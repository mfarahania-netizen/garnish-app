import { buildRecommendationActivationReadinessMatrix } from './recommendation-activation-readiness-matrix';
import { reviewLimitedDevShadowExperimentResults } from './recommendation-activation-review-model';
import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';
import { validA13 } from './recommendation-activation-result-reader.spec';

const ev = (over: any = {}) => readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), ...over } });
const matrix = (over: any = {}) => { const e = ev(over); return buildRecommendationActivationReadinessMatrix(reviewLimitedDevShadowExperimentResults(e), e); };

describe('buildRecommendationActivationReadinessMatrix', () => {
  it('production readiness ALWAYS red; real-user not green; dev-shadow design green when valid', () => {
    const m = matrix();
    expect(m.productionReadiness).toBe('red');
    expect(m.realUserReadiness).not.toBe('green');
    expect(m.safeLimitedDevActivationDesign).toBe('green');
  });
  it('has all 11 dimensions', () => {
    const m = matrix();
    for (const k of ['evidenceCompleteness', 'safetyGuardrails', 'consentEnforcement', 'traceRedaction', 'rollbackReadiness', 'killSwitchReadiness', 'performanceBounds', 'observability', 'sampleQuality', 'realUserReadiness', 'productionReadiness']) {
      expect(m.dimensions[k]).toBeDefined();
    }
  });
  it('valid evidence → no design blockers', () => {
    expect(matrix().overallBlockers).toEqual([]);
  });
  it('invalid evidence → safety/trace red blockers → design red', () => {
    const m = matrix({ failedChecks: 5, analysisSummary: { readinessStatus: 'blocked', failureEscapeCount: 1 } });
    expect(m.safeLimitedDevActivationDesign).toBe('red');
    expect(m.overallBlockers.length).toBeGreaterThan(0);
  });
  it('observability + sampleQuality are yellow (honest)', () => {
    const m = matrix();
    expect(m.dimensions.observability.status).toBe('yellow');
    expect(m.dimensions.sampleQuality.status).toBe('yellow');
  });
  it('never throws on garbage', () => {
    expect(() => buildRecommendationActivationReadinessMatrix(undefined as any, undefined as any)).not.toThrow();
    expect(buildRecommendationActivationReadinessMatrix(undefined as any, undefined as any).productionReadiness).toBe('red');
  });
});
