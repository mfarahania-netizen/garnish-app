/**
 * Founder results review + safe limited activation plan A14 QA gate (E18/E43-A14).
 *
 * Offline, deterministic gate proving the activation-review layer is safe + honest: config/defaults, access
 * model (production lockout, off-default, admin, no public endpoint), A13 evidence reader, founder review,
 * readiness matrix (production red, real-user not green), guardrails, activation plan caps, blocker
 * classifier, dry-run simulation, decision pack — across a matrix of valid + tampered evidence scenarios.
 * >=450 checks. A14 PLANS and validates; it never activates anything.
 */

import { resolveActivationReviewConfig, resolveActivationReviewEnvironment, evaluateActivationReviewAccess } from './recommendation-activation-review-config';
import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';
import { reviewLimitedDevShadowExperimentResults } from './recommendation-activation-review-model';
import { buildRecommendationActivationReadinessMatrix } from './recommendation-activation-readiness-matrix';
import { defineSafeLimitedActivationGuardrails, MANDATORY_GUARDRAIL_COUNT } from './recommendation-activation-guardrails';
import { generateSafeLimitedActivationPlan } from './recommendation-activation-plan-generator';
import { classifyActivationBlockers } from './recommendation-activation-blockers';
import { simulateSafeLimitedActivationDryRun } from './recommendation-activation-dry-run';
import { generateActivationDecisionPack } from './recommendation-activation-decision-pack';
import { RecommendationActivationReviewService } from './recommendation-activation-review-service';
import { ActivationReviewConfig, ActivationReviewMode, ActivationReviewEnvironment, ActivationReviewContext, ActivationReviewResult } from './recommendation-activation-review.types';

const GENERATED_AT = '2026-06-15T00:00:00.000Z';

const FORBIDDEN: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /\b(?:\+?98|0)9\d{9}\b/,
  /\beyJ[A-Za-z0-9._-]{10,}/,
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  /\bAIza[A-Za-z0-9_-]{8,}/,
  /\bsk-[A-Za-z0-9_-]{8,}/,
  /BEGIN (?:RSA |EC )?PRIVATE KEY/,
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\//i,
  /\b(diagnosis|diagnose[ds]?|diagnosing|pregnan\w+|eating disorder|mental health|medical condition|ethnicity|sexual\w*)\b/i,
];
const hasForbidden = (s: string) => FORBIDDEN.some((re) => re.test(s));
const hasRawContentKey = (s: string) => /"(userText|recipeBody|prompt|aiOutput|rawTrace|rawPayload|eventPayload)"/i.test(s);

const VALID_A13 = () => ({
  schemaVersion: 1, runMode: 'offline-limited-dev-shadow-experiment-execution',
  totalChecks: 408, passedChecks: 408, failedChecks: 0,
  executionManifestSummary: { approvedBy: 'founder', mode: 'shadow_dev', liveRankingChangeAllowed: false, userResponseChangeAllowed: false, productUseEnabled: false },
  runLedgerSummary: { status: 'completed', requestsExecuted: 120, shadowRunsAllowed: 96, shadowRunsBlocked: 24, tracesWritten: 0, failuresEscaped: 0 },
  analysisSummary: { readinessStatus: 'ready_for_founder_review_of_results', failureEscapeCount: 0 },
  rollbackDrillSummary: { passed: true, disableByEnv: true, killSwitchBlocks: true, traceWriteDisableByEnv: true, destructiveRollbackRequired: false, productionBlocked: true },
  dossierSummary: { nextDecisionRequired: 'founder_review_results', productUseEnabled: false, liveRankingChangedForUser: false },
  accessSummary: { publicEndpointExposed: false, productionExecutionBlocked: true, requiresAdmin: true },
  runtimeSafetySummary: { liveResponseChanged: false, liveRankingChanged: false, decisionTraceExposedToUser: false, productUseEnabled: false },
  promotionAllowed: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0, redactedFailureDetails: [], remainingIntegrationGaps: [],
});

