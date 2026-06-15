import { generateSafeLimitedActivationPlan } from './recommendation-activation-plan-generator';
import { buildRecommendationActivationReadinessMatrix } from './recommendation-activation-readiness-matrix';
import { defineSafeLimitedActivationGuardrails } from './recommendation-activation-guardrails';
import { reviewLimitedDevShadowExperimentResults } from './recommendation-activation-review-model';
import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';
import { validA13 } from './recommendation-activation-result-reader.spec';

const build = (over: any = {}) => {
  const e = readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), ...over } });
  const review = reviewLimitedDevShadowExperimentResults(e);
  const matrix = buildRecommendationActivationReadinessMatrix(review, e);
  const guardrails = defineSafeLimitedActivationGuardrails(review);
  return generateSafeLimitedActivationPlan(review, matrix, guardrails);
};

describe('generateSafeLimitedActivationPlan', () => {
  it('valid → draft_ready_for_founder_review, hard caps, dev-shadow scope, no live/product change', () => {
    const p = build();
    expect(p.status).toBe('draft_ready_for_founder_review');
    expect(p.scope).toBe('dev_internal_shadow_only');
    expect(p.maxUsers).toBeLessThanOrEqual(5);
    expect(p.maxRequests).toBeLessThanOrEqual(240);
    expect(p.durationHours).toBeLessThanOrEqual(24);
    expect(p.requiredApprovals).toEqual(['founder']);
    expect(p.liveRankingChangeAllowed).toBe(false);
    expect(p.userResponseChangeAllowed).toBe(false);
    expect(p.productUseEnabled).toBe(false);
  });
  it('forbidden actions include production/personalization/AI-autonomy/consent/redaction/kill-switch', () => {
    const f = build().forbiddenActions;
    for (const a of ['enable production ranking', 'enable public personalization', 'enable AI autonomy', 'disable consent checks', 'disable trace redaction', 'bypass kill switch']) {
      expect(f).toContain(a);
    }
  });
  it('invalid evidence → blocked plan', () => {
    expect(build({ failedChecks: 3, analysisSummary: { readinessStatus: 'blocked', failureEscapeCount: 1 } }).status).toBe('blocked');
  });
  it('rollback plan: env-disable, non-destructive, no live-ranking rollback', () => {
    const rb = build().rollbackPlan;
    expect(rb.disableByEnv).toBe(true);
    expect(rb.destructiveRollbackRequired).toBe(false);
    expect(rb.liveRankingRollbackRequired).toBe(false);
  });
  it('stop conditions present', () => {
    expect(build().stopConditions.length).toBeGreaterThan(0);
  });
  it('never throws on garbage', () => {
    expect(() => generateSafeLimitedActivationPlan(undefined as any, undefined as any, undefined as any)).not.toThrow();
    expect(generateSafeLimitedActivationPlan(undefined as any, undefined as any, undefined as any).maxUsers).toBeLessThanOrEqual(5);
  });
});
