import { reviewLimitedDevShadowExperimentResults } from './recommendation-activation-review-model';
import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';
import { validA13 } from './recommendation-activation-result-reader.spec';

const ev = (over: any = {}) => readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), ...over } });

describe('reviewLimitedDevShadowExperimentResults', () => {
  it('valid + safe evidence → eligible_for_safe_limited_activation_design, founder decision required, no production/live activation', () => {
    const r = reviewLimitedDevShadowExperimentResults(ev());
    expect(r.verdict).toBe('eligible_for_safe_limited_activation_design');
    expect(r.founderDecisionRequired).toBe(true);
    expect(r.productionActivationAllowed).toBe(false);
    expect(r.liveRankingActivationAllowed).toBe(false);
    expect(r.safetyQuality).toBe(1);
    expect(r.evidenceQuality).toBe(1);
  });
  it('invalid evidence → blocked', () => {
    expect(reviewLimitedDevShadowExperimentResults(ev({ failedChecks: 2 })).verdict).toBe('blocked');
  });
  it('safety issue (productUseEnabled true) → blocked', () => {
    expect(reviewLimitedDevShadowExperimentResults(ev({ runtimeSafetySummary: { ...validA13().runtimeSafetySummary, productUseEnabled: true } })).verdict).toBe('blocked');
  });
  it('always notes real-user evidence not collected', () => {
    expect(reviewLimitedDevShadowExperimentResults(ev()).warnings.some((w) => /real-user/i.test(w))).toBe(true);
  });
  it('never throws on garbage', () => {
    expect(() => reviewLimitedDevShadowExperimentResults(undefined as any)).not.toThrow();
    expect(reviewLimitedDevShadowExperimentResults(undefined as any).verdict).toBe('blocked');
    expect(reviewLimitedDevShadowExperimentResults(undefined as any).productionActivationAllowed).toBe(false);
  });
});
