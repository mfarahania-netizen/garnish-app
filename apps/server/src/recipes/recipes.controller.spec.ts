import { RecipesController } from './recipes.controller';

// Guardian H1 rework: prove the popular/fresh rails (Home/Discover read these) are actually WIRED to the
// hard safety gate with the logged-in user's id, and that anonymous passes through (userId undefined).
describe('RecipesController — safety-gate wiring', () => {
  let controller: RecipesController;
  let safety: { filter: jest.Mock };
  let recipesService: any;
  let searchService: any;

  beforeEach(() => {
    safety = { filter: jest.fn(async (_uid: any, rows: any[]) => rows) };
    recipesService = {
      findAll: jest.fn(async () => ({ data: [{ id: 'a' }, { id: 'b' }], total: 2 })),
      search: jest.fn(async () => [{ id: 's1' }]),
      findByIdsOrdered: jest.fn(async () => [{ id: 'r1' }]),
    };
    searchService = {
      search: jest.fn(async () => ({ resultStatus: 'ok', results: [{ recipeId: 'r1', score: 1, why: { matchedTerms: [] } }] })),
      similar: jest.fn(async () => ({ recipeId: 'x', results: [{ recipeId: 'n1' }], resultStatus: 'ok' })),
    };
    controller = new RecipesController(recipesService as any, {} as any, searchService as any, safety as any);
  });

  it('findAll runs the gate with the logged-in user id (Home/Discover rail)', async () => {
    const res = await controller.findAll({ user: { userId: 'u1' } } as any, '1', '20');
    expect(safety.filter).toHaveBeenCalledWith('u1', [{ id: 'a' }, { id: 'b' }]);
    expect(res.total).toBe(2);
  });

  it('findAll passes through anonymously (no req.user → userId undefined)', async () => {
    await controller.findAll({} as any, '1', '20');
    expect(safety.filter).toHaveBeenCalledWith(undefined, expect.any(Array));
  });

  it('search runs the gate for the logged-in user', async () => {
    await controller.search({ user: { userId: 'u1' } } as any, { q: 'x', limit: '10' } as any);
    expect(safety.filter).toHaveBeenCalledWith('u1', expect.any(Array));
  });

  it('similar runs the gate keyed by recipeId', async () => {
    await controller.similar({ user: { userId: 'u1' } } as any, 'x', '6');
    expect(safety.filter).toHaveBeenCalledWith('u1', [{ recipeId: 'n1' }], 'recipeId');
  });
});
