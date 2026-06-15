import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationActivationA14QaGate } from './recommendation-activation-a14-qa-gate';

describe('E18/E43-A14 founder results review + safe limited activation plan QA gate', () => {
  let artifact: Awaited<ReturnType<typeof runRecommendationActivationA14QaGate>>;

  beforeAll(async () => {
    artifact = await runRecommendationActivationA14QaGate();
    try {
      const outDir = path.resolve(__dirname, '../../../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a14_founder_results_review_activation_plan_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('offline-founder-results-review-activation-plan-evaluation, no network, product disabled', () => {
    expect(artifact.runMode).toBe('offline-founder-results-review-activation-plan-evaluation');
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.runtimeSafetySummary.productUseEnabled).toBe(false);
    expect(artifact.runtimeSafetySummary.liveRankingChanged).toBe(false);
  });

  it('runs at least 450 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A14 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(450);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'config_parsing', 'access_model', 'production_lockout', 'a13_evidence_reader', 'founder_review',
      'readiness_matrix', 'guardrails', 'activation_plan', 'blocker_classifier', 'dry_run', 'decision_pack',
      'no_raw_leak', 'no_public_endpoint', 'no_ranking_change', 'no_user_response_change', 'no_product_enablement',
      'no_production_activation', 'no_r3_r4_closure', 'runtime_safety', 'artifact_safety',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('A13 evidence loaded + valid; promotion not allowed', () => {
    expect(artifact.a13EvidenceSummary.loaded).toBe(true);
    expect(artifact.a13EvidenceSummary.valid).toBe(true);
    expect(artifact.a13EvidenceSummary.failureEscapeCount).toBe(0);
    expect(artifact.a13EvidenceSummary.promotionAllowed).toBe(false);
  });

  it('founder review: production + live activation never allowed; founder decision required', () => {
    expect(artifact.founderReviewSummary.founderDecisionRequired).toBe(true);
    expect(artifact.founderReviewSummary.productionActivationAllowed).toBe(false);
    expect(artifact.founderReviewSummary.liveRankingActivationAllowed).toBe(false);
    expect(artifact.promotionAllowed).toBe(false);
  });

  it('readiness matrix is honest: production red, real-user not green, dev-shadow design yellow/green', () => {
    expect(artifact.readinessMatrixSummary.productionReadiness).toBe('red');
    expect(artifact.readinessMatrixSummary.realUserReadiness).not.toBe('green');
    expect(['yellow', 'green']).toContain(artifact.readinessMatrixSummary.safeLimitedDevActivationDesign);
  });

  it('activation plan caps + scope are safe', () => {
    expect(artifact.activationPlanSummary.scope).toBe('dev_internal_shadow_only');
    expect(artifact.activationPlanSummary.maxUsers).toBeLessThanOrEqual(5);
    expect(artifact.activationPlanSummary.maxRequests).toBeLessThanOrEqual(240);
    expect(artifact.activationPlanSummary.durationHours).toBeLessThanOrEqual(24);
    expect(artifact.activationPlanSummary.liveRankingChangeAllowed).toBe(false);
    expect(artifact.activationPlanSummary.userResponseChangeAllowed).toBe(false);
    expect(artifact.activationPlanSummary.productUseEnabled).toBe(false);
  });

  it('guardrails + dry-run + decision pack + access summaries are safe', () => {
    expect(artifact.guardrailSummary.mandatoryGuardrails).toBeGreaterThanOrEqual(12);
    expect(artifact.guardrailSummary.blockingMissingGuardrails).toBe(0);
    expect(artifact.dryRunSummary.allPassed).toBe(true);
    expect(artifact.dryRunSummary.liveRankingChanged).toBe(false);
    expect(artifact.decisionPackSummary.requiredFounderDecision).toBe(true);
    expect(artifact.decisionPackSummary.forbiddenDecisionOptions).toEqual(['enable_production_ranking', 'enable_public_personalization', 'enable_ai_autonomy']);
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
