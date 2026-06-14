import * as fs from 'node:fs';
import * as path from 'node:path';
import { runProfileQaGate } from './profile-qa-gate';

describe('E43-A4 profile QA gate', () => {
  const artifact = runProfileQaGate();

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/behavior');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e43_a4_user_food_identity_graph_results.json'), JSON.stringify(artifact, null, 2));
    } catch {
      /* best-effort */
    }
  });

  it('is offline-deterministic with no DB/network and product use disabled', () => {
    expect(artifact.runMode).toBe('offline-deterministic');
    expect(artifact.dbMigrationRequired).toBe(false);
    expect(artifact.dbWritesDuringGate).toBe(0);
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.productUseEnabled).toBe(false);
  });

  it('runs at least 140 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('E43-A4 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(140);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'graph_completeness',
      'dimension_aggregation',
      'confidence_aggregation',
      'evidence_lineage',
      'conflict_resolution',
      'recency_freshness',
      'privacy_consent',
      'explainability_safety',
      'downstream_readiness',
      'multi_user_simulation',
      'non_collapse_distinctiveness',
      'artifact_redaction',
      'no_db_network',
      'overclaim_prevention',
    ]) {
      expect(artifact.categoryBreakdown[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('simulation has 12 users with distinct, non-collapsed profiles', () => {
    expect(artifact.simulationSummary.simulatedUsers).toBe(12);
    expect(artifact.simulationSummary.distinctProfileFingerprints).toBeGreaterThanOrEqual(11);
    expect(artifact.simulationSummary.collapsedProfiles).toBeLessThanOrEqual(1);
    expect(artifact.simulationSummary.profiles.length).toBe(12);
  });

  it('artifact is leak-free (no PII/secret/medical label about a user)', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+|mongodb(\+srv)?:\/\/\S+/);
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });

  it('redactedFailureDetails empty on a green run; gaps declared', () => {
    expect(artifact.redactedFailureDetails).toEqual([]);
    expect(artifact.remainingIntegrationGaps.length).toBeGreaterThanOrEqual(3);
  });
});
