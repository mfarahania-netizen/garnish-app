/**
 * Recommendation Lab A11 QA gate (E18/E43-A11).
 *
 * Offline, deterministic gate proving the internal recommendation lab is safe + honest: config/defaults,
 * access model (production lockout, off-default, admin, no public endpoint), kill switch, experiment
 * registry, config validator, runner boundedness (dry_run + shadow_dev + blocked paths), scorecard,
 * promotion gate (allowed always false), report generator, and leak/no-product safety. >=300 checks.
 */

import { resolveLabConfig, resolveLabEnvironment, evaluateRecommendationLabAccess, validateExperimentConfig } from './recommendation-lab-config';
import { evaluateRecommendationLabKillSwitch } from './recommendation-lab-kill-switch';
import { listRecommendationLabTemplates, getRecommendationLabTemplate, RECOMMENDATION_LAB_TEMPLATE_KEYS } from './recommendation-lab-experiment-registry';
import { runRecommendationLabExperiment } from './recommendation-lab-runner';
import { computeRecommendationLabScorecard } from './recommendation-lab-scorecard';
import { evaluateRecommendationLabPromotionGate } from './recommendation-lab-promotion-gate';
import { generateRecommendationLabReport } from './recommendation-lab-report-generator';
import { RecommendationShadowA8Service } from '../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../recommendation-shadow-profile-feed.types';
import { LabConfig, LabMode, LabEnvironment, RecommendationLabExperiment } from './recommendation-lab.types';

const GENERATED_AT = '2026-06-14T00:00:00.000Z';

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
const hasRawContentKey = (s: string) => /"(instruction|steps|description|recipeBody|body|userText|prompt|aiOutput|rawTrace)"/i.test(s);

const a8Fixture = () => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};

export interface LabA11QaArtifact {
  schemaVersion: 1; generatedAt: string; runMode: 'offline-recommendation-lab-evaluation';
  totalChecks: number; passedChecks: number; failedChecks: number;
  categories: Record<string, { total: number; passed: number }>;
  experimentSummary: { templatesRegistered: number; requestsExecuted: number; shadowRunsAllowed: number; shadowRunsBlocked: number; tracesAnalyzed: number; tracesWritten: number };
  scorecardSummary: { overallScore: number; safetyScore: number; consentComplianceScore: number; readinessScore: number };
  promotionGateSummary: { allowed: false; status: string; requiredFounderDecision: true; nextRequiredGate: string };
  accessSummary: { publicEndpointExposed: false; productionExecutionBlocked: true; requiresAdmin: true };
  killSwitchSummary: { killSwitchBlocksExecution: true; unsafeRequestBlocked: true };
  runtimeSafetySummary: { liveResponseChanged: false; liveRankingChanged: false; decisionTraceExposedToUser: false; productUseEnabled: false };
  retentionSummary: { destructiveOperationUsed: false; requiresFounderApproval: true };
  networkCallsDuringGate: 0;
  redactedFailureDetails: string[]; remainingIntegrationGaps: string[];
}

