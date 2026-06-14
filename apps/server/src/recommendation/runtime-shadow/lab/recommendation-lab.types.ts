/**
 * A11 Recommendation Lab — types (E18/E43-A11).
 *
 * An INTERNAL/DEV-only controlled experiment engine: run shadow recommendation batches, score quality,
 * classify blockers, enforce a safety kill-switch, and produce a promotion-readiness decision — WITHOUT
 * changing live ranking or the user response. Pure types only. `promotionGate.allowed` /
 * `productUseEnabled` / `liveRankingChangedForUser` / `publicEndpointExposed` are always false.
 */

export type LabMode = 'off' | 'service_only' | 'dev_internal_api';
export type LabEnvironment = 'production' | 'development' | 'test' | 'unknown';
export type ExperimentMode = 'dry_run' | 'shadow_dev';
export type QualityProfile = 'strict' | 'balanced' | 'exploratory';
export type ExperimentStatus = 'draft' | 'ready' | 'running' | 'completed' | 'blocked';

export interface LabConfig {
  mode: LabMode;
  allowDryRun: boolean;
  maxRequests: number;
  maxTraceRead: number;
  killSwitch: 'off' | 'on';
}

export interface LabContext {
  config: LabConfig;
  environment: LabEnvironment;
  adminVerified: boolean;
  internalCall?: boolean;
  /** explicitly requested unsafe intents (must always be false in A11) — used by the kill switch. */
  requestedLiveRankingMutation?: boolean;
  requestedUserResponseMutation?: boolean;
  requestedDestructiveRetention?: boolean;
  requestedRawDataExposure?: boolean;
  requestedPublicAccess?: boolean;
}

export interface ExperimentConfig {
  experimentKey: string;
  mode: ExperimentMode;
  userSampleSize: number;
  requestCount: number;
  contexts: string[];
  requireConsent: boolean;
  allowTraceWrite: boolean;
  includeOnlineTraceAnalysis: boolean;
  includeRetentionDryRun: boolean;
  qualityProfile: QualityProfile;
}

export interface ExperimentConfigValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExperimentTemplate {
  experimentKey: string;
  goal: string;
  requiredInputs: string[];
  allowedMode: ExperimentMode;
  maxRequests: number;
  qualityProfile: QualityProfile;
  expectedBlockers: string[];
  nextGate: string;
  config: ExperimentConfig;
}

export interface KillSwitchResult {
  blocked: boolean;
  reasons: string[];
  killSwitchEngaged: boolean;
}

export interface LabAccessEvaluation {
  allowed: boolean;
  mode: LabMode;
  reason: string;
  requiresAdmin: boolean;
  adminVerified: boolean;
  environment: LabEnvironment;
  publicEndpointExposed: false;
}

export interface RecommendationExperimentQualityScorecard {
  overallScore: number;
  readinessScore: number;
  safetyScore: number;
  traceQualityScore: number;
  rankingStabilityScore: number;
  consentComplianceScore: number;
  performanceScore: number;
  dataCoverageScore: number;
  failedCriticalChecks: string[];
  warnings: string[];
}

export interface RecommendationExperimentPromotionGate {
  allowed: false;
  status: 'blocked' | 'not_ready' | 'ready_for_founder_review';
  blockers: string[];
  warnings: string[];
  requiredFounderDecision: true;
  nextRequiredGate: 'A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT';
}

export interface RecommendationExperimentSafetySummary {
  consentBypassCount: number;
  rawLeakCount: number;
  unsafeExplanationCount: number;
  responseMutationCount: number;
  liveRankingMutationCount: number;
  traceRedactionPassRate: number;
  defaultOffDbIoCount: number;
  killSwitchEngaged: boolean;
  publicEndpointExposed: false;
  productUseEnabled: false;
  liveRankingChangedForUser: false;
}

export interface RecommendationExperimentReportSummary {
  title: string;
  experimentKey: string;
  summary: string;
  status: string;
  scorecard: RecommendationExperimentQualityScorecard;
  blockers: string[];
  warnings: string[];
  nextActions: string[];
  safetyNotes: string[];
  productUseEnabled: false;
  liveRankingChangedForUser: false;
}

/** Quality inputs carried on the experiment so scorecard/gate can recompute deterministically. */
export interface ExperimentMetrics {
  majorDivergenceRate: number;
  averageInputReadinessConfidence: number;
  coverageRatio: number | null;
  tracesAnalyzed: number;
  averageTopKOverlap: number | null;
  avgSimulatedRuntimeMs: number | null;
  p95SimulatedRuntimeMs: number | null;
  maxRequestsBound: number;
}

export interface RecommendationLabExperiment {
  experimentId: string;
  experimentKey: string;
  mode: 'off' | 'dry_run' | 'shadow_dev';
  status: ExperimentStatus;
  generatedAt: string;
  recipeUniverse: {
    expectedTotal: 350;
    observedTotal: number | null;
    coverageRatio: number | null;
  };
  trafficPlan: {
    usersPlanned: number;
    contextsPlanned: number;
    requestsPlanned: number;
    shadowRunsPlanned: number;
  };
  executionSummary: {
    requestsExecuted: number;
    shadowRunsAllowed: number;
    shadowRunsBlocked: number;
    tracesWritten: number;
    tracesAnalyzed: number;
    failuresEscaped: number;
  };
  metrics: ExperimentMetrics;
  qualityScorecard: RecommendationExperimentQualityScorecard;
  promotionGate: RecommendationExperimentPromotionGate;
  safety: RecommendationExperimentSafetySummary;
  report: RecommendationExperimentReportSummary;
  configValidation: ExperimentConfigValidation;
  productUseEnabled: false;
  liveRankingChangedForUser: false;
  version: 1;
}

export interface RunExperimentOptions {
  observedRecipeTotal?: number | null;
  now?: string;
  /** optional A8 service for online analysis + retention dry-run (in-memory in tests). */
  // (typed as unknown to avoid a hard import cycle; the runner narrows it.)
  a8Service?: unknown;
}
