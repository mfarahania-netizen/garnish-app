/**
 * GARNISH-EVAL-L4-15 — offline recsys metrics (pure, deterministic, honest).
 *
 * The OFFLINE half of recsys evaluation: scores quality from the catalog + the S9 content representation +
 * declared-profile fixtures — no real users needed, reproducible, NO Math.random, NO faked numbers. The
 * mandatory allergy-safety metric is an INDEPENDENT allergen-intersection check (it does not trust the
 * recommender's own verdict), so a future leak — or a regression in the fit/allergen logic — is caught.
 */
import { assessRecipeFit } from '../../recipes/intelligence/recipe-fit';
import { analyzeRecipeIntegrity } from '../../recipes/intelligence/recipe-integrity';
import { buildContentVector, cosineDense } from '../../recipes/search/recipe-content';

export interface ScoredRec {
  recipeId: string;
  fitScore: number;
  recommendation: string;
  recipe: any;
}

/**
 * The recommender's SAFE fit-ranked selection over a candidate set — the same contract the live cold-start
 * uses (assessRecipeFit + drop avoid_allergen + rank by fit). Shared so the harness measures the real rule.
 */
export function selectFitRankedSafe(recipes: any[], profile: any, limit = 10): ScoredRec[] {
  return recipes
    .map((r) => {
      const derived = analyzeRecipeIntegrity(r).derivedAllergens.allergens;
      const fit = assessRecipeFit(r, profile, derived);
      return { recipeId: r.id, fitScore: fit.fitScore, recommendation: fit.recommendation, recipe: r };
    })
    .filter((x) => x.recommendation !== 'avoid_allergen')
    .sort((a, b) => b.fitScore - a.fitScore || a.recipeId.localeCompare(b.recipeId))
    .slice(0, limit);
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).toLowerCase());
  if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p.map((x) => String(x).toLowerCase()) : []; } catch { return []; } }
  return [];
}

/** All allergens a recipe carries: declared `allergens` field ∪ dictionary-derived (from ingredients). */
export function recipeAllergens(recipe: any): string[] {
  const declared = parseList(recipe?.allergens);
  const derived = (analyzeRecipeIntegrity(recipe).derivedAllergens?.allergens ?? []).map((a: string) => a.toLowerCase());
  return [...new Set([...declared, ...derived])];
}

/** Catalog coverage: fraction of the catalog that is recommendable somewhere across the fixtures. */
export function catalogCoverage(recListsIds: string[][], catalogSize: number): number {
  if (catalogSize <= 0) return 0;
  const distinct = new Set<string>();
  for (const list of recListsIds) for (const id of list) distinct.add(id);
  return round(distinct.size / catalogSize);
}

/** Intra-list diversity: avg pairwise (1 − cosine) over each list's S9 content vectors (higher = more varied). */
export function intraListDiversity(recipeLists: any[][]): number {
  const perList: number[] = [];
  for (const list of recipeLists) {
    if (list.length < 2) continue;
    const vecs = list.map((r) => buildContentVector(r));
    let sum = 0, pairs = 0;
    for (let i = 0; i < vecs.length; i++) {
      for (let j = i + 1; j < vecs.length; j++) { sum += 1 - cosineDense(vecs[i], vecs[j]); pairs++; }
    }
    if (pairs > 0) perList.push(sum / pairs);
  }
  if (perList.length === 0) return 0;
  return round(perList.reduce((s, v) => s + v, 0) / perList.length);
}

/** Average fit quality across all recommended items (assessRecipeFit fitScore). */
export function avgFitQuality(recLists: ScoredRec[][]): number {
  const scores = recLists.flat().map((r) => r.fitScore);
  if (scores.length === 0) return 0;
  return round(scores.reduce((s, v) => s + v, 0) / scores.length);
}

/**
 * Popularity bias: share of recommendations drawn from the most-popular decile. Uses REAL popularity
 * (favorite/view counts) when present; returns null ("awaiting pilot") when there is no popularity signal —
 * never a fabricated number.
 */
export function popularityBias(recListsIds: string[][], popularity: Map<string, number>): number | null {
  const ranked = [...popularity.entries()].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null; // no real popularity yet → honest null
  const topDecile = new Set(ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 10))).map(([id]) => id));
  const all = recListsIds.flat();
  if (all.length === 0) return 0;
  const fromTop = all.filter((id) => topDecile.has(id)).length;
  return round(fromTop / all.length);
}

/**
 * MANDATORY allergy-safety metric (hard guard). INDEPENDENT of the recommender's own verdict: counts any
 * recommended recipe whose allergen set intersects the fixture's declared allergies. MUST be 0.
 */
export function allergenLeaks(recList: { recipe: any }[], declaredAllergens: string[]): number {
  const declared = declaredAllergens.map((a) => a.toLowerCase());
  if (declared.length === 0) return 0;
  let leaks = 0;
  for (const rec of recList) {
    const allergens = recipeAllergens(rec.recipe);
    if (allergens.some((a) => declared.some((d) => a.includes(d) || d.includes(a)))) leaks++;
  }
  return leaks;
}