const cfg = (over: Partial<ActivationReviewConfig> = {}): ActivationReviewConfig => ({ mode: 'dev_internal_api', requireAdmin: true, allowDryRun: true, maxTraceRead: 500, ...over });
const ctx = (over: Partial<ActivationReviewContext> = {}): ActivationReviewContext => ({ config: cfg(), environment: 'test', adminVerified: true, internalCall: true, now: GENERATED_AT, ...over });

interface Scenario { key: string; expectValid: boolean; artifact: any }
const SCENARIOS: Scenario[] = [
  { key: 'valid', expectValid: true, artifact: VALID_A13() },
  { key: 'failed_checks', expectValid: false, artifact: { ...VALID_A13(), failedChecks: 3 } },
  { key: 'non_founder', expectValid: false, artifact: { ...VALID_A13(), executionManifestSummary: { ...VALID_A13().executionManifestSummary, approvedBy: 'internal' } } },
  { key: 'product_use_true', expectValid: false, artifact: { ...VALID_A13(), runtimeSafetySummary: { ...VALID_A13().runtimeSafetySummary, productUseEnabled: true } } },
  { key: 'promotion_true', expectValid: false, artifact: { ...VALID_A13(), promotionAllowed: true } },
  { key: 'wrong_run_mode', expectValid: false, artifact: { ...VALID_A13(), runMode: 'x' } },
  { key: 'empty_artifact', expectValid: false, artifact: {} },
  { key: 'live_ranking_true', expectValid: false, artifact: { ...VALID_A13(), executionManifestSummary: { ...VALID_A13().executionManifestSummary, liveRankingChangeAllowed: true } } },
  { key: 'destructive_rollback', expectValid: false, artifact: { ...VALID_A13(), rollbackDrillSummary: { ...VALID_A13().rollbackDrillSummary, destructiveRollbackRequired: true } } },
];

export interface ActivationA14QaArtifact {
  schemaVersion: 1; generatedAt: string; runMode: 'offline-founder-results-review-activation-plan-evaluation';
  totalChecks: number; passedChecks: number; failedChecks: number;
  categories: Record<string, { total: number; passed: number }>;
  a13EvidenceSummary: { loaded: boolean; valid: boolean; failureEscapeCount: number | null; promotionAllowed: boolean | null };
  founderReviewSummary: { founderDecisionRequired: true; productionActivationAllowed: false; liveRankingActivationAllowed: false };
  readinessMatrixSummary: { productionReadiness: string; realUserReadiness: string; safeLimitedDevActivationDesign: string };
  activationPlanSummary: { scope: string; maxUsers: number; maxRequests: number; durationHours: number; liveRankingChangeAllowed: false; userResponseChangeAllowed: false; productUseEnabled: false };
  guardrailSummary: { mandatoryGuardrails: number; blockingMissingGuardrails: number };
  dryRunSummary: { allPassed: boolean; liveRankingChanged: false; userResponseChanged: false; productUseEnabled: false; publicEndpointExposed: false };
  decisionPackSummary: { requiredFounderDecision: true; forbiddenDecisionOptions: string[] };
  accessSummary: { publicEndpointExposed: false; productionExecutionBlocked: true; requiresAdmin: true };
  runtimeSafetySummary: { liveResponseChanged: false; liveRankingChanged: false; decisionTraceExposedToUser: false; productUseEnabled: false };
  promotionAllowed: false; liveRankingChangedForUser: false; networkCallsDuringGate: 0;
  redactedFailureDetails: string[]; remainingIntegrationGaps: string[];
}

