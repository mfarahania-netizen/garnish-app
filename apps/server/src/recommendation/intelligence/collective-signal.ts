/**
 * Collective co-occurrence signal (ENGINE-PROOF) — pure, ADDITIVE, shadow-only.
 *
 * "Users with taste like yours also cooked X." Builds a population-level popularity prior per taste
 * neighbourhood from real engagement events, and exposes a bounded per-candidate score the shadow ranker
 * BLENDS ADDITIVELY (never the sole signal, never bypassing the allergy/safety gate — only candidates the
 * scorer already allows are blended). Degrades gracefully at small N. No live ranking change.
 */

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

export interface Engagement { userId: string; recipeId: string; neighbourhood: string; weight?: number }

export interface CollectiveModel {
  /** neighbourhood → (recipeId → normalized 0..1 popularity within that neighbourhood). */
  byNeighbourhood: Record<string, Record<string, number>>;
  population: number;
}

/**
 * Build the model from population engagements grouped by taste neighbourhood (e.g. preferred cuisine).
 * Popularity is normalized within each neighbourhood so a small neighbourhood still yields a usable prior.
 */
export function buildCollectiveModel(engagements: Engagement[]): CollectiveModel {
  const counts: Record<string, Record<string, number>> = {};
  const users = new Set<string>();
  for (const e of Array.isArray(engagements) ? engagements : []) {
    if (!e?.recipeId || !e?.neighbourhood) continue;
    users.add(e.userId);
    const n = (counts[e.neighbourhood] = counts[e.neighbourhood] || {});
    n[e.recipeId] = (n[e.recipeId] || 0) + (typeof e.weight === 'number' ? e.weight : 1);
  }
  const byNeighbourhood: Record<string, Record<string, number>> = {};
  for (const [nb, recipes] of Object.entries(counts)) {
    const max = Math.max(1e-9, ...Object.values(recipes));
    byNeighbourhood[nb] = {};
    for (const [rid, c] of Object.entries(recipes)) byNeighbourhood[nb][rid] = round4(c / max);
  }
  return { byNeighbourhood, population: users.size };
}

/**
 * Bounded collective score (0..1) for a candidate in a user's taste neighbourhood. Excludes the user's
 * OWN contribution would require their id; callers pass the neighbourhood prior which is population-level.
 * Returns 0 when there is no signal (no-op) — never negative, never > the configured ceiling effect.
 */
export function collectiveScore(model: CollectiveModel, neighbourhood: string, recipeId: string): number {
  const nb = model.byNeighbourhood[neighbourhood];
  if (!nb) return 0;
  const p = nb[recipeId];
  return typeof p === 'number' ? p : 0;
}

/**
 * Blend a collective prior into an allow-listed candidate's score, ADDITIVELY and bounded by `lambda`.
 * SAFETY: callers MUST only pass candidates the scorer already allowed (decision recommend_shadow); a
 * blocked/allergen candidate is never blended. Returns a new score in [0,1].
 */
export function blendCollective(baseScore: number, collective: number, lambda = 0.3): number {
  const b = Number.isFinite(baseScore) ? Math.max(0, Math.min(1, baseScore)) : 0;
  const c = Number.isFinite(collective) ? Math.max(0, Math.min(1, collective)) : 0;
  return round4(Math.max(0, Math.min(1, b + lambda * c)));
}
