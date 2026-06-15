/**
 * GARNISH-COLDSTART-L4-14 — history-aware cold-start ranking blend (pure, deterministic, flagged).
 *
 * When a user's behavioural history is thin (low `_data_behavioralReliability`), the live ranker should
 * lean on signals that EXIST for a new user — content understanding + popularity + ingredient signal —
 * and away from behaviour/outcome features that are still empty, transitioning smoothly back to the base
 * weights as history grows. Feature-flagged so the existing path is unchanged when disabled. No randomness.
 */
export const COLDSTART_BLEND_FLAG = 'COLDSTART_RANKING_BLEND_ENABLED';
const RELIABILITY_FULL = 0.65; // at/above this, treat the user as having enough history → base weights

/** Default ON; set COLDSTART_RANKING_BLEND_ENABLED='false' to fall back to the legacy maturity scaling. */
export function coldStartBlendEnabled(): boolean {
  return String(process.env[COLDSTART_BLEND_FLAG] ?? '').trim().toLowerCase() !== 'false';
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/**
 * Lean the weight blend by thinness `t` (0 at reliability≥0.65 → identical to base; →1 as reliability→0).
 * Down-weights behaviour/outcome (don't exist yet), up-weights content understanding + popularity +
 * ingredient intelligence (available from day one). Caller normalizes. Deterministic.
 */
export function coldStartWeightBlend(weights: Record<string, number>, reliability: number): Record<string, number> {
  const t = clamp01((RELIABILITY_FULL - clamp01(reliability)) / RELIABILITY_FULL);
  if (t === 0) return { ...weights };
  const a = { ...weights };
  const scale = (key: string, factor: number) => { if (typeof a[key] === 'number') a[key] = a[key] * factor; };
  scale('behaviorFit', 1 - 0.6 * t);
  scale('outcomeFit', 1 - 0.5 * t);
  scale('tasteAffinity', 1 - 0.15 * t);
  scale('recency', 1 - 0.25 * t);
  scale('recipeUnderstanding', 1 + 0.9 * t); // content representation (S9) — available for new users
  scale('ingredientIntelligence', 1 + 0.6 * t);
  scale('popularity', 1 + 0.5 * t); // honest popularity (one input; never overrides hard filters)
  scale('novelty', 1 + 0.4 * t);
  return a;
}
