import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiTool, ToolContext } from '../ai-core.types';

const SUMMARY_MAX = 140;

/**
 * search_recipes (E47-A4) — REAL, read-only.
 * Searches the public recipe catalog with the existing query pattern (title/description/ingredient
 * contains), restricted to `isPublic`. Returns small sanitized objects only — never full recipe JSON,
 * never invented recipes, no LLM.
 */
@Injectable()
export class SearchRecipesTool implements AiTool {
  readonly name = 'search_recipes';
  readonly description = 'Search the public recipe catalog by query text. Read-only.';
  readonly inputSchema = { query: 'string', limit: 'number?' };

  constructor(private readonly prisma: PrismaService) {}

  async handler(input: Record<string, unknown>, _ctx: ToolContext) {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
    if (query.length < 2) {
      return { tool: this.name, query, results: [], resultStatus: 'empty_query' };
    }
    let recipes: { id: string; title: string; description: string | null }[] = [];
    try {
      recipes = await this.prisma.recipe.findMany({
        where: {
          isPublic: true, status: 'active', // respect visibility + exclude unreviewed UGC (advisor audit)
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            // RecipeIngredient.name holds the Persian ingredient text (e.g. «ران مرغ») — `contains`
            // (substring), insensitive, so «مرغ» matches it.
            { ingredients: { some: { name: { contains: query, mode: 'insensitive' } } } },
          ],
        },
        take: limit,
        select: { id: true, title: true, description: true },
      });
    } catch {
      return { tool: this.name, query, results: [], resultStatus: 'unavailable' };
    }
    const results = recipes.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.description ? r.description.slice(0, SUMMARY_MAX) : null,
      matchedReason: r.title?.includes(query)
        ? 'title_match'
        : r.description?.includes(query)
          ? 'description_match'
          : 'ingredient_match',
    }));
    return { tool: this.name, query, results, resultStatus: results.length ? 'ok' : 'no_results' };
  }
}
