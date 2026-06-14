import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationShadowA8QaGate } from './recommendation-shadow-a8-qa-gate';

describe('E18/E43-A8 persisted-profile + consent + online-shadow QA gate', () => {
  let artifact: Awaited<ReturnType<typeof runRecommendationShadowA8QaGate>>;

  beforeAll(async () => {
    artifact = await runRecommendationShadowA8QaGate();
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a8_persisted_profile_consent_online_shadow_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('offline-deterministic, no network, product disabled', () => {
    expect(artifact.runMode).toBe('offline-deterministic');
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.dbWritesDuringDefaultOffMode).toBe(0);
    expect(artifact.productUseEnabled).toBe(false);
    expect(artifact.liveRankingChangedForUser).toBe(false);
  });

  it('runs at least 220 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A8 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(220);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'profile_feed_modes', 'persisted_snapshot_path', 'rebuild_from_signals_path', 'cold_start_fallback_path', 'no_fabrication',
      'consent_resolver', 'request_consent_preferred', 'dev_fixture_isolated', 'runtime_integration', 'trace_write_consent',
      'online_analysis_read_only', 'retention_dry_run_only', 'no_response_ranking_change', 'default_off_db_io_zero',
      'artifact_safety', 'static_redaction', 'additive_migration_safety', 'no_product_enablement',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('runtime integration + retention summaries safe', () => {
    expect(artifact.runtimeIntegrationSummary.liveResponseChanged).toBe(false);
    expect(artifact.runtimeIntegrationSummary.liveRankingChanged).toBe(false);
    expect(artifact.runtimeIntegrationSummary.decisionTraceExposedToUser).toBe(false);
    expect(artifact.retentionReadinessSummary.destructiveOperationUsed).toBe(false);
  });

  it('declares migration status (no new A8 migration)', () => {
    expect(artifact.dbMigrationRequired).toBe(false);
    expect(artifact.dbMigrationType).toBe('none');
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
