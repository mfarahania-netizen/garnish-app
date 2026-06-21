import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiTool, ToolContext } from '../ai-core.types';
import { norm, looseMatch, clampLimit } from './grounding-utils';

/**
 * suggest_pairings (E47-L4) — REAL, read-only, grounded in CORPUS CO-OCCURRENCE (not invention).
 *
 * Given an ingredient (or a recipe whose ingredients form the base set), returns ingredients that
 * factually appear ALONGSIDE it across Garnish recipes, ranked by how many recipes they co-occur in.
 * This is a factual retrieval statement ("appears together in N recipes"), NOT a flavor/taste claim
 * and NOT a nutrition claim — so it never fabricates a pairing the data doesn't support.
 *
 * Grounding & degradation (no fabrication):
 *   - no ingredient/recipe given        -> resultStatus 'empty_query'
 *   - base appears in too few recipes    -> resultStatus 'insufficient_data'
 *   - DB error                          -> resultStatus 'unavailable'
 */
@Injectable()
export class SuggestPairingsTool implements AiTool {
  readonly name = 'suggest_pairings';
  readonly description =
    'Suggest ingredients that factually co-occur with a given ingredient/recipe across the recipe corpus (co-occurrence, not a taste claim). Read-only.';
  readonly inputSchema = { ingredient: 'string?', recipeId: 'string?', limit: 'number?' };

  private static readonly SCAN_CAP = 300;
  private static readonly MIN_BASE_RECIPES = 2;

  constructor(private readonly prisma: PrismaService) {}

  async handler(input: Record<string, unknown>, _ctx: ToolContext) {
    const ingredient = norm(input.ingredient);
    const recipeId = typeof input.recipeId === 'string' ? input.recipeId.trim() : '';
    const limit = clampLimit(input.limit, 6, 12);

    if (!ingredient && !recipeId) {
      return { tool: this.name, base: null, pairings: [], resultStatus: 'empty_query' };
    }

    let recipes: { id: string; title: string; ingredients: { name: string }[] }[] = [];
    let baseNames: string[] = [];
    try {
      recipes = await this.prisma.recipe.findMany({
        where: { isPublic: true, status: 'active' }, // advisor audit: exclude unreviewed UGC
        take: SuggestPairingsTool.SCAN_CAP,
        select: { id: true, title: true, ingredients: { select: { name: true } } },
      });
      if (recipeId) {
        const base = recipes.find((r) => r.id === recipeId);
        if (!base) {
          return { tool: this.name, base: recipeId, pairings: [], resultStatus: 'recipe_not_found' };
        }
        baseNames = base.ingredients.map((i) => i.name).filter(Boolean);
      } else {
        baseNames = [ingredient];
      }
    } catch {
      return { tool: this.name, base: ingredient || recipeId, pairings: [], resultStatus: 'unavailable' };
    }

    const inBase = (name: string) => baseNames.some((b) => looseMatch(name, b));
    const baseRecipes = recipes.filter((r) => r.ingredients.some((i) => inBase(i.name)));

    if (baseRecipes.length < SuggestPairingsTool.MIN_BASE_RECIPES) {
      return {
        tool: this.name,
        base: recipeId || ingredient,
        baseRecipeCount: baseRecipes.length,
        pairings: [],
        note: 'دادهٔ کافی برای پیشنهاد هم‌نشینی معتبر وجود ندارد (این ماده در رسپی‌های کمی آمده).',
        resultStatus: 'insufficient_data',
      };
    }

    const counts = new Map<string, { name: string; count: number }>();
    for (const r of baseRecipes) {
      const seenInRecipe = new Set<string>();
      for (const i of r.ingredients) {
        if (inBase(i.name)) continue;
        const key = norm(i.name);
        if (!key || seenInRecipe.has(key)) continue;
        seenInRecipe.add(key);
        const cur = counts.get(key) ?? { name: i.name, count: 0 };
        cur.count += 1;
        counts.set(key, cur);
      }
    }

    const pairings = [...counts.values()]
      .filter((c) => c.count >= 1)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, limit)
      .map((c) => ({
        name: c.name,
        basis: 'co_occurrence' as const,
        coOccurringRecipes: c.count,
        reason: `در ${c.count} رسپی همراه «${recipeId || ingredient}» آمده است`,
      }));

    if (pairings.length === 0) {
      return {
        tool: this.name,
        base: recipeId || ingredient,
        baseRecipeCount: baseRecipes.length,
        pairings: [],
        note: 'هم‌نشین پرتکراری در داده‌ها پیدا نشد.',
        resultStatus: 'insufficient_data',
      };
    }

    return {
      tool: this.name,
      base: recipeId || ingredient,
      baseRecipeCount: baseRecipes.length,
      pairings,
      note: `${pairings.length} هم‌نشین پرتکرار از روی ${baseRecipes.length} رسپی گارنیش (بر پایهٔ هم‌آیی واقعی، نه ادعای طعم).`,
      resultStatus: 'ok',
    };
  }
}
