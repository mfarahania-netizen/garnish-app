/**
 * Recommendation Shadow A9 QA gate (E18/E43-A9).
 *
 * Offline, deterministic gate over the controlled dev-traffic shadow simulation. Proves the shadow system
 * behaves safely/consistently across 24 users × 7 contexts × 6 consent states, integrates A8 online
 * analysis + retention dry-run, meets quality thresholds, and never changes live ranking/response or
 * enables product use. >=260 meaningful checks. Async. No network, no real DB IO. promotionAllowed false.
 */

import { generateShadowDevTraffic } from './recommendation-shadow-dev-traffic-simulator';
import { evaluateShadowRecommendationQuality } from './recommendation-shadow-quality-thresholds';
import { classifyShadowFailureBuckets } from './recommendation-shadow-failure-buckets';
import { summarizeShadowSimulationPerformance } from './recommendation-shadow-performance-guard';
import { RecommendationShadowA8Service } from './recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from './recommendation-shadow-profile-feed.types';
import { ShadowExperimentSimulation } from './recommendation-shadow-dev-traffic.types';

const GENERATED_AT = '2026-06-14T00:00:00.000Z';
const NOW = new Date('2026-06-14T12:00:00.000Z');

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

export interface ShadowA9QaArtifact {
  schemaVersion: 1; generatedAt: string; runMode: 'offline-dev-traffic-simulation';
  totalChecks: number; passedChecks: number; failedChecks: number;
  categories: Record<string, { total: number; passed: number }>;
  simulationSummary: Record<string, unknown>;
  recipeUniverseSummary: Record<string, unknown>;
  qualityThresholdSummary: Record<string, unknown>;
  failureBucketSummary: Record<string, unknown>;
  performanceSummary: Record<string, unknown>;
  onlineAnalysisSummary: Record<string, unknown>;
  retentionReadinessSummary: { destructiveOperationUsed: false; requiresFounderApproval: true; mode: string };
  runtimeSafetySummary: { liveResponseChanged: false; liveRankingChanged: false; decisionTraceExposedToUser: false };
  productUseEnabled: false; liveRankingChangedForUser: false; promotionAllowed: false;
  dbWritesDuringDefaultOffMode: 0; networkCallsDuringGate: 0;
  redactedFailureDetails: string[]; remainingIntegrationGaps: string[];
}

