import { simulateSafeLimitedActivationDryRun } from './recommendation-activation-dry-run';
import { generateSafeLimitedActivationPlan } from './recommendation-activation-plan-generator';
import { buildRecommendationActivationReadinessMatrix } from './recommendation-activation-readiness-matrix';
import { defineSafeLimitedActivationGuardrails } from './recommendation-activation-guardrails';
import { reviewLimitedDevShadowExperimentResults } from './recommendation-activation-review-model';
import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';
import { validA13 } from './recommendation-activation-result-reader.spec';
import { ActivationReviewContext } from './recommendation-activation-review.types';

const plan = () => {
  const e = readA13ExecutionEvidence(undefined, { artifactOverride: validA13() });
  const review = reviewLimitedDevShadowExperimentResults(e);
  const matrix = buildRecommendationActivationReadinessMatrix(review, e);
  return generateSafeLimitedActivationPlan(review, matrix, defineSafeLimitedActivationGuardrails(review));
};
const ctx: ActivationReviewContext = { config: { mode: 'dev_internal_api', requireAdmin: true, allowDryRun: true, maxTraceRead: 500 }, environment: 'test', adminVerified: true, internalCall: true };

describe('simulateSafeLimitedActivationDryRun', () => {
  it('all scenarios pass; no live/response/product/public change', () => {
    const d = simulateSafeLimitedActivationDryRun(plan(), ctx);
    expect(d.simulated).toBe(true);
    expect(d.allPassed).toBe(true);
    expect(d.liveRankingChanged).toBe(false);
    expect(d.userResponseChanged).toBe(false);
    expect(d.productUseEnabled).toBe(false);
    expect(d.publicEndpointExposed).toBe(false);
  });
  it('covers flag-off / flag-on-dev / kill-switch / consent / redaction / threshold / rollback / production', () => {
    const codes = simulateSafeLimitedActivationDryRun(plan(), ctx).scenarios.map((s) => s.code);
    for (const c of ['flag_off_default', 'flag_on_dev_only', 'kill_switch_on', 'missing_consent', 'trace_redaction_failure', 'threshold_breach', 'rollback_by_env', 'production_blocked']) {
      expect(codes).toContain(c);
    }
  });
  it('production scenario expects blocked', () => {
    const s = simulateSafeLimitedActivationDryRun(plan(), ctx).scenarios.find((x) => x.code === 'production_blocked')!;
    expect(s.expected).toBe('blocked');
    expect(s.actual).toBe('blocked');
    expect(s.passed).toBe(true);
  });
  it('never throws on garbage', () => {
    expect(() => simulateSafeLimitedActivationDryRun(undefined as any, undefined as any)).not.toThrow();
  });
});
