import { ForbiddenException } from '@nestjs/common';
import { RecommendationActivationReviewController } from './recommendation-activation-review-controller';
import { RecommendationActivationReviewService } from './recommendation-activation-review-service';

const controller = () => new RecommendationActivationReviewController(new RecommendationActivationReviewService());

describe('RecommendationActivationReviewController', () => {
  const ENV = process.env;
  const req = { user: { isAdmin: true, roles: ['admin'] } };
  afterEach(() => { process.env = ENV; });

  it('summary: default OFF → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'off' };
    expect(() => controller().summary(req)).toThrow(ForbiddenException);
  });
  it('summary: production + dev_internal_api → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'production' };
    expect(() => controller().summary(req)).toThrow(ForbiddenException);
  });
  it('summary: dev_internal_api + non-prod + admin → redacted summary (production red)', () => {
    process.env = { ...ENV, RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    const s = controller().summary(req);
    expect(s.safety.publicEndpointExposed).toBe(false);
    expect(s.readiness.productionReadiness).toBe('red');
    expect(s.decisionOptions).toContain('approve_safe_limited_dev_shadow_activation');
  });
  it('dry-run: ALLOW_DRY_RUN false → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'development', RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN: 'false' };
    expect(() => controller().dryRun(req)).toThrow(ForbiddenException);
  });
  it('dry-run: OFF mode → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'off' };
    expect(() => controller().dryRun(req)).toThrow(ForbiddenException);
  });
  it('dry-run: dev_internal_api + allow + admin → dry-run all passed, no live change', () => {
    process.env = { ...ENV, RECOMMENDATION_ACTIVATION_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'development', RECOMMENDATION_ACTIVATION_REVIEW_ALLOW_DRY_RUN: 'true' };
    const r = controller().dryRun(req);
    expect(r.dryRun!.allPassed).toBe(true);
    expect(r.dryRun!.liveRankingChanged).toBe(false);
  });
});
