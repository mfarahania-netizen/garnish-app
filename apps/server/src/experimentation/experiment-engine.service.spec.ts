import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { ExperimentEngine } from './experiment-engine.service';

describe('ExperimentEngine locked consent epoch isolation', () => {
  const epoch = new Date('2099-07-01T00:00:00.000Z');
  const nextEpoch = new Date('2099-07-02T00:00:00.000Z');
  let prisma: any;
  let tx: any;
  let service: ExperimentEngine;

  beforeEach(() => {
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
      userConsent: {
        findMany: jest.fn().mockResolvedValue(
          ['analytics', 'personalization'].map((purpose) => ({
            id: `consent-${purpose}`,
            purpose,
            status: 'granted',
            policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
            createdAt: epoch,
          })),
        ),
      },
      experiment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'exp-1',
          name: 'ranking-v1',
          variantA: { tasteAffinity: 1 },
          variantB: { behaviorFit: 1 },
        }),
      },
      experimentAssignment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          variant: 'A',
          createdAt: new Date('2099-07-01T00:01:00.000Z'),
        }),
        create: jest.fn(),
      },
    };
    prisma = {
      ...tx,
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx)),
    };
    service = new ExperimentEngine(prisma);
  });

  afterAll(() => {
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  });

  it('uses an assignment created within the locked joint epoch', async () => {
    await expect(service.getWeights('u1', epoch)).resolves.toMatchObject({
      tasteAffinity: 1,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns neutral when an assignment predates withdrawal and re-grant', async () => {
    tx.experimentAssignment.findUnique.mockResolvedValue({
      id: 'assignment-old',
      variant: 'A',
      createdAt: new Date('2099-06-30T23:59:00.000Z'),
    });
    await expect(service.getWeights('u1', epoch)).resolves.toBeNull();
    expect(tx.experimentAssignment.create).not.toHaveBeenCalled();
  });

  it('rejects stale precomputed input before experiment reads', async () => {
    await expect(service.getWeights('u1', nextEpoch)).resolves.toBeNull();
    expect(tx.experiment.findFirst).not.toHaveBeenCalled();
    expect(tx.experimentAssignment.create).not.toHaveBeenCalled();
  });

  it('creates an assignment inside the same transaction with no compensation path', async () => {
    tx.experimentAssignment.findUnique.mockResolvedValue(null);
    tx.experimentAssignment.create.mockResolvedValue({
      id: 'assignment-new',
      variant: 'B',
      createdAt: new Date('2099-07-01T00:02:00.000Z'),
    });
    await expect(service.getWeights('u1', epoch)).resolves.toMatchObject({
      behaviorFit: 1,
    });
    expect(tx.experimentAssignment.create).toHaveBeenCalledTimes(1);
    expect(tx.experimentAssignment).not.toHaveProperty('delete');
  });

  it('a locked withdrawal denies experiment and assignment IO', async () => {
    tx.userConsent.findMany.mockResolvedValue([
      {
        id: 'consent-analytics',
        purpose: 'analytics',
        status: 'withdrawn',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: nextEpoch,
      },
    ]);
    await expect(service.getWeights('u1')).resolves.toBeNull();
    expect(tx.experiment.findFirst).not.toHaveBeenCalled();
  });
});