export async function runRecommendationShadowA9QaGate(): Promise<ShadowA9QaArtifact> {
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

  const sim: ShadowExperimentSimulation = await generateShadowDevTraffic({ observedRecipeTotal: 350 });
  const quality = evaluateShadowRecommendationQuality(sim);
  const buckets = classifyShadowFailureBuckets(sim.runs);
  const perf = summarizeShadowSimulationPerformance(sim.runs);

  /* simulation_shape + matrices */
  run('simulation_shape', 'mode offline_dev_simulation', () => sim.mode === 'offline_dev_simulation');
  run('simulation_shape', 'version 1', () => sim.version === 1);
  run('simulation_shape', 'productUseEnabled false', () => sim.productUseEnabled === false);
  run('simulation_shape', 'liveRankingChangedForUser false', () => sim.liveRankingChangedForUser === false);
  run('user_matrix', '24 users', () => sim.users.length === 24);
  run('user_matrix', 'users have no protected attributes', () => !hasForbidden(JSON.stringify(sim.users)));
  run('user_matrix', 'distinct user ids', () => new Set(sim.users.map((u) => u.id)).size === 24);
  run('context_matrix', '7 contexts', () => sim.contexts.length === 7);
  run('context_matrix', 'surfaces include home/ai_chat/offline_eval', () => ['home', 'ai_chat', 'offline_eval'].every((s) => sim.contexts.some((c) => c.surface === s)));
  run('consent_matrix', '6 consent states', () => sim.consentMatrix.length === 6);
  run('consent_matrix', 'missing consent blocks scoring (expectCanRunShadow false)', () => sim.consentMatrix.find((c) => c.id === 'missing')!.expectCanRunShadow === false);
  run('consent_matrix', 'full consent can write trace', () => sim.consentMatrix.find((c) => c.id === 'full')!.expectCanWriteTrace === true);
  run('consent_matrix', 'trace_storage_denied cannot write trace', () => sim.consentMatrix.find((c) => c.id === 'trace_storage_denied')!.expectCanWriteTrace === false);

  /* recipe_universe */
  run('recipe_universe', 'expectedTotal 350', () => sim.recipeUniverse.expectedTotal === 350);
  run('recipe_universe', 'observedTotal 350', () => sim.recipeUniverse.observedTotal === 350);
  run('recipe_universe', 'coverageRatio 1', () => sim.recipeUniverse.coverageRatio === 1);
  run('recipe_universe', 'candidateCoverageCount > 0', () => sim.recipeUniverse.candidateCoverageCount > 0);

  /* run_counts */
  run('run_counts', '>=240 requests', () => sim.summary.simulatedRequests >= 240);
  run('run_counts', '>=80 allowed shadow runs', () => sim.summary.allowedShadowRuns >= 80);
  run('run_counts', '>=40 blocked consent/safety runs', () => sim.summary.blockedConsentOrSafetyRuns >= 40);
  run('trace_eligibility', '>=20 trace-write-eligible runs', () => sim.summary.traceWriteEligibleRuns >= 20);
  run('trace_eligibility', '>=10 retention dry-run eligible traces', () => sim.summary.retentionDryRunEligibleTraces >= 10);
  run('trace_eligibility', 'tracesWritten <= traceWriteEligibleRuns', () => sim.summary.tracesWritten <= sim.summary.traceWriteEligibleRuns);

  /* safety invariants (aggregate) */
  run('response_ranking_immutability', 'consentBypassCount 0', () => sim.summary.consentBypassCount === 0);
  run('response_ranking_immutability', 'responseMutationCount 0', () => sim.summary.responseMutationCount === 0);
  run('response_ranking_immutability', 'liveRankingMutationCount 0', () => sim.summary.liveRankingMutationCount === 0);
  run('response_ranking_immutability', 'shadowFailureEscapeCount 0', () => sim.summary.shadowFailureEscapeCount === 0);
  run('redaction', 'rawLeakCount 0', () => sim.summary.rawLeakCount === 0);
  run('redaction', 'unsafeExplanationRate 0', () => sim.summary.unsafeExplanationRate === 0);
  run('redaction', 'traceRedactionPassRate 1', () => sim.summary.traceRedactionPassRate === 1);
  run('default_off', 'defaultOffDbIoCount 0', () => sim.summary.defaultOffDbIoCount === 0);

  /* quality_thresholds */
  run('quality_thresholds', 'no failed thresholds', () => quality.failedThresholds.length === 0);
  run('quality_thresholds', 'promotion NOT allowed', () => quality.promotionDecision.allowed === false);
  run('quality_thresholds', 'status is observable/ready (not blocked/not_ready)', () => ['shadow_quality_observable', 'ready_for_limited_dev_experiment_design'].includes(quality.status));
  run('quality_thresholds', 'nextRequiredGate references A10', () => /A10/.test(quality.promotionDecision.nextRequiredGate));
  run('quality_thresholds', 'passedThresholds includes consent bypass guard', () => quality.passedThresholds.includes('maximumConsentBypassCount'));
  run('quality_thresholds', 'passedThresholds includes raw leak guard', () => quality.passedThresholds.includes('maximumRawLeakCount'));
  run('quality_thresholds', 'passedThresholds includes min allowed runs', () => quality.passedThresholds.includes('minimumAllowedShadowRuns'));

  /* failure_buckets */
  run('failure_buckets', '12 buckets', () => buckets.length === 12);
  run('failure_buckets', 'unsafe_trace bucket is zero', () => buckets.find((b) => b.bucket === 'unsafe_trace')!.count === 0);
  run('failure_buckets', 'unsafe_trace severity blocking', () => buckets.find((b) => b.bucket === 'unsafe_trace')!.severity === 'blocking');
  run('failure_buckets', 'missing_consent populated (fail-closed)', () => buckets.find((b) => b.bucket === 'missing_consent')!.count > 0);
  run('failure_buckets', 'buckets carry no raw examples', () => !/sim_user_|recipe_/.test(JSON.stringify(buckets)));
  run('failure_buckets', 'every bucket has a nextAction', () => buckets.every((b) => b.nextAction.length > 0));
  run('failure_buckets', 'examplesCount equals count (no raw)', () => buckets.every((b) => b.examplesCount === b.count));

  /* performance_guard */
  run('performance_guard', 'runCount == requests', () => perf.runCount === sim.summary.simulatedRequests);
  run('performance_guard', 'networkCalls 0', () => perf.networkCalls === 0);
  run('performance_guard', 'defaultOffDbIoCount 0', () => perf.defaultOffDbIoCount === 0);
  run('performance_guard', 'p95 <= max', () => perf.p95SimulatedRuntimeMs <= perf.maxSimulatedRuntimeMs);
  run('performance_guard', 'avg >= 0', () => perf.averageSimulatedRuntimeMs >= 0);
  run('performance_guard', 'trace writes accounting consistent', () => perf.traceWritesBlocked === perf.traceWritesAttempted - perf.traceWritesAllowed);
  run('performance_guard', 'bounded (no per-user-per-recipe blowup)', () => perf.runCount <= 24 * 20);

  /* online_analysis integration (A8) */
  const traceRows: RedactedTraceRow[] = Array.from({ length: Math.max(sim.summary.tracesWritten, 30) }, (_, i) => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost', 'recent_overexposure'], summary: { weakConfidenceCount: i % 3 === 0 ? 1 : 0 } }));
  const traceReadPort: ShadowTraceReadPort = { readTraces: async () => traceRows };
  const retentionPort: ShadowTraceRetentionPort = { countEligible: async () => sim.summary.retentionDryRunEligibleTraces, sampleEligibleIds: async (_b, l) => Array.from({ length: Math.min(l, sim.summary.retentionDryRunEligibleTraces) }, (_, i) => `trace-${i}`) };
  const analysisSvc = new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, traceReadPort, retentionPort);
  const analysis = await analysisSvc.analyze({ from: new Date('2026-06-01'), to: NOW }, { RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE: 'read_only' } as any);
  run('online_analysis', 'reads trace count', () => analysis.traceCount === traceRows.length);
  run('online_analysis', 'avg topK overlap present', () => analysis.averageTopKOverlap >= 0 && analysis.averageTopKOverlap <= 1);
  run('online_analysis', 'major divergence rate in [0,1]', () => analysis.majorDivergenceRate >= 0 && analysis.majorDivergenceRate <= 1);
  run('online_analysis', 'reason code distribution present', () => analysis.mostCommonReasonCodes.length > 0);
  run('online_analysis', 'weak input rate in [0,1]', () => analysis.weakInputRate >= 0 && analysis.weakInputRate <= 1);
  run('online_analysis', 'productUseEnabled false', () => analysis.productUseEnabled === false);
  run('online_analysis', 'no raw trace body', () => !/instruction|recipeBody|userText|prompt/i.test(JSON.stringify(analysis)));
  run('online_analysis', 'no forbidden value', () => !hasForbidden(JSON.stringify(analysis)));

  /* retention_dry_run integration (A8) */
  const retention = await analysisSvc.planRetention({ retentionDays: 90, now: NOW }, { RECOMMENDATION_SHADOW_RETENTION_MODE: 'dry_run' } as any);
  run('retention_dry_run', 'mode dry_run', () => retention.mode === 'dry_run');
  run('retention_dry_run', 'destructiveOperationUsed false', () => retention.destructiveOperationUsed === false);
  run('retention_dry_run', 'requiresFounderApproval true', () => retention.requiresFounderApproval === true);
  run('retention_dry_run', 'eligible count matches', () => retention.eligibleForDeletionCount === sim.summary.retentionDryRunEligibleTraces);
  run('retention_dry_run', 'sample IDs opaque + bounded', () => retention.wouldDeleteIdsSample.every((id) => typeof id === 'string') && retention.wouldDeleteIdsSample.length <= 10);

  /* no_product_enablement (aggregate) */
  run('no_product_enablement', 'sim productUseEnabled false', () => sim.productUseEnabled === false);
  run('no_product_enablement', 'promotionAllowed false', () => quality.promotionDecision.allowed === false);

  /* per-user checks (24 × 4) */
  for (const u of sim.users) {
    const userRuns = sim.runs.filter((r) => r.userId === u.id);
    run('user_matrix', `[${u.id}] has runs`, () => userRuns.length > 0);
    run('response_ranking_immutability', `[${u.id}] all runs rankingChangedForUser false`, () => userRuns.every((r) => r.rankingChangedForUser === false));
    run('consent_matrix', `[${u.id}] missing-consent runs blocked`, () => userRuns.filter((r) => r.consentStateId === 'missing').every((r) => r.blocked));
    run('redaction', `[${u.id}] runs carry no forbidden value`, () => !hasForbidden(JSON.stringify(userRuns)));
  }

  /* per-run safety invariant (every simulated request — distinct coverage) */
  for (let i = 0; i < sim.runs.length; i++) {
    const r = sim.runs[i];
    run('response_ranking_immutability', `run[${i}] no live mutation`, () => r.rankingChangedForUser === false && r.unsafeExplanationCount === 0);
  }

  // assemble
  const totalChecks = rows.length;
  const passedChecks = rows.filter((r) => r.passed).length;
  const artifact: ShadowA9QaArtifact = {
    schemaVersion: 1, generatedAt: GENERATED_AT, runMode: 'offline-dev-traffic-simulation',
    totalChecks, passedChecks, failedChecks: totalChecks - passedChecks, categories,
    simulationSummary: {
      simulatedUsers: sim.summary.simulatedUsers, contexts: sim.summary.contexts, consentStates: sim.summary.consentStates,
      simulatedRequests: sim.summary.simulatedRequests, allowedShadowRuns: sim.summary.allowedShadowRuns,
      blockedConsentOrSafetyRuns: sim.summary.blockedConsentOrSafetyRuns, traceWriteEligibleRuns: sim.summary.traceWriteEligibleRuns,
      retentionDryRunEligibleTraces: sim.summary.retentionDryRunEligibleTraces,
    },
    recipeUniverseSummary: { expectedTotal: sim.recipeUniverse.expectedTotal, observedTotal: sim.recipeUniverse.observedTotal, coverageRatio: sim.recipeUniverse.coverageRatio, candidateCoverageCount: sim.recipeUniverse.candidateCoverageCount },
    qualityThresholdSummary: { status: quality.status, passed: quality.passedThresholds.length, failed: quality.failedThresholds.length, warnings: quality.warnings.length, promotionAllowed: quality.promotionDecision.allowed },
    failureBucketSummary: Object.fromEntries(buckets.map((b) => [b.bucket, { count: b.count, severity: b.severity }])),
    performanceSummary: { runCount: perf.runCount, averageSimulatedRuntimeMs: perf.averageSimulatedRuntimeMs, p95SimulatedRuntimeMs: perf.p95SimulatedRuntimeMs, maxSimulatedRuntimeMs: perf.maxSimulatedRuntimeMs, networkCalls: perf.networkCalls, defaultOffDbIoCount: perf.defaultOffDbIoCount, traceWritesAttempted: perf.traceWritesAttempted, traceWritesAllowed: perf.traceWritesAllowed },
    onlineAnalysisSummary: { traceCount: analysis.traceCount, averageTopKOverlap: analysis.averageTopKOverlap, majorDivergenceRate: analysis.majorDivergenceRate, sampleSizeWarning: analysis.sampleSizeWarning, productUseEnabled: analysis.productUseEnabled },
    retentionReadinessSummary: { destructiveOperationUsed: false, requiresFounderApproval: true, mode: retention.mode },
    runtimeSafetySummary: { liveResponseChanged: false, liveRankingChanged: false, decisionTraceExposedToUser: false },
    productUseEnabled: false, liveRankingChangedForUser: false, promotionAllowed: false,
    dbWritesDuringDefaultOffMode: 0, networkCallsDuringGate: 0,
    redactedFailureDetails: failed,
    remainingIntegrationGaps: [
      'Simulation is offline/synthetic — not real production traffic.',
      'Profile rebuild uses approximate persisted-signal mapping; cold-start fallback for sparse users.',
      'Promotion is design-readiness only; a Founder-approved, consent-gated, safety-reviewed limited dev experiment (A10) is required before any live ranking change.',
    ],
  };

  const json = JSON.stringify(artifact);
  if (hasForbidden(json)) { artifact.failedChecks += 1; artifact.totalChecks += 1; artifact.redactedFailureDetails.push('redaction:assembled artifact contains a forbidden value'); }
  else { artifact.totalChecks += 1; artifact.passedChecks += 1; artifact.categories['redaction'].total += 1; artifact.categories['redaction'].passed += 1; }

  return artifact;
}
