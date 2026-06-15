import { defineSafeLimitedActivationGuardrails, MANDATORY_GUARDRAIL_COUNT } from './recommendation-activation-guardrails';
import { reviewLimitedDevShadowExperimentResults } from './recommendation-activation-review-model';
import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';
import { validA13 } from './recommendation-activation-result-reader.spec';

const review = (over: any = {}) => reviewLimitedDevShadowExperimentResults(readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), ...over } }));

describe('defineSafeLimitedActivationGuardrails', () => {
  it('returns >= 12 mandatory guardrails, all required', () => {
    const g = defineSafeLimitedActivationGuardrails(review());
    expect(g.length).toBeGreaterThanOrEqual(12);
    expect(MANDATORY_GUARDRAIL_COUNT).toBeGreaterThanOrEqual(12);
    expect(g.every((x) => x.required === true)).toBe(true);
  });
  it('includes the mandatory codes', () => {
    const codes = defineSafeLimitedActivationGuardrails(review()).map((g) => g.code);
    for (const c of ['founder_approval_required', 'dev_only_mode', 'admin_only_internal_access', 'feature_flag_off_by_default', 'kill_switch_on_call_path', 'sample_cap', 'trace_write_redacted_only', 'consent_required', 'no_public_exposure', 'no_live_ranking_mutation', 'no_user_response_mutation', 'rollback_by_env', 'monitoring_threshold', 'immediate_stop_conditions']) {
      expect(codes).toContain(c);
    }
  });
  it('valid+safe review → no blocking guardrail missing; monitoring needs verification', () => {
    const g = defineSafeLimitedActivationGuardrails(review());
    expect(g.filter((x) => x.failureImpact === 'blocking' && x.status === 'missing').length).toBe(0);
    expect(g.find((x) => x.code === 'monitoring_threshold')!.status).toBe('needs_verification');
  });
  it('blocked review → safety guardrails need verification', () => {
    const g = defineSafeLimitedActivationGuardrails(review({ failedChecks: 3 }));
    expect(g.find((x) => x.code === 'trace_write_redacted_only')!.status).toBe('needs_verification');
  });
  it('never throws on garbage', () => {
    expect(() => defineSafeLimitedActivationGuardrails(undefined as any)).not.toThrow();
  });
});
