import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiTool, ToolContext } from '../ai-core.types';
import { norm, looseMatch, toStringArray, clampLimit } from './grounding-utils';

/**
 * match_pantry_recipes (E47-L4) — REAL, read-only, grounded in the recipe corpus.
 *
 * "What can I cook with what I have." Given the ingredients the user has on hand, rank cookable public
 * recipes by ingredient overlap. Deterministic and fully explainable: every result lists which of the
 * recipe's ingredients matched and which are still missing.
 *
 * Grounding & degradation (no fabrication — never invents a recipe or an ingredient):
 *   - empty pantry            -> resultStatus 'empty_pantry'
 *   - no recipe shares any item -> resultStatus 'no_match' (matches: [])
 *   - DB error                -> resultStatus 'unavailable'
 */
@Injectable()
export class MatchPantryRecipesTool implements AiTool {
  readonly name = 'match_pantry_recipes';
  readonly description =
    'Rank cookable public recipes by overlap with the ingredients the user has. Shows matched + missing ingredients. Read-only.';
  readonly inputSchema = { have: 'string[]', limit: 'number?' };

  private static readonly SCAN_CAP = 300;

  constructor(private readonly prisma: PrismaService) {}

  async handler(input: Record<string, unknown>, _ctx: ToolContext) {
    const have = toStringArray(input.have).map((s) => s.trim()).filter(Boolean);
    const limit = clampLimit(input.limit, 5, 20);
    const haveNorm = [...new Set(have.map(norm))].filter(Boolean);

    if (haveNorm.length === 0) {
      return { tool: this.name, have, matches: [], resultStatus: 'empty_pantry' };
    }

    let recipes: { id: string; title: string; ingredients: { name: string }[] }[] = [];
    try {
      recipes = await this.prisma.recipe.findMany({
        where: { isPublic: true, status: 'active' }, // advisor audit: exclude unreviewed UGC
        take: MatchPantryRecipesTool.SCAN_CAP,
        select: { id: true, title: true, ingredients: { select: { name: true } } },
      });
    } catch {
      return { tool: this.name, have, matches: [], resultStatus: 'unavailable' };
    }

    const scored = recipes
      .map((r) => {
        const ingNames = r.ingredients.map((i) => i.name).filter(Boolean);
        const total = ingNames.length;
        if (total === 0) return null;
        const matched: string[] = [];
        const missing: string[] = [];
        for (const ing of ingNames) {
          if (haveNorm.some((h) => looseMatch(ing, h))) matched.push(ing);
          else missing.push(ing);
        }
        const coverage = matched.length / total;
        return {
          recipeId: r.id,
          title: r.title,
          matchedCount: matched.length,
          totalCount: total,
          matched,
          missing,
          missingCount: missing.length,
          coveragePct: Math.round(coverage * 100),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.matchedCount > 0)
      // best coverage first; then fewest missing; stable by recipeId for determinism
      .sort(
        (a, b) =>
          b.coveragePct - a.coveragePct ||
          a.missingCount - b.missingCount ||
          a.recipeId.localeCompare(b.recipeId),
      );

    const matches = scored.slice(0, limit);
    return {
      tool: this.name,
      have: haveNorm,
      matches,
      scanned: recipes.length,
      note: matches.length
        ? `${matches.length} غذا با موادی که داری هم‌پوشانی دارد (از ${recipes.length} رسپی بررسی‌شده).`
        : 'با این مواد، غذای هم‌پوشانی‌داری در رسپی‌ها پیدا نشد.',
      resultStatus: matches.length ? 'ok' : 'no_match',
    };
  }
}
