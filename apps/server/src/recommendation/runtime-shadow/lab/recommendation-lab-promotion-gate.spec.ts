import { evaluateRecommendationLabPromotionGate } from './recommendation-lab-promotion-gate';
import { RecommendationLabExperiment, RecommendationExperimentQualityScorecard } from './recommendation-lab.types';

const sc = (over: Partial<RecommendationExperimentQualityScorecard> = {}): RecommendationExperimentQualityScorecard => ({
  overallScore: 0.8, readinessScore: 0.7, safetyScore: 1, traceQualityScore: 1, rankingStabilityScore: 1, consentComplianceScore: 1, performanceScore: 1, dataCoverageScore: 1, failedCriticalChecks: [], warnings: [], ...over,
});
const exp = (over: Partial<RecommendationLabExperiment> = {}): RecommendationLabExperiment => ({
  experimentId: 'x', experimentKey: 'k', mode: 'shadow_dev', status: 'completed', generatedAt: 'now',
  recipeUniverse: { expectedTotal: 350, observedTotal: 350, coverageRatio: 1 }, trafficPlan: { usersPlanned: 24, contextsPlanned: 7, requestsPlanned: 240, shadowRunsPlanned: 144 },
  executionSummary: { requestsExecuted: 240, shadowRunsAllowed: 192, shadowRunsBlocked: 48, tracesWritten: 0, tracesAnalyzed: 40, failuresEscaped: 0 },
  metrics: {} as any, safety: { killSwitchEngaged: false } as any, configValidation: { ok: true, errors: [], warnings: [] },
  qualityScorecard: {} as any, promotionGate: {} as any, report: {} as any, productUseEnabled: false, liveRankingChangedForUser: false, version: 1, ...over,
});

describe('evaluateRecommendationLabPromotionGate', () => {
  it('clean + good scores → ready_for_founder_review, allowed false', () => {
    const g = evaluateRecommendationLabPromotionGate(sc(), exp());
    expect(g.allowed).toBe(false);
    expect(g.status).toBe('ready_for_founder_review');
    expect(g.requiredFounderDecision).toBe(true);
    expect(g.nextRequiredGate).toBe('A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT');
  });
  it('allowed ALWAYS false even with perfect scorecard', () => {
    expect(evaluateRecommendationLabPromotionGate(sc({ overallScore: 1, readinessScore: 1 }), exp()).allowed).toBe(false);
  });
  it('failed critical check → blocked', () => {
    expect(evaluateRecommendationLabPromotionGate(sc({ failedCriticalChecks: ['consent_bypass'], safetyScore: 0 }), exp()).status).toBe('blocked');
  });
  it('safety < 1 → blocked', () => {
    expect(evaluateRecommendationLabPromotionGate(sc({ safetyScore: 0.5 }), exp()).blockers).toContain('safety_score_below_max');
  });
  it('low readiness → not_ready (not blocked)', () => {
    const g = evaluateRecommendationLabPromotionGate(sc({ readinessScore: 0.2, overallScore: 0.6 }), exp());
    expect(g.status).toBe('not_ready');
    expect(g.allowed).toBe(false);
  });
  it('blocked experiment → blocked', () => {
    expect(evaluateRecommendationLabPromotionGate(sc(), exp({ status: 'blocked' })).status).toBe('blocked');
  });
  it('kill switch engaged → blocked', () => {
    expect(evaluateRecommendationLabPromotionGate(sc(), exp({ safety: { killSwitchEngaged: true } as any })).blockers).toContain('kill_switch_engaged');
  });
  it('always warns R3/R4 mitigating', () => {
    expect(evaluateRecommendationLabPromotionGate(sc(), exp()).warnings).toContain('R3_R4_remain_mitigating_not_closed');
  });
  it('never throws on garbage', () => {
    expect(() => evaluateRecommendationLabPromotionGate(undefined as any, undefined as any)).not.toThrow();
    expect(evaluateRecommendationLabPromotionGate(undefined as any, undefined as any).allowed).toBe(false);
  });
});
