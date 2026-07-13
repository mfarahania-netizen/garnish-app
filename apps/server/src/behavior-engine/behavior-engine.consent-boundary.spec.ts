import { BehaviorEngineScheduler } from './behavior-engine-scheduler.service';
import { BehaviorEngineService } from './behavior-engine.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { makeP0ATransactionBoundaryPrisma } from '../test-support/p0-a-epoch-fixture';

const EPOCH = new Date('2026-07-12T00:00:00.000Z');

function grantRows(epoch: Date) {
  return ['analytics', 'personalization'].map((purpose) => ({
    id: `${purpose}-grant`, userId: 'u1', purpose, status: 'granted',
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: epoch,
  }));
}

function makeService(currentGrantEpoch: () => Promise<Date | null>, boundaryEpoch = EPOCH) {
  const delegates: any = {
    userEvent: { findMany: jest.fn().mockResolvedValue([]) },
    shoppingItem: { findMany: jest.fn().mockResolvedValue([]) },
    userBehaviorProfile: {
      upsert: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  };
  const { prisma, tx } = makeP0ATransactionBoundaryPrisma(delegates, 'u1', grantRows(boundaryEpoch));
  const consent: any = { currentGrantEpoch: jest.fn(currentGrantEpoch) };
  return {
    service: new BehaviorEngineService(prisma, consent),
    prisma,
    tx,
    consent,
  };
}

describe('BehaviorEngineService personalization consent boundary', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  const previousAnalyticsRuntime = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
  });

  afterAll(() => {
    if (previousRuntime === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
    if (previousAnalyticsRuntime === undefined) delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousAnalyticsRuntime;
  });

  it('direct caller deny → returns without reading behavior data or mutating a profile', async () => {
    const { service, prisma, consent } = makeService(async () => null);

    await expect(service.processEventsForUser('u1')).resolves.toBeNull();

    expect(consent.currentGrantEpoch).toHaveBeenCalledWith('u1', [
      'analytics',
      'personalization',
    ]);
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.userBehaviorProfile.upsert).not.toHaveBeenCalled();
  });

  it('direct caller consent read error → fails closed without data reads or mutation', async () => {
    const { service, prisma } = makeService(async () => {
      throw new Error('consent store unavailable');
    });

    await expect(service.processEventsForUser('u1')).resolves.toBeNull();

    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.userBehaviorProfile.upsert).not.toHaveBeenCalled();
  });

  it('direct getProfile deny returns null before profile IO', async () => {
    const { service, prisma } = makeService(async () => null);

    await expect(service.getProfile('u1')).resolves.toBeNull();

    expect(prisma.userBehaviorProfile.findFirst).not.toHaveBeenCalled();
  });

  it('direct getProfile consent error returns null before profile IO', async () => {
    const { service, prisma } = makeService(async () => {
      throw new Error('consent unavailable');
    });

    await expect(service.getProfile('u1')).resolves.toBeNull();

    expect(prisma.userBehaviorProfile.findFirst).not.toHaveBeenCalled();
  });

  it('direct getProfile current grant preserves the profile read', async () => {
    const { service, prisma } = makeService(async () => EPOCH);
    prisma.userBehaviorProfile.findFirst.mockResolvedValue({ userId: 'u1' });

    await expect(service.getProfile('u1')).resolves.toEqual({ userId: 'u1' });

    expect(prisma.userBehaviorProfile.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', updatedAt: { gte: EPOCH } },
    });
  });

  it('uses only events originally collected for personalization', async () => {
    const { service, prisma } = makeService(async () => EPOCH);

    await service.processEventsForUser('u1');

    expect(prisma.userEvent.findMany).toHaveBeenCalledTimes(2);
    for (const [args] of prisma.userEvent.findMany.mock.calls) {
      expect(args.where).toMatchObject({
        userId: 'u1',
        consentPurpose: 'personalization',
      });
    }
  });

  it('re-consent epoch change during derivation suppresses the profile write', async () => {
    const nextEpoch = new Date('2026-07-12T01:00:00.000Z');
    const epochs = jest.fn().mockResolvedValue(EPOCH);
    const { service, prisma } = makeService(epochs, nextEpoch);

    await expect(service.processEventsForUser('u1')).resolves.toBeNull();

    for (const [args] of prisma.userEvent.findMany.mock.calls) {
      expect(args.where.timestamp.gte.getTime()).toBeGreaterThanOrEqual(
        EPOCH.getTime(),
      );
    }
    expect(prisma.userBehaviorProfile.upsert).not.toHaveBeenCalled();
  });

  it('scheduler path reaches the same fail-closed entry before profile mutation', async () => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    const prisma: any = {
      userEvent: {
        findMany: jest.fn(async () => [{ userId: 'u1' }]),
        create: jest.fn(),
      },
      shoppingItem: { findMany: jest.fn() },
      userBehaviorProfile: {
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      user: { findFirst: jest.fn(async () => null), findUnique: jest.fn() },
      notification: { createMany: jest.fn() },
    };
    const consent: any = { currentGrantEpoch: jest.fn(async () => null) };
    const service = new BehaviorEngineService(prisma, consent);
    const scheduler = new BehaviorEngineScheduler(service, prisma, {
      drain: jest.fn(),
    } as any);
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await scheduler.handleCron();
    } finally {
      log.mockRestore();
      warn.mockRestore();
    }

    expect(consent.currentGrantEpoch).toHaveBeenCalledWith('u1', [
      'analytics',
      'personalization',
    ]);
    expect(prisma.userEvent.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ consentPurpose: 'personalization' }),
      }),
    );
    expect(prisma.userEvent.create).not.toHaveBeenCalled();
    expect(prisma.userBehaviorProfile.upsert).not.toHaveBeenCalled();
  });

  it('scheduler performs zero database IO while personalization processing is disabled', async () => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    const prisma: any = {
      userEvent: { findMany: jest.fn() },
      userBehaviorProfile: { findMany: jest.fn() },
      notification: { createMany: jest.fn() },
    };
    const engine: any = { processEventsForUser: jest.fn() };
    const outbox: any = { drain: jest.fn() };
    const scheduler = new BehaviorEngineScheduler(engine, prisma, outbox);

    await scheduler.handleCron();
    await scheduler.drainOutbox();

    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(prisma.userBehaviorProfile.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
    expect(engine.processEventsForUser).not.toHaveBeenCalled();
    expect(outbox.drain).not.toHaveBeenCalled();
  });
});
