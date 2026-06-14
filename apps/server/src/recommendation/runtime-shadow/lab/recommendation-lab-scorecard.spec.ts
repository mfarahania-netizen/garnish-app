import { computeRecommendationLabScorecard } from './recommendation-lab-scorecard';
import { RecommendationLabExperiment } from './recommendation-lab.types';

function exp(over: { safety?: any; metrics?: any; execution?: any } = {}): RecommendationLabExperiment {
  return {
    experimentId: 'x', experimentKey: 'a11-shadow-dev-balanced', mode: 'shadow_dev', status: 'completed', generatedAt: 'now',
    recipeUniverse: { expectedTotal: 350, observedTotal: 350, coverageRatio: 1 },
    trafficPlan: { usersPlanned: 24, contextsPlanned: 7, requestsPlanned: 240, shadowRunsPlanned: 144 },
    executionSummary: { requestsExecuted: 240, shadowRunsAllowed: 192, shadowRunsBlocked: 48, tracesWritten: 0, tracesAnalyzed: 40, failuresEscaped: 0, ...(over.execution || {}) },
    metrics: { majorDivergenceRate: 0.25, averageInputReadinessConfidence: 0.6, coverageRatio: 1, tracesAnalyzed: 40, averageTopKOverlap: 0.5, avgSimulatedRuntimeMs: 9, p95SimulatedRuntimeMs: 15, maxRequestsBound: 240, ...(over.metrics || {}) },
    safety: { consentBypassCount: 0, rawLeakCount: 0, unsafeExplanationCount: 0, responseMutationCount: 0, liveRankingMutationCount: 0, traceRedactionPassRate: 1, defaultOffDbIoCount: 0, killSwitchEngaged: false, publicEndpointExposed: false, productUseEnabled: false, liveRankingChangedForUser: false, ...(over.safety || {}) },
    configValidation: { ok: true, errors: [], warnings: [] },
    qualityScorecard: {} as any, promotionGate: {} as any, report: {} as any, productUseEnabled: false, liveRankingChangedForUser: false, version: 1,
  };
}

describe('computeRecommendationLabScorecard', () => {
  it('clean experiment → high safety, non-zero overall', () => {
    const sc = computeRecommendationLabScorecard(exp());
    expect(sc.safetyScore).toBe(1);
    expect(sc.consentComplianceScore).toBe(1);
    expect(sc.overallScore).toBeGreaterThan(0.5);
    expect(sc.failedCriticalChecks).toEqual([]);
  });
  it('consent bypass → zero safety + zero overall', () => {
    const sc = computeRecommendationLabScorecard(exp({ safety: { consentBypassCount: 1 } }));
    expect(sc.safetyScore).toBe(0);
    expect(sc.consentComplianceScore).toBe(0);
    expect(sc.overallScore).toBe(0);
    expect(sc.failedCriticalChecks).toContain('consent_bypass');
  });
  it('raw leak → zero safety + traceQuality 0', () => {
    const sc = computeRecommendationLabScorecard(exp({ safety: { rawLeakCount: 1 } }));
    expect(sc.safetyScore).toBe(0);
    expect(sc.traceQualityScore).toBe(0);
    expect(sc.overallScore).toBe(0);
  });
  it('live ranking mutation → blocked safety + rankingStability 0', () => {
    const sc = computeRecommendationLabScorecard(exp({ safety: { liveRankingMutationCount: 1 } }));
    expect(sc.rankingStabilityScore).toBe(0);
    expect(sc.overallScore).toBe(0);
  });
  it('incomplete redaction → traceQuality < 1 + safety 0.5', () => {
    const sc = computeRecommendationLabScorecard(exp({ safety: { traceRedactionPassRate: 0.8 } }));
    expect(sc.traceQualityScore).toBeCloseTo(0.8, 5);
    expect(sc.safetyScore).toBe(0.5);
  });
  it('low coverage → lower dataCoverage + warning', () => {
    const sc = computeRecommendationLabScorecard(exp({ metrics: { coverageRatio: 0.2 } }));
    expect(sc.dataCoverageScore).toBeCloseTo(0.2, 5);
    expect(sc.warnings.join(' ')).toMatch(/coverage/i);
  });
  it('high divergence → readiness warning', () => {
    const sc = computeRecommendationLabScorecard(exp({ metrics: { majorDivergenceRate: 0.9 } }));
    expect(sc.warnings.join(' ')).toMatch(/divergence/i);
  });
  it('failures escaped → zero overall', () => {
    expect(computeRecommendationLabScorecard(exp({ execution: { failuresEscaped: 1 } })).overallScore).toBe(0);
  });
  it('never throws on garbage', () => {
    expect(() => computeRecommendationLabScorecard(undefined as any)).not.toThrow();
    expect(computeRecommendationLabScorecard(undefined as any).overallScore).toBe(0);
  });
});
