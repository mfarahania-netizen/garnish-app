import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PUBLISHED_RECIPE_WHERE } from '../../recipes/recipe-visibility';
import { FavoritesService } from '../../favorites/favorites.service';
import { ShoppingListService } from '../../shopping-list/shopping-list.service';
import { MealPlansService } from '../../meal-plans/meal-plans.service';
import { TasteCorrectionService, TasteStance } from '../../behavior-engine/signals/taste-correction.service';
import { RecipeSafetyFilterService } from '../../recipes/intelligence/recipe-safety-filter.service';
import { AgenticTool } from './agentic-loop.service';

const fold = (s: unknown) => String(s ?? '').replace(/‌/g, '').replace(/\s+/g, '').trim();
// Week starts SATURDAY (date.utils.getStartOfWeek) → dayOfWeek 0=شنبه … 6=جمعه (standard Iranian week).
const DAY_MAP: Record<string, number> = { شنبه: 0, یکشنبه: 1, دوشنبه: 2, سهشنبه: 3, چهارشنبه: 4, پنجشنبه: 5, جمعه: 6 };
const MEAL_MAP: Record<string, string> = { صبحانه: 'breakfast', صبحونه: 'breakfast', ناهار: 'lunch', نهار: 'lunch', شام: 'dinner', میانوعده: 'snack', عصرانه: 'snack' };
/** «جمعه» or a 0-6 number → dayOfWeek; null when unrecognized. */
function normalizeDay(raw: unknown): number | null {
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
  return DAY_MAP[fold(raw)] ?? null;
}
/** «شام»/«dinner» → mealType enum; null when unrecognized. */
function normalizeMeal(raw: unknown): string | null {
  const f = fold(raw);
  if (['breakfast', 'lunch', 'dinner', 'snack'].includes(f.toLowerCase())) return f.toLowerCase();
  return MEAL_MAP[f] ?? null;
}

// Peel a quantity off a free shopping item (founder hit: «دو کیلو سبزی خوردن» was stored as the literal name
// «سبزی خوردن دو کیلو» — the model treated the amount as part of the name). Deterministic, so it doesn't depend on
// the weak model parsing it. «دو کیلو سبزی خوردن» → {name:'سبزی خوردن', amount:'دو کیلو'}; «خیار» → {name:'خیار'}.
const QTY_WORDS = 'یک|یه|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده|نیم|ربع|چند|چندتا';
const QTY_UNITS = 'کیلوگرمی|کیلوگرم|کیلو|گرمی|گرم|تایی|تا|عددی|عدد|بسته‌ای|بسته|شیشه|قوطی|حلب|لیتری|لیتر|بطری|فنجان|قاشق|پیمانه|کیسه|پاکت|مثقال';
// peel an orphan unit the model sometimes leaves in the name when it drops the number («کیلو موز» → «موز»).
const stripOrphanUnit = (name: string): string => name.replace(new RegExp(`^(?:${QTY_UNITS})\\s+`), '').replace(new RegExp(`\\s+(?:${QTY_UNITS})$`), '').trim();
function splitQuantity(raw: string): { name: string; amount?: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { name: s };
  const digit = '[\\d۰-۹]+(?:[.,٫][\\d۰-۹]+)?';
  const qty = `(?:${digit}|${QTY_WORDS})(?:\\s*(?:${QTY_UNITS}))?`;
  let m = s.match(new RegExp(`^(${qty})\\s+(.{2,})$`)); // leading: «۵۰۰ گرم گوشت چرخ‌کرده»
  if (m) return { name: stripOrphanUnit(m[2].trim()) || m[2].trim(), amount: m[1].trim() };
  m = s.match(new RegExp(`^(.{2,}?)\\s+(${qty})$`)); // trailing: «سبزی خوردن دو کیلو»
  if (m && new RegExp(`${digit}|${QTY_UNITS}`).test(m[2])) return { name: stripOrphanUnit(m[1].trim()) || m[1].trim(), amount: m[2].trim() };
  return { name: stripOrphanUnit(s) || s };
}

