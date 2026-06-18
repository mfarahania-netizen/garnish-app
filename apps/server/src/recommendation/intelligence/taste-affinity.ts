/**
 * Cuisine / ingredient taste-affinity computation (ENGINE-PROOF) — pure, ADDITIVE, no frozen change.
 *
 * The audited A4 graph builder leaves TasteDimension.cuisineAffinities/ingredientAffinities EMPTY (the
 * recipe-data join is a documented v1 limitation). This module performs that join the SAFE, additive way —
 * the same pattern as the S2 /profile/dna projection: join the user's REAL positive taste events
 * (cook/save/view of specific recipes) with those recipes' cuisine + ingredients, producing PII-free
 * affinity rankings. It does NOT modify the builder; callers OVERLAY the result onto the taste dimension
 * before ranking (so when nothing is computed, everything is byte-identical to today).
 */

const norm = (s: unknown): string => String(s ?? '').trim().toLowerCase();
const round4 = (x: number): number => Math.round(x * 10000) / 10000;

export interface TasteEvent { recipeId: string; type: string; weight?: number }
export interface RecipeTasteMeta { cuisine?: string | null; ingredients?: string[] }

export interface TasteAffinities {
  cuisineAffinities: string[]; // most-engaged cuisines, descending
  ingredientAffinities: string[]; // most-engaged ingredients, descending
  cuisineWeights: Record<string, number>; // normalized 0..1 per cuisine (drives the ranking match)
}

/** Positive taste signals + their relative weight (a cook says far more than a view). */
const TASTE_TYPE_WEIGHT: Record<string, number> = {
  cook_complete: 1.0, recommendation_cook: 1.0,
  favorite_add: 0.7, recipe_saved: 0.7, recommendation_save: 0.7,
  recipe_view: 0.25, recipe_viewed: 0.25,
};

export function computeTasteAffinities(
  events: TasteEvent[],
  recipeIndex: Map<string, RecipeTasteMeta> | Record<string, RecipeTasteMeta>,
  opts: { topN?: number } = {},
): TasteAffinities {
  const idx = recipeIndex instanceof Map ? recipeIndex : new Map(Object.entries(recipeIndex || {}));
  const cuisineW: Record<string, number> = {};
  const ingredientW: Record<string, number> = {};
  for (const e of Array.isArray(events) ? events : []) {
    const w = TASTE_TYPE_WEIGHT[e?.type];
    if (!w) continue; // only positive taste signals
    const meta = idx.get(String(e.recipeId));
    if (!meta) continue;
    const ew = w * (typeof e.weight === 'number' ? e.weight : 1);
    const cz = norm(meta.cuisine);
    if (cz) cuisineW[cz] = (cuisineW[cz] || 0) + ew;
    for (const ing of meta.ingredients || []) { const n = norm(ing); if (n) ingredientW[n] = (ingredientW[n] || 0) + ew; }
  }
  const maxC = Math.max(1e-9, ...Object.values(cuisineW));
  const cuisineWeights: Record<string, number> = {};
  for (const [k, v] of Object.entries(cuisineW)) cuisineWeights[k] = round4(v / maxC);
  const topN = opts.topN ?? 8;
  const rank = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, topN).map(([k]) => k);
  return { cuisineAffinities: rank(cuisineW), ingredientAffinities: rank(ingredientW), cuisineWeights };
}

/**
 * Pure cuisine-match score for the ranking scorer. Returns 0..1 when the user has computed cuisine
 * affinities AND the candidate carries cuisineTags; returns null otherwise (→ caller leaves tasteFit
 * byte-identical, so every path that does not populate affinities is unaffected). A candidate whose
 * cuisine is the user's strongest affinity scores ~1; a non-match scores low.
 */
export function cuisineAffinityMatch(
  affinities: string[] | undefined,
  cuisineWeights: Record<string, number> | undefined,
  candidateCuisineTags: string[] | undefined,
): number | null {
  const aff = (affinities || []).map(norm).filter(Boolean);
  const tags = (candidateCuisineTags || []).map(norm).filter(Boolean);
  if (aff.length === 0 || tags.length === 0) return null; // data-gated no-op
  const weights = cuisineWeights || {};
  let best = 0;
  for (const t of tags) {
    if (aff.includes(t)) {
      const w = typeof weights[t] === 'number' ? weights[t] : 1 - aff.indexOf(t) / Math.max(1, aff.length);
      best = Math.max(best, Math.max(0, Math.min(1, w)));
    }
  }
  // matched cuisine → its normalized weight; no match → a low (not zero) floor so a single off-cuisine
  // candidate isn't punished into oblivion (diversity guard).
  return best > 0 ? round4(0.4 + 0.6 * best) : 0.3;
}
