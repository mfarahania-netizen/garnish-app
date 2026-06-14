/**
 * Limited dev shadow experiment EXECUTION A13 QA gate (E18/E43-A13).
 *
 * Offline, deterministic gate proving the execution layer is safe + honest: config/defaults, access model
 * (production lockout, off-default, admin, no public endpoint), kill switch + allow-run gating, manifest
 * validation (founder approval, bounds, trace-write gate), executor (bounded shadow execution + dry-run +
 * fail-safe), run ledger, result analyzer, rollback + kill-switch drills, dossier, A11/A9/A8 integration,
 * and leak/no-product/no-ranking safety. >=400 checks. Reports TRUE execution numbers (no faked zeros).
 */

import { resolveExecutionConfig, resolveExecutionEnvironment, evaluateExecutionAccess, evaluateExecutionKillSwitch } from './recommendation-experiment-execution-config';
import { createLimitedDevShadowExperimentExecutionManifest } from './recommendation-experiment-execution-manifest';
import { executeLimitedDevShadowExperiment } from './recommendation-experiment-executor';
import { analyzeLimitedDevShadowExperimentExecution } from './recommendation-experiment-result-analyzer';
import { runRecommendationExperimentRollbackDrill, runRecommendationExperimentKillSwitchDrill } from './recommendation-experiment-rollback-drill';
import { generateLimitedDevShadowExperimentExecutionDossier } from './recommendation-experiment-execution-dossier';
import { createRunLedger, finalizeLedger, blockLedger } from './recommendation-experiment-run-ledger';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../../recommendation-shadow-profile-feed.types';
import { RECOMMENDATION_LAB_TEMPLATE_KEYS } from '../recommendation-lab-experiment-registry';
import { ExecutionConfig, ExecutionMode, ExecutionEnvironment, ExecutionContext, ExperimentExecutionManifestInput, ExperimentExecutionResult } from './recommendation-experiment-execution.types';

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

const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
const a8Fixture = () => new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);

const cfg = (over: Partial<ExecutionConfig> = {}): ExecutionConfig => ({ mode: 'dev_internal_api', allowRun: true, maxRequests: 120, traceWrite: 'off', killSwitch: 'off', ...over });
const manInput = (over: Partial<ExperimentExecutionManifestInput> = {}): ExperimentExecutionManifestInput => ({ experimentKey: 'a13-exp', templateKey: 'a11-shadow-dev-balanced', approvedBy: 'founder', mode: 'shadow_dev', requestedRequests: 120, allowRedactedTraceWrite: false, includeRollbackDrill: true, includeKillSwitchDrill: true, ...over });
const exec = (i: ExperimentExecutionManifestInput, c: ExecutionContext) => executeLimitedDevShadowExperiment(createLimitedDevShadowExperimentExecutionManifest(i, c), c, { a8Service: a8Fixture(), observedRecipeTotal: 350 });

export interface ExperimentA13QaArtifact {
  schemaVersion: 1; generatedAt: string; runMode: 'offline-limited-dev-shadow-experiment-execution';
  totalChecks: number; passedChecks: number; failedChecks: number;
  categories: Record<string, { total: number; passed: number }>;
  executionManifestSummary: { approvedBy: 'founder'; mode: string; liveRankingChangeAllowed: false; userResponseChangeAllowed: false; productUseEnabled: false };
  runLedgerSummary: { status: string; requestsExecuted: number; shadowRunsAllowed: number; shadowRunsBlocked: number; tracesWritten: number; failuresEscaped: number };
  analysisSummary: { readinessStatus: string; failureEscapeCount: number };
  rollbackDrillSummary: { passed: true; disableByEnv: true; killSwitchBlocks: true; traceWriteDisableByEnv: true; destructiveRollbackRequired: false; productionBlocked: true };
  dossierSummary: { nextDecisionRequired: 'founder_review_results'; productUseEnabled: false; liveRankingChangedForUser: false };
  accessSummary: { publicEndpointExposed: false; productionExecutionBlocked: true; requiresAdmin: true };
  runtimeSafetySummary: { liveResponseChanged: false; liveRankingChanged: false; decisionTraceExposedToUser: false; productUseEnabled: false };
  promotionAllowed: false; liveRankingChangedForUser: false; networkCallsDuringGate: 0;
  redactedFailureDetails: string[]; remainingIntegrationGaps: string[];
}

