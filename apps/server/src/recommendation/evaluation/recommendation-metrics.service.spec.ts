import { RecommendationMetricsService } from './recommendation-metrics.service';

describe('RecommendationMetricsService', () => {
  let prisma: any;
  let service: RecommendationMetricsService;

  beforeEach(() => {
    prisma = {
      recommendationAttributionEvent: { findMany: jest.fn() },
      recommendationExposure: { count: jest.fn() },
      userOutcome: { findMany: jest.fn() },
      featureContributionLog: { findMany: jest.fn() },
      recommendationMetrics: { upsert: jest.fn(), findFirst: jest.fn() },
    };
    service = new RecommendationMetricsService(prisma);
  });

  it('builds a daily metrics snapshot', async () => {
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([
      { eventType: 'recommendation_impression' },
      { eventType: 'recommendation_click' },
      { eventType: 'recommendation_save' },
      { eventType: 'recommendation_cook' },
      { eventType: 'recommendation_dismiss' },
    ]);
    prisma.recommendationExposure.count.mockResolvedValue(4);
    prisma.userOutcome.findMany.mockResolvedValue([{ metricValue: 75 }, { metricValue: 85 }]);
    prisma.featureContributionLog.findMany.mockResolvedValue([
      { featureKey: 'tasteAffinity', contribution: 0.7 },
    ]);

    const snapshot = await service.buildMetricsForWindow(7);

    expect(snapshot.impressions).toBe(4);
    expect(snapshot.clickThroughRate).toBeCloseTo(0.25);
    expect(snapshot.recommendationQuality).toBe(80);
    expect(prisma.recommendationMetrics.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.recommendationMetrics.upsert.mock.calls[0][0].create.windowDays).toBe(7);
  });

  it('returns latest metrics snapshot', async () => {
    prisma.recommendationMetrics.findFirst.mockResolvedValue({ windowDays: 7, recommendationQuality: 80 });

    const metrics = await service.getLatestMetrics(7);

    expect(metrics).toEqual({ windowDays: 7, recommendationQuality: 80 });
  });
});