/**
 * Agentic WRITE-ACTION tools (brain phase B) — the assistant DOES things, not just talks.
 *
 * SAFETY TIER (per the 2026-06-27 research, AI_ASSISTANT_TARGET_DESIGN.md): these are REVERSIBLE actions
 * (favorite, shopping-list add) → auto-execute, no confirmation (blanket confirms cause fatigue); the UI
 * offers undo. They act ONLY on the CURRENT user's own data (ctx.userId) and reuse the real, audited write
 * services (FavoritesService's publish-gate; ShoppingListService). CONSEQUENTIAL/health writes (add/remove
 * ALLERGY) are NOT here — they need the explicit request-restating confirm flow and land in a later increment.
 */
@Injectable()
export class AgenticWriteToolsService {
  private readonly logger = new Logger('AgenticWriteToolsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly favorites: FavoritesService,
    private readonly shoppingList: ShoppingListService,
    private readonly mealPlans: MealPlansService,
    private readonly taste: TasteCorrectionService,
    private readonly safety: RecipeSafetyFilterService,
  ) {}

  /**
   * HARD allergy/pork gate for WRITE-actions (audit P1): a recipe the safety filter would DROP must never be
   * persisted into the user's plan/favorites/shopping-list — the gate has to wrap WRITES, not just the read tools.
   * safeIds is the SAME audited primitive the read path uses and is fail-closed (recipe unsafe OR profile unloadable
   * → []), satisfying the non-negotiable invariant.
   */
  private async recipeIsSafe(userId: string, recipeId: string): Promise<boolean> {
    try {
      const safe = await this.safety.safeIds(userId, [recipeId]);
      return safe.length > 0;
    } catch {
      return false; // fail-closed: any error → treat as unsafe, never persist
    }
  }

  build(): AgenticTool[] {
    return [
      this.addFavorite(),
      this.removeFavorite(),
      this.addItemsToShoppingList(),
      this.removeItemsFromShoppingList(),
      this.getShoppingList(),
      this.addRecipeToShoppingList(),
      this.addWeekToShoppingList(),
      this.addToMealPlan(),
      this.removeFromMealPlan(),
      this.fillWeekPlan(),
      this.fillMealSlots(),
      this.setIngredientTaste(),
    ];
  }

