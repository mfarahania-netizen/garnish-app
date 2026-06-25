import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AiTool, ToolContext } from '../ai-core.types';
import { foldPersian, tokenizeQuery } from './persian-search';

const SUMMARY_MAX = 140;

/**
 * search_recipes (E47-A4) — REAL, read-only.
 * Searches the public recipe catalog, restricted to `isPublic` + active. Returns small sanitized
 * objects only — never full recipe JSON, never invented recipes, no LLM.
 *
 * Retrieval is Persian-aware (E47 retrieval fix): a free question is tokenized into content terms
 * (ingredients/dish words) that are OR-matched over title/description/ingredient, then ranked by how
 * many distinct terms hit (title weighted highest). A bare keyword tokenizes to itself, so single-word
 * queries behave exactly as before. The hard allergy gate downstream is unchanged.
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

    const { terms } = tokenizeQuery(query);
    // OR-match each content term across title/description/ingredient name (substring, insensitive).
    // RecipeIngredient.name holds the Persian ingredient text (e.g. «ران مرغ»), so «مرغ» matches it.
    const or = terms.flatMap((t) => [
      { title: { contains: t, mode: 'insensitive' as const } },
      { description: { contains: t, mode: 'insensitive' as const } },
      { ingredients: { some: { name: { contains: t, mode: 'insensitive' as const } } } },
    ]);
    // Pull a window wider than `limit` so the relevance ranking has candidates to sort; capped small.
    const window = Math.min(Math.max(limit * 4, 24), 80);

    let recipes: {
      id: string;
      title: string;
      description: string | null;
      ingredients?: { name: string | null }[];
    }[] = [];
    try {
      recipes = await this.prisma.recipe.findMany({
        where: {
          isPublic: true,
          status: 'active', // respect visibility + exclude unreviewed UGC (advisor audit)
          OR: or,
        },
        take: window,
        select: {
          id: true,
          title: true,
          description: true,
          ingredients: { select: { name: true } },
        },
      });
    } catch {
      return { tool: this.name, query, results: [], resultStatus: 'unavailable' };
    }

    const ranked = recipes
      .map((r) => ({ r, ...scoreRecipe(r, terms) }))
      // STABLE sort by score desc; never drops rows (the WHERE clause already guaranteed a match in
      // production — a zero score only happens against artificial test doubles).
      .map((x, i) => ({ ...x, i }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, limit);

    const results = ranked.map(({ r, reason }) => ({
      id: r.id,
      title: r.title,
      summary: r.description ? r.description.slice(0, SUMMARY_MAX) : null,
      matchedReason: reason,
    }));
    return { tool: this.name, query, results, resultStatus: results.length ? 'ok' : 'no_results' };
  }
}

// Generic dish-CLASS words appear in dozens of titles, so a title match on them is a weak signal: «خورش قیمه»
// must let «قیمه» (the specific dish) outrank «خورش چغرتمه» (matched only on the class word «خورش»).
const GENERIC_DISH_WORDS = new Set(['خورش', 'خورشت', 'اش', 'آش', 'پلو', 'کباب', 'خوراک', 'سوپ', 'دمپخت', 'دمی', 'سالاد']);

/**
 * Relevance score + which field first matched. Order/weight: TITLE (dish is named after the term) >
 * INGREDIENT (the term is a real ingredient — what «با X چی بپزم» actually wants) > DESCRIPTION (the term
 * is only mentioned in prose — the weakest signal). Putting ingredient above description fixes the case
 * where «خورشت سیب» (mentions لپه in its blurb) out-ranked «کوفته تبریزی» (actually built on لپه). A title
 * match on a generic dish-class word («خورش») is weighted low so a specific dish word («قیمه») wins.
 */
function scoreRecipe(
  r: { title: string; description: string | null; ingredients?: { name: string | null }[] },
  terms: string[],
): { score: number; reason: 'title_match' | 'description_match' | 'ingredient_match' } {
  const title = foldPersian(r.title);
  const desc = foldPersian(r.description);
  const ingredients = (r.ingredients ?? []).map((ing) => foldPersian(ing?.name)).filter(Boolean);
  let score = 0;
  let titleHit = false;
  let ingredientHit = false;
  let descHit = false;
  for (const t of terms) {
    if (title.includes(t)) { score += GENERIC_DISH_WORDS.has(t) ? 1 : 3; titleHit = true; }
    else if (ingredients.some((n) => n.includes(t))) { score += 2; ingredientHit = true; }
    else if (desc.includes(t)) { score += 1; descHit = true; }
  }
  const reason = titleHit ? 'title_match' : ingredientHit ? 'ingredient_match' : descHit ? 'description_match' : 'title_match';
  return { score, reason };
}
