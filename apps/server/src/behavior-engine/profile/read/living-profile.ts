/**
 * Living Profile composition (GARNISH-PROFILE-L4-05) — pure.
 *
 * Merges the DECLARED profile (stated) with an OPTIONAL OBSERVED summary (behavioral graph) into a
 * single owner-facing read model with per-dimension confidence and an overall maturity/coverage score
 * — so a future UI can show it and downstream features know how much to trust the profile.
 *
 * Observed hydration from real signals is the existing E43-A4 graph's job; here it is an optional
 * input (cold-start when absent). Stage-2 plugs a richer observed summary in without changing callers.
 */
import { DeclaredProfile } from '../declared/declared-profile.types';

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

export interface LivingProfile {
  userId: string;
  version: 1;
  generatedAt: string;
  declared: DeclaredProfile;
  observed: ObservedSummary;
  maturity: {
    /** 0..1 — blends declared coverage (stated breadth) with observed confidence (behavioral depth). */
    overallScore: number;
    declaredCoverage: number;
    observedConfidence: number;
    band: 'empty' | 'forming' | 'developing' | 'mature';
    trustGuidance: string;
  };
  perDimensionConfidence: Record<string, number>;
  privacy: {
    highestPrivacyClass: string;
    consentPurposesUsed: string[];
    ownerOnly: true;
  };
}

function band(score: number): LivingProfile['maturity']['band'] {
  if (score < 0.1) return 'empty';
  if (score < 0.35) return 'forming';
  if (score < 0.7) return 'developing';
  return 'mature';
}

export function composeLivingProfile(
  declared: DeclaredProfile,
  observed: ObservedSummary = COLD_START_OBSERVED,
  now: Date = new Date(),
): LivingProfile {
  const declaredCoverage = declared.coverage.coverageScore;
  const observedConfidence = observed.overallConfidence;
  // declared breadth weighted slightly higher in stage 1 (observed not yet hydrated); honest blend.
  const overallScore = Number((declaredCoverage * 0.6 + observedConfidence * 0.4).toFixed(3));

  const perDimensionConfidence: Record<string, number> = {};
  for (const dim of Object.values(declared.dimensions)) {
    if (dim.status === 'declared' || dim.status === 'stale') perDimensionConfidence[`declared.${dim.key}`] = dim.confidence;
  }
  for (const [k, v] of Object.entries(observed.byDimension)) perDimensionConfidence[`observed.${k}`] = v;

  const b = band(overallScore);
  const trustGuidance =
    b === 'empty' ? 'Not enough profile signal yet — treat suggestions as generic.'
    : b === 'forming' ? 'Early profile — use as a soft prior, keep exploring.'
    : b === 'developing' ? 'Profile is developing — reasonable to personalize with light confidence.'
    : 'Profile is mature — safe to personalize with higher confidence (still never medical).';

  return {
    userId: declared.userId,
    version: 1,
    generatedAt: now.toISOString(),
    declared,
    observed,
    maturity: { overallScore, declaredCoverage, observedConfidence, band: b, trustGuidance },
    perDimensionConfidence,
    privacy: {
      highestPrivacyClass: declared.privacy.highestPrivacyClass,
      consentPurposesUsed: declared.privacy.consentPurposesUsed,
      ownerOnly: true,
    },
  };
}