  /**
   * Fill the WHOLE week's plan in ONE deterministic call (founder hit: "برنامهٔ هفته رو بچین" made the model
   * over-clarify «چند وعده؟» forever then emit a FAKE markdown table that was never saved — because the only
   * meal-plan tool placed ONE slot and 7×3 slots can't be done in the loop's iteration budget). Delegates to the
   * audited MealPlansService.generateSmartPlan (diet/skill/budget aware + the HARD allergy/pork safety filter),
   * which REPLACES the week with real, saved slots. The model then renders the returned week + offers the list.
   */
  private fillWeekPlan(): AgenticTool {
    return {
      spec: {
        name: 'fill_week_plan',
        description: 'چیدنِ یک‌بارهٔ کلِ برنامهٔ غذاییِ هفته — همهٔ روزها و وعده‌ها — به‌صورتِ خودکار و متناسب با رژیم/مهارت/بودجه و آلرژیِ کاربر. وقتی گفت «برنامهٔ هفته‌ام رو بچین»، «یه برنامهٔ هفتگی بساز»، «همه‌ی وعده‌ها رو بچین»، یا «برنامهٔ این هفته‌ام رو کامل کن». تعدادِ وعده را هرگز نپرس — همه را پر می‌کند و کاربر بعداً می‌تواند هر وعده را با add/remove جابه‌جا کند. آرگومان لازم ندارد.',
        parameters: { type: 'object', properties: {} },
      },
      execute: async (_args, ctx) => {
        try {
          const plan = await this.mealPlans.generateSmartPlan(ctx.userId);
          const slots = (plan?.slots ?? []) as Array<{ dayOfWeek: number; mealType: string; recipe?: { title?: string } | null }>;
          const placed = slots.filter((s) => s.recipe?.title).length;
          if (!placed) return { error: 'الان نتونستم برنامه رو بچینم (شاید با محدودیت‌های غذاییت گزینهٔ کافی نبود). می‌تونی چند غذا رو دستی بذاری.' };
          const DAY = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
          const week = DAY.map((day, d) => ({
            day,
            meals: slots.filter((s) => s.dayOfWeek === d && s.recipe?.title).map((s) => ({ meal: s.mealType, dish: s.recipe!.title })),
          })).filter((x) => x.meals.length);
          return { ok: true, action: 'fill_week_plan', placed, week, note: 'کلِ برنامهٔ هفته چیده و ذخیره شد. می‌تونی هر وعده رو جابه‌جا/عوض کنی، یا بگو لیستِ خریدش رو بسازم.' };
        } catch (e) {
          this.logger.warn(`fill_week_plan failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'چیدنِ برنامهٔ هفته الان ممکن نشد.' };
        }
      },
    };
  }

  /**
   * Fill a SPECIFIC set of (day, meal) slots with the system's own safe Persian-first picks — NOT the whole week
   * (founder: «فردا صبحانه و شام + پس‌فردا ۳ وعده بچین» wrongly regenerated everything). Delegates to the audited
   * MealPlansService.fillSlots (HARD safety filter + per-slot addMealSlot; the rest of the week is untouched).
   */
  private fillMealSlots(): AgenticTool {
    return {
      spec: {
        name: 'fill_meal_slots',
        description: 'پر کردنِ چند خانهٔ مشخصِ برنامه (روز+وعده) با غذای منتخبِ خودِ سیستم — وقتی کاربر چند وعدهٔ معین را «به سلیقهٔ خودت بچین» خواست (مثلِ «فردا صبحانه و شام و پس‌فردا هر سه وعده»). بقیهٔ هفته دست‌نخورده می‌ماند. برای «کلِ هفته» این نیست؛ fill_week_plan را بزن.',
        parameters: {
          type: 'object',
          properties: {
            slots: { type: 'array', description: 'فهرستِ خانه‌ها', items: { type: 'object', properties: { day: { type: 'string', description: 'روزِ هفته: شنبه…جمعه' }, mealType: { type: 'string', description: 'صبحانه/ناهار/شام' }, dish: { type: 'string', description: 'اگر کاربر برای این خانه غذای مشخص یا قید گفت (مثلِ «شیرین پلو» یا «املت»)؛ وگرنه خالی → سیستم خودش انتخاب می‌کند' } } } },
          },
          required: ['slots'],
        },
      },
      execute: async (args, ctx) => {
        const raw = Array.isArray((args as { slots?: unknown })?.slots) ? ((args as { slots: unknown[] }).slots) : [];
        const norm: { dayOfWeek: number; mealType: string; dish?: string }[] = [];
        for (const s of raw) {
          const dow = normalizeDay((s as { day?: unknown; dayOfWeek?: unknown })?.day ?? (s as { dayOfWeek?: unknown })?.dayOfWeek);
          const mt = normalizeMeal((s as { mealType?: unknown; meal?: unknown })?.mealType ?? (s as { meal?: unknown })?.meal);
          if (dow === null || !mt) continue;
          norm.push({ dayOfWeek: dow, mealType: mt, dish: String((s as { dish?: unknown })?.dish ?? '').trim() || undefined });
        }
        if (!norm.length) return { error: 'خانه‌ها (روز و وعده) مشخص نشد.' };
        try {
          const filled = await this.mealPlans.fillSlots(ctx.userId, norm);
          if (!filled.length) return { error: 'الان نتونستم این خانه‌ها رو پر کنم (شاید با محدودیت‌های غذاییت گزینهٔ کافی نبود).' };
          return { ok: true, action: 'fill_meal_slots', filled };
        } catch (e) {
          this.logger.warn(`fill_meal_slots failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'پر کردنِ خانه‌ها الان ممکن نشد.' };
        }
      },
    };
  }

