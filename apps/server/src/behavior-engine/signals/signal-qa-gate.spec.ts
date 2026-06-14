import * as fs from 'node:fs';
import * as path from 'node:path';
import { runSignalQaGate } from './signal-qa-gate';

describe('E43-A3 signal QA gate', () => {
  const artifact = runSignalQaGate();

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/behavior');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e43_a3_signal_observation_results.json'), JSON.stringify(artifact, null, 2));
    } catch {
      /* best-effort */
    }
  });

  it('is offline-deterministic with no DB/network', () => {
    expect(artifact.runMode).toBe('offline-deterministic');
    expect(artifact.dbMigrationRequired).toBe(false);
    expect(artifact.dbWritesDuringGate).toBe(0);
    expect(artifact.networkCallsDuringGate).toBe(0);
  });

  it('runs at least 60 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('E43-A3 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(60);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'registry_completeness',
      'forbidden_absence',
      'event_mapping',
      'confidence_scoring',
      'contradiction',
      'recency_decay',
      'privacy_consent',
      'explainability_safety',
      'artifact_redaction',
      'deterministic_ordering',
      'no_db_network',
    ]) {
      expect(artifact.categoryBreakdown[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('registry summary is honest (>=36, families, no forbidden, b2b absent)', () => {
    const s = artifact.signalRegistrySummary as any;
    expect(s.total).toBeGreaterThanOrEqual(36);
    expect(s.families).toBe(10);
    expect(s.noForbidden).toBe(true);
    expect(s.b2bAbsent).toBe(true);
    expect(s.statusGroundedInTaxonomy).toBe(true);
    expect(s.requiredKeysPresent).toBe(true);
  });

  it('artifact is leak-free (no PII/secret/medical label about a user)', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+|mongodb(\+srv)?:\/\/\S+/);
    // no forbidden medical/protected label about a user in the artifact
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });

  it('redactedFailureDetails is empty on a green run', () => {
    expect(artifact.redactedFailureDetails).toEqual([]);
  });

  it('declares remaining integration gaps (no over-claim)', () => {
    expect(artifact.remainingIntegrationGaps.length).toBeGreaterThanOrEqual(3);
  });
});
