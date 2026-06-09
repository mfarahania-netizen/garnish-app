import { RecommendationDiagnosticsController } from './diagnostics.controller';

describe('RecommendationDiagnosticsController', () => {
  let prisma: any;
  let featureStore: any;
  let signalRegistry: any;
  let evaluator: any;
  let metrics: any;
  let governanceInsights: any;
  let exposureTracking: any;
  let controller: RecommendationDiagnosticsController;

  beforeEach(() => {
    prisma = {
      userBehaviorSignal: { findMany: jest.fn() },
      userOutcome: { findMany: jest.fn() },
      featureContributionLog: { findMany: jest.fn() },
      userEngagementSnapshot: { findUnique: jest.fn() },
      userHealthSnapshot: { findUnique: jest.fn() },
      userIdentitySnapshot: { findUnique: jest.fn() },
      userRetentionSnapshot: { findUnique: jest.fn() },
    };
    featureStore = {
      getFeatureVector: jest.fn(),
      getDataMaturity: jest.fn().mockResolvedValue({
        dataMaturity: 'cold_start',
        confidenceLevel: 'cold_start',
        activeDays: 1,
        totalQualifiedEvents: 3,
        realImpressions: 0,
        clicks: 0,
        saves: 0,
        cooks: 0,
        signalConfidenceAvg: 0,
        behavioralReliability: 0.1,
      }),
    };
    signalRegistry = {
      getAll: jest.fn().mockReturnValue([{ name: 'likes_high_protein' }]),
    };
    evaluator = {
      getLatestRecommendationQuality: jest.fn(),
      getLatestRecommendationReward: jest.fn(),
      getRecommendationAttribution: jest.fn(),
    };
    metrics = {
      getLatestMetrics: jest.fn(),
    };
    governanceInsights = {
      getGovernanceSummary: jest.fn(),
    };
    exposureTracking = {
      getExposureMemory: jest.fn().mockResolvedValue([]),
    };
    controller = new RecommendationDiagnosticsController(
      prisma,
      featureStore,
      signalRegistry,
      evaluator,
      metrics,
      governanceInsights,
      exposureTracking,
    );
  });

  it('returns feature vector payload', async () => {
    featureStore.getFeatureVector.mockResolvedValue({ signal_x: 1 });

    const result = await controller.getFeatureVector({ user: { userId: 'u1' } });

    expect(result).toEqual({
      userId: 'u1',
      featureCount: 1,
      dataMaturity: {
        dataMaturity: 'cold_start',
        confidenceLevel: 'cold_start',
        activeDays: 1,
        totalQualifiedEvents: 3,
        realImpressions: 0,
        clicks: 0,
        saves: 0,
        cooks: 0,
        signalConfidenceAvg: 0,
        behavioralReliability: 0.1,
      },
      features: { signal_x: 1 },
    });
  });

  it('returns signals with registry metadata', async () => {
    prisma.userBehaviorSignal.findMany.mockResolvedValue([{ signalName: 'likes_high_protein' }]);

    const result = await controller.getSignals({ user: { userId: 'u1' } });

    expect(result.total).toBe(1);
    expect(result.registry).toEqual([{ name: 'likes_high_protein' }]);
  });

  it('returns outcomes payload', async () => {
    prisma.userOutcome.findMany.mockResolvedValue([{ metricName: 'shopping_efficiency' }]);

    const result = await controller.getOutcomes({ user: { userId: 'u1' } });

    expect(result.total).toBe(1);
    expect(result.outcomes).toEqual([{ metricName: 'shopping_efficiency' }]);
  });

  it('returns lifestyle summary payload', async () => {
    featureStore.getFeatureVector.mockResolvedValue({ signal_x: 1 });
    prisma.userBehaviorSignal.findMany.mockResolvedValue([{ signalName: 'likes_high_protein' }]);
    prisma.userOutcome.findMany.mockResolvedValue([{ metricName: 'shopping_efficiency' }]);
    prisma.userEngagementSnapshot.findUnique.mockResolvedValue({ activeDaysLast30: 7 });
    prisma.userHealthSnapshot.findUnique.mockResolvedValue({ mealPlanCompletionRate: 0.8 });
    prisma.userIdentitySnapshot.findUnique.mockResolvedValue({ recipeSaveRate: 0.4 });
    prisma.userRetentionSnapshot.findUnique.mockResolvedValue({ retentionScore: 72 });

    const result = await controller.getLifestyle({ user: { userId: 'u1' } });

    expect(result.userId).toBe('u1');
    expect(result.summary.healthScore).toBe(0.8);
    expect(result.summary.retentionScore).toBe(72);
    expect(result.summary.engagementScore).toBe(7);
    expect(result.summary.identityScore).toBe(0.4);
  });

  it('returns feature importance payload', async () => {
    prisma.featureContributionLog.findMany.mockResolvedValue([
      { featureKey: 'tasteAffinity', contribution: 68 },
    ]);

    const result = await controller.getFeatureImportance({ user: { userId: 'u1' } });

    expect(result.total).toBe(1);
    expect(result.logs).toEqual([{ featureKey: 'tasteAffinity', contribution: 68 }]);
  });

  it('returns recommendation quality payload', async () => {
    evaluator.getLatestRecommendationQuality.mockResolvedValue({ metricValue: 72.5 });

    const result = await controller.getRecommendationQuality({ user: { userId: 'u1' } });

    expect(result.latest).toEqual({ metricValue: 72.5 });
  });

  it('returns attribution payload', async () => {
    evaluator.getRecommendationAttribution.mockResolvedValue({ impressions: 10 });

    const result = await controller.getAttribution({ user: { userId: 'u1' } });

    expect(result.attribution).toEqual({ impressions: 10 });
  });

  it('returns summary payload', async () => {
    evaluator.getLatestRecommendationQuality.mockResolvedValue({ metricValue: 80 });
    evaluator.getLatestRecommendationReward.mockResolvedValue({ metricValue: 55 });
    evaluator.getRecommendationAttribution.mockResolvedValue({ impressions: 10 });
    metrics.getLatestMetrics.mockResolvedValue({ windowDays: 7, recommendationQuality: 80 });
    prisma.userBehaviorSignal.findMany.mockResolvedValue([{ signalName: 'likes_high_protein' }]);
    prisma.featureContributionLog.findMany.mockResolvedValue([{ featureKey: 'tasteAffinity' }]);

    const result = await controller.getSummary({ user: { userId: 'u1' } });

    expect(result.quality).toEqual({ metricValue: 80 });
    expect(result.reward).toEqual({ metricValue: 55 });
    expect(result.attribution).toEqual({ impressions: 10 });
    expect(result.metrics).toEqual({ windowDays: 7, recommendationQuality: 80 });
    expect(result.topSignals).toHaveLength(1);
    expect(result.topFeatureImportance).toHaveLength(1);
  });

  it('returns metrics payload', async () => {
    metrics.getLatestMetrics
      .mockResolvedValueOnce({ windowDays: 7, recommendationQuality: 80 })
      .mockResolvedValueOnce({ windowDays: 30, recommendationQuality: 70 })
      .mockResolvedValueOnce({ windowDays: 90, recommendationQuality: 65 });

    const result = await controller.getMetrics({ user: { userId: 'u1' } });

    expect(result.metrics['7d']).toEqual({ windowDays: 7, recommendationQuality: 80 });
    expect(result.metrics['30d']).toEqual({ windowDays: 30, recommendationQuality: 70 });
    expect(result.metrics['90d']).toEqual({ windowDays: 90, recommendationQuality: 65 });
  });

  it('returns governance payload', async () => {
    governanceInsights.getGovernanceSummary.mockResolvedValue({
      retentionPolicyDays: 365,
      totalUsers: 10,
    });

    const result = await controller.getGovernance({ user: { userId: 'u1' } });

    expect(result.governance).toEqual({
      retentionPolicyDays: 365,
      totalUsers: 10,
    });
  });

  it('returns report payload', async () => {
    evaluator.getLatestRecommendationQuality.mockResolvedValue({ metricValue: 80 });
    evaluator.getLatestRecommendationReward.mockResolvedValue({ metricValue: 55 });
    evaluator.getRecommendationAttribution.mockResolvedValue({ impressions: 10 });
    metrics.getLatestMetrics.mockResolvedValue({ windowDays: 7, recommendationQuality: 80 });
    governanceInsights.getGovernanceSummary.mockResolvedValue({
      retentionPolicyDays: 365,
      totalUsers: 10,
    });
    prisma.userBehaviorSignal.findMany.mockResolvedValue([{ signalName: 'likes_high_protein' }]);
    prisma.featureContributionLog.findMany.mockResolvedValue([{ featureKey: 'tasteAffinity' }]);

    const result = await controller.getReport({ user: { userId: 'u1' } });

    expect(result.summary.quality).toEqual({ metricValue: 80 });
    expect(result.metrics.metrics['7d']).toEqual({ windowDays: 7, recommendationQuality: 80 });
    expect(result.governance.governance).toEqual({
      retentionPolicyDays: 365,
      totalUsers: 10,
    });
  });
});
