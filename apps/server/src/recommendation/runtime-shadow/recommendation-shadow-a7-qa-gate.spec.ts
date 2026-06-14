import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationShadowA7QaGate } from './recommendation-shadow-a7-qa-gate';

describe('E18/E43-A7 scoring-input + trace + experiment QA gate', () => {
  let artifact: Awaited<ReturnType<typeof runRecommendationShadowA7QaGate>>;

  beforeAll(async () => {
    artifact = await runRecommendationShadowA7QaGate();
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a7_scoring_input_trace_experiment_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('is offline-deterministic, no network, product disabled', () => {
    expect(artifact.runMode).toBe('offline-deterministic');
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.dbWritesDuringDefaultOffMode).toBe(0);
    expect(artifact.productUseEnabled).toBe(false);
    expect(artifact.liveRankingChangedForUser).toBe(false);
  });

  it('runs at least 180 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A7 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(180);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'env_mode_parsing', 'input_provider_safety', 'input_readiness', 'no_raw_leak', 'experiment_assignment',
      'trace_redaction', 'trace_store_noop', 'trace_store_prisma', 'runtime_integration_isolation',
      'response_ranking_immutability', 'trace_write_failure_isolation', 'metrics_summary', 'artifact_safety',
      'db_migration_safety', 'no_product_enablement',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('runtime integration summary proves no live change', () => {
    expect(artifact.runtimeIntegrationSummary.liveResponseChanged).toBe(false);
    expect(artifact.runtimeIntegrationSummary.liveRankingChanged).toBe(false);
    expect(artifact.runtimeIntegrationSummary.decisionTraceExposedToUser).toBe(false);
  });

  it('declares the additive migration', () => {
    expect(artifact.dbMigrationRequired).toBe(true);
    expect(artifact.dbMigrationType).toBe('additive-shadow-trace-table');
  });

  it('artifact is leak-free', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+/);
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });

  it('redactedFailureDetails empty; gaps declared', () => {
    expect(artifact.redactedFailureDetails).toEqual([]);
    expect(artifact.remainingIntegrationGaps.length).toBeGreaterThanOrEqual(3);
  });
});