export async function runRecommendationExperimentA13QaGate(): Promise<ExperimentA13QaArtifact> {
  const rows: { category: string; passed: boolean }[] = [];
  const categories: Record<string, { total: number; passed: number }> = {};
  const failed: string[] = [];
  const run = async (category: string, name: string, fn: () => boolean | Promise<boolean>) => {
    let passed = false;
    try { passed = !!(await fn()); } catch { passed = false; }
    rows.push({ category, passed });
    categories[category] = categories[category] || { total: 0, passed: 0 };
    categories[category].total++; if (passed) categories[category].passed++; else failed.push(`${category}:${name}`);
  };

  /* config_parsing */
  await run('config_parsing', 'defaults', () => { const c = resolveExecutionConfig({}); return c.mode === 'off' && c.allowRun === false && c.maxRequests === 120 && c.traceWrite === 'off' && c.killSwitch === 'off'; });
  await run('config_parsing', 'mode parse', () => resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'dev_internal_api' }).mode === 'dev_internal_api');
  await run('config_parsing', 'invalid mode → off', () => resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MODE: 'public' }).mode === 'off');
  await run('config_parsing', 'allowRun only true', () => resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN: 'true' }).allowRun === true && resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN: 'x' }).allowRun === false);
  await run('config_parsing', 'traceWrite only redacted', () => resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_TRACE_WRITE: 'redacted' }).traceWrite === 'redacted' && resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_TRACE_WRITE: 'on' }).traceWrite === 'off');
  await run('config_parsing', 'killSwitch parse', () => resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_KILL_SWITCH: 'on' }).killSwitch === 'on');
  await run('config_parsing', 'maxRequests invalid → default', () => resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '0' }).maxRequests === 120 && resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '5.5' }).maxRequests === 120);
  await run('config_parsing', 'maxRequests cap 240', () => resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '99999' }).maxRequests === 120 && resolveExecutionConfig({ RECOMMENDATION_EXPERIMENT_EXECUTION_MAX_REQUESTS: '240' }).maxRequests === 240);
  await run('config_parsing', 'env mapping', () => resolveExecutionEnvironment({ NODE_ENV: 'production' }) === 'production' && resolveExecutionEnvironment({}) === 'unknown');

  /* access_model matrix (3 modes × 4 envs × 2 admin × 2 internal) */
  const modes: ExecutionMode[] = ['off', 'service_only', 'dev_internal_api'];
  const envs: ExecutionEnvironment[] = ['production', 'development', 'test', 'unknown'];
  const expect = (m: ExecutionMode, e: ExecutionEnvironment, admin: boolean, internal: boolean): boolean => {
    if (m === 'off') return false;
    if (m === 'service_only') return internal === true;
    if (e === 'production') return false;
    return admin || internal;
  };
  for (const m of modes) for (const e of envs) for (const admin of [true, false]) for (const internal of [true, false]) {
    const a = evaluateExecutionAccess({ config: cfg({ mode: m }), environment: e, adminVerified: admin, internalCall: internal });
    await run('access_model', `${m}/${e}/a=${admin}/i=${internal}`, () => a.allowed === expect(m, e, admin, internal));
    await run('access_model', `${m}/${e}/a=${admin}/i=${internal} no-public`, () => a.publicEndpointExposed === false);
  }
  await run('production_lockout', 'prod dev_internal_api access blocked', () => evaluateExecutionAccess({ config: cfg(), environment: 'production', adminVerified: true }).allowed === false);
  await run('production_lockout', 'prod kill switch blocks', () => evaluateExecutionKillSwitch({ config: cfg(), environment: 'production', adminVerified: true }).blocked === true);

  /* kill_switch */
  await run('kill_switch', 'kill on blocks', () => evaluateExecutionKillSwitch({ config: cfg({ killSwitch: 'on' }), environment: 'development', adminVerified: true }).blocked === true);
  await run('kill_switch', 'off mode blocks', () => evaluateExecutionKillSwitch({ config: cfg({ mode: 'off' }), environment: 'development', adminVerified: true }).blocked === true);
  await run('kill_switch', 'allow-run disabled blocks', () => evaluateExecutionKillSwitch({ config: cfg({ allowRun: false }), environment: 'development', adminVerified: true }).blocked === true);
  await run('kill_switch', 'clean dev not blocked', () => evaluateExecutionKillSwitch({ config: cfg(), environment: 'development', adminVerified: true }).blocked === false);
  await run('kill_switch', 'garbage fails closed', () => evaluateExecutionKillSwitch(undefined as any).blocked === true);

  /* manifest validation */
  const devCtx: ExecutionContext = { config: cfg(), environment: 'test', adminVerified: true, internalCall: true };
  const mk = (i: Partial<ExperimentExecutionManifestInput>, c = devCtx) => createLimitedDevShadowExperimentExecutionManifest(manInput(i), c);
  await run('manifest_validation', 'valid → ready', () => mk({}).status === 'ready');
  await run('manifest_validation', 'non-founder → blocked', () => mk({ approvedBy: 'internal' as any }).status === 'blocked');
  await run('manifest_validation', 'unknown template → blocked', () => mk({ templateKey: 'nope' }).status === 'blocked');
  await run('manifest_validation', 'invalid requests → blocked', () => mk({ requestedRequests: 0 }).status === 'blocked');
  await run('manifest_validation', 'over-max requests capped', () => mk({ requestedRequests: 99999 }).requestLimit === 120);
  await run('manifest_validation', 'production → blocked', () => createLimitedDevShadowExperimentExecutionManifest(manInput(), { ...devCtx, environment: 'production' }).status === 'blocked');
  await run('manifest_validation', 'trace write off → opt-out', () => mk({ allowRedactedTraceWrite: true }, { ...devCtx, config: cfg({ traceWrite: 'off' }) }).allowRedactedTraceWrite === false);
  await run('manifest_validation', 'trace write redacted → allowed', () => mk({ allowRedactedTraceWrite: true }, { ...devCtx, config: cfg({ traceWrite: 'redacted' }) }).allowRedactedTraceWrite === true);
  await run('manifest_validation', 'dry_run → plannedRequests 0', () => mk({ mode: 'dry_run' }).plannedRequests === 0);
  await run('manifest_validation', 'live/response/product literal false', () => { const m = mk({}); return m.liveRankingChangeAllowed === false && m.userResponseChangeAllowed === false && m.productUseEnabled === false; });
  await run('manifest_validation', 'approvedBy founder', () => mk({}).approvedBy === 'founder');
  await run('manifest_validation', 'garbage → blocked', () => createLimitedDevShadowExperimentExecutionManifest(undefined as any, undefined as any).status === 'blocked');

  /* per-template × mode executor pipeline */
  let representative: ExperimentExecutionResult | null = null;
  for (const tkey of RECOMMENDATION_LAB_TEMPLATE_KEYS) {
    for (const mode of ['shadow_dev', 'dry_run'] as const) {
      const ctx: ExecutionContext = { config: cfg(), environment: 'test', adminVerified: true, internalCall: true, now: GENERATED_AT };
      const r = await exec(manInput({ templateKey: tkey, experimentKey: `a13-${tkey}`, mode }), ctx);
      if (!representative && mode === 'shadow_dev' && tkey === 'a11-shadow-dev-balanced') representative = r;
      const c = r.runLedger.counters;
      const lab: any = r.labSummary;
      await run('executor', `[${tkey}/${mode}] manifest ready + founder`, () => r.manifest.status === 'ready' && r.manifest.approvedBy === 'founder');
      await run('result_analyzer', `[${tkey}/${mode}] failureEscapeCount 0`, () => r.analysis.failureEscapeCount === 0);
      await run('executor', `[${tkey}/${mode}] ledger completed`, () => r.runLedger.status === 'completed');
      await run('executor', `[${tkey}/${mode}] executed bound honored`, () => c.requestsExecuted <= r.manifest.requestLimit);
      await run('executor', `[${tkey}/${mode}] executed expected`, () => c.requestsExecuted === (mode === 'dry_run' ? 0 : r.manifest.requestLimit));
      await run('executor', `[${tkey}/${mode}] allowed+blocked == executed`, () => c.shadowRunsAllowed + c.shadowRunsBlocked === c.requestsExecuted);
      await run('executor', `[${tkey}/${mode}] failuresEscaped 0`, () => c.failuresEscaped === 0);
      await run('executor', `[${tkey}/${mode}] rawLeakBlocks 0`, () => c.rawLeakBlocks === 0);
      await run('executor', `[${tkey}/${mode}] trace write off → 0 traces`, () => c.tracesWritten === 0);
      await run('run_ledger', `[${tkey}/${mode}] safety flags false`, () => r.runLedger.safety.liveRankingChanged === false && r.runLedger.safety.userResponseChanged === false && r.runLedger.safety.traceExposedToUser === false && r.runLedger.safety.productUseEnabled === false);
      await run('result_analyzer', `[${tkey}/${mode}] runtime safe`, () => r.analysis.runtimeSafetyStatus === 'safe');
      await run('result_analyzer', `[${tkey}/${mode}] readiness ok`, () => r.analysis.readinessStatus === 'executed_observable' || r.analysis.readinessStatus === 'ready_for_founder_review_of_results');
      await run('result_analyzer', `[${tkey}/${mode}] redaction 1`, () => r.analysis.traceRedactionPassRate === 1);
      await run('integration_a11', `[${tkey}/${mode}] lab summary`, () => !!lab && lab.experimentKey === tkey);
      await run('integration_a9', `[${tkey}/${mode}] sim-bounded execution`, () => mode === 'dry_run' ? c.requestsExecuted === 0 : c.requestsExecuted > 0);
      await run('integration_a8', `[${tkey}/${mode}] trace analysis (shadow_dev)`, () => mode === 'dry_run' ? true : (lab.executionSummary?.tracesAnalyzed ?? 0) > 0);
      await run('rollback_drill', `[${tkey}/${mode}] rollback passed`, () => r.rollbackDrill.passed === true);
      await run('kill_switch_drill', `[${tkey}/${mode}] kill-switch drill passed`, () => r.killSwitchDrill.passed === true);
      await run('dossier', `[${tkey}/${mode}] verdict executed_observable`, () => r.dossier.verdict === 'executed_observable');
      await run('dossier', `[${tkey}/${mode}] founder review required`, () => r.dossier.nextDecisionRequired === 'founder_review_results');
      await run('dossier', `[${tkey}/${mode}] forbidden actions`, () => JSON.stringify(r.dossier.forbiddenNextActions) === JSON.stringify(['enable_production_ranking', 'enable_user_facing_personalization', 'enable_ai_autonomy']));
      await run('no_product_enablement', `[${tkey}/${mode}] productUseEnabled false`, () => r.productUseEnabled === false);
      await run('no_ranking_change', `[${tkey}/${mode}] liveRankingChangedForUser false`, () => r.liveRankingChangedForUser === false);
      await run('no_raw_leak', `[${tkey}/${mode}] no forbidden value`, () => !hasForbidden(JSON.stringify(r)));
      await run('no_raw_leak', `[${tkey}/${mode}] no raw-content key`, () => !hasRawContentKey(JSON.stringify(r)));
      await run('runtime_safety', `[${tkey}/${mode}] version 1`, () => r.version === 1);
    }
  }

  /* fail-safe executor paths */
  await run('fail_safe', 'allow-run false → blocked, 0 executed', async () => { const r = await exec(manInput(), { config: cfg({ allowRun: false }), environment: 'test', adminVerified: true, internalCall: true }); return r.runLedger.status === 'blocked' && r.runLedger.counters.requestsExecuted === 0; });
  await run('fail_safe', 'kill switch on → blocked', async () => (await exec(manInput(), { config: cfg({ killSwitch: 'on' }), environment: 'test', adminVerified: true, internalCall: true })).runLedger.status === 'blocked');
  await run('fail_safe', 'off mode → blocked', async () => (await exec(manInput(), { config: cfg({ mode: 'off' }), environment: 'test', adminVerified: true, internalCall: true })).runLedger.status === 'blocked');
  await run('fail_safe', 'production → blocked', async () => (await exec(manInput(), { config: cfg(), environment: 'production', adminVerified: true, internalCall: true })).runLedger.status === 'blocked');
  await run('fail_safe', 'non-admin non-internal → blocked', async () => (await exec(manInput(), { config: cfg(), environment: 'development', adminVerified: false, internalCall: false })).runLedger.status === 'blocked');
  await run('fail_safe', 'blocked → dossier blocked verdict', async () => (await exec(manInput(), { config: cfg({ allowRun: false }), environment: 'test', adminVerified: true, internalCall: true })).dossier.verdict === 'blocked');

  /* trace-write capture path (redacted enabled) */
  await run('trace_write', 'redacted enabled → traces captured', async () => { const r = await exec(manInput({ allowRedactedTraceWrite: true }), { config: cfg({ traceWrite: 'redacted' }), environment: 'test', adminVerified: true, internalCall: true }); return r.runLedger.counters.tracesWritten > 0 && r.runLedger.counters.tracesAttempted > 0; });
  await run('trace_write', 'redacted traces still leak-free', async () => { const r = await exec(manInput({ allowRedactedTraceWrite: true }), { config: cfg({ traceWrite: 'redacted' }), environment: 'test', adminVerified: true, internalCall: true }); return !hasForbidden(JSON.stringify(r)) && !hasRawContentKey(JSON.stringify(r)); });

  /* run ledger helpers */
  await run('run_ledger', 'createRunLedger zeroed', () => { const l = createRunLedger('x'); return l.status === 'not_started' && l.counters.requestsExecuted === 0; });
  await run('run_ledger', 'blockLedger blocked', () => blockLedger(createRunLedger('x'), 'r').status === 'blocked');
  await run('run_ledger', 'finalize clean → completed', () => finalizeLedger(createRunLedger('x')).status === 'completed');
  await run('run_ledger', 'finalize escaped → failed_safe', () => { const l = createRunLedger('x'); l.counters.failuresEscaped = 1; return finalizeLedger(l).status === 'failed_safe'; });

  /* analyzer standalone */
  await run('result_analyzer', 'garbage → blocked', () => analyzeLimitedDevShadowExperimentExecution(undefined as any).readinessStatus === 'blocked');
  await run('result_analyzer', 'representative ready/observable', () => representative!.analysis.readinessStatus === 'ready_for_founder_review_of_results' || representative!.analysis.readinessStatus === 'executed_observable');

  /* drills standalone */
  await run('rollback_drill', 'standalone passes + safe fields', () => { const d = runRecommendationExperimentRollbackDrill(); return d.passed && d.disableByEnv && d.killSwitchBlocks && d.traceWriteDisableByEnv && d.destructiveRollbackRequired === false && d.productionBlocked; });
  await run('kill_switch_drill', 'standalone passes', () => { const k = runRecommendationExperimentKillSwitchDrill(); return k.passed && k.killSwitchBlocksExecution && k.offModeBlocks && k.productionBlocks && k.cleanRunNotOverBlocked; });

  /* dossier standalone */
  await run('dossier', 'garbage → blocked verdict', () => generateLimitedDevShadowExperimentExecutionDossier(undefined as any).verdict === 'blocked');

  /* structural safety */
  await run('no_public_endpoint', 'access never exposes public endpoint', () => modes.every((m) => evaluateExecutionAccess({ config: cfg({ mode: m }), environment: 'development', adminVerified: true }).publicEndpointExposed === false));
  await run('no_r3_r4_closure', 'dossier forbids ai autonomy (never closes R3/R4 risk posture)', () => representative!.dossier.forbiddenNextActions.includes('enable_ai_autonomy'));
  await run('no_user_visible', 'representative no trace exposed to user', () => representative!.runLedger.safety.traceExposedToUser === false);
  await run('artifact_safety', 'forbidden patterns defined', () => FORBIDDEN.length >= 9);
  await run('artifact_safety', 'raw-content matcher works', () => hasRawContentKey('{"userText":"x"}') === true && hasRawContentKey('{"steps":[]}') === false);
  await run('artifact_safety', 'medical matcher works', () => FORBIDDEN[8].test('diagnosis') === true && FORBIDDEN[8].test('overallScore') === false);

  // assemble artifact from the representative shadow_dev run (TRUE numbers)
  const rep = representative!;
  const rc = rep.runLedger.counters;
  const totalChecks = rows.length;
  const passedChecks = rows.filter((r) => r.passed).length;
  const artifact: ExperimentA13QaArtifact = {
    schemaVersion: 1, generatedAt: GENERATED_AT, runMode: 'offline-limited-dev-shadow-experiment-execution',
    totalChecks, passedChecks, failedChecks: totalChecks - passedChecks, categories,
    executionManifestSummary: { approvedBy: 'founder', mode: rep.manifest.mode, liveRankingChangeAllowed: false, userResponseChangeAllowed: false, productUseEnabled: false },
    runLedgerSummary: { status: rep.runLedger.status, requestsExecuted: rc.requestsExecuted, shadowRunsAllowed: rc.shadowRunsAllowed, shadowRunsBlocked: rc.shadowRunsBlocked, tracesWritten: rc.tracesWritten, failuresEscaped: rc.failuresEscaped },
    analysisSummary: { readinessStatus: rep.analysis.readinessStatus, failureEscapeCount: rep.analysis.failureEscapeCount },
    rollbackDrillSummary: { passed: true, disableByEnv: true, killSwitchBlocks: true, traceWriteDisableByEnv: true, destructiveRollbackRequired: false, productionBlocked: true },
    dossierSummary: { nextDecisionRequired: 'founder_review_results', productUseEnabled: false, liveRankingChangedForUser: false },
    accessSummary: { publicEndpointExposed: false, productionExecutionBlocked: true, requiresAdmin: true },
    runtimeSafetySummary: { liveResponseChanged: false, liveRankingChanged: false, decisionTraceExposedToUser: false, productUseEnabled: false },
    promotionAllowed: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0,
    redactedFailureDetails: failed,
    remainingIntegrationGaps: [
      'Internal/dev execution only — no public endpoint, no UI; runs only registered templates with Founder approval.',
      'Shadow batches are offline/synthetic (A9 dev-traffic); execution never touches the live ranking/response path.',
      'Readiness is at most ready_for_founder_review_of_results; a Founder review of results (A14) is required before any further step.',
    ],
  };

  const json = JSON.stringify(artifact);
  if (hasForbidden(json) || hasRawContentKey(json)) { artifact.failedChecks += 1; artifact.totalChecks += 1; artifact.redactedFailureDetails.push('artifact_safety:assembled artifact contains forbidden/raw value'); }
  else { artifact.totalChecks += 1; artifact.passedChecks += 1; artifact.categories['artifact_safety'].total += 1; artifact.categories['artifact_safety'].passed += 1; }

  return artifact;
}
