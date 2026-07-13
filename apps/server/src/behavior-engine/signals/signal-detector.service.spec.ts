import { SignalDetectorService } from './signal-detector.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';
import { makeP0ATransactionBoundaryPrisma } from '../../test-support/p0-a-epoch-fixture';

describe('SignalDetectorService consent boundary', () => {
  const EPOCH = new Date('2026-07-01T00:00:00.000Z');
  const previousAnalyticsRuntime = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
  const previousPersonalizationRuntime =
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  function make(currentGrantEpoch: () => Promise<Date | null>, boundaryEpoch = EPOCH) {
    const delegates: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u1' }]),
        findUnique: jest.fn().mockResolvedValue({ healthGoals: [] }),
      },
      userEvent: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      },
      mealPlan: { count: jest.fn().mockResolvedValue(0) },
      userBehaviorSignal: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      signalObservation: { findMany: jest.fn() },
      userFeature: { findMany: jest.fn() },
    };
    const { prisma, tx } = makeP0ATransactionBoundaryPrisma(delegates, 'u1', [
      ...['analytics', 'personalization'].map((purpose) => ({
        id: `${purpose}-grant`, userId: 'u1', purpose, status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: boundaryEpoch,
      })),
    ]);
    const signalCalculator = { updateSignalInLockedTransaction: jest.fn().mockResolvedValue(undefined) };
    const snapshotBuilder = { buildAll: jest.fn().mockResolvedValue(undefined) };
    const featureStore = { buildFeatureVector: jest.fn().mockResolvedValue({}) };
    const consent = { currentGrantEpoch: jest.fn(currentGrantEpoch) };
    return {
      service: new SignalDetectorService(
        prisma,
        signalCalculator as any,
        snapshotBuilder as any,
        featureStore as any,
        consent as any,
      ),
      prisma,
      tx,
      signalCalculator,
      snapshotBuilder,
      featureStore,
      consent,
    };
  }

  beforeEach(() => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (previousAnalyticsRuntime === undefined) {
      delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    } else {
      process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousAnalyticsRuntime;
    }
    if (previousPersonalizationRuntime === undefined) {
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    } else {
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED =
        previousPersonalizationRuntime;
    }
  });

  it.each([
    ['analytics', 'OPTIONAL_ANALYTICS_INGEST_ENABLED'],
    ['personalization', 'OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED'],
  ] as const)(
    'returns before every user/consent/optional dependency when %s runtime is OFF',
    async (_purpose, envKey) => {
      delete process.env[envKey];
      const {
        service,
        prisma,
        signalCalculator,
        snapshotBuilder,
        featureStore,
        consent,
      } = make(async () => EPOCH);

      await expect(service.detectBatchSignals()).resolves.toEqual({
        status: 'disabled',
        reason: 'optional_processing_disabled',
        usersDiscovered: 0,
      });

      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(consent.currentGrantEpoch).not.toHaveBeenCalled();
      expect(prisma.userEvent.count).not.toHaveBeenCalled();
      expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
      expect(prisma.signalObservation.findMany).not.toHaveBeenCalled();
      expect(prisma.userFeature.findMany).not.toHaveBeenCalled();
      expect(prisma.userBehaviorSignal.deleteMany).not.toHaveBeenCalled();
      expect(prisma.mealPlan.count).not.toHaveBeenCalled();
      expect(signalCalculator.updateSignalInLockedTransaction).not.toHaveBeenCalled();
      expect(snapshotBuilder.buildAll).not.toHaveBeenCalled();
      expect(featureStore.buildFeatureVector).not.toHaveBeenCalled();
    },
  );

  it('withdrawal skips all per-user behavior reads and derived writes', async () => {
    const { service, prisma, signalCalculator, snapshotBuilder, featureStore } = make(async () => null);

    await service.detectBatchSignals();

    expect(prisma.userEvent.count).not.toHaveBeenCalled();
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.mealPlan.count).not.toHaveBeenCalled();
    expect(signalCalculator.updateSignalInLockedTransaction).not.toHaveBeenCalled();
    expect(snapshotBuilder.buildAll).not.toHaveBeenCalled();
    expect(featureStore.buildFeatureVector).not.toHaveBeenCalled();
  });

  it('consent read failure fails closed before all per-user behavior work', async () => {
    const { service, prisma, signalCalculator } = make(async () => {
      throw new Error('consent unavailable');
    });

    await expect(service.detectBatchSignals()).resolves.toEqual({
      status: 'completed',
      usersDiscovered: 1,
    });

    expect(prisma.userEvent.count).not.toHaveBeenCalled();
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(signalCalculator.updateSignalInLockedTransaction).not.toHaveBeenCalled();
  });

  it('current grant permits the existing signal and rebuild path', async () => {
    const { service, prisma, signalCalculator, snapshotBuilder, featureStore } = make(async () => EPOCH);

    await service.detectBatchSignals();

    expect(signalCalculator.updateSignalInLockedTransaction).toHaveBeenCalledTimes(2);
    expect(snapshotBuilder.buildAll).toHaveBeenCalledWith('u1');
    expect(featureStore.buildFeatureVector).toHaveBeenCalledWith('u1');
    expect(prisma.userEvent.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ consentPurpose: 'personalization' }),
    }));
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ consentPurpose: 'personalization' }),
    }));
  });

  it('food-explorer evidence excludes analytics-only and legacy/null rows', async () => {
    const { service, prisma, tx, signalCalculator } = make(async () => EPOCH);
    const rows = [
      { payload: '{"recipeId":"analytics"}', consentPurpose: 'analytics' },
      { payload: '{"recipeId":"legacy"}', consentPurpose: null },
      { payload: '{"recipeId":"personal"}', consentPurpose: 'personalization' },
    ];
    prisma.userEvent.findMany.mockImplementation((args: any) => Promise.resolve(
      rows
        .filter((row) => row.consentPurpose === args.where.consentPurpose)
        .map(({ payload }) => ({ payload })),
    ));

    await service.detectBatchSignals();

    expect(signalCalculator.updateSignalInLockedTransaction).toHaveBeenNthCalledWith(
      2,
      tx,
      'u1',
      'food_explorer',
      'identity',
      'identity',
      0.2,
      1,
    );
  });
});