  /**
   * USER-MODEL write (the "feeling-known" pillar) — record the user's stated taste for one ingredient so the
   * recommender reflects it. Delegates to the audited TasteCorrectionService: a SOFT, signed signal the FI-2.3
   * ranker already reads (re-ranks, NEVER excludes) — explicitly NOT the allergy hard gate. Fully reversible
   * (stance='neutral' clears it). The free name is resolved to a REAL dictionary ingredient first (the service
   * also rejects an unknown id), so the model can never write a taste signal for a non-existent ingredient.
   * Allergy is deliberately NOT here — allergy statements are owned by the deterministic §3 confirm-then-write
   * flow (a safer explicit-confirm path), so routing them here would be redundant and less safe.
   */
  private setIngredientTaste(): AgenticTool {
    return {
      spec: {
        name: 'set_ingredient_taste',
        description: 'ثبتِ سلیقهٔ کاربر دربارهٔ یک ماده تا در پیشنهادها لحاظ شود. stance=dislike وقتی گفت «X دوست ندارم/خوشم نمیاد»؛ stance=like وقتی گفت «عاشقِ Xم/X دوست دارم»؛ stance=neutral وقتی گفت «دیگه برام مهم نیست». این سلیقهٔ نرم است (رتبه‌بندی را جابه‌جا می‌کند، چیزی را حذف نمی‌کند) و ربطی به آلرژی ندارد — برای آلرژی این را صدا نزن.',
        parameters: {
          type: 'object',
          properties: {
            ingredient: { type: 'string', description: 'نامِ ماده، مثلِ «بادمجان»، «گردو»، «عدس»' },
            stance: { type: 'string', enum: ['like', 'dislike', 'neutral'], description: 'like=دوست دارد، dislike=دوست ندارد، neutral=بی‌تفاوت/پاک‌کردنِ نظرِ قبلی' },
          },
          required: ['ingredient', 'stance'],
        },
      },
      execute: async (args, ctx) => {
        const name = String(args?.ingredient ?? '').trim();
        const stance = String(args?.stance ?? '').trim().toLowerCase();
        if (!name) return { error: 'نامِ ماده مشخص نیست؛ از کاربر بپرس کدام ماده.' };
        if (!['like', 'dislike', 'neutral'].includes(stance)) return { error: 'نظر باید like، dislike یا neutral باشد.' };
        const ing = await this.resolveIngredientByName(name);
        if (!ing) return { error: `«${name}» را در فهرستِ موادِ ما پیدا نکردم؛ نتونستم سلیقه‌اش رو ثبت کنم.` };
        try {
          const res = await this.taste.correctTastePreference(ctx.userId, ing.id, stance as TasteStance);
          if (!res?.ok) return { error: 'ثبتِ سلیقه ممکن نشد.' };
          const verb = stance === 'like' ? 'دوست داری' : stance === 'dislike' ? 'دوست نداری' : 'برات بی‌تفاوت شد';
          return {
            ok: true,
            action: 'set_ingredient_taste',
            ingredient: ing.name,
            stance,
            note: `یادم می‌مونه که «${ing.name}» رو ${verb}؛ از این به بعد توی پیشنهادها لحاظش می‌کنم.`,
            undoHint: 'هر وقت نظرت عوض شد بهم بگو.',
          };
        } catch (e) {
          this.logger.warn(`set_ingredient_taste failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'ثبتِ سلیقه الان ممکن نشد.' };
        }
      },
    };
  }

  /** Resolve a free Persian/English ingredient mention to a REAL dictionary ingredient (exact → prefix → shortest). */
  private async resolveIngredientByName(name: string): Promise<{ id: string; name: string } | null> {
    const n = name.trim();
    if (!n) return null;
    const rows = await this.prisma.ingredient.findMany({
      where: { OR: [{ nameFa: { contains: n } }, { nameEn: { contains: n } }] },
      take: 15,
      select: { id: true, nameFa: true, nameEn: true },
    });
    if (!rows.length) return null;
    const byLen = [...rows].sort((a, b) => (fold(a.nameFa).length || 9999) - (fold(b.nameFa).length || 9999));
    // exact fold-match wins; else the SHORTEST name containing the term — the most generic base ingredient
    // («گردو» → «گردو خام», not «گردوی پکان خام»). First-prefix was order-dependent and picked variants.
    const exact = byLen.find((r) => fold(r.nameFa) === fold(n) || (r.nameEn && r.nameEn.trim().toLowerCase() === n.toLowerCase()));
    const best = exact || byLen[0];
    return { id: best.id, name: best.nameFa || best.nameEn || best.id };
  }

  /**
   * FLAGSHIP WORKFLOW (the ChatGPT-can't-do moment): build the shopping list from the user's WHOLE current-week
   * meal plan in one shot. Delegates to ShoppingListService.buildFromPlan — which aggregates ingredients across
   * every planned recipe, merges duplicates by dictionary id, scales by household size, categorizes, and de-dupes
   * against what's already listed (idempotent; manual/checked items preserved). No per-recipe LLM chaining → no
   * dropped items. Reads the same Saturday-first week as add_to_meal_plan, so a just-placed plan is included.
   */
  private addWeekToShoppingList(): AgenticTool {
    return {
      spec: {
        name: 'add_week_to_shopping_list',
        description: 'ساختنِ لیستِ خرید از کلِ برنامهٔ غذاییِ این هفتهٔ کاربر — موادِ همهٔ غذاهای برنامه را یک‌جا (با ادغامِ تکراری‌ها و اندازه به تعدادِ نفرات) به لیستِ خرید اضافه می‌کند. وقتی کاربر گفت «لیستِ خریدِ هفته رو بساز» یا بعد از چیدنِ برنامه پیشنهادِ ساختِ لیست را پذیرفت. با برنامهٔ فعلی کار می‌کند و آرگومان لازم ندارد؛ تک‌تکِ رسپی‌ها را جدا اضافه نکن.',
        parameters: { type: 'object', properties: {} },
      },
      execute: async (_args, ctx) => {
        try {
          const res = await this.shoppingList.buildFromPlan(ctx.userId);
          if (res.resultStatus === 'no_plan') {
            return { error: 'برنامهٔ غذاییِ این هفته خالی است؛ اول چند غذا در برنامه بگذار، بعد لیستِ خرید را می‌سازم.' };
          }
          if (res.added === 0) {
            return { ok: true, action: 'add_week_to_shopping_list', added: 0, note: 'همهٔ موادِ برنامه از قبل در لیستِ خرید بود؛ چیزِ تازه‌ای اضافه نشد.' };
          }
          return {
            ok: true,
            action: 'add_week_to_shopping_list',
            added: res.added,
            merged: res.merged,
            householdSize: res.householdSize,
            undoHint: 'از صفحهٔ لیستِ خرید قابلِ تغییر/حذف است.',
          };
        } catch (e) {
          this.logger.warn(`add_week_to_shopping_list failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'ساختنِ لیستِ خرید از برنامه الان ممکن نشد.' };
        }
      },
    };
  }

