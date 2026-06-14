/**
 * Downstream readiness contracts (E43-A4).
 *
 * Derives readiness for each future consumer (recommendation, notification, aiSnapshot, foodDna,
 * plannerGrocery, voiceIntent) from the profile dimensions. `safeForProductUse` is ALWAYS false in
 * E43-A4 — readiness may reach `ready_shadow`/`ready_for_runtime_gate` but NEVER enables product use,
 * ranking changes, a notification send engine, AI personalization, or a voice assistant. Pure.
 */

import {
  ProfileDimensionBase,
  ReadinessKey,
  ReadinessStatus,
  ReadinessLevel,
} from './user-food-identity-graph.types';

type Dims = Record<string, ProfileDimensionBase>;

/** Dimensions each consumer needs before it could (eventually) be wired behind a runtime gate. */
export const READINESS_REQUIREMENTS: Record<ReadinessKey, string[]> = {
  recommendation: ['taste', 'recommendationBehavior', 'effort'],
  notification: ['notificationBehavior', 'routine'],
  aiSnapshot: ['taste', 'effort', 'aiInteraction', 'safetyBoundaries'],
  foodDna: ['taste', 'onboardingColdStart', 'effort'],
  plannerGrocery: ['plannerBehavior', 'groceryBehavior', 'routine'],
  voiceIntent: ['aiInteraction', 'taste', 'routine'],
};

const round4 = (x: number): number => Math.round(x * 10000) / 10000;

function levelFor(missing: string[], confidence: number): ReadinessLevel {
  if (missing.length > 0) return 'not_ready';
  if (confidence < 0.3) return 'weak';
  if (confidence < 0.6) return 'ready_shadow';
  return 'ready_for_runtime_gate';
}

const REASONS: Record<ReadinessKey, string> = {
  recommendation: 'Recommendation context (taste + recommendation behavior + effort)',
  notification: 'Notification timing/fatigue context (notification behavior + routine)',
  aiSnapshot: 'Safe behavioral context snapshot for AI (taste + effort + AI interaction + safety boundary)',
  foodDna: 'Cold-start Food DNA context (taste + onboarding + effort)',
  plannerGrocery: 'Planner/grocery context (planner + grocery + routine)',
  voiceIntent: 'Voice-ready intent context (AI interaction + taste + routine)',
};

function build(key: ReadinessKey, dims: Dims): ReadinessStatus {
  const required = READINESS_REQUIREMENTS[key];
  const missing = required.filter((d) => !dims[d] || dims[d].status === 'empty');
  const present = required.filter((d) => dims[d] && dims[d].status !== 'empty');
  const confidence = present.length > 0 ? round4(present.reduce((s, d) => s + dims[d].confidence, 0) / required.length) : 0;
  const status = levelFor(missing, confidence);
  const reason =
    missing.length > 0
      ? `${REASONS_PREFIX(status)} — missing: ${missing.join(', ')}. ${REASONS[key]}.`
      : `${REASONS_PREFIX(status)}. ${REASONS[key]}.`;
  return {
    status,
    reason,
    requiredDimensions: required,
    missingDimensions: missing,
    confidence,
    safeForProductUse: false, // INVARIANT in E43-A4 — never product-enabled
  };
}

function REASONS_PREFIX(level: ReadinessLevel): string {
  switch (level) {
    case 'not_ready': return 'Not ready (insufficient evidence)';
    case 'weak': return 'Weak (low confidence)';
    case 'ready_shadow': return 'Ready for SHADOW evaluation only (not product-enabled)';
    case 'ready_for_runtime_gate': return 'Ready for a future runtime GATE decision (still not product-enabled)';
  }
}

export function buildReadinessContracts(dims: Dims): Record<ReadinessKey, ReadinessStatus> {
  return {
    recommendation: build('recommendation', dims),
    notification: build('notification', dims),
    aiSnapshot: build('aiSnapshot', dims),
    foodDna: build('foodDna', dims),
    plannerGrocery: build('plannerGrocery', dims),
    voiceIntent: build('voiceIntent', dims),
  };
}

/** Stable fingerprint of readiness (levels only) for regression diffs without raw data. */
export function profileReadinessFingerprint(contracts: Record<ReadinessKey, ReadinessStatus>): string {
  return (Object.keys(contracts) as ReadinessKey[])
    .sort()
    .map((k) => `${k}:${contracts[k].status}`)
    .join('|');
}
