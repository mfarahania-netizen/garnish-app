import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PUBLISHED_RECIPE_WHERE } from '../../recipes/recipe-visibility';
import { FavoritesService } from '../../favorites/favorites.service';
import { ShoppingListService } from '../../shopping-list/shopping-list.service';
import { AgenticTool } from './agentic-loop.service';

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
  ) {}

  build(): AgenticTool[] {
    return [this.addFavorite(), this.addRecipeToShoppingList()];
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
