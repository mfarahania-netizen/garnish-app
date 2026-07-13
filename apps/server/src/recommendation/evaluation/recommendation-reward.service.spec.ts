import { RecommendationRewardService } from './recommendation-reward.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';
import { makeP0ATransactionBoundaryPrisma } from '../../test-support/p0-a-epoch-fixture';

describe('RecommendationRewardService', () => {
  const epoch = new Date('2099-07-01T00:00:00.000Z');
  let prisma: any;
  let consent: any;
  let tx: any;
  let service: RecommendationRewardService;

  beforeEach(() => {
    const delegates = {
      recommendationAttributionEvent: { findMany: jest.fn() },
      recommendationExposure: { count: jest.fn() },
      userEvent: { findMany: jest.fn() },
      userOutcome: { create: jest.fn(), findFirst: jest.fn() },
    };
    ({ prisma, tx } = makeP0ATransactionBoundaryPrisma(delegates, 'u1',
      ['analytics', 'personalization'].map((purpose) => ({
        id: `${purpose}-grant`, userId: 'u1', purpose, status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: epoch,
      })),
    ));
    consent = { currentGrantEpoch: jest.fn().mockResolvedValue(epoch) };
    service = new RecommendationRewardService(prisma, consent);
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
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

    expect(reward!.rewardScore).toBeGreaterThan(0);
    expect(prisma.userOutcome.create).toHaveBeenCalledTimes(1);
    expect(prisma.userOutcome.create.mock.calls[0][0].data.metricName).toBe('recommendation_reward');
  });

  it('fallback reward excludes analytics-only and legacy/null UserEvent rows', async () => {
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([]);
    prisma.recommendationExposure.count.mockResolvedValue(0);
    prisma.userOutcome.create.mockResolvedValue({ id: 'outcome-1' });
    const rows = [
      { type: 'recommendation_dismiss', consentPurpose: 'analytics' },
      { type: 'recommendation_ignore', consentPurpose: null },
      { type: 'recommendation_cook', consentPurpose: 'personalization' },
    ];
    prisma.userEvent.findMany.mockImplementation(async ({ where }: any) => rows
      .filter((row) => row.consentPurpose === where.consentPurpose)
      .map(({ type }) => ({ type })));

    const reward = await service.buildRewardProfile('u1', 7);

    expect(reward!.aggregate.recommendation_cook).toBe(1);
    expect(reward!.aggregate.recommendation_dismiss).toBe(0);
    expect(reward!.aggregate.recommendation_ignore).toBe(0);
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ consentPurpose: 'personalization' }),
    }));
  });

  it('withdrawal prevents every per-user input read and reward write', async () => {
    consent.currentGrantEpoch.mockResolvedValue(null);

    await expect(service.buildRewardProfile('u1', 7)).resolves.toBeNull();
    await expect(service.getLatestReward('u1')).resolves.toBeNull();

    expect(prisma.recommendationAttributionEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.recommendationExposure.count).not.toHaveBeenCalled();
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.userOutcome.findFirst).not.toHaveBeenCalled();
    expect(prisma.userOutcome.create).not.toHaveBeenCalled();
  });

  it('consent read error fails closed before all reward reads and writes', async () => {
    consent.currentGrantEpoch.mockRejectedValue(new Error('consent unavailable'));

    await expect(service.buildRewardProfile('u1')).resolves.toBeNull();

    expect(prisma.recommendationAttributionEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.userOutcome.create).not.toHaveBeenCalled();
  });

  it('filters every input and cached outcome to the latest re-grant epoch', async () => {
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([]);
    prisma.userEvent.findMany.mockResolvedValue([]);
    prisma.recommendationExposure.count.mockResolvedValue(0);
    prisma.userOutcome.create.mockResolvedValue({ id: 'outcome-new' });
    prisma.userOutcome.findFirst.mockResolvedValue(null);

    await service.buildRewardProfile('u1', 14);
    await service.getLatestReward('u1');

    expect(prisma.recommendationAttributionEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ occurredAt: { gte: epoch } }) }),
    );
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ timestamp: { gte: epoch } }) }),
    );
    expect(prisma.recommendationExposure.count).toHaveBeenCalledWith({
      where: { userId: 'u1', viewedAt: { gte: epoch } },
    });
    expect(prisma.userOutcome.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ recordedAt: { gte: epoch } }),
    }));
  });

  it('suppresses the derived write when withdrawal and re-grant changes epoch during reads', async () => {
    const nextEpoch = new Date('2099-07-02T00:00:00.000Z');
    consent.currentGrantEpoch.mockResolvedValue(epoch);
    tx.userConsent.findMany = jest.fn().mockResolvedValue(
      ['analytics', 'personalization'].map((purpose) => ({
        id: `${purpose}-regrant`, userId: 'u1', purpose, status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: nextEpoch,
      })),
    );
    prisma.recommendationAttributionEvent.findMany.mockResolvedValue([]);
    prisma.userEvent.findMany.mockResolvedValue([]);
    prisma.recommendationExposure.count.mockResolvedValue(0);

    await expect(service.buildRewardProfile('u1')).resolves.toBeNull();

    expect(prisma.userOutcome.create).not.toHaveBeenCalled();
  });
});
