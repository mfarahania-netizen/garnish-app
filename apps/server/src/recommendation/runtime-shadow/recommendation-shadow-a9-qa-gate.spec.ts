import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationShadowA9QaGate } from './recommendation-shadow-a9-qa-gate';

describe('E18/E43-A9 controlled dev-traffic shadow experiment QA gate', () => {
  let artifact: Awaited<ReturnType<typeof runRecommendationShadowA9QaGate>>;

  beforeAll(async () => {
    artifact = await runRecommendationShadowA9QaGate();
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a9_dev_traffic_shadow_experiment_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('offline-dev-traffic-simulation, no network, product disabled, promotion not allowed', () => {
    expect(artifact.runMode).toBe('offline-dev-traffic-simulation');
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.dbWritesDuringDefaultOffMode).toBe(0);
    expect(artifact.productUseEnabled).toBe(false);
    expect(artifact.liveRankingChangedForUser).toBe(false);
    expect(artifact.promotionAllowed).toBe(false);
  });

  it('runs at least 260 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A9 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(260);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'simulation_shape', 'user_matrix', 'context_matrix', 'consent_matrix', 'recipe_universe', 'run_counts',
      'trace_eligibility', 'online_analysis', 'retention_dry_run', 'quality_thresholds', 'failure_buckets',
      'performance_guard', 'default_off', 'response_ranking_immutability', 'redaction', 'no_product_enablement',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('simulation summary meets scale minimums', () => {
    const s = artifact.simulationSummary as any;
    expect(s.simulatedUsers).toBe(24);
    expect(s.contexts).toBe(7);
    expect(s.consentStates).toBe(6);
    expect(s.simulatedRequests).toBeGreaterThanOrEqual(240);
    expect(s.allowedShadowRuns).toBeGreaterThanOrEqual(80);
    expect(s.blockedConsentOrSafetyRuns).toBeGreaterThanOrEqual(40);
    expect(s.traceWriteEligibleRuns).toBeGreaterThanOrEqual(20);
    expect(s.retentionDryRunEligibleTraces).toBeGreaterThanOrEqual(10);
  });

  it('recipe universe: observed 350 / ratio 1', () => {
    const r = artifact.recipeUniverseSummary as any;
    expect(r.expectedTotal).toBe(350);
    expect(r.observedTotal).toBe(350);
    expect(r.coverageRatio).toBe(1);
  });

  it('retention + runtime safety summaries safe', () => {
    expect(artifact.retentionReadinessSummary.destructiveOperationUsed).toBe(false);
    expect(artifact.retentionReadinessSummary.requiresFounderApproval).toBe(true);
    expect(artifact.runtimeSafetySummary.liveResponseChanged).toBe(false);
    expect(artifact.runtimeSafetySummary.liveRankingChanged).toBe(false);
    expect(artifact.runtimeSafetySummary.decisionTraceExposedToUser).toBe(false);
  });

  it('artifact is leak-free', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+/);
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });

  it('redactedFailureDetails empty; gaps declared', () => {
    expect(artifact.redactedFailureDetails).toEqual([]);
    expect(artifact.remainingIntegrationGaps.length).toBeGreaterThanOrEqual(3);
  });
});
