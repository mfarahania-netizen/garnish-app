/**
 * A10 limited dev experiment control plane — types (E18/E43-A10).
 *
 * An INTERNAL/DEV-only, read-only control plane for inspecting shadow recommendation quality, experiment
 * readiness, trace summaries, thresholds, failure buckets, and promotion blockers. Pure types only.
 * Nothing here changes live ranking or the user response, exposes a public endpoint, or exposes any raw
 * trace/user data. `promotionGate.allowed` / `productUseEnabled` / `liveRankingChangedForUser` /
 * `publicEndpointExposed` / `userVisible` are always false.
 */

export type ControlPlaneMode = 'off' | 'service_only' | 'dev_internal_api';
export type ControlPlaneEnvironment = 'production' | 'development' | 'test' | 'unknown';

export interface ControlPlaneConfig {
  mode: ControlPlaneMode;
  requireAdmin: boolean;
  maxTraceRead: number;
}

export interface ControlPlaneContext {
  config: ControlPlaneConfig;
  environment: ControlPlaneEnvironment;
  adminVerified: boolean;
  /** true when called from an internal service/test path (not an HTTP route). */
  internalCall?: boolean;
}

export interface ControlPlaneAccessEvaluation {
  allowed: boolean;
  mode: ControlPlaneMode;
  reason: string;
  requiresAdmin: boolean;
  adminVerified: boolean;
  environment: ControlPlaneEnvironment;
  publicEndpointExposed: false;
}

export interface ControlPlaneQuery {
  from?: Date;
  to?: Date;
  experimentKey?: string;
  limit?: number;
  includeSimulationArtifact?: boolean;
}

export interface ControlPlaneTraceSummary {
  traceCount: number;
  averageTopKOverlap: number | null;
  majorDivergenceRate: number | null;
  mostCommonReasonCodes: Array<{ code: string; count: number }>;
  weakInputRate: number | null;
  sampleSizeWarning: boolean;
}

export interface ControlPlaneQualitySummary {
  status: 'blocked' | 'not_ready' | 'shadow_quality_observable' | 'ready_for_limited_dev_experiment_design';
  passedThresholds: string[];
  failedThresholds: string[];
  warnings: string[];
}

export interface ControlPlaneFailureBucket {
  code: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'blocking';
  nextAction: string;
}

export interface ControlPlanePerformanceSummary {
  avgMs: number | null;
  p95Ms: number | null;
  networkCalls: 0;
  defaultOffDbIoCount: 0;
  estimatedDbReads: number;
  estimatedDbWrites: number;
}

export interface ControlPlaneRetentionSummary {
  mode: 'off' | 'dry_run';
  eligibleForDeletionCount: number;
  destructiveOperationUsed: false;
  requiresFounderApproval: true;
}

export interface ControlPlanePromotionGate {
  allowed: false;
  status: 'blocked' | 'not_ready' | 'dev_experiment_design_ready';
  blockers: string[];
  warnings?: string[];
  nextRequiredGate: string;
}

export interface ControlPlaneSimulationArtifactSummary {
  present: boolean;
  totalChecks: number | null;
  failedChecks: number | null;
  promotionAllowed: boolean | null;
  productUseEnabled: boolean | null;
  liveRankingChangedForUser: boolean | null;
  networkCallsDuringGate: number | null;
  redactedFailureDetailsEmpty: boolean | null;
  reChecksPassed: boolean;
  warnings: string[];
}

export interface ControlPlaneSummary {
  mode: ControlPlaneMode;
  generatedAt: string;
  experimentKey: string | null;
  traceSummary: ControlPlaneTraceSummary;
  qualitySummary: ControlPlaneQualitySummary;
  failureBucketSummary: ControlPlaneFailureBucket[];
  performanceSummary: ControlPlanePerformanceSummary;
  retentionSummary: ControlPlaneRetentionSummary;
  simulationArtifactSummary: ControlPlaneSimulationArtifactSummary;
  promotionGate: ControlPlanePromotionGate;
  safety: {
    publicEndpointExposed: false;
    requiresAdmin: boolean;
    userVisible: false;
    productUseEnabled: false;
    liveRankingChangedForUser: false;
  };
  limitations: string[];
  version: 1;
}

/** Input to the promotion-gate evaluator (a subset of the summary + simulation re-checks). */
export interface PromotionGateInput {
  traceSummary: ControlPlaneTraceSummary;
  qualitySummary: ControlPlaneQualitySummary;
  performanceSummary: ControlPlanePerformanceSummary;
  retentionSummary: ControlPlaneRetentionSummary;
  simulationArtifactSummary: ControlPlaneSimulationArtifactSummary;
  unsafeExplanationCount?: number;
  rawLeakCount?: number;
  consentBypassCount?: number;
  responseMutationCount?: number;
  liveRankingMutationCount?: number;
  traceRedactionPassRate?: number;
}
