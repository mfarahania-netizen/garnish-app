import { RecommendationEvaluatorService } from './recommendation-evaluator.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';
import { makeP0ATransactionBoundaryPrisma } from '../../test-support/p0-a-epoch-fixture';

describe('RecommendationEvaluatorService', () => {
  const epoch = new Date('2099-07-01T00:00:00.000Z');
  let prisma: any;
  let rewardService: any;
  let consent: any;
  let tx: any;
  let service: RecommendationEvaluatorService;

  beforeEach(() => {
    const delegates = {
      user: { findMany: jest.fn() },
      recommendationAttributionEvent: { findMany: jest.fn() },
      recommendationExposure: { count: jest.fn() },
      featureContributionLog: { findMany: jest.fn() },
      userOutcome: { create: jest.fn(), findFirst: jest.fn() },
    };
    ({ prisma, tx } = makeP0ATransactionBoundaryPrisma(delegates, 'u1',
      ['analytics', 'personalization'].map((purpose) => ({
        id: `${purpose}-grant`, userId: 'u1', purpose, status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: epoch,
      })),
    ));
    rewardService = {
      buildRewardProfile: jest.fn().mockResolvedValue({
        rewardScore: 42,
      }),
    };
    consent = { currentGrantEpoch: jest.fn().mockResolvedValue(epoch) };
    service = new RecommendationEvaluatorService(prisma, rewardService, consent);
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
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

  it('fallback attribution excludes analytics-only and legacy/null UserEvent rows', async () => {
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([]);
    prisma.recommendationExposure.count.mockResolvedValue(0);
    const rows = [
      { type: 'recommendation_click', consentPurpose: 'analytics' },
      { type: 'recommendation_save', consentPurpose: null },
      { type: 'recommendation_impression', consentPurpose: 'personalization' },
    ];
    prisma.userEvent = {
      findMany: jest.fn(async ({ where }: any) => rows
        .filter((row) => row.consentPurpose === where.consentPurpose)
        .map(({ type }) => ({ type }))),
    };

    const attribution = await service.getRecommendationAttribution('u1');

    expect(attribution.impressions).toBe(1);
    expect(attribution.clicks).toBe(0);
    expect(attribution.saves).toBe(0);
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ consentPurpose: 'personalization' }),
    }));
  });

  it('returns latest recommendation reward', async () => {
    prisma.userOutcome.findFirst.mockResolvedValue({
      metricName: 'recommendation_reward',
      metricValue: 67.5,
    });

    const reward = await service.getLatestRecommendationReward('u1');

    expect(reward?.metricValue).toBe(67.5);
  });

  it('withdrawal prevents all per-user evaluation reads and derived writes', async () => {
    consent.currentGrantEpoch.mockResolvedValue(null);

    await expect(service.buildRecommendationQuality('u1')).resolves.toBeNull();
    await expect(service.getLatestRecommendationQuality('u1')).resolves.toBeNull();
    await expect(service.getLatestRecommendationReward('u1')).resolves.toBeNull();
    await expect(service.getRecommendationAttribution('u1')).resolves.toMatchObject({
      impressions: 0,
      clicks: 0,
      exposures: 0,
    });

    expect(prisma.recommendationAttributionEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.recommendationExposure.count).not.toHaveBeenCalled();
    expect(prisma.featureContributionLog.findMany).not.toHaveBeenCalled();
    expect(prisma.userOutcome.findFirst).not.toHaveBeenCalled();
    expect(prisma.userOutcome.create).not.toHaveBeenCalled();
    expect(rewardService.buildRewardProfile).not.toHaveBeenCalled();
  });

  it('consent read error fails closed before evaluation reads and writes', async () => {
    consent.currentGrantEpoch.mockRejectedValue(new Error('consent unavailable'));

    await expect(service.buildRecommendationQuality('u1')).resolves.toBeNull();

    expect(prisma.recommendationAttributionEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.userOutcome.create).not.toHaveBeenCalled();
  });

  it('daily cron skips withdrawn users before derived services run', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    consent.currentGrantEpoch.mockResolvedValue(null);

    await service.evaluateDailyRecommendationQuality();

    expect(prisma.userOutcome.create).not.toHaveBeenCalled();
    expect(rewardService.buildRewardProfile).not.toHaveBeenCalled();
  });

  it('filters attribution, exposure, contribution, event, and outcome reads to the latest grant epoch', async () => {
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([]);
    prisma.recommendationExposure.count.mockResolvedValue(0);
    prisma.featureContributionLog.findMany.mockResolvedValue([]);
    prisma.userOutcome.findFirst.mockResolvedValue({
      metricName: 'recommendation_quality',
      metricValue: 50,
    });
    prisma.userOutcome.create.mockResolvedValue({ id: 'quality-new' });
    prisma.userEvent = { findMany: jest.fn().mockResolvedValue([]) };

    await service.buildRecommendationQuality('u1');
    await service.getLatestRecommendationQuality('u1');

    expect(prisma.recommendationAttributionEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ occurredAt: { gte: epoch } }) }),
    );
    expect(prisma.recommendationExposure.count).toHaveBeenCalledWith({
      where: { userId: 'u1', viewedAt: { gte: epoch } },
    });
    expect(prisma.featureContributionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', createdAt: { gte: epoch } } }),
    );
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ timestamp: { gte: epoch } }) }),
    );
    expect(prisma.userOutcome.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ recordedAt: { gte: epoch } }),
    }));
  });

  it('suppresses a quality write when withdrawal and re-grant changes epoch during reads', async () => {
    const nextEpoch = new Date('2099-07-02T00:00:00.000Z');
    consent.currentGrantEpoch.mockResolvedValue(epoch);
    tx.userConsent.findMany = jest.fn().mockResolvedValue(
      ['analytics', 'personalization'].map((purpose) => ({
        id: `${purpose}-regrant`, userId: 'u1', purpose, status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: nextEpoch,
      })),
    );
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([]);
    prisma.recommendationExposure.count.mockResolvedValue(0);
    prisma.featureContributionLog.findMany.mockResolvedValue([]);
    prisma.userEvent = { findMany: jest.fn().mockResolvedValue([]) };

    await expect(service.buildRecommendationQuality('u1')).resolves.toBeNull();

    expect(prisma.userOutcome.create).not.toHaveBeenCalled();
  });
});