  private removeFromMealPlan(): AgenticTool {
    return {
      spec: {
        name: 'remove_from_meal_plan',
        description: 'برداشتنِ غذای یک روز و وعده از برنامهٔ غذاییِ کاربر (هرچه در آن خانه باشد). وقتی گفت «دوشنبه نهار رو حذف کن». برای «جابه‌جا کردن» اول این را برای روزِ قدیم صدا بزن، بعد add_to_meal_plan را برای روزِ جدید.',
        parameters: {
          type: 'object',
          properties: {
            day: { type: 'string', description: 'روزِ هفته: شنبه … جمعه' },
            mealType: { type: 'string', description: 'وعده: صبحانه، ناهار، یا شام' },
          },
          required: ['day', 'mealType'],
        },
      },
      execute: async (args, ctx) => {
        const dayNum = normalizeDay(args?.day);
        const meal = normalizeMeal(args?.mealType);
        if (dayNum === null) return { error: 'روزِ هفته مشخص نیست؛ از کاربر بپرس کدام روز.' };
        if (!meal) return { error: 'وعده مشخص نیست؛ از کاربر بپرس صبحانه، ناهار یا شام.' };
        try {
          await this.mealPlans.removeMealSlot(ctx.userId, dayNum, meal);
          return { ok: true, action: 'remove_from_meal_plan', day: String(args?.day ?? ''), mealType: meal };
        } catch (e) {
          this.logger.warn(`remove_from_meal_plan failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'برداشتن از برنامهٔ غذایی الان ممکن نشد.' };
        }
      },
    };
  }

  private removeFavorite(): AgenticTool {
    return {
      spec: {
        name: 'remove_favorite',
        description: 'برداشتنِ یک رسپی از علاقه‌مندی‌های کاربر. وقتی گفت «این رو از علاقه‌مندی‌هام بردار». recipeId را از نتایجِ search_recipes بردار.',
        parameters: {
          type: 'object',
          properties: { recipeId: { type: 'string', description: 'id رسپی' } },
          required: ['recipeId'],
        },
      },
      execute: async (args, ctx) => {
        const recipeId = String(args?.recipeId ?? '').trim();
        if (!recipeId) return { error: 'recipeId لازم است' };
        try {
          await this.favorites.removeFavorite(ctx.userId, recipeId);
          return { ok: true, action: 'remove_favorite', recipeId };
        } catch (e) {
          this.logger.warn(`remove_favorite failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'برداشتن از علاقه‌مندی‌ها الان ممکن نشد.' };
        }
      },
    };
  }

