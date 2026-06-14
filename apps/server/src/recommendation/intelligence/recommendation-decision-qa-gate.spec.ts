import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationDecisionQaGate } from './recommendation-decision-qa-gate';

describe('E18/E43-A5 recommendation decision intelligence QA gate', () => {
  const artifact = runRecommendationDecisionQaGate();

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a5_recommendation_decision_intelligence_results.json'), JSON.stringify(artifact, null, 2));
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
  });

  it('runs at least 180 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A5 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(180);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'decision_trace_completeness',
      'scoring_weight_behavior',
      'graph_dimension_usage',
      'exposure_attribution',
      'outcome_attribution',
      'anti_repeat_fatigue',
      'safety_suppression',
      'why_engine_safety',
      'multi_user_distinct_ranking',
      'context_sensitivity',
      'confidence_behavior',
      'deterministic_ordering',
      'artifact_redaction',
      'no_db_network',
      'overclaim_prevention',
    ]) {
      expect(artifact.categoryBreakdown[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('simulation: 12 users / 30 candidates / 8 histories with distinct rankings', () => {
    expect(artifact.simulationSummary.simulatedUsers).toBe(12);
    expect(artifact.simulationSummary.candidateCount).toBe(30);
    expect(artifact.simulationSummary.exposureOutcomeHistories).toBe(8);
    expect(artifact.simulationSummary.distinctRankingFingerprints).toBeGreaterThanOrEqual(9);
    expect(artifact.simulationSummary.contextShiftCases).toBeGreaterThanOrEqual(1);
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
