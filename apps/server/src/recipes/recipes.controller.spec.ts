import { RecipesController } from './recipes.controller';

describe('RecipesController safety-gate wiring', () => {
  let controller: RecipesController;
  let safety: { filter: jest.Mock; safeIds: jest.Mock };
  let recipesService: any;
  let richness: any;
  let searchService: any;

  beforeEach(() => {
    safety = {
      filter: jest.fn(async (_uid: any, rows: any[]) => rows),
      safeIds: jest.fn(async (_uid: any, ids: string[]) => ids),
    };
    recipesService = {
      findAll: jest.fn(async () => ({ data: [{ id: 'a' }, { id: 'b' }], total: 2 })),
      findOne: jest.fn(async (id: string) => ({ id })),
      search: jest.fn(async () => [{ id: 's1' }]),
      findByIdsOrdered: jest.fn(async () => [{ id: 'r1' }]),
    };
    richness = {
      getRichRecipe: jest.fn(async (id: string) => ({ id, rich: true })),
      personalize: jest.fn(async (id: string) => ({ id, personalized: true })),
    };
    searchService = {
      search: jest.fn(async () => ({
        resultStatus: 'ok',
        results: [{ recipeId: 'r1', score: 1, why: { matchedTerms: [] } }],
      })),
      similar: jest.fn(async () => ({ recipeId: 'x', results: [{ recipeId: 'n1' }], resultStatus: 'ok' })),
    };
    controller = new RecipesController(recipesService as any, richness as any, searchService as any, safety as any);
  });

  it('findAll runs the gate with the logged-in user id', async () => {
    const res = await controller.findAll({ user: { userId: 'u1' } } as any, '1', '20');
    expect(recipesService.findAll).toHaveBeenCalledWith(0, 1000, undefined, undefined);
    expect(safety.filter).toHaveBeenCalledWith('u1', [{ id: 'a' }, { id: 'b' }]);
    expect(res.total).toBe(2);
  });

  it('findAll paginates after the safety gate so sparse pages are not produced', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `r${i + 1}` }));
    recipesService.findAll.mockResolvedValueOnce({ data: rows, total: 30, page: 1, pageSize: 1000 });
    safety.filter.mockResolvedValueOnce(rows.filter((_, i) => i % 2 === 0));

    const res = await controller.findAll({ user: { userId: 'u1' } } as any, '2', '5');

    expect(recipesService.findAll).toHaveBeenCalledWith(0, 1000, undefined, undefined);
    expect(res.total).toBe(15);
    expect(res.data.map((r: any) => r.id)).toEqual(['r11', 'r13', 'r15', 'r17', 'r19']);
  });

  it('findAll does not safety-filter anonymous listing', async () => {
    await controller.findAll({} as any, '1', '20');

    expect(recipesService.findAll).toHaveBeenCalledWith(0, 20, undefined, undefined);
    expect(safety.filter).not.toHaveBeenCalled();
  });

  it('search runs the gate for the logged-in user with an expanded candidate pool', async () => {
    await controller.search({ user: { userId: 'u1' } } as any, { q: 'x', limit: '10' } as any);

    expect(searchService.search).toHaveBeenCalledWith('x', { limit: 200 });
    expect(safety.filter).toHaveBeenCalledWith('u1', expect.any(Array));
  });

  it('search returns the requested limit after filtering a larger candidate pool', async () => {
    const ranked = Array.from({ length: 25 }, (_, i) => ({
      recipeId: `r${i + 1}`,
      score: 1,
      why: { matchedTerms: [] },
    }));
    const rows = ranked.map((r) => ({ id: r.recipeId }));
    searchService.search.mockResolvedValueOnce({ resultStatus: 'ok', results: ranked });
    recipesService.findByIdsOrdered.mockResolvedValueOnce(rows);
    safety.filter.mockResolvedValueOnce(rows.slice(0, 12));

    const res = await controller.search({ user: { userId: 'u1' } } as any, { q: 'x', limit: '10' } as any);

    expect(res).toHaveLength(10);
  });

  it('similar runs the gate keyed by recipeId', async () => {
    await controller.similar({ user: { userId: 'u1' } } as any, 'x', '6');
    expect(safety.filter).toHaveBeenCalledWith('u1', [{ recipeId: 'n1' }], 'recipeId');
  });
});
