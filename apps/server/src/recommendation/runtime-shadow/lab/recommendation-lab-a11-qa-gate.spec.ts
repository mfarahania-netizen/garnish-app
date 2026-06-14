import * as fs from 'node:fs';
import * as path from 'node:path';
import { runRecommendationLabA11QaGate } from './recommendation-lab-a11-qa-gate';

describe('E18/E43-A11 Recommendation Lab controlled-dev-experiment QA gate', () => {
  let artifact: Awaited<ReturnType<typeof runRecommendationLabA11QaGate>>;

  beforeAll(async () => {
    artifact = await runRecommendationLabA11QaGate();
    try {
      const outDir = path.resolve(__dirname, '../../../../../..', 'docs/qa/recommendation');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'e18_e43_a11_recommendation_lab_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('offline-recommendation-lab-evaluation, no network, product disabled', () => {
    expect(artifact.runMode).toBe('offline-recommendation-lab-evaluation');
    expect(artifact.networkCallsDuringGate).toBe(0);
    expect(artifact.runtimeSafetySummary.productUseEnabled).toBe(false);
    expect(artifact.runtimeSafetySummary.liveRankingChanged).toBe(false);
  });

  it('runs at least 300 checks and ALL pass', () => {
    if (artifact.failedChecks) console.error('A11 GATE FAILURES:', JSON.stringify(artifact.redactedFailureDetails, null, 2));
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(300);
    expect(artifact.failedChecks).toBe(0);
    expect(artifact.passedChecks).toBe(artifact.totalChecks);
  });

  it('covers every required check family', () => {
    for (const cat of [
      'config_parsing', 'access_model', 'production_lockout', 'kill_switch', 'experiment_registry',
      'config_validator', 'runner', 'scorecard', 'promotion_gate', 'report_generator',
      'no_raw_leak', 'no_public_endpoint', 'no_ranking_change', 'no_product_enablement',
      'runtime_safety', 'recipe_universe', 'no_r3_r4_closure', 'artifact_safety',
    ]) {
      expect(artifact.categories[cat]?.total).toBeGreaterThan(0);
    }
  });

  it('promotion gate is always allowed:false with founder decision required', () => {
    expect(artifact.promotionGateSummary.allowed).toBe(false);
    expect(artifact.promotionGateSummary.requiredFounderDecision).toBe(true);
    expect(artifact.promotionGateSummary.nextRequiredGate).toBe('A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT');
  });

  it('access + kill-switch + retention + runtime-safety summaries are safe', () => {
    expect(artifact.accessSummary.publicEndpointExposed).toBe(false);
    expect(artifact.accessSummary.productionExecutionBlocked).toBe(true);
    expect(artifact.accessSummary.requiresAdmin).toBe(true);
    expect(artifact.killSwitchSummary.killSwitchBlocksExecution).toBe(true);
    expect(artifact.killSwitchSummary.unsafeRequestBlocked).toBe(true);
    expect(artifact.retentionSummary.destructiveOperationUsed).toBe(false);
    expect(artifact.retentionSummary.requiresFounderApproval).toBe(true);
    expect(artifact.runtimeSafetySummary.liveResponseChanged).toBe(false);
    expect(artifact.runtimeSafetySummary.decisionTraceExposedToUser).toBe(false);
  });

  it('artifact is leak-free', () => {
    const json = JSON.stringify(artifact);
    expect(json).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}/);
    expect(json).not.toMatch(/postgres:\/\/\S+|mysql:\/\/\S+/);
    expect(json).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace|instruction|steps)"/i);
    expect(json.toLowerCase()).not.toMatch(/diagnosis|pregnan|eating disorder|mental health|ethnicity|sexuality/);
  });

  it('redactedFailureDetails empty; gaps declared', () => {
    expect(artifact.redactedFailureDetails).toEqual([]);
    expect(artifact.remainingIntegrationGaps.length).toBeGreaterThanOrEqual(3);
  });
});
