/**
 * A13 Founder-approved limited dev shadow experiment EXECUTION — types (E18/E43-A13).
 *
 * The first controlled execution layer: run a bounded, Founder-approved, dev-only SHADOW recommendation
 * experiment, capture a safe redacted run ledger + evidence, analyze quality/blockers, prove rollback +
 * kill-switch safety, and produce an execution dossier — WITHOUT changing live ranking or the user
 * response. Pure types only. `liveRankingChange*` / `userResponseChange*` / `productUseEnabled` /
 * `publicEndpointExposed` / `liveRankingChangedForUser` are always literal `false`.
 */

export type ExecutionMode = 'off' | 'service_only' | 'dev_internal_api';
export type ExecutionEnvironment = 'production' | 'development' | 'test' | 'unknown';
export type ExperimentRunMode = 'dry_run' | 'shadow_dev';
export type ExecutionTraceWriteMode = 'off' | 'redacted';

export interface ExecutionConfig {
  mode: ExecutionMode;
  allowRun: boolean;
  maxRequests: number;
  traceWrite: ExecutionTraceWriteMode;
  killSwitch: 'off' | 'on';
}

export interface ExecutionContext {
  config: ExecutionConfig;
  environment: ExecutionEnvironment;
  adminVerified: boolean;
  internalCall?: boolean;
  now?: string;
}

export interface ExecutionAccessEvaluation {
  allowed: boolean;
  mode: ExecutionMode;
  reason: string;
  requiresAdmin: true;
  adminVerified: boolean;
  environment: ExecutionEnvironment;
  publicEndpointExposed: false;
}

export interface ExecutionKillSwitchResult {
  blocked: boolean;
  reasons: string[];
  killSwitchEngaged: boolean;
}

export interface ExperimentExecutionManifestInput {
  experimentKey: string;
  templateKey: string;
  approvedBy: 'founder';
  mode: ExperimentRunMode;
  requestedRequests: number;
  allowRedactedTraceWrite: boolean;
  includeRollbackDrill: boolean;
  includeKillSwitchDrill: boolean;
}

export interface ExperimentExecutionManifest {
  executionId: string;
  experimentKey: string;
  templateKey: string;
  approvedBy: 'founder';
  mode: ExperimentRunMode;
  status: 'blocked' | 'ready' | 'executed';
  requestLimit: number;
  plannedRequests: number;
  plannedShadowRuns: number;
  allowRedactedTraceWrite: boolean;
  safetyConstraints: string[];
  requiredRuntimeFlags: string[];
  blockers: string[];
  liveRankingChangeAllowed: false;
  userResponseChangeAllowed: false;
  productUseEnabled: false;
}

export interface ExperimentRunLedgerCounters {
  requestsAttempted: number;
  requestsExecuted: number;
  shadowRunsAllowed: number;
  shadowRunsBlocked: number;
  tracesAttempted: number;
  tracesWritten: number;
  tracesRejected: number;
  safetyBlocks: number;
  consentBlocks: number;
  rawLeakBlocks: number;
  failuresEscaped: number;
}

export interface ExperimentRunLedger {
  executionId: string;
  startedAt: string;
  completedAt: string | null;
  status: 'not_started' | 'running' | 'completed' | 'blocked' | 'failed_safe';
  counters: ExperimentRunLedgerCounters;
  safety: {
    liveRankingChanged: false;
    userResponseChanged: false;
    traceExposedToUser: false;
    productUseEnabled: false;
  };
  redactedFailureDetails: string[];
}

/** Quality metrics carried on the result so the analyzer is pure over the result. */
export interface ExperimentExecutionMetrics {
  averageTopKOverlap: number | null;
  majorDivergenceRate: number | null;
  weakInputRate: number | null;
  traceRedactionPassRate: number;
  traceWriteEligible: number;
}

export interface ExperimentExecutionAnalysis {
  allowedShadowRunRate: number;
  blockRate: number;
  consentBlockRate: number;
  safetyBlockRate: number;
  traceRedactionPassRate: number;
  traceWriteAcceptanceRate: number;
  averageTopKOverlap: number | null;
  majorDivergenceRate: number | null;
  weakInputRate: number | null;
  failureEscapeCount: number;
  runtimeSafetyStatus: 'safe' | 'unsafe';
  readinessStatus: 'blocked' | 'executed_observable' | 'ready_for_founder_review_of_results';
  warnings: string[];
}

export interface ExperimentRollbackDrill {
  passed: boolean;
  disableByEnv: true;
  killSwitchBlocks: true;
  traceWriteDisableByEnv: true;
  destructiveRollbackRequired: false;
  productionBlocked: true;
  blockers: string[];
}

export interface ExperimentKillSwitchDrill {
  passed: boolean;
  killSwitchBlocksExecution: boolean;
  offModeBlocks: boolean;
  productionBlocks: boolean;
  cleanRunNotOverBlocked: boolean;
  blockers: string[];
}

export type ExecutionForbiddenNextAction =
  | 'enable_production_ranking'
  | 'enable_user_facing_personalization'
  | 'enable_ai_autonomy';

export interface ExperimentExecutionDossier {
  title: string;
  executionId: string;
  verdict: 'blocked' | 'executed_observable' | 'failed_safe';
  summary: string;
  runLedger: ExperimentRunLedger;
  qualityAnalysis: ExperimentExecutionAnalysis;
  rollbackDrill: ExperimentRollbackDrill;
  blockers: string[];
  warnings: string[];
  nextDecisionRequired: 'founder_review_results';
  forbiddenNextActions: ExecutionForbiddenNextAction[];
  productUseEnabled: false;
  liveRankingChangedForUser: false;
}

export interface ExperimentExecutionResult {
  manifest: ExperimentExecutionManifest;
  runLedger: ExperimentRunLedger;
  labSummary: unknown;
  metrics: ExperimentExecutionMetrics;
  analysis: ExperimentExecutionAnalysis;
  rollbackDrill: ExperimentRollbackDrill;
  killSwitchDrill: ExperimentKillSwitchDrill;
  dossier: ExperimentExecutionDossier;
  productUseEnabled: false;
  liveRankingChangedForUser: false;
  version: 1;
}

export interface ExecuteExperimentOptions {
  observedRecipeTotal?: number | null;
  now?: string;
  a8Service?: unknown;
}
