import { FeatureStoreService } from './feature-store.service';

describe('FeatureStoreService', () => {
  let prisma: any;
  let snapshotBuilder: any;
  let service: FeatureStoreService;

  beforeEach(() => {
    prisma = {
      userBehaviorSignal: { findMany: jest.fn().mockResolvedValue([]) },
      userIdentityDimension: { findMany: jest.fn().mockResolvedValue([]) },
      userRetentionSnapshot: { findUnique: jest.fn().mockResolvedValue(null) },
      userOutcome: { findMany: jest.fn().mockResolvedValue([]) },
      userIdentitySnapshot: { findUnique: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          preferences: null,
          profile: null,
        }),
      },
      userEvent: {
        count: jest.fn().mockResolvedValue(0),
      },
      userFeatureVector: { upsert: jest.fn() },
      userFeature: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    snapshotBuilder = {
      buildAll: jest.fn().mockResolvedValue(undefined),
    };
    service = new FeatureStoreService(prisma, snapshotBuilder);
  });

  it('adds time-window signals to the feature vector', async () => {
    prisma.userEvent.count
      .mockResolvedValueOnce(28)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(90)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(32)
      .mockResolvedValueOnce(180)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(70);

    const features = await service.buildFeatureVector('u1');

    expect(features.signal_activity_7d).toBeGreaterThan(0);
    expect(features.signal_activity_30d).toBeGreaterThanOrEqual(features.signal_activity_7d);
    expect(features.signal_recommendation_engagement_30d).toBeGreaterThan(0);
    expect(snapshotBuilder.buildAll).toHaveBeenCalledWith('u1');
  });
});
