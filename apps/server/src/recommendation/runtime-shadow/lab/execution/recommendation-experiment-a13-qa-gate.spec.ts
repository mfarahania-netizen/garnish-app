import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationExperimentA13QaGate } from './recommendation-experiment-a13-qa-gate';

describe('E18/E43-A13 limited dev shadow experiment execution QA gate', () => {
  let artifact: Awaited<ReturnType<typeof runRecommendationExperimentA13QaGate>>;

  beforeAll(async () => {
    artifact = await runRecommendationExperimentA13QaGate();
    try {
      const outDir = path.resolve(__dirname, '../../../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a13_limited_dev_shadow_experiment_execution_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('offline-limited-dev-shadow-experiment-execution, no network, product disabled', () => {
    expect(artifact.runMode).toBe('offline-limited-dev-shadow-experiment-execution');
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.runtimeSafetySummary.productUseEnabled).toBe(false);
    expect(artifact.runtimeSafetySummary.liveRankingChanged).toBe(false);
  });

  it('runs at least 400 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A13 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(400);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'config_parsing', 'access_model', 'production_lockout', 'kill_switch', 'manifest_validation', 'executor',
      'run_ledger', 'result_analyzer', 'rollback_drill', 'kill_switch_drill', 'dossier', 'fail_safe', 'trace_write',
      'integration_a8', 'integration_a9', 'integration_a11', 'no_raw_leak', 'no_public_endpoint',
      'no_ranking_change', 'no_product_enablement', 'no_r3_r4_closure', 'runtime_safety', 'artifact_safety',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('manifest is founder-approved; promotion never allowed; no live/product change', () => {
    expect(artifact.executionManifestSummary.approvedBy).toBe('founder');
    expect(artifact.executionManifestSummary.liveRankingChangeAllowed).toBe(false);
    expect(artifact.executionManifestSummary.userResponseChangeAllowed).toBe(false);
    expect(artifact.executionManifestSummary.productUseEnabled).toBe(false);
    expect(artifact.promotionAllowed).toBe(false);
  });

  it('run ledger reports true, safe execution numbers', () => {
    expect(['completed', 'blocked', 'failed_safe']).toContain(artifact.runLedgerSummary.status);
    expect(artifact.runLedgerSummary.status).toBe('completed');
    expect(artifact.runLedgerSummary.requestsExecuted).toBeGreaterThan(0);
    expect(artifact.runLedgerSummary.shadowRunsAllowed + artifact.runLedgerSummary.shadowRunsBlocked).toBe(artifact.runLedgerSummary.requestsExecuted);
    expect(artifact.runLedgerSummary.failuresEscaped).toBe(0);
  });

  it('analysis + rollback + dossier + access summaries are safe', () => {
    expect(['executed_observable', 'ready_for_founder_review_of_results']).toContain(artifact.analysisSummary.readinessStatus);
    expect(artifact.analysisSummary.failureEscapeCount).toBe(0);
    expect(artifact.rollbackDrillSummary.passed).toBe(true);
    expect(artifact.rollbackDrillSummary.killSwitchBlocks).toBe(true);
    expect(artifact.rollbackDrillSummary.productionBlocked).toBe(true);
    expect(artifact.rollbackDrillSummary.destructiveRollbackRequired).toBe(false);
    expect(artifact.dossierSummary.nextDecisionRequired).toBe('founder_review_results');
    expect(artifact.accessSummary.publicEndpointExposed).toBe(false);
    expect(artifact.accessSummary.productionExecutionBlocked).toBe(true);
    expect(artifact.accessSummary.requiresAdmin).toBe(true);
  });

  it('artifact is leak-free', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+/);
    expect(json).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace|rawPayload|eventPayload)"/i);
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });

  it('redactedFailureDetails empty; gaps declared', () => {
    expect(artifact.redactedFailureDetails).toEqual([]);
    expect(artifact.remainingIntegrationGaps.length).toBeGreaterThanOrEqual(3);
  });
});