  private addToMealPlan(): AgenticTool {
    return {
      spec: {
        name: 'add_to_meal_plan',
        description: 'گذاشتنِ یک رسپی در برنامهٔ غذاییِ هفتهٔ کاربر، برای یک روز و وعدهٔ مشخص. وقتی کاربر گفت «جمعه شام ته‌چین بذار». recipeId را از نتایجِ search_recipes بردار.',
        parameters: {
          type: 'object',
          properties: {
            recipeId: { type: 'string', description: 'id رسپی از نتایجِ جستجو' },
            day: { type: 'string', description: 'روزِ هفته به فارسی: شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه، پنجشنبه، یا جمعه' },
            mealType: { type: 'string', description: 'وعده: صبحانه، ناهار، یا شام' },
          },
          required: ['recipeId', 'day', 'mealType'],
        },
      },
      execute: async (args, ctx) => {
        const recipeId = String(args?.recipeId ?? '').trim();
        const dayNum = normalizeDay(args?.day);
        const meal = normalizeMeal(args?.mealType);
        if (!recipeId) return { error: 'recipeId لازم است' };
        if (dayNum === null) return { error: 'روزِ هفته مشخص نیست؛ از کاربر بپرس کدام روز (شنبه تا جمعه).' };
        if (!meal) return { error: 'وعده مشخص نیست؛ از کاربر بپرس صبحانه، ناهار یا شام.' };
        if (!(await this.recipeIsSafe(ctx.userId, recipeId))) return { error: 'این رسپی با محدودیتِ غذاییت (آلرژی) سازگار نیست؛ نمی‌تونم در برنامه بذارمش.' };
        try {
          await this.mealPlans.addMealSlot(ctx.userId, dayNum, meal, recipeId); // publish-gated inside the service
          const r = await this.prisma.recipe.findFirst({ where: { id: recipeId, ...PUBLISHED_RECIPE_WHERE }, select: { title: true } });
          return { ok: true, action: 'add_to_meal_plan', recipe: r?.title ?? recipeId, day: String(args?.day ?? ''), mealType: meal, undoHint: 'از صفحهٔ برنامهٔ غذایی قابلِ تغییر/حذف است.' };
        } catch (e) {
          this.logger.warn(`add_to_meal_plan failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'گذاشتن در برنامهٔ غذایی الان ممکن نشد.' };
        }
      },
    };
  }

  private addFavorite(): AgenticTool {
    return {
      spec: {
        name: 'add_favorite',
        description: 'ذخیرهٔ یک رسپی در علاقه‌مندی‌های کاربر. وقتی کاربر گفت «این رو ذخیره کن»/«به علاقه‌مندی‌هام اضافه کن». recipeId را از نتایجِ search_recipes بردار.',
        parameters: {
          type: 'object',
          properties: { recipeId: { type: 'string', description: 'id رسپی از نتایجِ جستجو' } },
          required: ['recipeId'],
        },
      },
      execute: async (args, ctx) => {
        const recipeId = String(args?.recipeId ?? '').trim();
        if (!recipeId) return { error: 'recipeId لازم است' };
        if (!(await this.recipeIsSafe(ctx.userId, recipeId))) return { error: 'این رسپی با محدودیتِ غذاییت (آلرژی) سازگار نیست؛ نمی‌تونم ذخیره‌اش کنم.' };
        try {
          await this.favorites.addFavorite(ctx.userId, recipeId); // idempotent + publish-gated inside the service
          const r = await this.prisma.recipe.findFirst({ where: { id: recipeId, ...PUBLISHED_RECIPE_WHERE }, select: { title: true } });
          return { ok: true, action: 'add_favorite', saved: r?.title ?? recipeId, undoHint: 'کاربر می‌تواند از صفحهٔ علاقه‌مندی‌ها حذفش کند.' };
        } catch (e) {
          this.logger.warn(`add_favorite failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'این رسپی برای ذخیره در دسترس نیست.' };
        }
      },
    };
  }

