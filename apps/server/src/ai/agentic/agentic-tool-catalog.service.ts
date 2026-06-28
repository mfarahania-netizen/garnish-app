import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PUBLISHED_RECIPE_WHERE } from '../../recipes/recipe-visibility';
import { AgenticTool } from './agentic-loop.service';
import { SearchRecipesTool } from '../tools/search-recipes.tool';
import { SuggestSubstitutionsTool } from '../tools/suggest-substitutions.tool';
import { GetUserFoodContextTool } from '../tools/get-user-food-context.tool';
import { matchTroubleshooting } from '../chat/cooking-troubleshooting';
import { computeDishNutrition, buildDishInputs, DishDictRow } from '../../recipes/intelligence/dish-nutrition';

/**
 * The agentic brain's TOOL CATALOG (brain piece 3) — the read-only tools the model may call.
 *
 * Each entry is a curated ToolSpec (clear Persian descriptions drive good tool selection) wrapping the
 * real, already-tested handler — NOT a reimplementation. Every recipe read goes through the
 * PUBLISHED_RECIPE_WHERE publish gate (no pending/private UGC ever reaches the model). The HARD
 * allergy/pork gate still wraps the whole loop in the caller — these tools never decide safety.
 */
@Injectable()
export class AgenticToolCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchRecipesTool,
    private readonly substitutions: SuggestSubstitutionsTool,
    private readonly userContext: GetUserFoodContextTool,
  ) {}

  /** The ordered catalog handed to the agentic loop. */
  build(): AgenticTool[] {
    return [this.searchRecipes(), this.recipeDetails(), this.computeNutrition(), this.troubleshoot(), this.suggestSubstitutions(), this.getUserContext()];
  }

  /**
   * compute_nutrition — the deterministic «دقیق حساب کن» capability. Given a recipeId (from search_recipes),
   * compute the dish's per-serving macros from its OWN ingredients (source-locked per-100g × resolved grams,
   * via the gram-conversion layer) — the MODEL never does the math. Prefers the stored per-serving Nutrition
   * row (so it matches the meal-plan line), else live-computes. Surfaces numbers ONLY when the dish is FULLY
   * grounded; otherwise returns computable:false with an honest note (never a guessed/partial total). The
   * `line` is a ready-to-quote Persian sentence so the weak model reproduces the numbers verbatim.
   */
  private computeNutrition(): AgenticTool {
    return {
      spec: {
        name: 'compute_nutrition',
        description:
          'محاسبهٔ دقیقِ ارزشِ غذاییِ یک غذای کامل (کالری/پروتئین/کربوهیدرات/چربی هر پُرس) از روی موادِ همان دستور. recipeId را از نتایجِ search_recipes بده. وقتی کاربر می‌پرسد یک غذا چند کالری/چقدر پروتئین دارد، یا وقتی غذایی پیشنهاد دادی و باید «دقیق حساب» شود، این را صدا بزن. عددها را عیناً از خروجی (به‌ویژه فیلدِ line) بنویس و تغییر نده.',
        parameters: {
          type: 'object',
          properties: { recipeId: { type: 'string', description: 'id رسپی، از نتایجِ search_recipes' } },
          required: ['recipeId'],
        },
      },
      execute: async (args) => {
        const recipeId = String(args.recipeId ?? '').trim();
        if (!recipeId) return { error: 'recipeId لازم است' };
        return this.nutritionForRecipe(recipeId);
      },
    };
  }

  /** Load a published recipe + its dictionary and return its per-serving nutrition (stored-first, else computed). */
  private async nutritionForRecipe(recipeId: string): Promise<unknown> {
    let recipe: {
      id: string; title: string; servings: number | null; gris: unknown;
      nutrition: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null } | null;
      ingredients: { name: string; ingredientId: string | null; amount: string | null; unit: string | null }[];
    } | null;
    try {
      recipe = await this.prisma.recipe.findFirst({
        where: { id: recipeId, ...PUBLISHED_RECIPE_WHERE }, // publish gate
        select: {
          id: true, title: true, servings: true, gris: true,
          nutrition: { select: { calories: true, protein: true, carbs: true, fat: true, fiber: true } },
          ingredients: { select: { name: true, ingredientId: true, amount: true, unit: true } },
        },
      });
    } catch {
      return { computable: false, note: 'الان نتونستم محاسبه کنم.' };
    }
    if (!recipe) return { error: 'رسپی پیدا نشد یا عمومی نیست', recipeId };

    const macros = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
    let perServing: Record<string, number> | null = null;
    let servings = Number(recipe.servings) || 0;
    if (recipe.nutrition && recipe.nutrition.calories != null) {
      perServing = {};
      for (const m of macros) if (recipe.nutrition[m] != null) perServing[m] = Number(recipe.nutrition[m]);
    } else {
      const ids = recipe.ingredients.map((i) => i.ingredientId).filter((x): x is string => !!x);
      let dictRows: { id: string; nutritionPer100g: unknown; category: string | null; gramConversions: unknown }[] = [];
      try {
        dictRows = ids.length ? await this.prisma.ingredient.findMany({ where: { id: { in: ids } }, select: { id: true, nutritionPer100g: true, category: true, gramConversions: true } }) : [];
      } catch {
        return { computable: false, note: 'الان نتونستم محاسبه کنم.' };
      }
      const dictById = new Map<string, DishDictRow>(dictRows.map((d) => [d.id, { nutritionPer100g: d.nutritionPer100g, category: d.category, gramConversions: d.gramConversions }]));
      const built = buildDishInputs(recipe, dictById);
      servings = built.servings;
      const res = computeDishNutrition(built.inputs, built.servings);
      perServing = res.perServing;
    }
    if (!perServing || perServing.calories == null) {
      // honest refusal — the dish has an unquantified real-calorie ingredient we won't guess (the guard stays).
      return { recipeId, title: recipe.title, computable: false, note: `ارزشِ غذاییِ «${recipe.title}» را با اطمینان نمی‌توانم دقیق حساب کنم (دادهٔ مقدارِ یکی از موادش کامل نیست). عددِ ساختگی نمی‌دهم.` };
    }
    const fa = (n: number) => String(Math.round(n)).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
    const bits: string[] = [`${fa(perServing.calories)} کالری`];
    if (perServing.protein != null) bits.push(`${fa(perServing.protein)} گرم پروتئین`);
    if (perServing.carbs != null) bits.push(`${fa(perServing.carbs)} گرم کربوهیدرات`);
    if (perServing.fat != null) bits.push(`${fa(perServing.fat)} گرم چربی`);
    const line = `**${recipe.title}** — هر پُرس تقریباً ${bits.join('، ')}. (تخمینی بر پایهٔ موادِ دستور؛ نه توصیهٔ تغذیه‌ای/پزشکی.)`;
    return { recipeId, title: recipe.title, computable: true, servings, perServing, line };
  }

  private searchRecipes(): AgenticTool {
    return {
      spec: {
        name: 'search_recipes',
        description:
          'جستجوی رسپی‌های واقعیِ گارنیش بر اساس متن (نامِ غذا، ماده، یا معیار مثل «خورشت»، «بادمجان»، «شام سریع»). برای پیدا کردنِ هر غذا اول این را صدا بزن. خروجی فهرستی از رسپی‌ها با id و عنوان و خلاصه است.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'عبارتِ جستجو، مثل «خورشت بادمجان» یا «دسر سریع»' },
            limit: { type: 'number', description: 'حداکثر تعداد نتیجه (پیش‌فرض ۱۰)' },
          },
          required: ['query'],
        },
      },
      execute: (args, ctx) => this.search.handler(args, ctx),
    };
  }

  private recipeDetails(): AgenticTool {
    return {
      spec: {
        name: 'get_recipe_details',
        description:
          'گرفتنِ دستورِ کاملِ یک رسپی (موادِ لازم + مراحلِ پخت) با id آن. id را از نتایجِ search_recipes بردار. وقتی کاربر دستورِ کامل، مواد، یا مراحل را می‌خواهد این را صدا بزن.',
        parameters: {
          type: 'object',
          properties: { recipeId: { type: 'string', description: 'id رسپی، از نتایجِ search_recipes' } },
          required: ['recipeId'],
        },
      },
      execute: async (args) => {
        const recipeId = String(args.recipeId ?? '').trim();
        if (!recipeId) return { error: 'recipeId لازم است' };
        const r = await this.prisma.recipe.findFirst({
          where: { id: recipeId, ...PUBLISHED_RECIPE_WHERE }, // publish gate — never serve pending/private UGC
          select: {
            id: true,
            title: true,
            description: true,
            cookingTime: true,
            servings: true,
            ingredients: { select: { name: true, amount: true, unit: true }, orderBy: { order: 'asc' } },
            steps: { select: { instruction: true }, orderBy: { order: 'asc' } },
          },
        });
        if (!r) return { error: 'رسپی پیدا نشد یا عمومی نیست', recipeId };
        return {
          id: r.id,
          title: r.title,
          description: r.description,
          cookingTime: r.cookingTime,
          servings: r.servings,
          ingredients: r.ingredients.map((i) => [i.amount, i.unit, i.name].filter(Boolean).join(' ').trim()),
          steps: r.steps.map((s, idx) => `${idx + 1}. ${s.instruction}`),
        };
      },
    };
  }

  private troubleshoot(): AgenticTool {
    return {
      spec: {
        name: 'troubleshoot_cooking',
        description:
          'کمک برای یک مشکلِ حینِ پخت — وقتی غذای کاربر خراب شده یا می‌شود (مثل «کوبیده‌ام می‌ریزد»، «برنجم شفته شد»، «ته‌دیگ نچسبید»). علت + راه‌حلِ الان + پیشگیری می‌دهد. این برای رسپی‌خواستن نیست؛ فقط وقتی کاربر یک مشکل دارد.',
        parameters: {
          type: 'object',
          properties: {
            dish: { type: 'string', description: 'غذا یا ماده، مثل «کوبیده»، «برنج»، «ته‌دیگ»' },
            symptom: { type: 'string', description: 'مشکل، مثل «می‌ریزد»، «شفته شد»، «نچسبید»' },
          },
          required: ['dish', 'symptom'],
        },
      },
      execute: async (args) => {
        const hit = matchTroubleshooting(`${String(args.dish ?? '')} ${String(args.symptom ?? '')}`);
        if (!hit) return { found: false, note: 'برای این مشکلِ خاص نکتهٔ آماده نداریم؛ راهنماییِ کلیِ محتاطانه بده و از ادعای قطعی پرهیز کن.' };
        return { found: true, cause: hit.cause, fix: hit.fix, prevent: hit.prevent };
      },
    };
  }

  private suggestSubstitutions(): AgenticTool {
    return {
      spec: {
        name: 'suggest_substitutions',
        description: 'پیشنهادِ جایگزینِ یک ماده — وقتی کاربر می‌پرسد «به جای X چی بریزم؟» یا X را ندارد/نمی‌خواهد. آلرژی‌آگاه و فقط از فرهنگِ موادِ موجود.',
        parameters: {
          type: 'object',
          properties: { ingredient: { type: 'string', description: 'ماده‌ای که جایگزین می‌خواهد، مثل «شیر» یا «تخم‌مرغ»' } },
          required: ['ingredient'],
        },
      },
      execute: (args, ctx) => this.substitutions.handler(args, ctx),
    };
  }

  private getUserContext(): AgenticTool {
    return {
      spec: {
        name: 'get_user_context',
        description:
          'گرفتنِ پروفایلِ غذاییِ همین کاربر: آلرژی‌ها، چیزهایی که دوست ندارد، رژیم، و هدفش. وقتی می‌خواهی پیشنهاد را شخصی کنی یا مطمئن شوی چیزی برخلافِ محدودیتِ او نیست، اول این را صدا بزن. ورودی ندارد.',
        parameters: { type: 'object', properties: {} },
      },
      execute: (_args, ctx) => this.userContext.handler({}, ctx),
    };
  }
}
