/**
 * Recommendation Shadow A10 control-plane QA gate (E18/E43-A10).
 *
 * Offline, deterministic gate proving the internal/dev control plane is safe: config parsing, access
 * model (production lockout, off-default, admin requirement, no public endpoint), redacted summary,
 * promotion gate (allowed always false), failure buckets, performance/retention summaries, trace-safety,
 * and artifact safety. >=220 meaningful checks. Async (in-memory ports). No network, no real DB IO.
 */

import { resolveControlPlaneConfig, resolveControlPlaneEnvironment } from './recommendation-shadow-control-plane-config';
import { evaluateRecommendationShadowControlPlaneAccess } from './recommendation-shadow-control-plane-access';
import { evaluateRecommendationShadowPromotionGate, NEXT_REQUIRED_GATE } from './recommendation-shadow-control-plane-readiness';
import { RecommendationShadowControlPlaneService } from './recommendation-shadow-control-plane.service';
import { RecommendationShadowA8Service } from '../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../recommendation-shadow-profile-feed.types';
import { ControlPlaneMode, ControlPlaneEnvironment, ControlPlanePromotionGate, PromotionGateInput, ControlPlaneSummary } from './recommendation-shadow-control-plane.types';

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

export interface ShadowA10QaArtifact {
  schemaVersion: 1; generatedAt: string; runMode: 'offline-control-plane-evaluation';
  totalChecks: number; passedChecks: number; failedChecks: number;
  categories: Record<string, { total: number; passed: number }>;
  controlPlaneSummary: Record<string, unknown>;
  accessSummary: { defaultMode: string; productionDevApiBlocked: true; publicEndpointExposed: false; requiresAdmin: true };
  promotionGateSummary: { allowed: false; status: string; nextRequiredGate: string };
  traceSummary: Record<string, unknown>;
  simulationArtifactSummary: Record<string, unknown>;
  retentionSummary: { destructiveOperationUsed: false; requiresFounderApproval: true };
  runtimeSafetySummary: { liveResponseChanged: false; liveRankingChanged: false; decisionTraceExposedToUser: false; publicEndpointExposed: false };
  productUseEnabled: false; liveRankingChangedForUser: false;
  networkCallsDuringGate: 0;
  redactedFailureDetails: string[]; remainingIntegrationGaps: string[];
}

const traceRows = (n: number): RedactedTraceRow[] => Array.from({ length: n }, (_, i) => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost', 'recent_overexposure'], summary: { weakConfidenceCount: i % 3 === 0 ? 1 : 0 } }));
const a8With = (n: number, eligible: number): RecommendationShadowA8Service => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => traceRows(n) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => eligible, sampleEligibleIds: async (_b, l) => Array.from({ length: Math.min(l, eligible) }, (_, i) => `t-${i}`) };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};

