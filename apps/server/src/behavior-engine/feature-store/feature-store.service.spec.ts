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
        // getDataMaturity() reads recent events via findMany — mock it so the data-maturity
        // path resolves (empty = low maturity; the asserted signals come from count() below).
        findMany: jest.fn().mockResolvedValue([]),
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

  it('P1-4: a FRESH cached vector is served WITHOUT a rebuild (no buildAll, no write)', async () => {
    prisma.userFeatureVector.findUnique = jest.fn().mockResolvedValue({
      features: { signal_x: 0.42 },
      updatedAt: new Date(), // fresh (just now)
    });
    const features = await service.buildFeatureVector('u1');
    expect(features).toEqual({ signal_x: 0.42 });
    expect(snapshotBuilder.buildAll).not.toHaveBeenCalled(); // no rebuild
    expect(prisma.userFeatureVector.upsert).not.toHaveBeenCalled(); // no write
    expect(prisma.$transaction).not.toHaveBeenCalled(); // no userFeature delete/recreate
  });

  it('P1-4: an ABSENT cached vector falls through to a full rebuild', async () => {
    prisma.userFeatureVector.findUnique = jest.fn().mockResolvedValue(null);
    await service.buildFeatureVector('u1');
    expect(snapshotBuilder.buildAll).toHaveBeenCalledWith('u1'); // rebuilt
    expect(prisma.userFeatureVector.upsert).toHaveBeenCalled(); // written
  });
});
