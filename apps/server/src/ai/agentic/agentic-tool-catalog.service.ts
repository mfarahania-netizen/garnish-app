import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PUBLISHED_RECIPE_WHERE } from '../../recipes/recipe-visibility';
import { AgenticTool } from './agentic-loop.service';
import { SearchRecipesTool } from '../tools/search-recipes.tool';
import { SuggestSubstitutionsTool } from '../tools/suggest-substitutions.tool';
import { GetUserFoodContextTool } from '../tools/get-user-food-context.tool';
import { matchTroubleshooting } from '../chat/cooking-troubleshooting';

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
    return [this.searchRecipes(), this.recipeDetails(), this.troubleshoot(), this.suggestSubstitutions(), this.getUserContext()];
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
