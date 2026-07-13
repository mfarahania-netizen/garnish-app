import { PrismaService } from '../prisma/prisma.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from './consent.constants';
import {
  OptionalProcessingBoundaryOperationalError,
  nextConsentDecisionTimestamp,
  withUserConsentMutationBoundary,
  withUserOptionalProcessingBoundary,
} from './optional-processing-transaction-boundary.service';

const epoch = new Date('2026-07-13T00:00:00.000Z');

function grant(purpose: 'analytics' | 'personalization', at = epoch): {
  id: string;
  purpose: 'analytics' | 'personalization';
  status: string;
  policyVersion: string;
  createdAt: Date;
} {
  return {
    id: `consent-${purpose}`,
    purpose,
    status: 'granted',
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    createdAt: at,
  };
}

function harness(rows = [grant('analytics'), grant('personalization')]) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    userConsent: {
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn().mockResolvedValue({ createdAt: epoch }),
    },
    optionalWrite: jest.fn().mockResolvedValue({ id: 'written' }),
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
      callback(tx)),
  } as unknown as PrismaService;
  return { prisma, tx };
}

describe('canonical optional-processing transaction boundary', () => {
  const oldAnalytics = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
  const oldPersonalization =
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
  });

  afterAll(() => {
    if (oldAnalytics === undefined)
      delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = oldAnalytics;
    if (oldPersonalization === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED =
        oldPersonalization;
  });

  it('returns before every DB call when a required runtime is OFF', async () => {
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    const { prisma } = harness();
    const callback = jest.fn();

    await expect(withUserOptionalProcessingBoundary(
      prisma,
      { userId: 'u1', purposes: ['analytics'], operation: 'test.off' },
      callback,
    )).resolves.toEqual({ status: 'denied', reason: 'runtime_disabled' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('locks User, resolves current policy/epoch, and writes only through tx', async () => {
    const { prisma, tx } = harness();
    const result = await withUserOptionalProcessingBoundary(
      prisma,
      {
        userId: 'u1',
        purposes: ['personalization', 'analytics'],
        operation: 'test.write',
        expectedEpoch: epoch,
      },
      async (client, context) => {
        expect(client).toBe(tx);
        expect(context.grantEpoch).toEqual(epoch);
        return (client as unknown as typeof tx).optionalWrite();
      },
    );

    expect(result).toEqual({
      status: 'executed',
      value: { id: 'written' },
      grantEpoch: epoch,
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userConsent.findMany).toHaveBeenCalledTimes(1);
    expect(tx.optionalWrite).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: 'ReadCommitted',
        maxWait: 2_000,
        timeout: 5_000,
      }),
    );
  });

  it.each([
    ['withdrawal', [grant('analytics'), { ...grant('personalization'), status: 'withdrawn' }]],
    ['stale policy', [grant('analytics'), { ...grant('personalization'), policyVersion: 'stale' }]],
  ])('denies %s under the lock with zero callback write', async (_label, rows) => {
    const { prisma, tx } = harness(rows);
    const callback = jest.fn();
    await expect(withUserOptionalProcessingBoundary(
      prisma,
      {
        userId: 'u1',
        purposes: ['analytics', 'personalization'],
        operation: 'test.denied',
      },
      callback,
    )).resolves.toEqual({ status: 'denied', reason: 'consent_not_granted' });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('rejects a stale pre-computation epoch after acquiring the lock', async () => {
    const nextEpoch = new Date(epoch.getTime() + 1_000);
    const { prisma } = harness([
      grant('analytics', nextEpoch),
      grant('personalization', nextEpoch),
    ]);
    const callback = jest.fn();
    await expect(withUserOptionalProcessingBoundary(
      prisma,
      {
        userId: 'u1',
        purposes: ['analytics', 'personalization'],
        operation: 'test.expected-epoch',
        expectedEpoch: epoch,
      },
      callback,
    )).resolves.toEqual({ status: 'denied', reason: 'consent_epoch_changed' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('rechecks runtime after lock wait and performs zero ledger/write IO if it turned OFF', async () => {
    const { prisma, tx } = harness();
    tx.$queryRaw.mockImplementationOnce(async () => {
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
      return [{ id: 'u1' }];
    });
    const callback = jest.fn();
    await expect(withUserOptionalProcessingBoundary(
      prisma,
      {
        userId: 'u1',
        purposes: ['personalization'],
        operation: 'test.runtime-race',
      },
      callback,
    )).resolves.toEqual({ status: 'denied', reason: 'runtime_disabled' });
    expect(tx.userConsent.findMany).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it('retries only bounded concurrency failures and then succeeds', async () => {
    const { prisma, tx } = harness();
    (prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce(Object.assign(new Error('serialization failure'), { code: 'P2034' }))
      .mockRejectedValueOnce(Object.assign(new Error('deadlock detected'), { code: '40P01' }))
      .mockImplementationOnce(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await withUserOptionalProcessingBoundary(
      prisma,
      { userId: 'u1', purposes: ['analytics'], operation: 'test.retry' },
      async () => 'ok',
    );
    expect(result.status).toBe('executed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('surfaces a structured operational error after the bounded retry budget', async () => {
    const { prisma } = harness();
    (prisma.$transaction as jest.Mock).mockRejectedValue(
      Object.assign(new Error('deadlock detected'), { code: '40P01' }),
    );
    await expect(withUserOptionalProcessingBoundary(
      prisma,
      { userId: 'u1', purposes: ['analytics'], operation: 'test.exhausted' },
      async () => 'never',
    )).rejects.toMatchObject({
      name: OptionalProcessingBoundaryOperationalError.name,
      code: 'OPTIONAL_PROCESSING_BOUNDARY_FAILED',
      operation: 'test.exhausted',
      attempts: 3,
    });
  });

  it('uses the same User lock for consent mutations without requiring a prior grant', async () => {
    const { prisma, tx } = harness([]);
    const callback = jest.fn().mockResolvedValue('withdrawn');
    await expect(withUserConsentMutationBoundary(
      prisma,
      { userId: 'u1', operation: 'consent.withdraw' },
      callback,
    )).resolves.toEqual({ status: 'executed', value: 'withdrawn' });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userConsent.findMany).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(tx);
  });

  it('generates a strictly later ledger timestamp under the lock', async () => {
    const { tx } = harness();
    const next = await nextConsentDecisionTimestamp(tx as never, 'u1', 'analytics');
    expect(next.getTime()).toBeGreaterThan(epoch.getTime());
  });
});
