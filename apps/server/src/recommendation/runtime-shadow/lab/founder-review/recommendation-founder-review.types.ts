/**
 * A12 Founder-reviewed limited dev shadow experiment — evidence pack types (E18/E43-A12).
 *
 * An INTERNAL/DEV-only evidence system that assembles reproducible, redacted evidence so a FOUNDER can
 * decide whether the shadow recommendation engine is ready for a limited dev shadow experiment — WITHOUT
 * changing live ranking or the user response, WITHOUT self-promoting, and WITHOUT exposing traces to
 * users. Pure types only. `promotionAllowed` / `liveRankingChange*` / `userResponseChange*` /
 * `productUseEnabled` / `userVisible` / `publicEndpointExposed` are always literal `false`.
 */

export type FounderReviewMode = 'off' | 'service_only' | 'dev_internal_api';
export type FounderReviewEnvironment = 'production' | 'development' | 'test' | 'unknown';
export type FounderReviewRequestedBy = 'founder' | 'internal';
export type FounderReviewScope = 'dev_shadow_only';
export type FounderReviewPlanStatus = 'draft' | 'blocked' | 'ready_for_founder_review';

export interface FounderReviewConfig {
  mode: FounderReviewMode;
  requireAdmin: boolean;
  maxTraceRead: number;
  allowRun: boolean;
}

export interface FounderReviewContext {
  config: FounderReviewConfig;
  environment: FounderReviewEnvironment;
  adminVerified: boolean;
  internalCall?: boolean;
  now?: string;
}

export interface FounderReviewAccessEvaluation {
  allowed: boolean;
  mode: FounderReviewMode;
  reason: string;
  requiresAdmin: boolean;
  adminVerified: boolean;
  environment: FounderReviewEnvironment;
  publicEndpointExposed: false;
}

export interface FounderReviewPlanInput {
  experimentKey: string;
  templateKey: string;
  requestedBy: FounderReviewRequestedBy;
  scope: FounderReviewScope;
  maxRequests: number;
  includeTraceAnalysis: boolean;
  includeSimulationEvidence: boolean;
  includeRollbackProof: boolean;
  includeRetentionDryRun: boolean;
}

export interface FounderReviewExperimentPlan {
  planId: string;
  experimentKey: string;
  templateKey: string;
  scope: FounderReviewScope;
  status: FounderReviewPlanStatus;
  constraints: string[];
  requiredApprovals: ['founder'];
  allowedActions: string[];
  disallowedActions: string[];
  safetyPreconditions: string[];
  evidenceRequired: string[];
  blockers: string[];
  promotionAllowed: false;
  liveRankingChangeAllowed: false;
  userResponseChangeAllowed: false;
}

/** Redacted, already-gathered evidence inputs handed to the pure pack generator. */
export interface FounderReviewEvidenceInputs {
  labSummary?: unknown;
  controlPlaneSummary?: unknown;
  simulationArtifactSummary?: unknown;
  traceAnalysisSummary?: unknown;
  retentionDryRunSummary?: unknown;
}

export interface FounderReviewSafetyChecklist {
  status: 'blocked' | 'pass_with_warnings' | 'pass';
  passed: string[];
  failed: string[];
  warnings: string[];
  criticalFailureCount: number;
}

export interface RecommendationRollbackProof {
  killSwitch: {
    exists: true;
    defaultSafe: true;
    blocksExecution: boolean;
    productionBlocked: boolean;
    unsafeRequestBlocked: boolean;
  };
  rollback: {
    liveRankingChangePresent: false;
    userResponseChangePresent: false;
    disableByEnv: true;
    disableRequiresDeploy: false;
    destructiveRollbackRequired: false;
    steps: string[];
  };
  retention: {
    dryRunOnly: true;
    destructiveOperationUsed: false;
    requiresFounderApproval: true;
  };
}

export interface FounderReviewPromotionReview {
  promotionAllowed: false;
  status: 'blocked' | 'not_ready' | 'ready_for_founder_review';
  blockers: string[];
  warnings: string[];
  requiredFounderDecision: true;
  nextRequiredGate: 'A13_FOUNDER_APPROVED_LIMITED_DEV_SHADOW_EXPERIMENT_EXECUTION';
}

export interface FounderDecisionPlaceholder {
  status: 'not_requested' | 'pending_founder_review';
  allowedActionsAfterApproval: string[];
  actionsStillForbidden: string[];
}

export interface FounderReviewEvidencePack {
  evidencePackId: string;
  generatedAt: string;
  plan: FounderReviewExperimentPlan;
  labSummary: unknown;
  controlPlaneSummary: unknown;
  simulationSummary: unknown;
  traceAnalysisSummary: unknown;
  safetyChecklist: FounderReviewSafetyChecklist;
  rollbackProof: RecommendationRollbackProof;
  retentionDryRunSummary: unknown;
  promotionReview: FounderReviewPromotionReview;
  founderDecisionPlaceholder: FounderDecisionPlaceholder;
  evidenceCompleteness: number;
  evidenceComplete: boolean;
  blockers: string[];
  warnings: string[];
  productUseEnabled: false;
  liveRankingChangedForUser: false;
  userVisible: false;
  version: 1;
}

export type FounderReviewDecisionOption =
  | 'reject'
  | 'request_more_evidence'
  | 'approve_limited_dev_shadow_experiment';

export type FounderReviewForbiddenDecisionOption =
  | 'enable_production_ranking'
  | 'enable_user_facing_personalization'
  | 'enable_ai_autonomy';

export interface FounderReviewDossier {
  title: string;
  verdict: 'blocked' | 'ready_for_founder_review' | 'not_ready';
  executiveSummary: string;
  evidenceCompleteness: number;
  safetyStatus: string;
  qualityStatus: string;
  blockers: string[];
  warnings: string[];
  requiredFounderDecision: true;
  allowedDecisionOptions: FounderReviewDecisionOption[];
  forbiddenDecisionOptions: FounderReviewForbiddenDecisionOption[];
  nextStep: string;
}

export interface GenerateEvidencePackOptions {
  inputs?: FounderReviewEvidenceInputs;
  now?: string;
}
