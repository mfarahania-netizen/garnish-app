import { RecommendationDiagnosticsController } from './diagnostics.controller';

describe('RecommendationDiagnosticsController summary', () => {
  it('returns an investor-friendly consolidated summary shape', async () => {
    const controller = new RecommendationDiagnosticsController(
      {
        userBehaviorSignal: { findMany: jest.fn().mockResolvedValue([{ signalName: 'likes_high_protein' }]) },
        userOutcome: { findMany: jest.fn().mockResolvedValue([]) },
        featureContributionLog: { findMany: jest.fn().mockResolvedValue([{ featureKey: 'tasteAffinity' }]) },
      } as any,
      {
        getFeatureVector: jest.fn().mockResolvedValue({ signal_x: 1 }),
      } as any,
      {
        getAll: jest.fn().mockReturnValue([{ name: 'likes_high_protein' }]),
      } as any,
      {
        getLatestRecommendationQuality: jest.fn().mockResolvedValue({ metricValue: 80 }),
        getLatestRecommendationReward: jest.fn().mockResolvedValue({ metricValue: 55 }),
        getRecommendationAttribution: jest.fn().mockResolvedValue({ impressions: 10 }),
      } as any,
      {
        getLatestMetrics: jest.fn().mockResolvedValue({ windowDays: 7, recommendationQuality: 80 }),
      } as any,
      {
        getGovernanceSummary: jest.fn().mockResolvedValue({
          retentionPolicyDays: 365,
          totalUsers: 25,
        }),
      } as any,
      {
        getExposureMemory: jest.fn().mockResolvedValue([]),
      } as any,
    );

    const summary = await controller.getSummary({ user: { userId: 'u1' } } as any);

    expect(summary).toMatchObject({
      userId: 'u1',
      quality: { metricValue: 80 },
      reward: { metricValue: 55 },
      attribution: { impressions: 10 },
      metrics: { windowDays: 7, recommendationQuality: 80 },
    });
    expect(summary.topSignals).toHaveLength(1);
    expect(summary.topFeatureImportance).toHaveLength(1);
  });
});
