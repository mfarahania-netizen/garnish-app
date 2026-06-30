import { RecommendationEvaluatorService } from './recommendation-evaluator.service';

describe('RecommendationEvaluatorService', () => {
  let prisma: any;
  let rewardService: any;
  let service: RecommendationEvaluatorService;

  beforeEach(() => {
    prisma = {
      user: { findMany: jest.fn() },
      recommendationAttributionEvent: { findMany: jest.fn() },
      recommendationExposure: { count: jest.fn() },
      featureContributionLog: { findMany: jest.fn() },
      userOutcome: { create: jest.fn(), findFirst: jest.fn() },
    };
    rewardService = {
      buildRewardProfile: jest.fn().mockResolvedValue({
        rewardScore: 42,
      }),
    };
    service = new RecommendationEvaluatorService(prisma, rewardService);
  });

  it('computes and stores daily recommendation quality', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_save' },
      { eventType: 'recommendation_save' },
      { eventType: 'recommendation_cook' },
      { eventType: 'recommendation_dismiss' },
      { eventType: 'recommendation_ignore' },
    ]);
    prisma.recommendationExposure.count.mockResolvedValue(8);
    prisma.featureContributionLog.findMany.mockResolvedValue([{ featureKey: 'tasteAffinity' }]);
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_save' },
      { eventType: 'recommendation_cook' },
      { eventType: 'recommendation_dismiss' },
    ]);

    await service.evaluateDailyRecommendationQuality();

    expect(prisma.userOutcome.create).toHaveBeenCalledTimes(1);
    expect(prisma.userOutcome.create.mock.calls[0][0].data.metricName).toBe('recommendation_quality');
    expect(prisma.userOutcome.create.mock.calls[0][0].data.metricValue).toBeGreaterThan(0);
    expect(rewardService.buildRewardProfile).toHaveBeenCalledWith('u1', 7);
  });

  it('builds recommendation attribution summary', async () => {
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_save' },
      { eventType: 'recommendation_save' },
      { eventType: 'recommendation_cook' },
      { eventType: 'recommendation_dismiss' },
      { eventType: 'recommendation_ignore' },
    ]);

    const attribution = await service.getRecommendationAttribution('u1');

    expect(attribution.impressions).toBe(10);
    expect(attribution.clickThroughRate).toBeCloseTo(0.4);
    expect(attribution.saveRate).toBeCloseTo(0.5);
    expect(attribution.cookRate).toBeCloseTo(0.5);
  });

  it('P1-7: attribution is the source of truth — does NOT double-count when UserEvent has the same rows', async () => {
    // attribution is DERIVED from UserEvent, so both tables carry the same 2 impressions + 1 click.
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_click' },
    ]);
    prisma.userEvent = { findMany: jest.fn().mockResolvedValue([
      { type: 'recommendation_impression' },
      { type: 'recommendation_impression' },
      { type: 'recommendation_click' },
    ]) };
    const attribution = await service.getRecommendationAttribution('u1');
    expect(attribution.impressions).toBe(2); // NOT 4 — attribution only, no double-count
    expect(attribution.clickThroughRate).toBeCloseTo(0.5); // 1 click / 2 impressions
  });

  it('P1-7: falls back to UserEvent only when attribution is absent', async () => {
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([]); // no attribution
    prisma.userEvent = { findMany: jest.fn().mockResolvedValue([
      { type: 'recommendation_impression' },
      { type: 'recommendation_impression' },
      { type: 'recommendation_click' },
    ]) };
    const attribution = await service.getRecommendationAttribution('u1');
    expect(attribution.impressions).toBe(2); // fallback used when attribution empty
  });

  it('returns latest recommendation reward', async () => {
    prisma.userOutcome.findFirst.mockResolvedValue({
      metricName: 'recommendation_reward',
      metricValue: 67.5,
    });

    const reward = await service.getLatestRecommendationReward('u1');

    expect(reward?.metricValue).toBe(67.5);
  });
});
