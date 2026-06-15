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
import { buildTfidfIndex, searchIndex, similarIndex, TfidfIndex, SearchDocInput } from './tfidf';
import { analyzeRecipeIntegrity } from '../intelligence/recipe-integrity';
import { assessRecipeFit } from '../intelligence/recipe-fit';
import { toStringArray } from '../../ai/tools/grounding-utils';

const INDEX_TTL_MS = 5 * 60 * 1000;
const CORPUS_CAP = 2000;

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
  private index: TfidfIndex | null = null;
  private indexedAt = 0;
  /** observed but unwired: queries that returned nothing — the "wanted-but-missing" signal (taste.unmet_search_demand). */
  private readonly unmetSearchLog: string[] = [];

  constructor(private readonly prisma: PrismaService, private readonly profiles: ProfileReadService) {}

  private buildDocText(r: any): string {
    const ingredients = (r.ingredients ?? []).map((i: any) => i.name).filter(Boolean);
    const terms = (r.searchTerms ?? []).map((t: any) => t.term).filter(Boolean);
    const cats = toStringArray(r.categories);
    // weight title (×3) and ingredients (×2) — they matter most for recipe search
    return [r.title, r.title, r.title, ...ingredients, ...ingredients, r.description, r.diet, r.mealType, r.region, ...cats, ...terms]
      .filter(Boolean)
      .join(' ');
  }

  async buildIndex(force = false): Promise<TfidfIndex> {
    if (!force && this.index && Date.now() - this.indexedAt < INDEX_TTL_MS) return this.index;
    const recipes = await this.prisma.recipe.findMany({
      where: { isPublic: true },
      take: CORPUS_CAP,
      select: { id: true, title: true, description: true, diet: true, mealType: true, region: true, categories: true, difficulty: true, cookingTime: true, ingredients: { select: { name: true } }, searchTerms: { select: { term: true } } },
    });
    const docs: SearchDocInput[] = recipes.map((r) => ({
      id: r.id,
      title: r.title,
      text: this.buildDocText(r),
      facets: { diet: r.diet, mealType: r.mealType, region: r.region, difficulty: r.difficulty, cookingTime: r.cookingTime, categories: toStringArray(r.categories) },
    }));
    this.index = buildTfidfIndex(docs);
    this.indexedAt = Date.now();
    return this.index;
  }

  async search(query: string, opts: { limit?: number; userId?: string } = {}): Promise<SearchResponse> {
    const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50);
    const q = (query ?? '').trim();
    if (q.length < 2) return { query: q, results: [], total: 0, resultStatus: 'empty_query', personalized: false, unmetSearch: false };

    const index = await this.buildIndex();
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

  async similar(recipeId: string, opts: { limit?: number } = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || 6, 1), 20);
    const index = await this.buildIndex();
    const sims = similarIndex(index, recipeId, limit);
    return {
      recipeId,
      results: sims.map((s) => ({
        recipeId: s.id,
        title: s.title,
        score: s.score,
        why: this.explainSimilarity(index, recipeId, s.id, s.sharedTerms),
      })),
      resultStatus: sims.length ? 'ok' : index.docs.has(recipeId) ? 'no_similar' : 'recipe_not_found',
    };
  }

  /** Classify shared terms into ingredient / cuisine / effort buckets for an explainable "similar because…". */
  private explainSimilarity(index: TfidfIndex, baseId: string, otherId: string, sharedTerms: string[]) {
    const base = index.docs.get(baseId)?.facets ?? {};
    const other = index.docs.get(otherId)?.facets ?? {};
    const reasons: string[] = [];
    if (sharedTerms.length) reasons.push(`shared key terms: ${sharedTerms.slice(0, 5).join(', ')}`);
    if (base.region && base.region === other.region) reasons.push(`same cuisine (${base.region})`);
    if (base.mealType && base.mealType === other.mealType) reasons.push(`same meal type (${base.mealType})`);
    if (base.difficulty && base.difficulty === other.difficulty) reasons.push(`comparable effort (${base.difficulty})`);
    return { sharedTerms, reasons };
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