export async function runRecommendationActivationA14QaGate(): Promise<ActivationA14QaArtifact> {
  const rows: { category: string; passed: boolean }[] = [];
  const categories: Record<string, { total: number; passed: number }> = {};
  const failed: string[] = [];
  const run = (category: string, name: string, fn: () => boolean) => {
    let passed = false;
    try { passed = !!fn(); } catch { passed = false; }
    rows.push({ category, passed });
    categories[category] = categories[category] || { total: 0, passed: 0 };
    categories[category].total++; if (passed) categories[category].passed++; else failed.push(`${category}:${name}`);
  };

  /* config_parsing */
  run('config_parsing', 'defaults', () => { const c = resolveActivationReviewConfig({}); return c.mode === 'off' && c.requireAdmin === true && c.allowDryRun === false && c.maxTraceRead === 500; });
  run('config_parsing', 'mode parse', () => resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'dev_internal_api' }).mode === 'dev_internal_api');
  run('config_parsing', 'invalid mode → off', () => resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'public' }).mode === 'off');
  run('config_parsing', 'requireAdmin only false disables', () => resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_REQUIRE_ADMIN: 'false' }).requireAdmin === false && resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_REQUIRE_ADMIN: 'x' }).requireAdmin === true);
  run('config_parsing', 'allowDryRun only true', () => resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN: 'true' }).allowDryRun === true && resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN: 'x' }).allowDryRun === false);
  run('config_parsing', 'maxTraceRead invalid → default', () => resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ: '0' }).maxTraceRead === 500 && resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ: '5.5' }).maxTraceRead === 500);
  run('config_parsing', 'maxTraceRead cap', () => resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ: '999999' }).maxTraceRead === 500 && resolveActivationReviewConfig({ RECOMMENDATION_ACTIVATION_REVIEW_MAX_TRACE_READ: '1000' }).maxTraceRead === 1000);
  run('config_parsing', 'env mapping', () => resolveActivationReviewEnvironment({ NODE_ENV: 'production' }) === 'production' && resolveActivationReviewEnvironment({}) === 'unknown');

  /* access_model matrix */
  const modes: ActivationReviewMode[] = ['off', 'service_only', 'dev_internal_api'];
  const envs: ActivationReviewEnvironment[] = ['production', 'development', 'test', 'unknown'];
  const expect = (m: ActivationReviewMode, e: ActivationReviewEnvironment, admin: boolean, internal: boolean): boolean => {
    if (m === 'off') return false;
    if (m === 'service_only') return internal === true;
    if (e === 'production') return false;
    return admin || internal;
  };
  for (const m of modes) for (const e of envs) for (const admin of [true, false]) for (const internal of [true, false]) {
    const a = evaluateActivationReviewAccess({ config: cfg({ mode: m }), environment: e, adminVerified: admin, internalCall: internal });
    run('access_model', `${m}/${e}/a=${admin}/i=${internal}`, () => a.allowed === expect(m, e, admin, internal));
    run('access_model', `${m}/${e}/a=${admin}/i=${internal} no-public`, () => a.publicEndpointExposed === false);
  }
  run('production_lockout', 'prod dev_internal_api blocked', () => evaluateActivationReviewAccess({ config: cfg(), environment: 'production', adminVerified: true }).allowed === false);
  run('production_lockout', 'off blocked even admin', () => evaluateActivationReviewAccess({ config: cfg({ mode: 'off' }), environment: 'development', adminVerified: true }).allowed === false);
  run('production_lockout', 'REQUIRE_ADMIN=false no HTTP access without admin', () => evaluateActivationReviewAccess({ config: cfg({ requireAdmin: false }), environment: 'development', adminVerified: false, internalCall: false }).allowed === false);

  /* a13_evidence_reader detail */
  run('a13_evidence_reader', 'valid override → valid', () => readA13ExecutionEvidence(undefined, { artifactOverride: VALID_A13() }).valid === true);
  run('a13_evidence_reader', 'real on-disk artifact → loaded+valid', () => { const r = readA13ExecutionEvidence(ctx()); return r.loaded === true && r.valid === true; });
  run('a13_evidence_reader', 'empty → invalid no crash', () => readA13ExecutionEvidence(undefined, { artifactOverride: {} }).valid === false);
  for (const k of ['schemaVersion', 'runMode', 'failedChecksZero', 'approvedByFounder', 'liveRankingChangeNotAllowed', 'userResponseChangeNotAllowed', 'productUseDisabled', 'failureEscapeZero', 'noDestructiveRollback', 'productionBlocked', 'noPublicEndpoint', 'promotionNotAllowed', 'redactedFailuresEmpty']) {
    run('a13_evidence_reader', `check present: ${k}`, () => k in readA13ExecutionEvidence(undefined, { artifactOverride: VALID_A13() }).checks);
  }

  /* pipeline scenario matrix (service-driven, with dry-run) */
  const service = new RecommendationActivationReviewService();
  let representative: ActivationReviewResult | null = null;
  for (const sc of SCENARIOS) {
    const r = service.buildReview(ctx(), { artifactOverride: sc.artifact, withDryRun: true });
    if (sc.key === 'valid') representative = r;
    const json = JSON.stringify(r);
    run('founder_review', `[${sc.key}] evidence.valid expected`, () => r.evidence.valid === sc.expectValid);
    run('founder_review', `[${sc.key}] productionActivationAllowed false`, () => r.review.productionActivationAllowed === false);
    run('founder_review', `[${sc.key}] liveRankingActivationAllowed false`, () => r.review.liveRankingActivationAllowed === false);
    run('founder_review', `[${sc.key}] founderDecisionRequired true`, () => r.review.founderDecisionRequired === true);
    run('founder_review', `[${sc.key}] verdict matches validity`, () => sc.expectValid ? r.review.verdict === 'eligible_for_safe_limited_activation_design' : r.review.verdict === 'blocked');
    run('readiness_matrix', `[${sc.key}] production red`, () => r.matrix.productionReadiness === 'red');
    run('readiness_matrix', `[${sc.key}] real-user not green`, () => r.matrix.realUserReadiness !== 'green');
    run('readiness_matrix', `[${sc.key}] design status`, () => sc.expectValid ? r.matrix.safeLimitedDevActivationDesign === 'green' : r.matrix.safeLimitedDevActivationDesign === 'red');
    run('activation_plan', `[${sc.key}] maxUsers<=5`, () => r.plan.maxUsers <= 5);
    run('activation_plan', `[${sc.key}] maxRequests<=240`, () => r.plan.maxRequests <= 240);
    run('activation_plan', `[${sc.key}] durationHours<=24`, () => r.plan.durationHours <= 24);
    run('activation_plan', `[${sc.key}] scope dev_internal_shadow_only`, () => r.plan.scope === 'dev_internal_shadow_only');
    run('activation_plan', `[${sc.key}] plan status matches`, () => sc.expectValid ? r.plan.status === 'draft_ready_for_founder_review' : r.plan.status === 'blocked');
    run('activation_plan', `[${sc.key}] forbidden actions`, () => ['enable production ranking', 'enable public personalization', 'enable AI autonomy', 'disable consent checks', 'disable trace redaction', 'bypass kill switch'].every((a) => r.plan.forbiddenActions.includes(a)));
    run('no_ranking_change', `[${sc.key}] plan liveRankingChangeAllowed false`, () => r.plan.liveRankingChangeAllowed === false);
    run('no_user_response_change', `[${sc.key}] plan userResponseChangeAllowed false`, () => r.plan.userResponseChangeAllowed === false);
    run('no_product_enablement', `[${sc.key}] plan productUseEnabled false`, () => r.plan.productUseEnabled === false);
    run('blocker_classifier', `[${sc.key}] founder_decision blocks`, () => r.blockers.find((b) => b.bucket === 'founder_decision_required')!.blocksActivation === true);
    run('blocker_classifier', `[${sc.key}] production_not_allowed present`, () => r.blockers.some((b) => b.bucket === 'production_not_allowed'));
    run('no_r3_r4_closure', `[${sc.key}] r3_r4_mitigating present`, () => r.blockers.some((b) => b.bucket === 'r3_r4_mitigating'));
    run('dry_run', `[${sc.key}] dry-run all passed`, () => !!r.dryRun && r.dryRun.allPassed === true);
    run('dry_run', `[${sc.key}] dry-run no live change`, () => !!r.dryRun && r.dryRun.liveRankingChanged === false && r.dryRun.userResponseChanged === false && r.dryRun.publicEndpointExposed === false);
    run('decision_pack', `[${sc.key}] verdict matches`, () => sc.expectValid ? r.decisionPack.verdict === 'draft_ready_for_founder_review' : r.decisionPack.verdict === 'blocked');
    run('decision_pack', `[${sc.key}] founder decision required`, () => r.decisionPack.requiredFounderDecision === true);
    run('decision_pack', `[${sc.key}] forbidden options`, () => JSON.stringify(r.decisionPack.forbiddenDecisionOptions) === JSON.stringify(['enable_production_ranking', 'enable_public_personalization', 'enable_ai_autonomy']));
    run('decision_pack', `[${sc.key}] allowed options`, () => JSON.stringify(r.decisionPack.allowedDecisionOptions) === JSON.stringify(['reject', 'request_more_real_dev_evidence', 'approve_safe_limited_dev_shadow_activation']));
    run('no_production_activation', `[${sc.key}] no production-ranking in allowed`, () => !r.decisionPack.allowedDecisionOptions.some((o) => /production/.test(o)));
    run('runtime_safety', `[${sc.key}] result flags false`, () => r.productUseEnabled === false && r.liveRankingChangedForUser === false);
    run('no_raw_leak', `[${sc.key}] no forbidden value`, () => !hasForbidden(json));
    run('no_raw_leak', `[${sc.key}] no raw-content key`, () => !hasRawContentKey(json));
  }

  /* guardrail detail */
  const repReview = representative!.review;
  const guards = defineSafeLimitedActivationGuardrails(repReview);
  run('guardrails', 'mandatory count >= 12', () => guards.length >= 12 && MANDATORY_GUARDRAIL_COUNT >= 12);
  run('guardrails', 'all required', () => guards.every((g) => g.required === true));
  run('guardrails', 'no blocking missing', () => guards.filter((g) => g.failureImpact === 'blocking' && g.status === 'missing').length === 0);
  for (const code of ['founder_approval_required', 'dev_only_mode', 'admin_only_internal_access', 'feature_flag_off_by_default', 'kill_switch_on_call_path', 'sample_cap', 'trace_write_redacted_only', 'consent_required', 'no_public_exposure', 'no_live_ranking_mutation', 'no_user_response_mutation', 'rollback_by_env', 'monitoring_threshold', 'immediate_stop_conditions']) {
    run('guardrails', `code present: ${code}`, () => guards.some((g) => g.code === code));
  }

  /* readiness dimension detail */
  const repMatrix = representative!.matrix;
  for (const dimk of ['evidenceCompleteness', 'safetyGuardrails', 'consentEnforcement', 'traceRedaction', 'rollbackReadiness', 'killSwitchReadiness', 'performanceBounds', 'observability', 'sampleQuality', 'realUserReadiness', 'productionReadiness']) {
    run('readiness_matrix', `dimension present: ${dimk}`, () => !!repMatrix.dimensions[dimk] && ['red', 'yellow', 'green'].includes(repMatrix.dimensions[dimk].status));
  }
  run('readiness_matrix', 'production red blocker semantics', () => repMatrix.dimensions.productionReadiness.status === 'red');
  run('readiness_matrix', 'valid → no overall design blockers', () => repMatrix.overallBlockers.length === 0);

  /* blocker bucket detail */
  const repBlockers = representative!.blockers;
  for (const bk of ['missing_evidence', 'safety_failure', 'consent_gap', 'trace_redaction_gap', 'rollback_gap', 'kill_switch_gap', 'observability_gap', 'sample_quality_gap', 'real_user_gap', 'production_not_allowed', 'r3_r4_mitigating', 'founder_decision_required']) {
    run('blocker_classifier', `bucket present: ${bk}`, () => repBlockers.some((b) => b.bucket === bk));
  }
  run('blocker_classifier', 'valid → safety/trace/consent gaps 0', () => ['safety_failure', 'trace_redaction_gap', 'consent_gap', 'rollback_gap', 'kill_switch_gap'].every((bk) => repBlockers.find((b) => b.bucket === bk)!.count === 0));

  /* dry-run detail */
  const repDry = representative!.dryRun!;
  for (const code of ['flag_off_default', 'flag_on_dev_only', 'kill_switch_on', 'missing_consent', 'trace_redaction_failure', 'threshold_breach', 'rollback_by_env', 'production_blocked']) {
    run('dry_run', `scenario present: ${code}`, () => repDry.scenarios.some((s) => s.code === code && s.passed));
  }

  /* decision pack standalone */
  run('decision_pack', 'garbage → blocked', () => generateActivationDecisionPack(undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, null).verdict === 'blocked');

  /* structural safety */
  run('no_public_endpoint', 'access never exposes public endpoint', () => modes.every((m) => evaluateActivationReviewAccess({ config: cfg({ mode: m }), environment: 'development', adminVerified: true }).publicEndpointExposed === false));
  run('no_production_activation', 'plan scope never production', () => representative!.plan.scope === 'dev_internal_shadow_only');
  run('artifact_safety', 'forbidden patterns defined', () => FORBIDDEN.length >= 9);
  run('artifact_safety', 'raw-content matcher works', () => hasRawContentKey('{"userText":"x"}') === true && hasRawContentKey('{"steps":[]}') === false);
  run('artifact_safety', 'medical matcher works', () => FORBIDDEN[8].test('diagnosis') === true && FORBIDDEN[8].test('overallScore') === false);

  // assemble artifact from the representative (valid) run
  const rep = representative!;
  const totalChecks = rows.length;
  const passedChecks = rows.filter((r) => r.passed).length;
  const artifact: ActivationA14QaArtifact = {
    schemaVersion: 1, generatedAt: GENERATED_AT, runMode: 'offline-founder-results-review-activation-plan-evaluation',
    totalChecks, passedChecks, failedChecks: totalChecks - passedChecks, categories,
    a13EvidenceSummary: { loaded: rep.evidence.loaded, valid: rep.evidence.valid, failureEscapeCount: rep.evidence.summary.failureEscapeCount, promotionAllowed: rep.evidence.summary.promotionAllowed },
    founderReviewSummary: { founderDecisionRequired: true, productionActivationAllowed: false, liveRankingActivationAllowed: false },
    readinessMatrixSummary: { productionReadiness: rep.matrix.productionReadiness, realUserReadiness: rep.matrix.realUserReadiness, safeLimitedDevActivationDesign: rep.matrix.safeLimitedDevActivationDesign },
    activationPlanSummary: { scope: rep.plan.scope, maxUsers: rep.plan.maxUsers, maxRequests: rep.plan.maxRequests, durationHours: rep.plan.durationHours, liveRankingChangeAllowed: false, userResponseChangeAllowed: false, productUseEnabled: false },
    guardrailSummary: { mandatoryGuardrails: rep.guardrails.length, blockingMissingGuardrails: rep.guardrails.filter((g) => g.failureImpact === 'blocking' && g.status === 'missing').length },
    dryRunSummary: { allPassed: rep.dryRun!.allPassed, liveRankingChanged: false, userResponseChanged: false, productUseEnabled: false, publicEndpointExposed: false },
    decisionPackSummary: { requiredFounderDecision: true, forbiddenDecisionOptions: rep.decisionPack.forbiddenDecisionOptions },
    accessSummary: { publicEndpointExposed: false, productionExecutionBlocked: true, requiresAdmin: true },
    runtimeSafetySummary: { liveResponseChanged: false, liveRankingChanged: false, decisionTraceExposedToUser: false, productUseEnabled: false },
    promotionAllowed: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0,
    redactedFailureDetails: failed,
    remainingIntegrationGaps: [
      'Internal/dev planning + dry-run only — no public endpoint, no UI; nothing is activated.',
      'A13 evidence is offline/synthetic dev-traffic; real-user readiness is not green and production readiness is red.',
      'Safe limited dev-shadow activation is a DRAFT for Founder review; A15 (founder decision + first guarded activation) is the only next step.',
    ],
  };

  const json = JSON.stringify(artifact);
  if (hasForbidden(json) || hasRawContentKey(json)) { artifact.failedChecks += 1; artifact.totalChecks += 1; artifact.redactedFailureDetails.push('artifact_safety:assembled artifact contains forbidden/raw value'); }
  else { artifact.totalChecks += 1; artifact.passedChecks += 1; artifact.categories['artifact_safety'].total += 1; artifact.categories['artifact_safety'].passed += 1; }

  return artifact;
}
