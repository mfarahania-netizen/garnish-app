import { classifyActivationBlockers } from './recommendation-activation-blockers';
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
  return classifyActivationBlockers(review, matrix, guardrails);
};
const byBucket = (b: ReturnType<typeof build>, name: string) => b.find((x) => x.bucket === name)!;

describe('classifyActivationBlockers', () => {
  it('has all 12 buckets', () => {
    const b = build();
    for (const name of ['missing_evidence', 'safety_failure', 'consent_gap', 'trace_redaction_gap', 'rollback_gap', 'kill_switch_gap', 'observability_gap', 'sample_quality_gap', 'real_user_gap', 'production_not_allowed', 'r3_r4_mitigating', 'founder_decision_required']) {
      expect(byBucket(b, name)).toBeDefined();
    }
  });
  it('valid evidence → safety/trace/consent/rollback/kill-switch gaps are 0', () => {
    const b = build();
    for (const name of ['missing_evidence', 'safety_failure', 'consent_gap', 'trace_redaction_gap', 'rollback_gap', 'kill_switch_gap']) {
      expect(byBucket(b, name).count).toBe(0);
    }
  });
  it('founder_decision_required always blocks activation', () => {
    expect(byBucket(build(), 'founder_decision_required').blocksActivation).toBe(true);
  });
  it('production_not_allowed + r3_r4_mitigating present but do not block the dev-shadow design', () => {
    const b = build();
    expect(byBucket(b, 'production_not_allowed').count).toBe(1);
    expect(byBucket(b, 'production_not_allowed').blocksActivation).toBe(false);
    expect(byBucket(b, 'r3_r4_mitigating').blocksActivation).toBe(false);
  });
  it('observability + sample + real-user gaps present but non-blocking for design', () => {
    const b = build();
    expect(byBucket(b, 'observability_gap').count).toBe(1);
    expect(byBucket(b, 'observability_gap').blocksActivation).toBe(false);
    expect(byBucket(b, 'real_user_gap').blocksActivation).toBe(false);
  });
  it('invalid evidence → safety/trace gaps block', () => {
    const b = build({ failedChecks: 5, analysisSummary: { readinessStatus: 'blocked', failureEscapeCount: 1 } });
    expect(byBucket(b, 'safety_failure').blocksActivation).toBe(true);
  });
  it('never throws on garbage', () => {
    expect(() => classifyActivationBlockers(undefined as any, undefined as any, undefined as any)).not.toThrow();
  });
});
