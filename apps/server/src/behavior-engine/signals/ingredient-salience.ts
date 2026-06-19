/**
 * FI-PHASE-2.3 — ingredient-level SOFT taste. Pure helpers for the per-ingredient aversion/affinity signal.
 *
 * Requirement (B) — attribution + ubiquity, made concrete:
 *  - SALIENCE (IDF): ubiquitous ingredients (salt/onion/oil — high document-frequency) carry almost no taste
 *    information, so they get a near-zero salience and barely accumulate; distinctive ingredients (lentils,
 *    eggplant, fish — low df) carry the real signal. salience = clamp01( ln(N/df) / ln(N) ): df=1 → 1.0,
 *    df=N → 0. (Live corpus: salt df=275 → ~0.04, lentils_dry df=8 → ~0.65.)
 *  - WEAK ATTRIBUTION: a single reject is weak evidence about any ONE of a dish's ~10 ingredients, so the
 *    per-event delta is divided by √K (K = ingredient count) AND scaled by salience — one reject moves a
 *    distinctive ingredient only ~0.03 and a ubiquitous one ~0.002. Only a consistent pattern accumulates.
 *  - BOUNDS: the signed per-ingredient signal is clamped to [-AVERSION_CAP, +AFFINITY_CAP]; affinity is capped
 *    lower than aversion to preserve exploration (a learned like nudges gently; a learned dislike can go deeper).
 *
 * This signal is SOFT — it feeds ONLY the ranker's scoring (a down-rank), never any hard allergy veto.
 */

export const SALIENCE_DEFAULT = 0.5; // unknown/unmapped ingredient → neutral salience
export const ING_BASE_DELTA = 0.15; // per-event base magnitude (before salience + attribution)
export const ING_AVERSION_CAP = 1.0; // a learned dislike can saturate to -1
export const ING_AFFINITY_CAP = 0.6; // a learned like is gentler (preserves exploration)
export const ING_CONF_STEP = 0.1; // confidence grows with repeated, consistent evidence
export const ING_CONF_FLOOR = 0.2; // first observation starts low-confidence (so one event ≈ negligible)

/** salience = clamp01( ln(N/df) / ln(N) ). Down-weights ubiquitous ingredients toward 0. */
export function ingredientSalience(df: number, n: number): number {
  if (!Number.isFinite(df) || df < 1 || !Number.isFinite(n) || n < 2) return SALIENCE_DEFAULT;
  const idf = Math.log(n / Math.min(df, n));
  const max = Math.log(n); // df === 1
  if (max <= 0) return SALIENCE_DEFAULT;
  return Math.max(0, Math.min(1, idf / max));
}

/** √K — spreads a single reject's weak evidence thinly across the dish's ingredients. */
export function attributionDivisor(numIngredients: number): number {
  return Math.sqrt(Math.max(1, numIngredients));
}

/** signed clamp to [-AVERSION_CAP, +AFFINITY_CAP]. */
export function clampIngredientSignal(value: number): number {
  return Math.max(-ING_AVERSION_CAP, Math.min(ING_AFFINITY_CAP, value));
}

/**
 * The signed per-event delta for ONE ingredient.
 * direction: +1 on cook/save (affinity), -1 on reject (aversion).
 */
export function ingredientDelta(direction: number, salience: number, numIngredients: number): number {
  const sign = direction >= 0 ? 1 : -1;
  return (sign * ING_BASE_DELTA * salience) / attributionDivisor(numIngredients);
}
