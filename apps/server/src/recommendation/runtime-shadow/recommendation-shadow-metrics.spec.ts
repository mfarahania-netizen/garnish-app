import { summarizeRecommendationShadowMetrics } from './recommendation-shadow-metrics';
import { ShadowMetricsInput } from './recommendation-shadow-input-provider.types';

describe('summarizeRecommendationShadowMetrics', () => {
  const rows: ShadowMetricsInput[] = [
    { attempted: true, allowed: true, traceWritten: true, traceWriteFailed: false, topKOverlap: 0.8, majorDivergence: true, weakInput: false, unsafeExplanationCount: 0, decisionConfidence: 0.6, missingInputs: ['exposureHistory'] },
    { attempted: true, allowed: true, traceWritten: false, traceWriteFailed: true, topKOverlap: 0.4, majorDivergence: false, weakInput: true, unsafeExplanationCount: 0, decisionConfidence: 0.4, missingInputs: ['userFoodIdentityGraph', 'exposureHistory'] },
    { attempted: true, allowed: false, blockedReason: 'consent_missing', traceWritten: false, traceWriteFailed: false },
    { attempted: false, allowed: false, blockedReason: 'experiment_not_assigned', traceWritten: false, traceWriteFailed: false },
  ];

  it('aggregates counts correctly', () => {
    const s = summarizeRecommendationShadowMetrics(rows);
    expect(s.shadowRunsAttempted).toBe(3);
    expect(s.shadowRunsAllowed).toBe(2);
    expect(s.tracesWritten).toBe(1);
    expect(s.traceWriteFailures).toBe(1);
    expect(s.majorDivergenceCount).toBe(1);
    expect(s.weakInputCount).toBe(1);
    expect(s.blockedByReason).toEqual({ consent_missing: 1, experiment_not_assigned: 1 });
    expect(s.missingInputFrequencies).toEqual({ exposureHistory: 2, userFoodIdentityGraph: 1 });
  });

  it('averages only over present numbers', () => {
    const s = summarizeRecommendationShadowMetrics(rows);
    expect(s.averageTopKOverlap).toBeCloseTo(0.6, 5);
    expect(s.averageDecisionConfidence).toBeCloseTo(0.5, 5);
  });

  it('empty input → zeros and null averages', () => {
    const s = summarizeRecommendationShadowMetrics([]);
    expect(s.shadowRunsAttempted).toBe(0);
    expect(s.averageTopKOverlap).toBeNull();
    expect(s.averageDecisionConfidence).toBeNull();
  });

  it('never throws on garbage', () => {
    expect(() => summarizeRecommendationShadowMetrics(null as any)).not.toThrow();
  });
});
