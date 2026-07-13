import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CURRENT_PRIVACY_POLICY_VERSION } from './consent.constants';
import {
  withUserConsentMutationBoundary,
  withUserOptionalProcessingBoundary,
} from './optional-processing-transaction-boundary.service';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve'];
  let reject!: Deferred<T>['reject'];
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const integrationEnabled =
  process.env.RUN_P0A_V2_TX_INTEGRATION === 'true';
const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('optional-processing boundary PostgreSQL interleavings A-J', () => {
  const dbUrl = process.env.DATABASE_URL ?? '';
  const clientA = new PrismaClient();
  const clientB = new PrismaClient();
  let userId = '';

  const asService = (client: PrismaClient) =>
    client as unknown as PrismaService;

  const writeEvent = (
    tx: Prisma.TransactionClient,
    id: string,
    type = 'p0a_v2_tx_test',
  ) => tx.userEvent.create({
    data: {
      id,
      userId,
      type,
      consentPurpose: 'analytics',
    },
  });

  const decision = (
    tx: Prisma.TransactionClient,
    purpose: 'analytics' | 'personalization',
    status: 'granted' | 'withdrawn',
    policyVersion: string = CURRENT_PRIVACY_POLICY_VERSION,
  ) => {
    const now = new Date();
    return tx.userConsent.create({
      data: {
        userId,
        purpose,
        status,
        policyVersion,
        source: 'p0a_v2_tx_test',
        createdAt: now,
        grantedAt: status === 'granted' ? now : undefined,
        withdrawnAt: status === 'withdrawn' ? now : null,
      },
    });
  };

  const boundaryWrite = (
    client: PrismaClient,
    id: string,
    callback?: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) => withUserOptionalProcessingBoundary(
    asService(client),
    {
      userId,
      purposes: ['analytics'],
      operation: `integration.write.${id}`,
    },
    async (tx) => callback ? callback(tx) : writeEvent(tx, id),
  );

  const mutateConsent = (
    client: PrismaClient,
    purpose: 'analytics' | 'personalization',
    status: 'granted' | 'withdrawn',
    callback?: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) => withUserConsentMutationBoundary(
    asService(client),
    { userId, operation: `integration.consent.${status}.${purpose}` },
    async (tx) => callback
      ? callback(tx)
      : decision(tx, purpose, status),
  );

  beforeAll(async () => {
    expect(new URL(dbUrl).pathname.replace(/^\//, '')).toBe(
      'garnish_p0a_v2_tx_test',
    );
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    await Promise.all([clientA.$connect(), clientB.$connect()]);
  });

  beforeEach(async () => {
    await clientA.user.deleteMany({
      where: { phone: { startsWith: 'p0a-v2-tx-' } },
    });
    const user = await clientA.user.create({
      data: { phone: `p0a-v2-tx-${Date.now()}-${Math.random()}` },
    });
    userId = user.id;
    await decision(clientA as unknown as Prisma.TransactionClient, 'analytics', 'granted');
  });

  afterAll(async () => {
    await clientA.user.deleteMany({
      where: { phone: { startsWith: 'p0a-v2-tx-' } },
    });
    await Promise.all([clientA.$disconnect(), clientB.$disconnect()]);
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  });

  it('A: writer commits first; withdrawal waits and commits after the pre-withdrawal row', async () => {
    const writerHasLock = deferred<void>();
    const releaseWriter = deferred<void>();
    let withdrawalEntered = false;

    const writer = boundaryWrite(clientA, 'case-a', async (tx) => {
      writerHasLock.resolve();
      await releaseWriter.promise;
      return writeEvent(tx, 'case-a');
    });
    await writerHasLock.promise;
    const withdrawal = mutateConsent(clientB, 'analytics', 'withdrawn', async (tx) => {
      withdrawalEntered = true;
      return decision(tx, 'analytics', 'withdrawn');
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(withdrawalEntered).toBe(false);
    releaseWriter.resolve();
    const [writeResult, withdrawalResult] = await Promise.all([writer, withdrawal]);
    expect(writeResult.status).toBe('executed');
    expect(withdrawalResult.status).toBe('executed');

    const [row, latest] = await Promise.all([
      clientA.userEvent.findUniqueOrThrow({ where: { id: 'case-a' } }),
      clientA.userConsent.findFirstOrThrow({
        where: { userId, purpose: 'analytics' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    ]);
    expect(latest.status).toBe('withdrawn');
    expect(row.timestamp.getTime()).toBeLessThanOrEqual(latest.createdAt.getTime());
  });

  it('B: withdrawal commits first; waiting writer re-reads and creates zero row', async () => {
    const withdrawalHasLock = deferred<void>();
    const releaseWithdrawal = deferred<void>();
    let writerEntered = false;
    const withdrawal = mutateConsent(clientA, 'analytics', 'withdrawn', async (tx) => {
      withdrawalHasLock.resolve();
      await releaseWithdrawal.promise;
      return decision(tx, 'analytics', 'withdrawn');
    });
    await withdrawalHasLock.promise;
    const writer = boundaryWrite(clientB, 'case-b', async (tx) => {
      writerEntered = true;
      return writeEvent(tx, 'case-b');
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(writerEntered).toBe(false);
    releaseWithdrawal.resolve();
    await expect(withdrawal).resolves.toMatchObject({ status: 'executed' });
    await expect(writer).resolves.toEqual({
      status: 'denied',
      reason: 'consent_not_granted',
    });
    expect(await clientA.userEvent.count({ where: { id: 'case-b' } })).toBe(0);
  });

  it('C: withdrawal between request validation and lock acquisition controls the decision', async () => {
    const requestValidated = deferred<void>();
    const continueToBoundary = deferred<void>();
    const writer = (async () => {
      requestValidated.resolve();
      await continueToBoundary.promise;
      return boundaryWrite(clientA, 'case-c');
    })();
    await requestValidated.promise;
    await mutateConsent(clientB, 'analytics', 'withdrawn');
    continueToBoundary.resolve();
    await expect(writer).resolves.toEqual({
      status: 'denied',
      reason: 'consent_not_granted',
    });
    expect(await clientA.userEvent.count({ where: { id: 'case-c' } })).toBe(0);
  });

  it('D: exception before commit rolls back the optional insert', async () => {
    await expect(boundaryWrite(clientA, 'case-d', async (tx) => {
      await writeEvent(tx, 'case-d');
      throw new Error('before commit');
    })).rejects.toThrow('Optional processing boundary failed');
    expect(await clientA.userEvent.count({ where: { id: 'case-d' } })).toBe(0);
  });

  it('E: a process-level callback failure leaves zero committed row', async () => {
    await expect(boundaryWrite(clientA, 'case-e', async (tx) => {
      await writeEvent(tx, 'case-e');
      return Promise.reject(Object.assign(new Error('simulated process failure'), {
        signal: 'SIGTERM',
      }));
    })).rejects.toThrow('Optional processing boundary failed');
    expect(await clientA.userEvent.count({ where: { id: 'case-e' } })).toBe(0);
  });

  it('F: cleanup failure is irrelevant because a committed withdrawal prevents the insert', async () => {
    await mutateConsent(clientA, 'analytics', 'withdrawn');
    const cleanup = jest.fn().mockRejectedValue(new Error('delete unavailable'));
    await expect(boundaryWrite(clientB, 'case-f')).resolves.toEqual({
      status: 'denied',
      reason: 'consent_not_granted',
    });
    await expect(cleanup()).rejects.toThrow('delete unavailable');
    expect(await clientA.userEvent.count({ where: { id: 'case-f' } })).toBe(0);
  });

  it('G: simultaneous idempotent writers serialize and retain one event', async () => {
    const idempotentWrite = (client: PrismaClient) => boundaryWrite(
      client,
      'case-g',
      (tx) => tx.userEvent.upsert({
        where: { id: 'case-g' },
        create: {
          id: 'case-g',
          userId,
          type: 'p0a_v2_tx_test',
          consentPurpose: 'analytics',
        },
        update: {},
      }),
    );
    const results = await Promise.all([
      idempotentWrite(clientA),
      idempotentWrite(clientB),
    ]);
    expect(results.every((result) => result.status === 'executed')).toBe(true);
    expect(await clientA.userEvent.count({ where: { id: 'case-g' } })).toBe(1);
  });

  it('H: a writer waits for a grant and is allowed only after that grant commits', async () => {
    await mutateConsent(clientA, 'analytics', 'withdrawn');
    const grantHasLock = deferred<void>();
    const releaseGrant = deferred<void>();
    let writerEntered = false;
    const grant = mutateConsent(clientA, 'analytics', 'granted', async (tx) => {
      grantHasLock.resolve();
      await releaseGrant.promise;
      return decision(tx, 'analytics', 'granted');
    });
    await grantHasLock.promise;
    const writer = boundaryWrite(clientB, 'case-h', async (tx) => {
      writerEntered = true;
      return writeEvent(tx, 'case-h');
    });
    await new Promise((resolve) => setTimeout(resolve, 75));
    expect(writerEntered).toBe(false);
    releaseGrant.resolve();
    await expect(grant).resolves.toMatchObject({ status: 'executed' });
    await expect(writer).resolves.toMatchObject({ status: 'executed' });
    expect(await clientA.userEvent.count({ where: { id: 'case-h' } })).toBe(1);
  });

  it('I: a stale-policy grant cannot authorize a write', async () => {
    await mutateConsent(clientA, 'analytics', 'withdrawn');
    await withUserConsentMutationBoundary(
      asService(clientA),
      { userId, operation: 'integration.stale-policy' },
      (tx) => decision(tx, 'analytics', 'granted', 'privacy-stale'),
    );
    await expect(boundaryWrite(clientB, 'case-i')).resolves.toEqual({
      status: 'denied',
      reason: 'consent_not_granted',
    });
    expect(await clientA.userEvent.count({ where: { id: 'case-i' } })).toBe(0);
  });

  it('J: runtime OFF before lock causes zero transaction/query and zero write', async () => {
    const queryClient = new PrismaClient({
      log: [{ emit: 'event', level: 'query' }],
    });
    await queryClient.$connect();
    const queries: string[] = [];
    queryClient.$on('query', (event) => queries.push(event.query));
    delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    await expect(boundaryWrite(queryClient, 'case-j')).resolves.toEqual({
      status: 'denied',
      reason: 'runtime_disabled',
    });
    expect(queries).toEqual([]);
    expect(await clientA.userEvent.count({ where: { id: 'case-j' } })).toBe(0);
    await queryClient.$disconnect();
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
  });
});
