/**
 * Food DNA projection (S2 — FOOD DNA ACTIVATION) — pure, PII-free, owner-scoped read shape.
 *
 * A THIN read projection over the EXISTING engine: it reshapes the already-computed, already-PII-free
 * fields of a `UserFoodIdentityGraph` (the four user-facing dimensions + their `safeExplanation`/`summary`)
 * plus the maturity that `maturityFor` computed — for the Food DNA screen to consume. It computes NOTHING
 * new (no inference, no scoring), surfaces NO raw text / sensitive fields, and never fabricates a trait the
 * engine did not compute (a missing graph → honest cold-start). The hydration/build/maturity logic stays in
 * the frozen engine; this only selects + renames PII-free fields for the UI.
 */
import { UserFoodIdentityGraph } from '../user-food-identity-graph.types';
import { maturityFor } from './living-profile';

export interface FoodDnaMetric {
  key: string;
  /** numeric 0..1 score OR a short engine-computed string (e.g. flavorPatternSummary) — never raw user text. */
  value: number | string;
}

export interface FoodDnaDimension {
  key: 'taste' | 'effort' | 'skill' | 'routine';
  status: string; // engine DimensionStatus
  confidence: number; // 0..1
  evidenceCount: number;
  /** the engine's honest "you lean …" line (PII-free, guaranteed safe by the profile QA gate). */
  safeExplanation: string;
  summary: string;
  limitations: string[];
  /** dimension-salient PII-free numbers/strings the engine already computed (affinities, quick-meal pref, …). */
  metrics: FoodDnaMetric[];
  /** ingredient/cuisine NAMES the user leans toward / away from (taste only; PII-free recipe vocabulary). */
  affinities?: string[];
  avoidances?: string[];
}

export interface FoodDnaProjection {
  userId: string;
  generatedAt: string;
  /** cold_start = no observed behavior yet (honest forming state); partial/ready as behavior accrues. */
  status: 'cold_start' | 'partial' | 'ready';
  maturity: { band: string; score: number; trustGuidance: string; observedConfidence: number; declaredCoverage: number };
  dimensions: FoodDnaDimension[];
  strongestDimensions: string[];
  weakestDimensions: string[];
  /** PII-free provenance for the UI's honesty copy. */
  evidence: { observationCount: number; sourceSignalCount: number };
}

const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 100) / 100 : 0);

/** Select the PII-free salient metrics the engine already computed for each dimension (no recompute). */
function metricsFor(key: FoodDnaDimension['key'], d: any): FoodDnaMetric[] {
  if (!d) return [];
  const m: FoodDnaMetric[] = [];
  const push = (k: string, v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) m.push({ key: k, value: num(v) }); else if (typeof v === 'string' && v.trim()) m.push({ key: k, value: v }); };
  if (key === 'taste') { push('flavorPattern', d.flavorPatternSummary); push('exploration', d.explorationScore); push('repetition', d.repetitionPreference); }
  else if (key === 'effort') { push('quickMeal', d.quickMealPreference); push('lowPrep', d.lowPrepTolerance); push('complexReady', d.complexRecipeReadiness); }
  else if (key === 'skill') { push('technique', d.techniqueConfidence); push('completionGrowth', d.cookCompletionGrowth); push('nextChallenge', d.nextSkillChallengeReadiness); }
  else if (key === 'routine') { push('weeklyPlanning', d.weeklyPlanningPattern); push('mealTiming', d.mealTimePattern); push('weekendCooking', d.weekendCookingPattern); }
  return m;
}

const toStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, 6) : []);

/**
 * Project the four user-facing dimensions + maturity from an (optionally null) observed graph.
 * `declaredCoverage` is the declared profile's coverage score (the ≤0.20 prior). Pure; no IO.
 */
export function projectFoodDna(
  graph: UserFoodIdentityGraph | null,
  declaredCoverage: number,
  now: Date,
  userId: string,
): FoodDnaProjection {
  const observedConfidence = graph?.confidence?.overall ?? 0;
  const maturity = maturityFor(declaredCoverage, observedConfidence); // REUSED — no recompute
  const status: FoodDnaProjection['status'] = observedConfidence <= 0 ? 'cold_start' : observedConfidence < 0.5 ? 'partial' : 'ready';

  const KEYS: FoodDnaDimension['key'][] = ['taste', 'effort', 'skill', 'routine'];
  const dimensions: FoodDnaDimension[] = KEYS.map((key) => {
    const d: any = graph?.dimensions?.[key] ?? null;
    const dim: FoodDnaDimension = {
      key,
      status: typeof d?.status === 'string' ? d.status : 'empty',
      confidence: num(d?.confidence),
      evidenceCount: typeof d?.evidenceCount === 'number' ? d.evidenceCount : 0,
      safeExplanation: typeof d?.safeExplanation === 'string' ? d.safeExplanation : '',
      summary: typeof d?.summary === 'string' ? d.summary : '',
      limitations: toStrArr(d?.limitations),
      metrics: metricsFor(key, d),
    };
    if (key === 'taste' && d) {
      dim.affinities = toStrArr(d.ingredientAffinities).concat(toStrArr(d.cuisineAffinities)).slice(0, 6);
      dim.avoidances = toStrArr(d.ingredientAvoidances);
    }
    return dim;
  });

  return {
    userId,
    generatedAt: now.toISOString(),
    status,
    maturity: {
      band: maturity.band,
      score: maturity.overallScore,
      trustGuidance: maturity.trustGuidance,
      observedConfidence: num(observedConfidence),
      declaredCoverage: num(maturity.declaredCoverage),
    },
    dimensions,
    strongestDimensions: toStrArr(graph?.confidence?.strongestDimensions),
    weakestDimensions: toStrArr(graph?.confidence?.weakestDimensions),
    evidence: { observationCount: graph?.sourceObservationIds?.length ?? 0, sourceSignalCount: graph?.sourceSignalCount ?? 0 },
  };
}
