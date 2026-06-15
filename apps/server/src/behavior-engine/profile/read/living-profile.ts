/**
 * Living Profile composition (GARNISH-PROFILE-L4-05 → UNIFY-06) — pure.
 *
 * UNIFY-06: ONE composed `LivingUserProfile` = the existing OBSERVED `UserFoodIdentityGraph` (unchanged,
 * by reference) ⊕ the existing DECLARED profile (unchanged) ⊕ a NEW cross-layer RECONCILIATION ⊕ an
 * overall maturity/coverage score spanning both layers ⊕ per-source provenance. The two sources are
 * composed BY REFERENCE — never flattened or mutated — so the observed-graph contract, its 11-dim QA
 * gate, the declared gate, and frozen runtime-shadow all stay intact.
 */
import { DeclaredProfile } from '../declared/declared-profile.types';
import { UserFoodIdentityGraph } from '../user-food-identity-graph.types';
import { reconcileProfile, ReconciliationResult } from '../reconciliation/profile-reconciliation';

export interface ObservedSummary {
  status: 'cold_start' | 'partial' | 'ready';
  overallConfidence: number; // 0..1
  byDimension: Record<string, number>; // observed dimension → confidence
  strongestDimensions: string[];
  weakestDimensions: string[];
}

export const COLD_START_OBSERVED: ObservedSummary = {
  status: 'cold_start',
  overallConfidence: 0,
  byDimension: {},
  strongestDimensions: [],
  weakestDimensions: [],
};

/** Derive a PII-free ObservedSummary from the real observed graph WITHOUT mutating it (by reference). */
export function summarizeObservedGraph(graph: UserFoodIdentityGraph | null): ObservedSummary {
  if (!graph) return COLD_START_OBSERVED;
  const byDimension: Record<string, number> = { ...(graph.confidence?.byDimension ?? {}) };
  const overall = graph.confidence?.overall ?? 0;
  return {
    status: overall <= 0 ? 'cold_start' : overall < 0.5 ? 'partial' : 'ready',
    overallConfidence: Number(overall.toFixed(3)),
    byDimension,
    strongestDimensions: graph.confidence?.strongestDimensions ?? [],
    weakestDimensions: graph.confidence?.weakestDimensions ?? [],
  };
}

function band(score: number): 'empty' | 'forming' | 'developing' | 'mature' {
  if (score < 0.1) return 'empty';
  if (score < 0.35) return 'forming';
  if (score < 0.7) return 'developing';
  return 'mature';
}

function maturityFor(declaredCoverage: number, observedConfidence: number) {
  const overallScore = Number((declaredCoverage * 0.6 + observedConfidence * 0.4).toFixed(3));
  const b = band(overallScore);
  const trustGuidance =
    b === 'empty' ? 'Not enough profile signal yet — treat suggestions as generic.'
    : b === 'forming' ? 'Early profile — use as a soft prior, keep exploring.'
    : b === 'developing' ? 'Profile is developing — reasonable to personalize with light confidence.'
    : 'Profile is mature — safe to personalize with higher confidence (still never medical).';
  return { overallScore, declaredCoverage, observedConfidence, band: b, trustGuidance };
}

/* ───────────────────────── legacy composition (kept; declared + ObservedSummary) ───────────────────────── */
export interface LivingProfile {
  userId: string;
  version: 1;
  generatedAt: string;
  declared: DeclaredProfile;
  observed: ObservedSummary;
  maturity: ReturnType<typeof maturityFor>;
  perDimensionConfidence: Record<string, number>;
  privacy: { highestPrivacyClass: string; consentPurposesUsed: string[]; ownerOnly: true };
}

export function composeLivingProfile(declared: DeclaredProfile, observed: ObservedSummary = COLD_START_OBSERVED, now: Date = new Date()): LivingProfile {
  const perDimensionConfidence: Record<string, number> = {};
  for (const dim of Object.values(declared.dimensions)) if (dim.status === 'declared' || dim.status === 'stale') perDimensionConfidence[`declared.${dim.key}`] = dim.confidence;
  for (const [k, v] of Object.entries(observed.byDimension)) perDimensionConfidence[`observed.${k}`] = v;
  return {
    userId: declared.userId,
    version: 1,
    generatedAt: now.toISOString(),
    declared,
    observed,
    maturity: maturityFor(declared.coverage.coverageScore, observed.overallConfidence),
    perDimensionConfidence,
    privacy: { highestPrivacyClass: declared.privacy.highestPrivacyClass, consentPurposesUsed: declared.privacy.consentPurposesUsed, ownerOnly: true },
  };
}

/* ───────────────────────── UNIFY-06: the single composed LivingUserProfile ───────────────────────── */
export interface LivingUserProfile {
  userId: string;
  version: 2;
  generatedAt: string;
  /** OBSERVED — summary of the existing UserFoodIdentityGraph (composed by reference; never mutated). */
  observed: ObservedSummary;
  /** DECLARED — the existing declared profile (unchanged). */
  declared: DeclaredProfile;
  /** RECONCILED — cross-layer agreement/conflict/precedence (the point of unification). */
  reconciled: ReconciliationResult;
  /** maturity spanning BOTH layers. */
  maturity: ReturnType<typeof maturityFor>;
  /** per-dimension confidence across declared + observed. */
  perDimensionConfidence: Record<string, number>;
  /** which source drove each reconciled value. */
  provenance: Record<string, { source: 'declared' | 'observed' | 'blend' | 'declared_safety'; status: string }>;
  privacy: { highestPrivacyClass: string; consentPurposesUsed: string[]; ownerOnly: true };
}

/**
 * Compose the unified living profile from the existing declared profile + the existing observed graph.
 * observedGraph may be null (cold-start). Pure; never mutates either input.
 */
export function composeLivingUserProfile(declared: DeclaredProfile, observedGraph: UserFoodIdentityGraph | null, now: Date = new Date()): LivingUserProfile {
  const observed = summarizeObservedGraph(observedGraph);
  const reconciled = reconcileProfile(declared, observedGraph);

  const perDimensionConfidence: Record<string, number> = {};
  for (const dim of Object.values(declared.dimensions)) if (dim.status === 'declared' || dim.status === 'stale') perDimensionConfidence[`declared.${dim.key}`] = dim.confidence;
  for (const [k, v] of Object.entries(observed.byDimension)) perDimensionConfidence[`observed.${k}`] = v;
  for (const [k, d] of Object.entries(reconciled.dimensions)) if (d.status !== 'unknown') perDimensionConfidence[`reconciled.${k}`] = d.confidence;

  const provenance: LivingUserProfile['provenance'] = {};
  for (const [k, d] of Object.entries(reconciled.dimensions)) {
    const source = d.precedence === 'declared_safety' ? 'declared_safety' : d.status === 'observed_only' ? 'observed' : d.status === 'declared_only' ? 'declared' : 'blend';
    provenance[k] = { source, status: d.status };
  }

  return {
    userId: declared.userId,
    version: 2,
    generatedAt: now.toISOString(),
    observed,
    declared,
    reconciled,
    maturity: maturityFor(declared.coverage.coverageScore, observed.overallConfidence),
    perDimensionConfidence,
    provenance,
    privacy: { highestPrivacyClass: declared.privacy.highestPrivacyClass, consentPurposesUsed: declared.privacy.consentPurposesUsed, ownerOnly: true },
  };
}
