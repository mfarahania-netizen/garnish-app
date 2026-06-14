import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { RecommendationFounderReviewController } from './recommendation-founder-review-controller';
import { RecommendationFounderReviewService } from './recommendation-founder-review-service';
import { RecommendationShadowControlPlaneService } from '../../control-plane/recommendation-shadow-control-plane.service';
import { RecommendationShadowA8Service } from '../../recommendation-shadow-a8-service';
import { ShadowTraceReadPort, ShadowTraceRetentionPort, RedactedTraceRow } from '../../recommendation-shadow-profile-feed.types';

const a8 = () => {
  const readPort: ShadowTraceReadPort = { readTraces: async () => Array.from({ length: 40 }, (_, i): RedactedTraceRow => ({ topKOverlap: 0.5, rankShiftCount: 2, majorDivergence: i % 4 === 0, reasonCodes: ['novelty_boost'], summary: { weakConfidenceCount: 0 } })) };
  const retPort: ShadowTraceRetentionPort = { countEligible: async () => 5, sampleEligibleIds: async () => ['a', 'b'] };
  return new RecommendationShadowA8Service(undefined, undefined, undefined, undefined, readPort, retPort);
};
const controller = () => { const s = a8(); return new RecommendationFounderReviewController(new RecommendationFounderReviewService(new RecommendationShadowControlPlaneService(s), s)); };

describe('RecommendationFounderReviewController', () => {
  const ENV = process.env;
  const req = { user: { isAdmin: true, roles: ['admin'] } };
  afterEach(() => { process.env = ENV; });

  it('summary: default OFF → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_FOUNDER_REVIEW_MODE: 'off' };
    expect(() => controller().summary(req)).toThrow(ForbiddenException);
  });

  it('summary: production + dev_internal_api → 403', () => {
    process.env = { ...ENV, RECOMMENDATION_FOUNDER_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'production' };
    expect(() => controller().summary(req)).toThrow(ForbiddenException);
  });

  it('summary: dev_internal_api + non-prod + admin → redacted summary', () => {
    process.env = { ...ENV, RECOMMENDATION_FOUNDER_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    const s = controller().summary(req);
    expect(s.safety.publicEndpointExposed).toBe(false);
    expect(s.templates.length).toBe(5);
  });

  it('evidence-pack: invalid templateKey → 400', async () => {
    process.env = { ...ENV, RECOMMENDATION_FOUNDER_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    await expect(controller().evidencePack(req, { templateKey: 'bad key!!' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('evidence-pack: unknown template → 400', async () => {
    process.env = { ...ENV, RECOMMENDATION_FOUNDER_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    await expect(controller().evidencePack(req, { templateKey: 'a11-not-real' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('evidence-pack: OFF mode → 403 before execution', async () => {
    process.env = { ...ENV, RECOMMENDATION_FOUNDER_REVIEW_MODE: 'off' };
    await expect(controller().evidencePack(req, { templateKey: 'a11-shadow-dev-balanced' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('evidence-pack: dev_internal_api + admin → pack with promotion allowed false', async () => {
    process.env = { ...ENV, RECOMMENDATION_FOUNDER_REVIEW_MODE: 'dev_internal_api', NODE_ENV: 'development' };
    const res = await controller().evidencePack(req, { templateKey: 'a11-shadow-dev-balanced', requestedBy: 'founder' });
    expect(res.evidencePack.promotionReview.promotionAllowed).toBe(false);
    expect(res.evidencePack.liveRankingChangedForUser).toBe(false);
    expect(res.dossier.requiredFounderDecision).toBe(true);
  });
});
