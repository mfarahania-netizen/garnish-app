/**
 * RecipeContentFeatureStore (GARNISH-EMBED-L4-13) — the ONE content-feature source.
 *
 * Builds & caches a single TF-IDF index over the canonical content docs (buildContentDoc) plus per-recipe
 * facets and principled dense vectors. Search + "similar" read the index/neighbors from here, so they
 * share one consistent representation. Deterministic + local: NO external API, NO vector DB, NO new dep.
 * This is content-side only — it does NOT touch the frozen recommendation runtime-shadow or its feature
 * paths, and it is NOT a user-behavior feature store.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildTfidfIndex, similarIndex, TfidfIndex } from './tfidf';
import { buildContentDoc, extractFacets, buildContentVector, facetSimilarity, blendSimilarity, ContentFacets } from './recipe-content';

const INDEX_TTL_MS = 5 * 60 * 1000;
const CORPUS_CAP = 2000;
const EMPTY_FACETS: ContentFacets = { cuisine: null, diet: null, mealType: null, difficulty: null, effortBand: 'unknown' };

export interface ContentFeatures {
  recipeId: string;
  title: string;
  facets: ContentFacets;
  topTerms: { term: string; weight: number }[];
  termCount: number;
  vector: number[];
}

export interface ContentNeighbor {
  recipeId: string;
  title: string;
  score: number; // facet-blended cosine
  why: { sharedTerms: string[]; reasons: string[] };
}

@Injectable()
export class RecipeContentFeatureStore {
  private readonly logger = new Logger(RecipeContentFeatureStore.name);
  private index: TfidfIndex | null = null;
  private readonly facets = new Map<string, ContentFacets>();
  private readonly vectors = new Map<string, number[]>();
  private builtAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async build(force = false): Promise<TfidfIndex> {
    if (!force && this.index && Date.now() - this.builtAt < INDEX_TTL_MS) return this.index;
    const recipes = await this.prisma.recipe.findMany({
      where: { isPublic: true },
      take: CORPUS_CAP,
      select: { id: true, title: true, description: true, diet: true, mealType: true, region: true, category: true, categories: true, difficulty: true, cookingTime: true, ingredients: { select: { name: true } }, searchTerms: { select: { term: true } } },
    });
    this.index = buildTfidfIndex(recipes.map((r) => buildContentDoc(r as any)));
    this.facets.clear();
    this.vectors.clear();
    for (const r of recipes) {
      this.facets.set(r.id, extractFacets(r as any));
      this.vectors.set(r.id, buildContentVector(r as any));
    }
    this.builtAt = Date.now();
    return this.index;
  }

  async getIndex(): Promise<TfidfIndex> {
    return this.build();
  }

  /** Cached content features for a recipe — the explainable representation served to consumers. */
  async getContentFeatures(recipeId: string): Promise<ContentFeatures | null> {
    const index = await this.build();
    const doc = index.docs.get(recipeId);
    if (!doc) return null;
    const topTerms = [...doc.vector.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([term, weight]) => ({ term, weight: Math.round(weight * 10000) / 10000 }));
    return { recipeId, title: doc.title, facets: this.facets.get(recipeId) ?? EMPTY_FACETS, topTerms, termCount: doc.termCount, vector: this.vectors.get(recipeId) ?? [] };
  }

  /** Dense content vector for a recipe (used by the candidate-generator embedding path). */
  async getVector(recipeId: string): Promise<number[]> {
    await this.build();
    return this.vectors.get(recipeId) ?? [];
  }

  /**
   * Facet-blended nearest neighbors: TF-IDF term cosine boosted when content facets (cuisine / meal type /
   * effort) also align, with an explainable "similar because…". Better ranking than term overlap alone.
   */
  async neighbors(recipeId: string, limit = 6): Promise<{ neighbors: ContentNeighbor[]; status: 'ok' | 'no_similar' | 'recipe_not_found' }> {
    const index = await this.build();
    if (!index.docs.has(recipeId)) return { neighbors: [], status: 'recipe_not_found' };
    const baseFacets = this.facets.get(recipeId) ?? EMPTY_FACETS;
    const raw = similarIndex(index, recipeId, Math.max(limit * 3, limit));
    const blended = raw
      .map((h) => {
        const fSim = facetSimilarity(baseFacets, this.facets.get(h.id) ?? EMPTY_FACETS);
        return { h, score: blendSimilarity(h.score, fSim) };
      })
      .sort((a, b) => b.score - a.score || a.h.id.localeCompare(b.h.id))
      .slice(0, limit);

    const neighbors = blended.map(({ h, score }) => ({
      recipeId: h.id,
      title: h.title,
      score,
      why: { sharedTerms: h.sharedTerms, reasons: this.explain(baseFacets, this.facets.get(h.id) ?? EMPTY_FACETS, h.sharedTerms) },
    }));
    return { neighbors, status: neighbors.length ? 'ok' : 'no_similar' };
  }

  private explain(base: ContentFacets, other: ContentFacets, sharedTerms: string[]): string[] {
    const reasons: string[] = [];
    if (sharedTerms.length) reasons.push(`shared key ingredients/terms: ${sharedTerms.slice(0, 5).join(', ')}`);
    if (base.cuisine && base.cuisine === other.cuisine) reasons.push(`same cuisine (${base.cuisine})`);
    if (base.mealType && base.mealType === other.mealType) reasons.push(`same meal type (${base.mealType})`);
    if (base.effortBand !== 'unknown' && base.effortBand === other.effortBand) reasons.push(`comparable effort (${base.effortBand})`);
    if (base.difficulty && base.difficulty === other.difficulty) reasons.push(`comparable difficulty (${base.difficulty})`);
    return reasons;
  }
}
