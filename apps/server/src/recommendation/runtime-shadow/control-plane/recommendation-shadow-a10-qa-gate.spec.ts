import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationShadowA10QaGate } from './recommendation-shadow-a10-qa-gate';

describe('E18/E43-A10 control-plane internal-metrics QA gate', () => {
  let artifact: Awaited<ReturnType<typeof runRecommendationShadowA10QaGate>>;

  beforeAll(async () => {
    artifact = await runRecommendationShadowA10QaGate();
    try {
      const outDir = path.resolve(__dirname, '../../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a10_control_plane_internal_metrics_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('offline-control-plane-evaluation, no network, product disabled', () => {
    expect(artifact.runMode).toBe('offline-control-plane-evaluation');
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.productUseEnabled).toBe(false);
    expect(artifact.liveRankingChangedForUser).toBe(false);
  });

  it('runs at least 220 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A10 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(220);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'config_parsing', 'access_model', 'production_lockout', 'missing_guard_behavior', 'service_only_mode',
      'summary_shape', 'trace_summary_safety', 'simulation_artifact_reader', 'promotion_gate', 'failure_buckets',
      'performance_summary', 'retention_summary', 'no_raw_trace_exposure', 'no_public_endpoint', 'no_user_visible',
      'no_ranking_change', 'no_product_enablement', 'no_r3_r4_closure', 'artifact_safety',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('access + promotion + retention + runtime-safety summaries are safe', () => {
    expect(artifact.accessSummary.defaultMode).toBe('off');
    expect(artifact.accessSummary.productionDevApiBlocked).toBe(true);
    expect(artifact.accessSummary.publicEndpointExposed).toBe(false);
    expect(artifact.accessSummary.requiresAdmin).toBe(true);
    expect(artifact.promotionGateSummary.allowed).toBe(false);
    expect(artifact.promotionGateSummary.nextRequiredGate).toBe('A11_FOUNDER_APPROVED_LIMITED_DEV_EXPERIMENT');
    expect(artifact.retentionSummary.destructiveOperationUsed).toBe(false);
    expect(artifact.retentionSummary.requiresFounderApproval).toBe(true);
    expect(artifact.runtimeSafetySummary.liveRankingChanged).toBe(false);
    expect(artifact.runtimeSafetySummary.publicEndpointExposed).toBe(false);
  });

  it('artifact is leak-free', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+/);
    expect(json).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace)"/i);
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });

  it('redactedFailureDetails empty; gaps declared', () => {
    expect(artifact.redactedFailureDetails).toEqual([]);
    expect(artifact.remainingIntegrationGaps.length).toBeGreaterThanOrEqual(3);
  });
});
