import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationFounderReviewA12QaGate } from './recommendation-founder-review-a12-qa-gate';

describe('E18/E43-A12 Founder-review evidence-pack QA gate', () => {
  let artifact: Awaited<ReturnType<typeof runRecommendationFounderReviewA12QaGate>>;

  beforeAll(async () => {
    artifact = await runRecommendationFounderReviewA12QaGate();
    try {
      const outDir = path.resolve(__dirname, '../../../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a12_founder_review_evidence_pack_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('offline-founder-review-evidence-evaluation, no network, product disabled', () => {
    expect(artifact.runMode).toBe('offline-founder-review-evidence-evaluation');
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.runtimeSafetySummary.productUseEnabled).toBe(false);
    expect(artifact.runtimeSafetySummary.liveRankingChanged).toBe(false);
  });

  it('runs at least 350 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A12 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(350);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'config_parsing', 'access_model', 'production_lockout', 'plan_model', 'plan_pipeline', 'evidence_pack',
      'integration_a8', 'integration_a9', 'integration_a10', 'integration_a11', 'safety_checklist', 'rollback_proof',
      'promotion_review', 'dossier', 'founder_decision_model', 'no_raw_leak', 'no_public_endpoint',
      'no_ranking_change', 'no_product_enablement', 'no_r3_r4_closure', 'runtime_safety', 'artifact_safety',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('plan + promotion are founder-gated; promotion never allowed', () => {
    expect(artifact.planSummary.scope).toBe('dev_shadow_only');
    expect(artifact.planSummary.requiredApprovals).toEqual(['founder']);
    expect(artifact.planSummary.promotionAllowed).toBe(false);
    expect(artifact.planSummary.liveRankingChangeAllowed).toBe(false);
    expect(artifact.planSummary.userResponseChangeAllowed).toBe(false);
    expect(artifact.promotionAllowed).toBe(false);
  });

  it('evidence pack integrates A8/A9/A10/A11 and is complete', () => {
    expect(artifact.evidencePackSummary.evidenceComplete).toBe(true);
    expect(artifact.evidencePackSummary.integratesA8).toBe(true);
    expect(artifact.evidencePackSummary.integratesA9).toBe(true);
    expect(artifact.evidencePackSummary.integratesA10).toBe(true);
    expect(artifact.evidencePackSummary.integratesA11).toBe(true);
  });

  it('safety + rollback + dossier + access + retention summaries are safe', () => {
    expect(artifact.safetyChecklistSummary.criticalFailureCount).toBe(0);
    expect(['pass', 'pass_with_warnings']).toContain(artifact.safetyChecklistSummary.status);
    expect(artifact.rollbackProofSummary.killSwitchBlocksExecution).toBe(true);
    expect(artifact.rollbackProofSummary.productionBlocked).toBe(true);
    expect(artifact.rollbackProofSummary.destructiveRollbackRequired).toBe(false);
    expect(artifact.dossierSummary.requiredFounderDecision).toBe(true);
    expect(artifact.dossierSummary.allowedDecisionOptions).toEqual(['reject', 'request_more_evidence', 'approve_limited_dev_shadow_experiment']);
    expect(artifact.accessSummary.publicEndpointExposed).toBe(false);
    expect(artifact.accessSummary.productionExecutionBlocked).toBe(true);
    expect(artifact.accessSummary.requiresAdmin).toBe(true);
    expect(artifact.retentionSummary.destructiveOperationUsed).toBe(false);
    expect(artifact.retentionSummary.requiresFounderApproval).toBe(true);
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