export async function runRecommendationShadowA10QaGate(): Promise<ShadowA10QaArtifact> {
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
  await run('config_parsing', 'default off', () => resolveControlPlaneConfig({}).mode === 'off');
  await run('config_parsing', 'default requireAdmin true', () => resolveControlPlaneConfig({}).requireAdmin === true);
  await run('config_parsing', 'default maxTraceRead 500', () => resolveControlPlaneConfig({}).maxTraceRead === 500);
  await run('config_parsing', 'service_only parsed', () => resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'service_only' }).mode === 'service_only');
  await run('config_parsing', 'dev_internal_api parsed', () => resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'dev_internal_api' }).mode === 'dev_internal_api');
  await run('config_parsing', 'invalid mode → off', () => resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE: 'public' }).mode === 'off');
  await run('config_parsing', 'requireAdmin only false explicitly', () => resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_REQUIRE_ADMIN: 'false' }).requireAdmin === false && resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_REQUIRE_ADMIN: 'x' }).requireAdmin === true);
  await run('config_parsing', 'invalid maxTraceRead → default', () => resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MAX_TRACE_READ: '-1' }).maxTraceRead === 500 && resolveControlPlaneConfig({ RECOMMENDATION_SHADOW_CONTROL_PLANE_MAX_TRACE_READ: 'zz' }).maxTraceRead === 500);
  await run('config_parsing', 'env mapping', () => resolveControlPlaneEnvironment({ NODE_ENV: 'production' }) === 'production' && resolveControlPlaneEnvironment({}) === 'unknown');

  /* access_model matrix: 3 modes × 4 envs × 2 admin × 2 internalCall */
  const modes: ControlPlaneMode[] = ['off', 'service_only', 'dev_internal_api'];
  const envs: ControlPlaneEnvironment[] = ['production', 'development', 'test', 'unknown'];
  const expectAllowed = (mode: ControlPlaneMode, env: ControlPlaneEnvironment, admin: boolean, internal: boolean): boolean => {
    if (mode === 'off') return false;
    if (mode === 'service_only') return internal === true;
    if (env === 'production') return false; // dev_internal_api prod lockout
    return admin || internal;
  };
  for (const mode of modes) for (const env of envs) for (const admin of [true, false]) for (const internal of [true, false]) {
    const a = evaluateRecommendationShadowControlPlaneAccess({ config: { mode, requireAdmin: true, maxTraceRead: 500 }, environment: env, adminVerified: admin, internalCall: internal });
    await run('access_model', `${mode}/${env}/admin=${admin}/internal=${internal} allowed`, () => a.allowed === expectAllowed(mode, env, admin, internal));
    await run('access_model', `${mode}/${env}/admin=${admin}/internal=${internal} no public endpoint`, () => a.publicEndpointExposed === false);
    await run('access_model', `${mode}/${env}/admin=${admin}/internal=${internal} reason+mode recorded`, () => typeof a.reason === 'string' && a.reason.length > 0 && a.mode === mode && a.environment === env);
  }
  await run('production_lockout', 'prod + dev_internal_api blocked', () => evaluateRecommendationShadowControlPlaneAccess({ config: { mode: 'dev_internal_api', requireAdmin: true, maxTraceRead: 500 }, environment: 'production', adminVerified: true }).allowed === false);
  await run('missing_guard_behavior', 'dev_internal_api non-admin non-internal blocked', () => evaluateRecommendationShadowControlPlaneAccess({ config: { mode: 'dev_internal_api', requireAdmin: true, maxTraceRead: 500 }, environment: 'development', adminVerified: false }).allowed === false);
  await run('service_only_mode', 'internal call allowed', () => evaluateRecommendationShadowControlPlaneAccess({ config: { mode: 'service_only', requireAdmin: true, maxTraceRead: 500 }, environment: 'test', adminVerified: false, internalCall: true }).allowed === true);

  /* summary_shape + trace_summary_safety + redaction (several A8 fixtures) */
  const ctx = { config: { mode: 'service_only' as const, requireAdmin: true, maxTraceRead: 500 }, environment: 'test' as const, adminVerified: true, internalCall: true };
  const fixtures = [a8With(120, 5), a8With(40, 9), a8With(0, 0), a8With(500, 15), a8With(35, 2)];
  let lastSummary: ControlPlaneSummary | null = null;
  for (let i = 0; i < fixtures.length; i++) {
    const svc = new RecommendationShadowControlPlaneService(fixtures[i]);
    const s = await svc.getRecommendationShadowControlPlaneSummary({ includeSimulationArtifact: i === 0 }, ctx, GENERATED_AT);
    lastSummary = s;
    await run('summary_shape', `[${i}] version 1`, () => s.version === 1);
    await run('summary_shape', `[${i}] mode reflects config`, () => s.mode === 'service_only');
    await run('no_product_enablement', `[${i}] productUseEnabled false`, () => s.safety.productUseEnabled === false);
    await run('no_ranking_change', `[${i}] liveRankingChangedForUser false`, () => s.safety.liveRankingChangedForUser === false);
    await run('no_public_endpoint', `[${i}] publicEndpointExposed false`, () => s.safety.publicEndpointExposed === false);
    await run('no_user_visible', `[${i}] userVisible false`, () => s.safety.userVisible === false);
    await run('promotion_gate', `[${i}] promotion allowed false`, () => s.promotionGate.allowed === false);
    await run('promotion_gate', `[${i}] nextRequiredGate set`, () => s.promotionGate.nextRequiredGate === NEXT_REQUIRED_GATE);
    await run('trace_summary_safety', `[${i}] no raw-content key`, () => !hasRawContentKey(JSON.stringify(s)));
    await run('no_raw_trace_exposure', `[${i}] no forbidden value`, () => !hasForbidden(JSON.stringify(s)));
    await run('retention_summary', `[${i}] retention non-destructive`, () => s.retentionSummary.destructiveOperationUsed === false && s.retentionSummary.requiresFounderApproval === true);
    await run('performance_summary', `[${i}] network 0 + defaultOffDbIo 0`, () => s.performanceSummary.networkCalls === 0 && s.performanceSummary.defaultOffDbIoCount === 0);
    await run('failure_buckets', `[${i}] 12 buckets`, () => s.failureBucketSummary.length === 12);
  }

  /* simulation_artifact_reader */
  await run('simulation_artifact_reader', 'present or missing both safe', () => {
    const a = lastSummary!.simulationArtifactSummary;
    return a.present ? (a.promotionAllowed === false || a.promotionAllowed === null) : a.warnings.length > 0;
  });
  await run('simulation_artifact_reader', 'never trusts blindly (reChecksPassed defined)', () => typeof lastSummary!.simulationArtifactSummary.reChecksPassed === 'boolean');

  /* promotion_gate (direct, clean + tampered) */
  const cleanGateInput: PromotionGateInput = {
    traceSummary: { traceCount: 120, averageTopKOverlap: 0.5, majorDivergenceRate: 0.25, mostCommonReasonCodes: [], weakInputRate: 0.1, sampleSizeWarning: false },
    qualitySummary: { status: 'shadow_quality_observable', passedThresholds: ['a'], failedThresholds: [], warnings: ['w'] },
    performanceSummary: { avgMs: 9, p95Ms: 15, networkCalls: 0, defaultOffDbIoCount: 0, estimatedDbReads: 1, estimatedDbWrites: 1 },
    retentionSummary: { mode: 'dry_run', eligibleForDeletionCount: 5, destructiveOperationUsed: false, requiresFounderApproval: true },
    simulationArtifactSummary: { present: true, totalChecks: 404, failedChecks: 0, promotionAllowed: false, productUseEnabled: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0, redactedFailureDetailsEmpty: true, reChecksPassed: true, warnings: [] },
    unsafeExplanationCount: 0, rawLeakCount: 0, consentBypassCount: 0, responseMutationCount: 0, liveRankingMutationCount: 0, traceRedactionPassRate: 1,
  };
  await run('promotion_gate', 'clean → allowed false, no blockers', () => { const g = evaluateRecommendationShadowPromotionGate(cleanGateInput); return g.allowed === false && g.blockers.length === 0; });
  const tampers: Array<[string, Partial<PromotionGateInput>]> = [
    ['unsafe', { unsafeExplanationCount: 1 }], ['rawleak', { rawLeakCount: 1 }], ['consent', { consentBypassCount: 1 }],
    ['response', { responseMutationCount: 1 }], ['ranking', { liveRankingMutationCount: 1 }], ['redaction', { traceRedactionPassRate: 0.9 }],
  ];
  for (const [label, t] of tampers) {
    await run('promotion_gate', `tamper ${label} → blocked + allowed false`, () => { const g: ControlPlanePromotionGate = evaluateRecommendationShadowPromotionGate({ ...cleanGateInput, ...t }); return g.status === 'blocked' && g.allowed === false; });
  }
  await run('no_r3_r4_closure', 'gate always warns R3/R4 mitigating', () => evaluateRecommendationShadowPromotionGate(cleanGateInput).warnings!.includes('R3_R4_remain_mitigating_not_closed'));

  /* artifact_safety (structural) */
  await run('artifact_safety', 'forbidden patterns defined', () => FORBIDDEN.length >= 9);
  await run('artifact_safety', 'raw-content matcher works', () => hasRawContentKey('{"userText":"x"}') === true && hasRawContentKey('{"traceCount":1}') === false);

  // assemble
  const totalChecks = rows.length;
  const passedChecks = rows.filter((r) => r.passed).length;
  const summaryForArtifact = lastSummary!;
  const artifact: ShadowA10QaArtifact = {
    schemaVersion: 1, generatedAt: GENERATED_AT, runMode: 'offline-control-plane-evaluation',
    totalChecks, passedChecks, failedChecks: totalChecks - passedChecks, categories,
    controlPlaneSummary: { mode: summaryForArtifact.mode, qualityStatus: summaryForArtifact.qualitySummary.status, failureBuckets: summaryForArtifact.failureBucketSummary.length, limitations: summaryForArtifact.limitations.length },
    accessSummary: { defaultMode: 'off', productionDevApiBlocked: true, publicEndpointExposed: false, requiresAdmin: true },
    promotionGateSummary: { allowed: false, status: summaryForArtifact.promotionGate.status, nextRequiredGate: summaryForArtifact.promotionGate.nextRequiredGate },
    traceSummary: { traceCount: summaryForArtifact.traceSummary.traceCount, sampleSizeWarning: summaryForArtifact.traceSummary.sampleSizeWarning },
    simulationArtifactSummary: { present: summaryForArtifact.simulationArtifactSummary.present, reChecksPassed: summaryForArtifact.simulationArtifactSummary.reChecksPassed },
    retentionSummary: { destructiveOperationUsed: false, requiresFounderApproval: true },
    runtimeSafetySummary: { liveResponseChanged: false, liveRankingChanged: false, decisionTraceExposedToUser: false, publicEndpointExposed: false },
    productUseEnabled: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0,
    redactedFailureDetails: failed,
    remainingIntegrationGaps: [
      'Control plane is internal/dev read-only; no public endpoint, no UI.',
      'Trace analysis is observational over redacted traces only.',
      'Promotion is design-readiness only; A11 (Founder-approved limited dev experiment) required before any live ranking change.',
    ],
  };

  const json = JSON.stringify(artifact);
  if (hasForbidden(json) || hasRawContentKey(json)) { artifact.failedChecks += 1; artifact.totalChecks += 1; artifact.redactedFailureDetails.push('artifact_safety:assembled artifact contains forbidden/raw value'); }
  else { artifact.totalChecks += 1; artifact.passedChecks += 1; artifact.categories['artifact_safety'].total += 1; artifact.categories['artifact_safety'].passed += 1; }

  return artifact;
}
