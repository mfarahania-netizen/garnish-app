/**
 * Shadow Runtime Recommendation Integration — types (E18/E43-A6).
 *
 * E18/E43-A5 produced a PURE/SHADOW recommendation decision engine. A6 lets that engine run BESIDE the
 * existing live recommendation pipeline WITHOUT changing live ranking, the user-visible response, UI, or
 * any product behavior. These are pure types only.
 *
 * Invariants enforced everywhere downstream:
 *   - `rankingChangedForUser` is ALWAYS false.
 *   - `productUseEnabled` / `safeForProductUse` are ALWAYS false.
 *   - no raw user text / recipe body / AI prompt-or-output / PII / medical-or-protected label leaves this
 *     layer (the safety gate blocks; diagnostics are redacted).
 */

import {
  RecommendationCandidate,
  RecommendationDecisionTrace,
  DecisionContext,
  DecisionHistory,
} from '../intelligence/recommendation-decision.types';
import { UserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.types';

export type ShadowRuntimeMode = 'off' | 'shadow';

/** Resolved runtime configuration (env-driven, safe defaults). */
export interface ShadowRuntimeConfig {
  mode: ShadowRuntimeMode;
  /** 0..1 — fraction of eligible requests that run shadow scoring. Default 0 (disabled). */
  sampleRate: number;
}

/** Divergence reason codes (strictly validated, deterministic, safe — no protected/medical inference). */
export const DIVERGENCE_REASON_CODES = [
  'taste_profile_shift',
  'effort_context_shift',
  'skill_mismatch',
  'recent_overexposure',
  'dismiss_history',
  'cook_success_boost',
  'novelty_boost',
  'safety_soft_suppression',
  'weak_profile_confidence',
  'missing_candidate_metadata',
  'cold_start_fallback',
  'insufficient_history',
  'shadow_live_alignment',
] as const;
export type DivergenceReasonCode = (typeof DIVERGENCE_REASON_CODES)[number];

/** Safety-gate block reason codes. */
export const SHADOW_SAFETY_BLOCK_CODES = [
  'consent_missing',
  'consent_incompatible',
  'raw_recipe_body',
  'raw_user_text',
  'raw_ai_prompt_or_output',
  'pii_detected',
  'medical_or_protected_label',
  'unsafe_why_explanation',
  'invalid_sample_rate',
  'invalid_mode',
  'sensitive_value_in_trace',
] as const;
export type ShadowSafetyBlockCode = (typeof SHADOW_SAFETY_BLOCK_CODES)[number];

/** Consent the caller asserts for the user (never fabricated by this layer). */
export interface ShadowConsent {
  /** behavioral analytics / profiling consent — REQUIRED for any shadow collection. */
  behavioralAnalytics?: boolean;
  /** product personalization consent — irrelevant in A6 (shadow never personalizes), kept for A7. */
  personalization?: boolean;
}

/** Inputs the safety gate scans before any shadow scoring is allowed. */
export interface ShadowSafetyInput {
  config: ShadowRuntimeConfig;
  consent?: ShadowConsent;
  /** candidate metadata to be fed to the scorer (scanned for raw bodies / PII / protected labels). */
  candidates?: RecommendationCandidate[];
  /** a produced trace (scanned for unsafe why text + sensitive values), when available. */
  trace?: RecommendationDecisionTrace | null;
}

export interface ShadowSafetyResult {
  allowed: boolean;
  blockedReasonCodes: ShadowSafetyBlockCode[];
  redactionApplied: boolean;
  productUseEnabled: false;
}

/** Output of the live-vs-shadow comparison (no raw values, deterministic). */
export interface LiveShadowComparison {
  liveRankingFingerprint: string;
  shadowRankingFingerprint: string;
  liveCandidateCount: number;
  shadowCandidateCount: number;
  /** overlap of the top-K sets (0..1). */
  topKOverlap: number;
  /** number of recipes whose rank differs between live and shadow (present in both). */
  rankShiftCount: number;
  /** recipes in the live top-K that shadow suppressed/blocked or dropped out of its top-K. */
  suppressedByShadowCount: number;
  /** recipes shadow ranked materially higher than live. */
  boostedByShadowCount: number;
  /** shadow candidates with confidence < weak threshold. */
  weakConfidenceCount: number;
  majorDivergence: boolean;
  reasons: DivergenceReasonCode[];
}

/** The full shadow inputs needed to actually score (supplied by a provider; null in the default path). */
export interface ShadowScoringInputs {
  graph: UserFoodIdentityGraph;
  candidates: RecommendationCandidate[];
  history: DecisionHistory;
}

/** Pure-orchestrator input. */
export interface ShadowRuntimeInput {
  config: ShadowRuntimeConfig;
  userId: string;
  /** live ranking, as recipeIds, already produced by the existing pipeline (read-only copy). */
  liveCandidateIds: string[];
  /** scoring inputs; null when no provider is configured (the default live path → no DB reads). */
  scoringInputs?: ShadowScoringInputs | null;
  consent?: ShadowConsent;
  context?: DecisionContext;
  now?: Date;
  /** deterministic sampling key (defaults to userId). */
  sampleKey?: string;
  /** top-K window for comparison (default 10). */
  topK?: number;
}

export type ShadowReadinessStatus =
  | 'off'
  | 'shadow_collected'
  | 'shadow_ready_for_experiment_design'
  | 'blocked';

/** The single result object the runtime hook produces (and DISCARDS — never returned to users). */
export interface ShadowRuntimeResult {
  enabled: boolean;
  mode: ShadowRuntimeMode;
  userId: string;
  liveCandidateCount: number;
  shadowCandidateCount: number;
  liveRankingFingerprint: string;
  shadowRankingFingerprint: string;
  /** ALWAYS false in A6. */
  rankingChangedForUser: false;
  divergence: {
    topKOverlap: number;
    rankShiftCount: number;
    majorDivergence: boolean;
    reasons: DivergenceReasonCode[];
  };
  safety: {
    allowed: boolean;
    blockedReasonCodes: ShadowSafetyBlockCode[];
    redactionApplied: boolean;
    /** ALWAYS false in A6. */
    productUseEnabled: false;
  };
  readiness: {
    status: ShadowReadinessStatus;
    reason: string;
    missingInputs: string[];
    nextStep: string;
  };
  diagnostics: {
    decisionTraceAvailable: boolean;
    explanationCount: number;
    unsafeExplanationCount: number;
    weakConfidenceCount: number;
  };
  version: 1;
}
