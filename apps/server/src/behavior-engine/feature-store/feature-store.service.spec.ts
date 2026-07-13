import { FeatureStoreService } from './feature-store.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';

describe('FeatureStoreService', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  const previousAnalyticsRuntime = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
  const EPOCH = new Date('2026-07-01T00:00:00.000Z');
  let prisma: any;
  let snapshotBuilder: any;
  let consent: any;
  let service: FeatureStoreService;

  beforeEach(() => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    prisma = {
      userBehaviorSignal: { findMany: jest.fn().mockResolvedValue([]) },
      userIdentityDimension: { findMany: jest.fn().mockResolvedValue([]) },
      userRetentionSnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      userOutcome: { findMany: jest.fn().mockResolvedValue([]) },
      userIdentitySnapshot: { findFirst: jest.fn().mockResolvedValue(null) },
      userBehaviorProfile: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          preferences: null,
        }),
      },
      userEvent: {
        count: jest.fn().mockResolvedValue(0),
        // getDataMaturity() reads recent events via findMany — mock it so the data-maturity
        // path resolves (empty = low maturity; the asserted signals come from count() below).
        findMany: jest.fn().mockResolvedValue([]),
      },
      userFeatureVector: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      userFeature: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      userConsent: { findMany: jest.fn().mockResolvedValue([]) },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    };
    prisma.userConsent.findMany.mockResolvedValue(
      ['analytics', 'personalization'].map((purpose) => ({
        id: `${purpose}-grant`, purpose, status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, createdAt: EPOCH,
      })),
    );
    prisma.$transaction = jest.fn(async (callback: (tx: any) => unknown) => callback(prisma));
    snapshotBuilder = {
      buildAll: jest.fn().mockResolvedValue(undefined),
    };
    consent = { currentGrantEpoch: jest.fn().mockResolvedValue(EPOCH) };
    service = new FeatureStoreService(prisma, snapshotBuilder, consent);
  });

  afterAll(() => {
    if (previousRuntime === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
    if (previousAnalyticsRuntime === undefined)
      delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousAnalyticsRuntime;
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
    prisma.userFeatureVector.findFirst = jest.fn().mockResolvedValue({
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
    prisma.userFeatureVector.findFirst = jest.fn().mockResolvedValue(null);
    await service.buildFeatureVector('u1');
    expect(snapshotBuilder.buildAll).toHaveBeenCalledWith('u1'); // rebuilt
    expect(prisma.userFeatureVector.upsert).toHaveBeenCalled(); // written
  });

  it('withdrawal returns an empty vector before any private read or write', async () => {
    consent.currentGrantEpoch.mockResolvedValue(null);
    prisma.userFeatureVector.findFirst = jest.fn();

    await expect(service.buildFeatureVector('u1')).resolves.toEqual({});
    await expect(service.getFeatureVector('u1')).resolves.toEqual({});
    await expect(service.getDataMaturity('u1')).resolves.toMatchObject({
      dataMaturity: 'cold_start',
      totalQualifiedEvents: 0,
    });

    expect(prisma.userFeatureVector.findFirst).not.toHaveBeenCalled();
    expect(snapshotBuilder.buildAll).not.toHaveBeenCalled();
    expect(prisma.userFeatureVector.upsert).not.toHaveBeenCalled();
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('consent read failure is fail-closed before private reads and mutation', async () => {
    consent.currentGrantEpoch.mockRejectedValue(new Error('consent unavailable'));
    prisma.userFeatureVector.findFirst = jest.fn();

    await expect(service.buildFeatureVector('u1')).resolves.toEqual({});

    expect(prisma.userFeatureVector.findFirst).not.toHaveBeenCalled();
    expect(snapshotBuilder.buildAll).not.toHaveBeenCalled();
    expect(prisma.userFeatureVector.upsert).not.toHaveBeenCalled();
  });

  it('data maturity excludes analytics-only and legacy/null events but includes personalization rows', async () => {
    const now = new Date();
    const rows = [
      { type: 'recommendation_impression', timestamp: now, consentPurpose: 'analytics' },
      { type: 'recommendation_click', timestamp: now, consentPurpose: null },
      { type: 'recommendation_save', timestamp: now, consentPurpose: 'personalization' },
    ];
    prisma.userEvent.findMany.mockImplementation((args: any) => Promise.resolve(
      rows
        .filter((row) => row.consentPurpose === args.where.consentPurpose)
        .map(({ type, timestamp }) => ({ type, timestamp })),
    ));

    const maturity = await service.getDataMaturity('u1');

    expect(maturity.totalQualifiedEvents).toBe(1);
    expect(maturity.saves).toBe(1);
    expect(maturity.realImpressions).toBe(0);
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ consentPurpose: 'personalization' }),
    }));
  });

  it('findUsersByFeature runtime OFF is honest empty with zero consent/feature IO', async () => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

    await expect(service.findUsersByFeature('signal_x', 0.5)).resolves.toEqual([]);

    expect(prisma.userConsent.findMany).not.toHaveBeenCalled();
    expect(prisma.userFeature.findMany).not.toHaveBeenCalled();
  });

  it('findUsersByFeature withdrawal/stale population yields empty before feature IO', async () => {
    prisma.userConsent.findMany.mockResolvedValue([
      {
        userId: 'u1',
        purpose: 'personalization',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: new Date('2026-07-01T00:00:00Z'),
      },
      {
        userId: 'u1',
        purpose: 'personalization',
        status: 'withdrawn',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: new Date('2026-07-02T00:00:00Z'),
      },
      {
        userId: 'u2',
        purpose: 'personalization',
        status: 'granted',
        policyVersion: 'privacy-stale',
        createdAt: new Date('2026-07-02T00:00:00Z'),
      },
    ]);

    await expect(service.findUsersByFeature('signal_x', 0.5)).resolves.toEqual([]);

    expect(prisma.userFeature.findMany).not.toHaveBeenCalled();
  });

  it('findUsersByFeature consent read error is empty before feature IO', async () => {
    prisma.userConsent.findMany.mockRejectedValue(new Error('ledger unavailable'));

    await expect(service.findUsersByFeature('signal_x', 0.5)).resolves.toEqual([]);

    expect(prisma.userFeature.findMany).not.toHaveBeenCalled();
  });

  it('findUsersByFeature restricts rows to current-policy grant epochs', async () => {
    const epoch = new Date('2026-07-03T00:00:00Z');
    prisma.userConsent.findMany.mockResolvedValue([
      {
        userId: 'u1',
        purpose: 'analytics',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: epoch,
      },
      {
        userId: 'u1',
        purpose: 'personalization',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: epoch,
      },
    ]);
    prisma.userFeature.findMany.mockResolvedValue([{ userId: 'u1' }]);

    await expect(service.findUsersByFeature('signal_x', 0.5)).resolves.toEqual([
      'u1',
    ]);

    expect(prisma.userFeature.findMany).toHaveBeenCalledWith({
      where: {
        featureKey: 'signal_x',
        value: { gte: 0.5 },
        OR: [{ userId: 'u1', updatedAt: { gte: epoch } }],
      },
      select: { userId: true },
    });
  });
});