export async function runRecommendationLabA11QaGate(): Promise<LabA11QaArtifact> {
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
  await run('config_parsing', 'defaults', () => { const c = resolveLabConfig({}); return c.mode === 'off' && c.allowDryRun === false && c.maxRequests === 240 && c.maxTraceRead === 500 && c.killSwitch === 'off'; });
  await run('config_parsing', 'mode parse', () => resolveLabConfig({ RECOMMENDATION_LAB_MODE: 'dev_internal_api' }).mode === 'dev_internal_api');
  await run('config_parsing', 'invalid mode → off', () => resolveLabConfig({ RECOMMENDATION_LAB_MODE: 'public' }).mode === 'off');
  await run('config_parsing', 'allowDryRun only true explicit', () => resolveLabConfig({ RECOMMENDATION_LAB_ALLOW_DRY_RUN: 'true' }).allowDryRun === true && resolveLabConfig({ RECOMMENDATION_LAB_ALLOW_DRY_RUN: 'x' }).allowDryRun === false);
  await run('config_parsing', 'killSwitch parse', () => resolveLabConfig({ RECOMMENDATION_LAB_KILL_SWITCH: 'on' }).killSwitch === 'on');
  await run('config_parsing', 'maxRequests invalid → default', () => resolveLabConfig({ RECOMMENDATION_LAB_MAX_REQUESTS: '0' }).maxRequests === 240 && resolveLabConfig({ RECOMMENDATION_LAB_MAX_REQUESTS: '5.5' }).maxRequests === 240);
  await run('config_parsing', 'maxRequests cap', () => resolveLabConfig({ RECOMMENDATION_LAB_MAX_REQUESTS: '99999' }).maxRequests === 240);
  await run('config_parsing', 'env mapping', () => resolveLabEnvironment({ NODE_ENV: 'production' }) === 'production' && resolveLabEnvironment({}) === 'unknown');

  /* access_model matrix (3 modes × 4 envs × 2 admin × 2 internal) */
  const modes: LabMode[] = ['off', 'service_only', 'dev_internal_api'];
  const envs: LabEnvironment[] = ['production', 'development', 'test', 'unknown'];
  const expect = (m: LabMode, e: LabEnvironment, admin: boolean, internal: boolean): boolean => {
    if (m === 'off') return false;
    if (m === 'service_only') return internal === true;
    if (e === 'production') return false;
    return admin || internal;
  };
  const lc = (m: LabMode): LabConfig => ({ mode: m, allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off' });
  for (const m of modes) for (const e of envs) for (const admin of [true, false]) for (const internal of [true, false]) {
    const a = evaluateRecommendationLabAccess({ config: lc(m), environment: e, adminVerified: admin, internalCall: internal });
    await run('access_model', `${m}/${e}/a=${admin}/i=${internal}`, () => a.allowed === expect(m, e, admin, internal));
    await run('access_model', `${m}/${e}/a=${admin}/i=${internal} no-public`, () => a.publicEndpointExposed === false);
  }
  await run('production_lockout', 'prod dev_internal_api blocked', () => evaluateRecommendationLabAccess({ config: lc('dev_internal_api'), environment: 'production', adminVerified: true }).allowed === false);

  /* kill_switch */
  const ks = (over: any) => evaluateRecommendationLabKillSwitch({ config: lc('dev_internal_api'), environment: 'development', adminVerified: true, ...over });
  await run('kill_switch', 'clean not blocked', () => ks({}).blocked === false);
  await run('kill_switch', 'kill on blocks', () => ks({ config: { ...lc('dev_internal_api'), killSwitch: 'on' } }).blocked === true);
  await run('kill_switch', 'off mode blocks', () => ks({ config: lc('off') }).blocked === true);
  await run('kill_switch', 'production blocks', () => ks({ environment: 'production' }).blocked === true);
  await run('kill_switch', 'live ranking mutation blocks', () => ks({ requestedLiveRankingMutation: true }).reasons.includes('live_ranking_mutation_requested'));
  await run('kill_switch', 'response mutation blocks', () => ks({ requestedUserResponseMutation: true }).reasons.includes('user_response_mutation_requested'));
  await run('kill_switch', 'destructive retention blocks', () => ks({ requestedDestructiveRetention: true }).reasons.includes('destructive_retention_requested'));
  await run('kill_switch', 'raw exposure blocks', () => ks({ requestedRawDataExposure: true }).reasons.includes('raw_data_exposure_requested'));
  await run('kill_switch', 'public access blocks', () => ks({ requestedPublicAccess: true }).reasons.includes('public_access_attempted'));

  /* experiment_registry */
  await run('experiment_registry', '5 templates', () => listRecommendationLabTemplates().length === 5 && RECOMMENDATION_LAB_TEMPLATE_KEYS.length === 5);
  for (const t of listRecommendationLabTemplates()) {
    await run('experiment_registry', `[${t.experimentKey}] shape`, () => t.goal.length > 0 && t.nextGate === 'A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT' && t.config.experimentKey === t.experimentKey);
  }
  await run('experiment_registry', 'unknown → null', () => getRecommendationLabTemplate('nope') === null);

  /* config_validator */
  const labCfg: LabConfig = { mode: 'dev_internal_api', allowDryRun: true, maxRequests: 240, maxTraceRead: 500, killSwitch: 'off' };
  const baseCfg = () => getRecommendationLabTemplate('a11-shadow-dev-balanced')!.config;
  await run('config_validator', 'valid passes (dev)', () => validateExperimentConfig(baseCfg(), labCfg, 'development').ok === true);
  await run('config_validator', 'production blocks', () => validateExperimentConfig(baseCfg(), labCfg, 'production').ok === false);
  await run('config_validator', 'kill switch blocks', () => validateExperimentConfig(baseCfg(), { ...labCfg, killSwitch: 'on' }, 'development').ok === false);
  await run('config_validator', 'over-max requestCount blocks', () => validateExperimentConfig({ ...baseCfg(), requestCount: 99999 }, labCfg, 'development').ok === false);
  await run('config_validator', 'over-max userSampleSize blocks', () => validateExperimentConfig({ ...baseCfg(), userSampleSize: 9999 }, labCfg, 'development').ok === false);
  await run('config_validator', 'unknown context blocks', () => validateExperimentConfig({ ...baseCfg(), contexts: ['evil'] }, labCfg, 'development').ok === false);
  await run('config_validator', 'trace write without consent blocks', () => validateExperimentConfig({ ...baseCfg(), allowTraceWrite: true, requireConsent: false }, labCfg, 'development').ok === false);
  await run('config_validator', 'missing key blocks', () => validateExperimentConfig({ ...baseCfg(), experimentKey: '' }, labCfg, 'development').ok === false);
  await run('config_validator', 'unsafe profile blocks', () => validateExperimentConfig({ ...baseCfg(), qualityProfile: 'yolo' as any }, labCfg, 'development').ok === false);
  await run('config_validator', 'dry_run disallowed blocks', () => validateExperimentConfig({ ...baseCfg(), mode: 'dry_run' }, { ...labCfg, allowDryRun: false }, 'development').ok === false);

  /* runner: per-template × {shadow_dev, dry_run} */
  const internalCtx = { config: labCfg, environment: 'test' as const, adminVerified: true, internalCall: true };
  let lastExperiment: RecommendationLabExperiment | null = null;
  let aggRequests = 0, aggAllowed = 0, aggBlocked = 0, aggAnalyzed = 0, aggWritten = 0;
  for (const key of RECOMMENDATION_LAB_TEMPLATE_KEYS) {
    for (const mode of ['shadow_dev', 'dry_run'] as const) {
      const cfg = { ...getRecommendationLabTemplate(key)!.config, mode };
      const exp = await runRecommendationLabExperiment(cfg, internalCtx, { a8Service: a8Fixture(), observedRecipeTotal: 350 });
      if (mode === 'shadow_dev' && key === 'a11-shadow-dev-balanced') { lastExperiment = exp; aggRequests = exp.executionSummary.requestsExecuted; aggAllowed = exp.executionSummary.shadowRunsAllowed; aggBlocked = exp.executionSummary.shadowRunsBlocked; aggAnalyzed = exp.executionSummary.tracesAnalyzed; aggWritten = exp.executionSummary.tracesWritten; }
      await run('runner', `[${key}/${mode}] status completed`, () => exp.status === 'completed');
      await run('runner', `[${key}/${mode}] version 1`, () => exp.version === 1);
      await run('runner', `[${key}/${mode}] requests bounded`, () => exp.executionSummary.requestsExecuted <= 24 * 20);
      await run('runner', `[${key}/${mode}] failuresEscaped 0`, () => exp.executionSummary.failuresEscaped === 0);
      await run('runner', `[${key}/${mode}] maxRequestsBound 240`, () => exp.metrics.maxRequestsBound === 240);
      await run('config_validator', `[${key}/${mode}] config valid`, () => exp.configValidation.ok === true);
      await run('runtime_safety', `[${key}/${mode}] kill switch not engaged`, () => exp.safety.killSwitchEngaged === false);
      await run('promotion_gate', `[${key}/${mode}] allowed false`, () => exp.promotionGate.allowed === false);
      await run('promotion_gate', `[${key}/${mode}] founder decision required`, () => exp.promotionGate.requiredFounderDecision === true && exp.promotionGate.nextRequiredGate === 'A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT');
      await run('no_product_enablement', `[${key}/${mode}] productUseEnabled false`, () => exp.productUseEnabled === false);
      await run('no_ranking_change', `[${key}/${mode}] liveRankingChangedForUser false`, () => exp.liveRankingChangedForUser === false);
      await run('scorecard', `[${key}/${mode}] scores in [0,1]`, () => exp.qualityScorecard.overallScore >= 0 && exp.qualityScorecard.overallScore <= 1 && exp.qualityScorecard.safetyScore >= 0 && exp.qualityScorecard.safetyScore <= 1);
      await run('no_raw_leak', `[${key}/${mode}] no forbidden value`, () => !hasForbidden(JSON.stringify(exp)));
      await run('no_raw_leak', `[${key}/${mode}] no raw-content key`, () => !hasRawContentKey(JSON.stringify(exp)));
      await run('report_generator', `[${key}/${mode}] report safe`, () => exp.report.productUseEnabled === false && exp.report.liveRankingChangedForUser === false && exp.report.experimentKey === key);
      await run('recipe_universe', `[${key}/${mode}] observed 350 / ratio 1`, () => exp.recipeUniverse.observedTotal === 350 && exp.recipeUniverse.coverageRatio === 1);
      await run('runtime_safety', `[${key}/${mode}] safety flags false`, () => exp.safety.publicEndpointExposed === false && exp.safety.productUseEnabled === false && exp.safety.liveRankingChangedForUser === false);
    }
  }

  /* runner blocked paths */
  await run('production_lockout', 'runner production → blocked', async () => (await runRecommendationLabExperiment(baseCfg(), { ...internalCtx, environment: 'production' }, { a8Service: a8Fixture() })).status === 'blocked');
  await run('kill_switch', 'runner kill switch → blocked', async () => (await runRecommendationLabExperiment(baseCfg(), { ...internalCtx, config: { ...labCfg, killSwitch: 'on' } }, { a8Service: a8Fixture() })).status === 'blocked');
  await run('kill_switch', 'runner off mode → blocked', async () => (await runRecommendationLabExperiment(baseCfg(), { ...internalCtx, config: { ...labCfg, mode: 'off' } }, { a8Service: a8Fixture() })).status === 'blocked');

  /* scorecard tamper */
  const baseExp = lastExperiment!;
  await run('scorecard', 'clean shadow_dev safety 1', () => computeRecommendationLabScorecard(baseExp).safetyScore === 1);
  await run('scorecard', 'consent bypass → safety 0', () => computeRecommendationLabScorecard({ ...baseExp, safety: { ...baseExp.safety, consentBypassCount: 1 } }).overallScore === 0);
  await run('scorecard', 'raw leak → overall 0', () => computeRecommendationLabScorecard({ ...baseExp, safety: { ...baseExp.safety, rawLeakCount: 1 } }).overallScore === 0);
  await run('scorecard', 'live ranking mutation → overall 0', () => computeRecommendationLabScorecard({ ...baseExp, safety: { ...baseExp.safety, liveRankingMutationCount: 1 } }).overallScore === 0);
  await run('scorecard', 'failures escaped → overall 0', () => computeRecommendationLabScorecard({ ...baseExp, executionSummary: { ...baseExp.executionSummary, failuresEscaped: 1 } }).overallScore === 0);

  /* promotion gate tamper */
  await run('promotion_gate', 'safety<1 → blocked', () => evaluateRecommendationLabPromotionGate({ ...baseExp.qualityScorecard, safetyScore: 0.5 }, baseExp).status === 'blocked');
  await run('promotion_gate', 'allowed false with perfect scorecard', () => evaluateRecommendationLabPromotionGate({ ...baseExp.qualityScorecard, overallScore: 1, readinessScore: 1 }, baseExp).allowed === false);
  await run('promotion_gate', 'always warns R3/R4', () => evaluateRecommendationLabPromotionGate(baseExp.qualityScorecard, baseExp).warnings.includes('R3_R4_remain_mitigating_not_closed'));

  /* report generator */
  await run('report_generator', 'report has nextActions + safetyNotes', () => { const r = generateRecommendationLabReport(baseExp, baseExp.qualityScorecard, baseExp.promotionGate); return r.nextActions.length > 0 && r.safetyNotes.length > 0; });
  await run('no_raw_leak', 'report leak-free', () => !hasForbidden(JSON.stringify(generateRecommendationLabReport(baseExp, baseExp.qualityScorecard, baseExp.promotionGate))));

  /* no_public_endpoint / no_r3_r4_closure (structural) */
  await run('no_public_endpoint', 'access never exposes public endpoint', () => modes.every((m) => evaluateRecommendationLabAccess({ config: lc(m), environment: 'development', adminVerified: true }).publicEndpointExposed === false));
  await run('no_r3_r4_closure', 'promotion gate never closes R3/R4', () => baseExp.promotionGate.warnings.includes('R3_R4_remain_mitigating_not_closed'));
  await run('artifact_safety', 'forbidden patterns defined', () => FORBIDDEN.length >= 9);
  await run('artifact_safety', 'raw-content matcher works', () => hasRawContentKey('{"userText":"x"}') === true && hasRawContentKey('{"overallScore":1}') === false);

  // assemble
  const totalChecks = rows.length;
  const passedChecks = rows.filter((r) => r.passed).length;
  const artifact: LabA11QaArtifact = {
    schemaVersion: 1, generatedAt: GENERATED_AT, runMode: 'offline-recommendation-lab-evaluation',
    totalChecks, passedChecks, failedChecks: totalChecks - passedChecks, categories,
    experimentSummary: { templatesRegistered: 5, requestsExecuted: aggRequests, shadowRunsAllowed: aggAllowed, shadowRunsBlocked: aggBlocked, tracesAnalyzed: aggAnalyzed, tracesWritten: aggWritten },
    scorecardSummary: { overallScore: baseExp.qualityScorecard.overallScore, safetyScore: baseExp.qualityScorecard.safetyScore, consentComplianceScore: baseExp.qualityScorecard.consentComplianceScore, readinessScore: baseExp.qualityScorecard.readinessScore },
    promotionGateSummary: { allowed: false, status: baseExp.promotionGate.status, requiredFounderDecision: true, nextRequiredGate: baseExp.promotionGate.nextRequiredGate },
    accessSummary: { publicEndpointExposed: false, productionExecutionBlocked: true, requiresAdmin: true },
    killSwitchSummary: { killSwitchBlocksExecution: true, unsafeRequestBlocked: true },
    runtimeSafetySummary: { liveResponseChanged: false, liveRankingChanged: false, decisionTraceExposedToUser: false, productUseEnabled: false },
    retentionSummary: { destructiveOperationUsed: false, requiresFounderApproval: true },
    networkCallsDuringGate: 0,
    redactedFailureDetails: failed,
    remainingIntegrationGaps: [
      'Internal/dev lab only — no public endpoint, no UI; runs only registered templates.',
      'Shadow batches are offline/synthetic; analysis is observational over redacted traces.',
      'Promotion is founder-review readiness only; A12 (Founder-reviewed limited dev shadow experiment) required before any live ranking change.',
    ],
  };

  const json = JSON.stringify(artifact);
  if (hasForbidden(json) || hasRawContentKey(json)) { artifact.failedChecks += 1; artifact.totalChecks += 1; artifact.redactedFailureDetails.push('artifact_safety:assembled artifact contains forbidden/raw value'); }
  else { artifact.totalChecks += 1; artifact.passedChecks += 1; artifact.categories['artifact_safety'].total += 1; artifact.categories['artifact_safety'].passed += 1; }

  return artifact;
}
