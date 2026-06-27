import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PUBLISHED_RECIPE_WHERE } from '../../recipes/recipe-visibility';
import { FavoritesService } from '../../favorites/favorites.service';
import { ShoppingListService } from '../../shopping-list/shopping-list.service';
import { MealPlansService } from '../../meal-plans/meal-plans.service';
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
  ) {}

  build(): AgenticTool[] {
    return [
      this.addFavorite(),
      this.removeFavorite(),
      this.addRecipeToShoppingList(),
      this.addToMealPlan(),
      this.removeFromMealPlan(),
    ];
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
}
