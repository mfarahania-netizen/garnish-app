/**
 * A9 controlled dev-traffic shadow experiment simulation — types (E18/E43-A9).
 *
 * A fully OFFLINE, deterministic simulation of dev recommendation traffic across users, contexts, and
 * consent states, run against the A8 shadow service with in-memory ports. Pure types only. Nothing here
 * changes live ranking or the user response; `promotionAllowed`/`productUseEnabled` are always false.
 */

import { DivergenceReasonCode } from './recommendation-shadow-runtime.types';

export type SimulationConsentStateId =
  | 'full'
  | 'behavioral_only'
  | 'missing'
  | 'trace_storage_denied'
  | 'experiment_denied'
  | 'dev_fixture';

export interface SimulatedConsentState {
  id: SimulationConsentStateId;
  purposes: string[];
  expectCanRunShadow: boolean;
  expectCanWriteTrace: boolean;
  viaDevFixture?: boolean;
}

export interface SimulatedShadowUser {
  id: string;
  label: string;
  /** profile-feed behavior: rebuild observations, or none (cold-start). NEVER protected attributes. */
  profileFeedMode: 'off' | 'persisted' | 'rebuild';
  hasPersistedSignals: boolean;
}

export interface SimulatedRecommendationContext {
  surface: string;
  dayPart: string;
  weekday: number;
}

export interface ShadowExperimentSimulationRun {
  userId: string;
  consentStateId: SimulationConsentStateId;
  surface: string;
  enabled: boolean;
  blocked: boolean;
  blockReason?: string;
  traceWriteEligible: boolean;
  traceWritten: boolean;
  majorDivergence: boolean;
  topKOverlap: number;
  inputReadinessConfidence: number;
  weakInput: boolean;
  unsafeExplanationCount: number;
  profileSource: string;
  rankingChangedForUser: false;
  simulatedRuntimeMs: number;
}

export interface ShadowExperimentSimulationSummary {
  simulatedUsers: number;
  contexts: number;
  consentStates: number;
  simulatedRequests: number;
  allowedShadowRuns: number;
  blockedConsentOrSafetyRuns: number;
  traceWriteEligibleRuns: number;
  tracesWritten: number;
  retentionDryRunEligibleTraces: number;
  averageInputReadinessConfidence: number;
  majorDivergenceRate: number;
  unsafeExplanationRate: number;
  responseMutationCount: number;
  liveRankingMutationCount: number;
  consentBypassCount: number;
  rawLeakCount: number;
  shadowFailureEscapeCount: number;
  defaultOffDbIoCount: number;
  traceRedactionPassRate: number;
}

export interface ShadowExperimentSimulation {
  simulationId: string;
  generatedAt: string;
  mode: 'offline_dev_simulation';
  recipeUniverse: {
    expectedTotal: 350;
    observedTotal: number | null;
    candidateCoverageCount: number;
    coverageRatio: number;
  };
  users: SimulatedShadowUser[];
  contexts: SimulatedRecommendationContext[];
  consentMatrix: SimulatedConsentState[];
  runs: ShadowExperimentSimulationRun[];
  summary: ShadowExperimentSimulationSummary;
  productUseEnabled: false;
  liveRankingChangedForUser: false;
  version: 1;
}

/* ───────────────────────── quality thresholds ───────────────────────── */

export interface ShadowQualityThresholds {
  minimumAllowedShadowRuns: number;
  maximumUnsafeExplanationRate: number;
  maximumResponseMutationCount: number;
  maximumLiveRankingMutationCount: number;
  minimumAverageInputReadinessConfidence: number;
  maximumMajorDivergenceRateForPromotion: number;
  minimumTraceRedactionPassRate: number;
  maximumConsentBypassCount: number;
  maximumRawLeakCount: number;
  maximumShadowFailureEscapeCount: number;
  maximumDefaultOffDbIoCount: number;
}

export interface ShadowQualityEvaluation {
  status: 'blocked' | 'not_ready' | 'shadow_quality_observable' | 'ready_for_limited_dev_experiment_design';
  passedThresholds: string[];
  failedThresholds: string[];
  warnings: string[];
  promotionDecision: {
    allowed: false;
    reason: string;
    nextRequiredGate: string;
  };
}

/* ───────────────────────── failure buckets ───────────────────────── */

export type FailureBucketId =
  | 'missing_consent'
  | 'profile_feed_missing'
  | 'low_input_readiness'
  | 'unsafe_trace'
  | 'trace_write_denied'
  | 'trace_write_failed'
  | 'major_divergence'
  | 'weak_shadow_confidence'
  | 'candidate_metadata_missing'
  | 'default_off_skip'
  | 'safety_gate_block'
  | 'simulation_fixture_gap';

export interface FailureBucket {
  bucket: FailureBucketId;
  count: number;
  examplesCount: number;
  severity: 'low' | 'medium' | 'high' | 'blocking';
  nextAction: string;
}

/* ───────────────────────── performance guard ───────────────────────── */

export interface ShadowPerformanceSummary {
  runCount: number;
  averageSimulatedRuntimeMs: number;
  p95SimulatedRuntimeMs: number;
  maxSimulatedRuntimeMs: number;
  estimatedDbReads: number;
  estimatedDbWrites: number;
  networkCalls: number;
  defaultOffDbIoCount: number;
  traceWritesAttempted: number;
  traceWritesAllowed: number;
  traceWritesBlocked: number;
}

export interface ReasonCodeDistribution {
  code: DivergenceReasonCode | string;
  count: number;
}
