import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';

export const validA13 = () => ({
  schemaVersion: 1,
  runMode: 'offline-limited-dev-shadow-experiment-execution',
  totalChecks: 408, passedChecks: 408, failedChecks: 0,
  executionManifestSummary: { approvedBy: 'founder', mode: 'shadow_dev', liveRankingChangeAllowed: false, userResponseChangeAllowed: false, productUseEnabled: false },
  runLedgerSummary: { status: 'completed', requestsExecuted: 120, shadowRunsAllowed: 96, shadowRunsBlocked: 24, tracesWritten: 0, failuresEscaped: 0 },
  analysisSummary: { readinessStatus: 'ready_for_founder_review_of_results', failureEscapeCount: 0 },
  rollbackDrillSummary: { passed: true, disableByEnv: true, killSwitchBlocks: true, traceWriteDisableByEnv: true, destructiveRollbackRequired: false, productionBlocked: true },
  dossierSummary: { nextDecisionRequired: 'founder_review_results', productUseEnabled: false, liveRankingChangedForUser: false },
  accessSummary: { publicEndpointExposed: false, productionExecutionBlocked: true, requiresAdmin: true },
  runtimeSafetySummary: { liveResponseChanged: false, liveRankingChanged: false, decisionTraceExposedToUser: false, productUseEnabled: false },
  promotionAllowed: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0,
  redactedFailureDetails: [], remainingIntegrationGaps: [],
});

describe('readA13ExecutionEvidence', () => {
  it('reads the real on-disk A13 artifact → loaded + valid', () => {
    const r = readA13ExecutionEvidence();
    expect(r.loaded).toBe(true);
    expect(r.valid).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.summary.approvedBy).toBe('founder');
    expect(r.summary.failureEscapeCount).toBe(0);
  });
  it('valid override → all checks pass', () => {
    const r = readA13ExecutionEvidence(undefined, { artifactOverride: validA13() });
    expect(r.valid).toBe(true);
    expect(Object.values(r.checks).every(Boolean)).toBe(true);
  });
  it('failedChecks > 0 → invalid + blocker', () => {
    const r = readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), failedChecks: 3 } });
    expect(r.valid).toBe(false);
    expect(r.blockers).toContain('a13_evidence_invalid:failedChecksZero');
  });
  it('non-founder approval → invalid', () => {
    const r = readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), executionManifestSummary: { ...validA13().executionManifestSummary, approvedBy: 'internal' } } });
    expect(r.valid).toBe(false);
  });
  it('wrong runMode → invalid', () => {
    expect(readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), runMode: 'x' } }).valid).toBe(false);
  });
  it('promotionAllowed true → invalid', () => {
    expect(readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), promotionAllowed: true } }).valid).toBe(false);
  });
  it('missing artifact (null override is undefined; use empty object) → no crash, invalid', () => {
    expect(readA13ExecutionEvidence(undefined, { artifactOverride: {} }).valid).toBe(false);
    expect(() => readA13ExecutionEvidence(undefined, { artifactOverride: {} })).not.toThrow();
  });
  it('always notes synthetic/offline evidence', () => {
    expect(readA13ExecutionEvidence(undefined, { artifactOverride: validA13() }).warnings.some((w) => /synthetic|offline/i.test(w))).toBe(true);
  });
});
