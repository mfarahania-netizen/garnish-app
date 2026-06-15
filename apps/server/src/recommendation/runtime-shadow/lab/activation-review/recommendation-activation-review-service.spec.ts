import { RecommendationActivationReviewService } from './recommendation-activation-review-service';
import { validA13 } from './recommendation-activation-result-reader.spec';
import { ActivationReviewContext } from './recommendation-activation-review.types';

const svc = () => new RecommendationActivationReviewService();
const ctx = (over: Partial<ActivationReviewContext> = {}): ActivationReviewContext => ({ config: { mode: 'dev_internal_api', requireAdmin: true, allowDryRun: false, maxTraceRead: 500 }, environment: 'test', adminVerified: true, internalCall: true, ...over });

describe('RecommendationActivationReviewService', () => {
  it('buildReview (real on-disk A13 evidence) → eligible design, no dry-run unless allowed', () => {
    const r = svc().buildReview(ctx());
    expect(r.evidence.loaded).toBe(true);
    expect(r.evidence.valid).toBe(true);
    expect(r.review.verdict).toBe('eligible_for_safe_limited_activation_design');
    expect(r.matrix.productionReadiness).toBe('red');
    expect(r.plan.status).toBe('draft_ready_for_founder_review');
    expect(r.dryRun).toBeNull();
    expect(r.decisionPack.verdict).toBe('draft_ready_for_founder_review');
    expect(r.productUseEnabled).toBe(false);
    expect(r.liveRankingChangedForUser).toBe(false);
  });

  it('dry-run only runs when ALLOW_DRY_RUN + withDryRun', () => {
    const r = svc().buildReview(ctx({ config: { mode: 'dev_internal_api', requireAdmin: true, allowDryRun: true, maxTraceRead: 500 } }), { withDryRun: true });
    expect(r.dryRun).not.toBeNull();
    expect(r.dryRun!.allPassed).toBe(true);
    expect(r.dryRun!.liveRankingChanged).toBe(false);
  });

  it('override invalid evidence → review blocked, plan blocked', () => {
    const r = svc().buildReview(ctx(), { artifactOverride: { ...validA13(), failedChecks: 4, analysisSummary: { readinessStatus: 'blocked', failureEscapeCount: 1 } } });
    expect(r.review.verdict).toBe('blocked');
    expect(r.plan.status).toBe('blocked');
  });

  it('getSummary is redacted + safe', () => {
    const s = svc().getSummary(ctx());
    expect(s.safety.publicEndpointExposed).toBe(false);
    expect(s.readiness.productionReadiness).toBe('red');
    expect(s.decisionOptions).toContain('approve_safe_limited_dev_shadow_activation');
    expect(JSON.stringify(s)).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace)"|@|postgres:\/\//i);
  });

  it('result is leak-free', () => {
    expect(JSON.stringify(svc().buildReview(ctx()))).not.toMatch(/"(userText|recipeBody|prompt|aiOutput|rawTrace)"|@|postgres:\/\//i);
  });
});