  private addRecipeToShoppingList(): AgenticTool {
    return {
      spec: {
        name: 'add_recipe_to_shopping_list',
        description: 'افزودنِ موادِ لازمِ یک رسپی به لیستِ خریدِ کاربر. وقتی کاربر گفت «موادِ این رو بریز تو لیستِ خرید». recipeId را از نتایجِ search_recipes بردار.',
        parameters: {
          type: 'object',
          properties: { recipeId: { type: 'string', description: 'id رسپی از نتایجِ جستجو' } },
          required: ['recipeId'],
        },
      },
      execute: async (args, ctx) => {
        const recipeId = String(args?.recipeId ?? '').trim();
        if (!recipeId) return { error: 'recipeId لازم است' };
        if (!(await this.recipeIsSafe(ctx.userId, recipeId))) return { error: 'این رسپی با محدودیتِ غذاییت (آلرژی) سازگار نیست؛ موادشو به لیست اضافه نمی‌کنم.' };
        const r = await this.prisma.recipe.findFirst({
          where: { id: recipeId, ...PUBLISHED_RECIPE_WHERE }, // publish-gate — never pull a private/pending recipe
          select: { title: true, ingredients: { select: { name: true, amount: true, unit: true }, orderBy: { order: 'asc' } } },
        });
        if (!r) return { error: 'رسپی پیدا نشد یا عمومی نیست.' };
        const items = (r.ingredients ?? [])
          .map((i) => ({ name: String(i.name ?? '').trim(), amount: i.amount ?? undefined, unit: i.unit ?? undefined }))
          .filter((i) => i.name);
        if (!items.length) return { error: 'موادی برای افزودن پیدا نشد.' };
        try {
          await this.shoppingList.addItems(ctx.userId, items);
          return { ok: true, action: 'add_recipe_to_shopping_list', recipe: r.title, added: items.length, undoHint: 'کاربر می‌تواند از صفحهٔ لیستِ خرید آیتم‌ها را بردارد.' };
        } catch (e) {
          this.logger.warn(`add_recipe_to_shopping_list failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'افزودن به لیستِ خرید الان ممکن نشد.' };
        }
      },
    };
  }

  /**
   * Add one or more FREE, standalone items to the shopping list (founder hit live: «خیار رو به لیست خرید اضافه کن»
   * was refused because the only shopping tools added a whole RECIPE's ingredients — there was no plain "add this
   * item" path, which is the most basic shopping-list operation). No recipe + no allergy gate: it's a user-initiated
   * note on their own list (they may buy anything), not a recommendation. Reuses the audited ShoppingListService.addItems
   * (dedupe/merge/categorize live in the service).
   */
  private addItemsToShoppingList(): AgenticTool {
    return {
      spec: {
        name: 'add_items_to_shopping_list',
        description: 'افزودنِ یک یا چند مادهٔ مشخص (دلخواه) به لیستِ خریدِ کاربر — وقتی گفت «خیار رو به لیستِ خرید اضافه کن» یا «ماست و نون و تخم‌مرغ بذار تو لیستِ خرید». این برای موادِ تکیِ آزاد است، نه موادِ یک رسپی (برای آن add_recipe_to_shopping_list). نامِ مواد را همان‌طور که کاربر گفت بنویس؛ خودت رسپی پیدا نکن.',
        parameters: {
          type: 'object',
          properties: {
            items: { type: 'array', items: { type: 'string' }, description: 'فهرستِ نامِ مواد، مثلاً ["خیار"] یا ["ماست","نون","تخم‌مرغ"]' },
          },
          required: ['items'],
        },
      },
      execute: async (args, ctx) => {
        const src = (args as { items?: unknown; item?: unknown })?.items ?? (args as { item?: unknown })?.item ?? [];
        const rawList = Array.isArray(src) ? src : [src];
        const items = rawList.map((s) => splitQuantity(String(s ?? ''))).filter((i) => i.name); // peel «دو کیلو» off the name
        if (!items.length) return { error: 'هیچ ماده‌ای مشخص نشد؛ از کاربر بپرس چی به لیست اضافه کنه.' };
        try {
          await this.shoppingList.addItems(ctx.userId, items);
          const names = items.map((i) => (i.amount ? `${i.name} (${i.amount})` : i.name));
          return { ok: true, action: 'add_items_to_shopping_list', added: names, note: `به لیستِ خرید اضافه شد: ${names.join('، ')}.`, undoHint: 'از صفحهٔ لیستِ خرید قابلِ حذف است.' };
        } catch (e) {
          this.logger.warn(`add_items_to_shopping_list failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'افزودن به لیستِ خرید الان ممکن نشد.' };
        }
      },
    };
  }

