import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';
import { RecommendationCountersService } from './recommendation-counters.service';

const epoch = new Date('2026-07-13T00:00:00.000Z');

describe('RecommendationCountersService — counters first-class', () => {
  describe('propensities (softmax)', () => {
    it('sums to 1 and is monotonic in score', () => {
      const p = RecommendationCountersService.propensities([3, 1, 0]);
      expect(p).toHaveLength(3);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
      expect(p[0]).toBeGreaterThan(p[1]);
      expect(p[1]).toBeGreaterThan(p[2]);
    });
    it('is numerically stable for huge scores', () => {
      const p = RecommendationCountersService.propensities([1000, 999, 998]);
      expect(p.every(Number.isFinite)).toBe(true);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    });
    it('empty returns empty', () => {
      expect(RecommendationCountersService.propensities([])).toEqual([]);
    });
  });

  describe('logSlate', () => {
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

    function make(options: {
      rows?: any[];
      writeError?: Error & { code?: string };
      transactionErrors?: Array<Error & { code?: string }>;
    } = {}) {
      const created: any[] = [];
      const rows = options.rows ?? ['analytics', 'personalization'].map((purpose) => ({
        id: `consent-${purpose}`,
        purpose,
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
        createdAt: epoch,
      }));
      const tx: any = {
        $executeRaw: jest.fn().mockResolvedValue(0),
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
        userConsent: { findMany: jest.fn().mockResolvedValue(rows) },
        recommendationServedItem: {
          createMany: jest.fn(async ({ data }: any) => {
            if (options.writeError) throw options.writeError;
            created.push(...data);
            return { count: data.length };
          }),
        },
      };
      const transactionErrors = [...(options.transactionErrors ?? [])];
      const prisma: any = {
        ...tx,
        $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => {
          const error = transactionErrors.shift();
          if (error) throw error;
          return callback(tx);
        }),
      };
      return {
        svc: new RecommendationCountersService(prisma, {} as any),
        created,
        prisma,
        tx,
      };
    }

    it('writes one row per item with position, propensity and context through tx', async () => {
      const { svc, created, prisma } = make();
      const n = await svc.logSlate(
        'u1',
        [{ recipeId: 'a', score: 2 }, { recipeId: 'b', score: 1 }],
        { surface: 'home', context: { season: 'winter' }, requestId: 'req-xyz' },
      );
      expect(n).toBe(2);
      expect(created[0]).toMatchObject({
        userId: 'u1', recipeId: 'a', position: 0, surface: 'home', requestId: 'req-xyz',
      });
      expect(created[1]).toMatchObject({ position: 1, requestId: 'req-xyz' });
      expect(created[0].propensity).toBeGreaterThan(created[1].propensity);
      expect(created[0].contextJson).toContain('winter');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('never throws on a persistent write fault', async () => {
      const { svc } = make({ writeError: new Error('db down') });
      await expect(svc.logSlate('u1', [{ recipeId: 'a', score: 1 }])).resolves.toBe(0);
    });

    it('retries bounded concurrency conflicts only', async () => {
      const conflict = () => Object.assign(new Error('serialization failure'), { code: 'P2034' });
      const { svc, prisma } = make({ transactionErrors: [conflict(), conflict()] });
      await expect(svc.logSlate('u1', [{ recipeId: 'a', score: 1 }])).resolves.toBe(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    });

    it('skips empty input and missing user with no transaction', async () => {
      const { svc, prisma } = make();
      expect(await svc.logSlate('u1', [])).toBe(0);
      expect(await svc.logSlate('', [{ recipeId: 'a', score: 1 }])).toBe(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it.each(['analytics', 'personalization'])('denies missing %s grant with zero write', async (missing) => {
      const rows = ['analytics', 'personalization']
        .filter((purpose) => purpose !== missing)
        .map((purpose) => ({
          id: `consent-${purpose}`,
          purpose,
          status: 'granted',
          policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          createdAt: epoch,
        }));
      const { svc, tx } = make({ rows });
      await expect(svc.logSlate('u1', [{ recipeId: 'a', score: 1 }])).resolves.toBe(0);
      expect(tx.recommendationServedItem.createMany).not.toHaveBeenCalled();
    });

    it('fails closed when the locked ledger read fails', async () => {
      const { svc, tx } = make();
      tx.userConsent.findMany.mockRejectedValue(new Error('ledger unavailable'));
      await expect(svc.logSlate('u1', [{ recipeId: 'a', score: 1 }])).resolves.toBe(0);
      expect(tx.recommendationServedItem.createMany).not.toHaveBeenCalled();
    });

    it('rejects a slate computed under an older consent epoch', async () => {
      const { svc, tx } = make();
      const staleEpoch = new Date(epoch.getTime() - 1_000);
      await expect(svc.logSlate(
        'u1',
        [{ recipeId: 'a', score: 1 }],
        { expectedEpoch: staleEpoch },
      )).resolves.toBe(0);
      expect(tx.recommendationServedItem.createMany).not.toHaveBeenCalled();
    });
  });
});
