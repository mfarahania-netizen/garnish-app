import { generateActivationDecisionPack } from './recommendation-activation-decision-pack';
import { simulateSafeLimitedActivationDryRun } from './recommendation-activation-dry-run';
import { generateSafeLimitedActivationPlan } from './recommendation-activation-plan-generator';
import { classifyActivationBlockers } from './recommendation-activation-blockers';
import { buildRecommendationActivationReadinessMatrix } from './recommendation-activation-readiness-matrix';
import { defineSafeLimitedActivationGuardrails } from './recommendation-activation-guardrails';
import { reviewLimitedDevShadowExperimentResults } from './recommendation-activation-review-model';
import { readA13ExecutionEvidence } from './recommendation-activation-result-reader';
import { validA13 } from './recommendation-activation-result-reader.spec';
import { ActivationReviewContext } from './recommendation-activation-review.types';

const ctx: ActivationReviewContext = { config: { mode: 'dev_internal_api', requireAdmin: true, allowDryRun: true, maxTraceRead: 500 }, environment: 'test', adminVerified: true, internalCall: true };
const build = (over: any = {}) => {
  const e = readA13ExecutionEvidence(undefined, { artifactOverride: { ...validA13(), ...over } });
  const review = reviewLimitedDevShadowExperimentResults(e);
  const matrix = buildRecommendationActivationReadinessMatrix(review, e);
  const guardrails = defineSafeLimitedActivationGuardrails(review);
  const plan = generateSafeLimitedActivationPlan(review, matrix, guardrails);
  const blockers = classifyActivationBlockers(review, matrix, guardrails);
  const dryRun = simulateSafeLimitedActivationDryRun(plan, ctx);
  return generateActivationDecisionPack(e, review, matrix, guardrails, plan, blockers, dryRun);
};

describe('generateActivationDecisionPack', () => {
  it('valid → draft_ready_for_founder_review, founder decision required, allowed/forbidden options correct', () => {
    const d = build();
    expect(d.verdict).toBe('draft_ready_for_founder_review');
    expect(d.requiredFounderDecision).toBe(true);
    expect(d.allowedDecisionOptions).toEqual(['reject', 'request_more_real_dev_evidence', 'approve_safe_limited_dev_shadow_activation']);
    expect(d.forbiddenDecisionOptions).toEqual(['enable_production_ranking', 'enable_public_personalization', 'enable_ai_autonomy']);
    expect(d.productUseEnabled).toBe(false);
    expect(d.liveRankingChangedForUser).toBe(false);
  });
  it('invalid evidence → blocked', () => {
    expect(build({ failedChecks: 5, analysisSummary: { readinessStatus: 'blocked', failureEscapeCount: 1 } }).verdict).toBe('blocked');
  });
  it('never overclaims (no production/personalization in allowed)', () => {
    const d = build();
    expect(d.allowedDecisionOptions).not.toContain('enable_production_ranking');
  });
  it('leak-free', () => {
    expect(JSON.stringify(build())).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace)"|@|postgres:\/\//i);
  });
  it('never throws on garbage', () => {
    expect(() => generateActivationDecisionPack(undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, null)).not.toThrow();
    expect(generateActivationDecisionPack(undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, undefined as any, null).verdict).toBe('blocked');
  });
});
