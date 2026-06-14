import { evaluateRecommendationShadowPromotionGate, NEXT_REQUIRED_GATE } from './recommendation-shadow-control-plane-readiness';
import { PromotionGateInput } from './recommendation-shadow-control-plane.types';

const cleanInput = (): PromotionGateInput => ({
  traceSummary: { traceCount: 120, averageTopKOverlap: 0.5, majorDivergenceRate: 0.25, mostCommonReasonCodes: [], weakInputRate: 0.1, sampleSizeWarning: false },
  qualitySummary: { status: 'shadow_quality_observable', passedThresholds: ['a', 'b'], failedThresholds: [], warnings: ['w'] },
  performanceSummary: { avgMs: 9, p95Ms: 15, networkCalls: 0, defaultOffDbIoCount: 0, estimatedDbReads: 100, estimatedDbWrites: 10 },
  retentionSummary: { mode: 'dry_run', eligibleForDeletionCount: 5, destructiveOperationUsed: false, requiresFounderApproval: true },
  simulationArtifactSummary: { present: true, totalChecks: 404, failedChecks: 0, promotionAllowed: false, productUseEnabled: false, liveRankingChangedForUser: false, networkCallsDuringGate: 0, redactedFailureDetailsEmpty: true, reChecksPassed: true, warnings: [] },
  unsafeExplanationCount: 0, rawLeakCount: 0, consentBypassCount: 0, responseMutationCount: 0, liveRankingMutationCount: 0, traceRedactionPassRate: 1,
});

describe('evaluateRecommendationShadowPromotionGate', () => {
  it('clean input → allowed false, status dev_experiment_design_ready (or not_ready with warnings)', () => {
    const g = evaluateRecommendationShadowPromotionGate(cleanInput());
    expect(g.allowed).toBe(false);
    expect(g.blockers).toEqual([]);
    expect(['dev_experiment_design_ready', 'not_ready']).toContain(g.status);
    expect(g.nextRequiredGate).toBe(NEXT_REQUIRED_GATE);
  });

  it('allowed is ALWAYS false even with perfect input', () => {
    const perfect = { ...cleanInput(), qualitySummary: { status: 'ready_for_limited_dev_experiment_design' as const, passedThresholds: ['x'], failedThresholds: [], warnings: [] } };
    expect(evaluateRecommendationShadowPromotionGate(perfect).allowed).toBe(false);
  });

  it('unsafe explanation → blocked', () => {
    expect(evaluateRecommendationShadowPromotionGate({ ...cleanInput(), unsafeExplanationCount: 1 }).status).toBe('blocked');
  });
  it('raw leak → blocked', () => {
    expect(evaluateRecommendationShadowPromotionGate({ ...cleanInput(), rawLeakCount: 1 }).blockers).toContain('raw_leak_present');
  });
  it('consent bypass → blocked', () => {
    expect(evaluateRecommendationShadowPromotionGate({ ...cleanInput(), consentBypassCount: 1 }).blockers).toContain('consent_bypass_present');
  });
  it('live ranking mutation → blocked', () => {
    expect(evaluateRecommendationShadowPromotionGate({ ...cleanInput(), liveRankingMutationCount: 1 }).blockers).toContain('live_ranking_mutation');
  });
  it('incomplete redaction → blocked', () => {
    expect(evaluateRecommendationShadowPromotionGate({ ...cleanInput(), traceRedactionPassRate: 0.9 }).blockers).toContain('trace_redaction_incomplete');
  });
  it('destructive retention → blocked', () => {
    const i = cleanInput(); (i.retentionSummary as any).destructiveOperationUsed = true;
    expect(evaluateRecommendationShadowPromotionGate(i).blockers).toContain('destructive_retention');
  });
  it('artifact claims promotion → blocked', () => {
    const i = cleanInput(); i.simulationArtifactSummary.promotionAllowed = true;
    expect(evaluateRecommendationShadowPromotionGate(i).blockers).toContain('simulation_artifact_claims_promotion');
  });
  it('always warns R3/R4 remain mitigating', () => {
    expect(evaluateRecommendationShadowPromotionGate(cleanInput()).warnings).toContain('R3_R4_remain_mitigating_not_closed');
  });
  it('never throws on garbage', () => {
    expect(() => evaluateRecommendationShadowPromotionGate(undefined as any)).not.toThrow();
    expect(evaluateRecommendationShadowPromotionGate(undefined as any).allowed).toBe(false);
  });
});
