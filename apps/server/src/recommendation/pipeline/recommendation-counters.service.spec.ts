import { RecommendationCountersService } from './recommendation-counters.service';

describe('RecommendationCountersService — counters first-class', () => {
  describe('propensities (softmax)', () => {
    it('sums to 1 and is monotonic in score', () => {
      const p = RecommendationCountersService.propensities([3, 1, 0]);
      expect(p).toHaveLength(3);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
      expect(p[0]).toBeGreaterThan(p[1]);
      expect(p[1]).toBeGreaterThan(p[2]);
    });
    it('is numerically stable for huge scores (no overflow → NaN)', () => {
      const p = RecommendationCountersService.propensities([1000, 999, 998]);
      expect(p.every((x) => Number.isFinite(x))).toBe(true);
      expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    });
    it('empty → []', () => {
      expect(RecommendationCountersService.propensities([])).toEqual([]);
    });
  });

  describe('logSlate', () => {
    function make(fault = false) {
      const created: any[] = [];
      const prisma: any = {
        recommendationServedItem: {
          createMany: jest.fn(async ({ data }: any) => {
            if (fault) throw new Error('db down');
            created.push(...data);
            return { count: data.length };
          }),
        },
      };
      return { svc: new RecommendationCountersService(prisma), created, prisma };
    }

    it('writes one row per item with 0-based position, propensity, and serialized context', async () => {
      const { svc, created } = make();
      const n = await svc.logSlate('u1', [{ recipeId: 'a', score: 2 }, { recipeId: 'b', score: 1 }], { surface: 'home', context: { season: 'winter' } });
      expect(n).toBe(2);
      expect(created[0]).toMatchObject({ userId: 'u1', recipeId: 'a', position: 0, surface: 'home' });
      expect(created[1].position).toBe(1);
      expect(created[0].propensity).toBeGreaterThan(created[1].propensity); // higher score served at higher propensity
      expect(created[0].contextJson).toContain('winter'); // context captured for counterfactual replay
    });

    it('NEVER throws — a DB fault returns 0 so serving is unaffected', async () => {
      const { svc } = make(true);
      await expect(svc.logSlate('u1', [{ recipeId: 'a', score: 1 }])).resolves.toBe(0);
    });

    it('skips empty input / missing user (no write)', async () => {
      const { svc, prisma } = make();
      expect(await svc.logSlate('u1', [])).toBe(0);
      expect(await svc.logSlate('', [{ recipeId: 'a', score: 1 }])).toBe(0);
      expect(prisma.recommendationServedItem.createMany).not.toHaveBeenCalled();
    });
  });
});
