/**
 * RecipeSearchService (GARNISH-SEARCH-L4-08) — deterministic semantic search + "similar recipes".
 *
 * Builds a TF-IDF index over the live recipe corpus (cached), serves meaning-aware search + nearest-
 * neighbor "similar recipes" with explainable WHY. Optional personalized re-rank REUSES the canonical
 * unified profile (getLivingUserProfile) + the S07 recipe-fit (assessRecipeFit) — no parallel
 * recommender, no runtime-shadow coupling. Declared allergies are a HARD safety filter: an
 * allergen-conflicting recipe is never surfaced as a top "for you" hit without a clear caution.
 *
 * NO live-AI, NO external API, NO vector DB, NO new dependency.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfileReadService } from '../../behavior-engine/profile/read/profile-read.service';
import { searchIndex } from './tfidf';
import { RecipeContentFeatureStore } from './recipe-content-feature-store.service';
import { analyzeRecipeIntegrity } from '../intelligence/recipe-integrity';
import { assessRecipeFit } from '../intelligence/recipe-fit';

const FIT_MULTIPLIER: Record<string, number> = { avoid_allergen: 0.05, caution: 0.6, ok: 1, great_fit: 1.3 };

export interface SearchResult {
  recipeId: string;
  title: string;
  score: number;
  why: { matchedTerms: string[] };
  personalization?: { recommendation: string; allergenCaution: boolean; reasons: string[] };
}
export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
  resultStatus: 'ok' | 'no_results' | 'empty_query';
  personalized: boolean;
  unmetSearch: boolean;
}

@Injectable()
export class RecipeSearchService {
  private readonly logger = new Logger(RecipeSearchService.name);
  /** observed but unwired: queries that returned nothing — the "wanted-but-missing" signal (taste.unmet_search_demand). */
  private readonly unmetSearchLog: string[] = [];

  // EMBED-L4-13: the TF-IDF index + content representation now come from the ONE content feature store
  // (buildContentDoc) — search & similar read the same consistent source.
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: ProfileReadService,
    private readonly content: RecipeContentFeatureStore,
  ) {}

  async search(query: string, opts: { limit?: number; userId?: string } = {}): Promise<SearchResponse> {
    const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50);
    const q = (query ?? '').trim();
    if (q.length < 2) return { query: q, results: [], total: 0, resultStatus: 'empty_query', personalized: false, unmetSearch: false };

    const index = await this.content.getIndex();
    const hits = searchIndex(index, q, limit * 2);
    if (hits.length === 0) {
      this.recordUnmetSearch(q);
      return { query: q, results: [], total: 0, resultStatus: 'no_results', personalized: false, unmetSearch: true };
    }

    let results: SearchResult[] = hits.map((h) => ({ recipeId: h.id, title: h.title, score: h.score, why: { matchedTerms: h.matchedTerms } }));
    let personalized = false;
    if (opts.userId) {
      try {
        results = await this.personalize(opts.userId, results);
        personalized = true;
      } catch (err) {
        this.logger.warn(`personalized re-rank unavailable; serving base ranking: ${err instanceof Error ? err.name : 'error'}`);
      }
    }
    return { query: q, results: results.slice(0, limit), total: hits.length, resultStatus: 'ok', personalized, unmetSearch: false };
  }

  /** Better, explainable "similar recipes": TF-IDF term overlap blended with content-facet alignment. */
  async similar(recipeId: string, opts: { limit?: number } = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || 6, 1), 20);
    const { neighbors, status } = await this.content.neighbors(recipeId, limit);
    return {
      recipeId,
      results: neighbors.map((n) => ({ recipeId: n.recipeId, title: n.title, score: n.score, why: n.why })),
      resultStatus: status,
    };
  }

  /** Re-rank by personal fit, REUSING getLivingUserProfile + assessRecipeFit. Allergen conflict → demoted + cautioned. */
  private async personalize(userId: string, results: SearchResult[]): Promise<SearchResult[]> {
    const profile = await this.profiles.getLivingUserProfile(userId);
    const ids = results.map((r) => r.recipeId);
    const recipes = await this.prisma.recipe.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, diet: true, difficulty: true, cookingTime: true, allergens: true, categories: true, ingredients: { select: { name: true, ingredient: { select: { allergens: true } } } } },
    });
    const byId = new Map(recipes.map((r) => [r.id, r]));

    const scored = results.map((r) => {
      const recipe = byId.get(r.recipeId);
      if (!recipe) return { ...r, personalizedScore: r.score };
      const derived = analyzeRecipeIntegrity(recipe).derivedAllergens.allergens;
      const fit = assessRecipeFit(recipe, profile, derived);
      const mult = FIT_MULTIPLIER[fit.recommendation] ?? 1;
      return {
        ...r,
        personalizedScore: r.score * mult,
        personalization: { recommendation: fit.recommendation, allergenCaution: fit.safety.allergenConflict, reasons: fit.reasons.slice(0, 3) },
      };
    });
    // allergen-conflicting recipes are demoted BELOW all safe ones (never a top "for you" hit without caution)
    scored.sort((a, b) => {
      const aSafe = !a.personalization?.allergenCaution;
      const bSafe = !b.personalization?.allergenCaution;
      if (aSafe !== bSafe) return aSafe ? -1 : 1;
      return (b.personalizedScore ?? 0) - (a.personalizedScore ?? 0) || a.recipeId.localeCompare(b.recipeId);
    });
    return scored.map(({ personalizedScore, ...r }) => r);
  }

  private recordUnmetSearch(query: string) {
    // "wanted but missing" — feeds the taste.unmet_search_demand signal (emission wiring is a later phase).
    this.unmetSearchLog.push(query);
    this.logger.log(`unmet_search_demand: no results for a query (len=${query.length}) — logged as wanted-but-missing`);
  }

  getUnmetSearchCount(): number {
    return this.unmetSearchLog.length;
  }
}
