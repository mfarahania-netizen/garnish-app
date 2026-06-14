import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationShadowRuntimeQaGate } from './recommendation-shadow-qa-gate';

describe('E18/E43-A6 shadow runtime recommendation QA gate', () => {
  const artifact = runRecommendationShadowRuntimeQaGate();

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a6_shadow_runtime_recommendation_results.json'), JSON.stringify(artifact, null, 2));
    } catch {
      /* best-effort */
    }
  });

  it('is offline-deterministic, no DB/network, product use disabled', () => {
    expect(artifact.runMode).toBe('offline-deterministic');
    expect(artifact.dbMigrationRequired).toBe(false);
    expect(artifact.dbWritesDuringGate).toBe(0);
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.productUseEnabled).toBe(false);
    expect(artifact.rankingChangedForUser).toBe(false);
  });

  it('runs at least 220 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A6 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(220);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'runtime_mode_parsing',
      'sampling_gate',
      'safety_gate',
      'integration_safety',
      'live_response_immutability',
      'live_ranking_immutability',
      'comparison_metrics',
      'divergence_analysis',
      'shadow_scorer_call_isolation',
      'redaction',
      'no_db_network',
      'artifact_safety',
      'no_product_enablement',
      'overclaim_prevention',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('integration summary proves no live change / no db / no network', () => {
    expect(artifact.integrationSummary.integrationAdded).toBe(true);
    expect(artifact.integrationSummary.integrationPoint).toBeTruthy();
    expect(artifact.integrationSummary.liveResponseChanged).toBe(false);
    expect(artifact.integrationSummary.liveRankingChanged).toBe(false);
    expect(artifact.integrationSummary.dbWritesAdded).toBe(false);
    expect(artifact.integrationSummary.networkCallsAdded).toBe(false);
  });

  it('comparison: 12 users / 30 candidates / 8 histories with distinct shadow fingerprints', () => {
    expect(artifact.comparisonSummary.simulatedUsers).toBe(12);
    expect(artifact.comparisonSummary.candidateCount).toBe(30);
    expect(artifact.comparisonSummary.histories).toBe(8);
    expect(artifact.comparisonSummary.distinctShadowFingerprints).toBeGreaterThanOrEqual(6);
  });

  it('shadow isolation: off mode produces no trace; no throws escaped', () => {
    expect(artifact.shadowIsolationSummary.offModeProducesNoTrace).toBe(true);
    expect(artifact.shadowIsolationSummary.throwsEscaped).toBe(0);
    expect(artifact.shadowIsolationSummary.inputArraysNotMutated).toBe(true);
  });

  it('artifact is leak-free (no PII/secret/medical label)', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+|mongodb(\+srv)?:\/\/\S+/);
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });

  it('redactedFailureDetails empty; gaps declared', () => {
    expect(artifact.redactedFailureDetails).toEqual([]);
    expect(artifact.remainingIntegrationGaps.length).toBeGreaterThanOrEqual(3);
  });
});
