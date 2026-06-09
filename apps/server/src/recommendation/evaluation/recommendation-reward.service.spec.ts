import { RecommendationRewardService } from './recommendation-reward.service';

describe('RecommendationRewardService', () => {
  let prisma: any;
  let service: RecommendationRewardService;

  beforeEach(() => {
    prisma = {
      recommendationAttributionEvent: { findMany: jest.fn() },
      userOutcome: { create: jest.fn(), findFirst: jest.fn() },
    };
    service = new RecommendationRewardService(prisma);
  });

  it('builds and stores a reward profile from attribution events', async () => {
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([
      { eventType: 'recommendation_impression', value: 0.1 },
      { eventType: 'recommendation_click', value: 0.3 },
      { eventType: 'recommendation_save', value: 0.6 },
      { eventType: 'recommendation_cook', value: 1.0 },
      { eventType: 'recommendation_dismiss', value: -1.0 },
    ]);

    const reward = await service.buildRewardProfile('u1', 7);

    expect(reward.rewardScore).toBeGreaterThan(0);
    expect(prisma.userOutcome.create).toHaveBeenCalledTimes(1);
    expect(prisma.userOutcome.create.mock.calls[0][0].data.metricName).toBe('recommendation_reward');
  });
});