  /**
   * Remove item(s) from the shopping list by name (founder battery: «خیار رو از لیست خرید حذف کن» did nothing — there
   * was an add tool but NO remove tool). Reads the user's list, matches by folded contains (so «خیار» hits the stored
   * «خیار»), and removes via the audited ShoppingListService.removeItem (owner-checked by userId).
   */
  private removeItemsFromShoppingList(): AgenticTool {
    return {
      spec: {
        name: 'remove_items_from_shopping_list',
        description: 'برداشتنِ یک یا چند ماده از لیستِ خریدِ کاربر — وقتی گفت «خیار رو از لیستِ خرید بردار/حذف کن» یا «ماست و نون رو از لیست پاک کن». نامِ مواد را همان‌طور که گفت بنویس.',
        parameters: {
          type: 'object',
          properties: { items: { type: 'array', items: { type: 'string' }, description: 'نامِ موادی که باید از لیست حذف شوند' } },
          required: ['items'],
        },
      },
      execute: async (args, ctx) => {
        const src = (args as { items?: unknown; item?: unknown })?.items ?? (args as { item?: unknown })?.item ?? [];
        const names = (Array.isArray(src) ? src : [src]).map((s) => fold(s)).filter(Boolean);
        if (!names.length) return { error: 'مشخص نشد چی رو از لیست حذف کنم.' };
        try {
          const list = await this.shoppingList.getList(ctx.userId);
          const removed: string[] = [];
          for (const it of (list?.items ?? []) as { id: string; name: string }[]) {
            const itName = fold(it.name);
            // EXACT folded match only (B4): bidirectional substring over-deleted — «نون» wiped «نون خامه‌ای». Precise
            // beats greedy for a destructive op; if nothing matches, the tool honestly says so and the user can refine.
            if (itName && names.some((n) => itName === n)) {
              await this.shoppingList.removeItem(it.id, ctx.userId); // owner-checked inside the service
              removed.push(it.name);
            }
          }
          if (!removed.length) return { ok: true, action: 'remove_items_from_shopping_list', removed: [], note: 'چیزی با این نام تو لیستِ خرید نبود.' };
          return { ok: true, action: 'remove_items_from_shopping_list', removed, note: `از لیستِ خرید حذف شد: ${removed.join('، ')}.` };
        } catch (e) {
          this.logger.warn(`remove_items_from_shopping_list failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'حذف از لیستِ خرید الان ممکن نشد.' };
        }
      },
    };
  }

  /** Read the user's current shopping list (founder battery: «تو لیست خریدم چی هست؟» → «دسترسی ندارم»; there was no read tool). */
  private getShoppingList(): AgenticTool {
    return {
      spec: {
        name: 'get_shopping_list',
        description: 'خواندنِ لیستِ خریدِ فعلیِ کاربر و گفتنِ محتویاتش — وقتی پرسید «تو لیستِ خریدم چی هست؟»، «لیستِ خریدمو نشون بده»، «چی باید بخرم؟». آرگومان لازم ندارد.',
        parameters: { type: 'object', properties: {} },
      },
      execute: async (_args, ctx) => {
        try {
          const list = await this.shoppingList.getList(ctx.userId);
          const items = ((list?.items ?? []) as { name: string; amount?: string | null }[])
            .map((i) => ({ name: i.name, amount: i.amount ?? undefined }))
            .filter((i) => i.name);
          return { ok: true, action: 'get_shopping_list', count: items.length, items, note: items.length ? '' : 'لیستِ خرید فعلاً خالیه.' };
        } catch (e) {
          this.logger.warn(`get_shopping_list failed: ${e instanceof Error ? e.message : String(e)}`);
          return { error: 'خواندنِ لیستِ خرید الان ممکن نشد.' };
        }
      },
    };
  }
}
