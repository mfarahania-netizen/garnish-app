/**
 * A14 Founder results review + safe limited activation plan — types (E18/E43-A14).
 *
 * Reads A13 execution evidence and turns it into a Founder review + activation readiness matrix + guardrail
 * requirements + a SAFE LIMITED ACTIVATION PLAN + blocker classification + dry-run simulation + a decision
 * pack — WITHOUT activating anything. A14 plans and validates; it never turns on live ranking. Pure types
 * only. `liveRanking*Allowed` / `userResponseChange*` / `productUseEnabled` / `production*Allowed` /
 * `publicEndpointExposed` are always literal `false`.
 */

export type ActivationReviewMode = 'off' | 'service_only' | 'dev_internal_api';
export type ActivationReviewEnvironment = 'production' | 'development' | 'test' | 'unknown';
export type RagStatus = 'red' | 'yellow' | 'green';

export interface ActivationReviewConfig {
  mode: ActivationReviewMode;
  requireAdmin: boolean;
  allowDryRun: boolean;
  maxTraceRead: number;
}

export interface ActivationReviewContext {
  config: ActivationReviewConfig;
  environment: ActivationReviewEnvironment;
  adminVerified: boolean;
  internalCall?: boolean;
  now?: string;
}

export interface ActivationReviewAccessEvaluation {
  allowed: boolean;
  mode: ActivationReviewMode;
  reason: string;
  requiresAdmin: boolean;
  adminVerified: boolean;
  environment: ActivationReviewEnvironment;
  publicEndpointExposed: false;
}

export interface A13EvidenceSummary {
  failedChecks: number | null;
  approvedBy: string | null;
  failureEscapeCount: number | null;
  readinessStatus: string | null;
  runLedgerStatus: string | null;
  requestsExecuted: number | null;
  shadowRunsAllowed: number | null;
  shadowRunsBlocked: number | null;
  productionBlocked: boolean | null;
  publicEndpointExposed: boolean | null;
  promotionAllowed: boolean | null;
  liveRankingChangeAllowed: boolean | null;
  userResponseChangeAllowed: boolean | null;
  productUseEnabled: boolean | null;
  destructiveRollbackRequired: boolean | null;
  redactedFailureDetailsEmpty: boolean | null;
}

export interface A13EvidenceReadResult {
  loaded: boolean;
  valid: boolean;
  blockers: string[];
  warnings: string[];
  checks: Record<string, boolean>;
  summary: A13EvidenceSummary;
}

export interface FounderResultReview {
  reviewId: string;
  verdict: 'blocked' | 'needs_more_evidence' | 'eligible_for_safe_limited_activation_design';
  evidenceQuality: number;
  safetyQuality: number;
  rankingStabilityQuality: number;
  consentQuality: number;
  traceQuality: number;
  blockers: string[];
  warnings: string[];
  founderDecisionRequired: true;
  productionActivationAllowed: false;
  liveRankingActivationAllowed: false;
}

export interface ActivationReadinessDimension {
  status: RagStatus;
  score: number;
  blocker: boolean;
  reason: string;
  nextAction: string;
}

export interface ActivationReadinessMatrix {
  dimensions: Record<string, ActivationReadinessDimension>;
  productionReadiness: RagStatus;
  realUserReadiness: RagStatus;
  safeLimitedDevActivationDesign: RagStatus;
  overallBlockers: string[];
}

export type GuardrailStatus = 'satisfied' | 'missing' | 'needs_verification';
export interface ActivationGuardrail {
  code: string;
  required: true;
  status: GuardrailStatus;
  failureImpact: 'low' | 'medium' | 'high' | 'blocking';
}

export interface SafeLimitedActivationRollbackPlan {
  disableByEnv: true;
  killSwitchPath: string;
  destructiveRollbackRequired: false;
  liveRankingRollbackRequired: false;
  steps: string[];
}

export interface SafeLimitedActivationPlan {
  planId: string;
  status: 'blocked' | 'draft_ready_for_founder_review';
  scope: 'dev_internal_shadow_only';
  maxUsers: number;
  maxRequests: number;
  durationHours: number;
  requiredApprovals: ['founder'];
  requiredFlags: string[];
  explicitNonGoals: string[];
  guardrails: ActivationGuardrail[];
  stopConditions: string[];
  rollbackPlan: SafeLimitedActivationRollbackPlan;
  allowedActions: string[];
  forbiddenActions: string[];
  blockers: string[];
  liveRankingChangeAllowed: false;
  userResponseChangeAllowed: false;
  productUseEnabled: false;
}

export interface ActivationBlockerBucket {
  bucket: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'blocking';
  nextAction: string;
  blocksActivation: boolean;
}

export interface ActivationDryRunScenario {
  code: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface ActivationDryRunResult {
  simulated: true;
  liveRankingChanged: false;
  userResponseChanged: false;
  productUseEnabled: false;
  publicEndpointExposed: false;
  scenarios: ActivationDryRunScenario[];
  allPassed: boolean;
}

export type ActivationDecisionOption =
  | 'reject'
  | 'request_more_real_dev_evidence'
  | 'approve_safe_limited_dev_shadow_activation';

export type ActivationForbiddenDecisionOption =
  | 'enable_production_ranking'
  | 'enable_public_personalization'
  | 'enable_ai_autonomy';

export interface ActivationDecisionPack {
  title: string;
  verdict: 'blocked' | 'draft_ready_for_founder_review';
  executiveSummary: string;
  evidenceSummary: A13EvidenceSummary;
  readinessMatrix: ActivationReadinessMatrix;
  guardrails: ActivationGuardrail[];
  activationPlan: SafeLimitedActivationPlan;
  blockers: ActivationBlockerBucket[];
  dryRun: ActivationDryRunResult | null;
  requiredFounderDecision: true;
  allowedDecisionOptions: ActivationDecisionOption[];
  forbiddenDecisionOptions: ActivationForbiddenDecisionOption[];
  nextStep: string;
  productUseEnabled: false;
  liveRankingChangedForUser: false;
}

export interface ActivationReviewResult {
  evidence: A13EvidenceReadResult;
  review: FounderResultReview;
  matrix: ActivationReadinessMatrix;
  guardrails: ActivationGuardrail[];
  plan: SafeLimitedActivationPlan;
  blockers: ActivationBlockerBucket[];
  dryRun: ActivationDryRunResult | null;
  decisionPack: ActivationDecisionPack;
  productUseEnabled: false;
  liveRankingChangedForUser: false;
  version: 1;
}

export interface ReadEvidenceOptions {
  artifactOverride?: unknown;
  now?: string;
}
