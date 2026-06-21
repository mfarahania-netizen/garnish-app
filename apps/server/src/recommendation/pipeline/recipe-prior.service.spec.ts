import { RecipePriorService } from './recipe-prior.service';

const ENV = 'L1_RECIPE_PRIOR_ENABLED';
function on() { process.env[ENV] = 'true'; }
function off() { delete process.env[ENV]; }

function make(rows: any[] = [], user: any = { locale: 'nl-NL', country: 'NL', preferences: { diet: 'vegetarian', skillLevel: 'beginner' } }) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma: any = { recipePrior: { findMany }, user: { findUnique: jest.fn().mockResolvedValue(user) } };
  return { svc: new RecipePriorService(prisma), prisma, findMany };
}

afterEach(off);

describe('RecipePriorService — read path (L1 step 4)', () => {
  it('returns null when the flag is OFF (default) → ranker stays neutral', async () => {
    const { svc } = make();
    expect(await svc.valuesForSlate('u1', ['r1'])).toBeNull();
  });

  it('returns null for an empty slate even when enabled', async () => {
    on();
    const { svc } = make();
    expect(await svc.valuesForSlate('u1', [])).toBeNull();
  });

  it('COLD START: empty table → every candidate is the neutral 0.5', async () => {
    on();
    const { svc } = make([]);
    const out = await svc.valuesForSlate('u1', ['r1', 'r2']);
    expect(out!.get('r1')).toBe(0.5);
    expect(out!.get('r2')).toBe(0.5);
  });

  it('a positive COHORT reward lifts the value above 0.5 (shrunk by κ=10)', async () => {
    on();
    // cohort n=100, mean=+0.4 → shrink(0,{100,0.4},10)=40/110≈0.3636 → 0.5+0.5*0.3636≈0.6818
    const cohortKey = 'country=nl;diet=vegetarian;skill=beginner';
    const { svc } = make([{ recipeId: 'r1', scope: 'cohort', scopeKey: cohortKey, n: 100, mean: 0.4, populationMu: 0 }]);
    const out = await svc.valuesForSlate('u1', ['r1']);
    expect(out!.get('r1')).toBeCloseTo(0.6818, 3);
  });

  it('a negative PERSON reward pulls the value below 0.5', async () => {
    on();
    const { svc } = make([{ recipeId: 'r1', scope: 'person', scopeKey: 'u1', n: 50, mean: -0.6, populationMu: 0 }]);
    const out = await svc.valuesForSlate('u1', ['r1']);
    expect(out!.get('r1')).toBeLessThan(0.5);
  });

  it('derives the cohort key from the user via the shared mapper (queried in the OR filter)', async () => {
    on();
    const { svc, findMany } = make([]);
    await svc.valuesForSlate('u1', ['r1']);
    const where = findMany.mock.calls[0][0].where;
    const cohortClause = where.OR.find((c: any) => c.scope === 'cohort');
    expect(cohortClause.scopeKey).toBe('country=nl;diet=vegetarian;skill=beginner');
    expect(where.OR).toEqual(expect.arrayContaining([{ scope: 'person', scopeKey: 'u1' }]));
  });

  it('folds the active EU occasion (Christmas) into the cohort key — CORE for the Europe launch', async () => {
    on();
    const { svc, findMany } = make([]);
    await svc.valuesForSlate('u1', ['r1'], { occasion: { key: 'none' }, europeanOccasion: { key: 'christmas' } } as any);
    const cohortClause = findMany.mock.calls[0][0].where.OR.find((c: any) => c.scope === 'cohort');
    expect(cohortClause.scopeKey).toBe('country=nl;diet=vegetarian;occasion=christmas;skill=beginner');
  });

  it('is BATCHED — one findMany for the whole slate (no N+1)', async () => {
    on();
    const { svc, findMany } = make([]);
    await svc.valuesForSlate('u1', ['r1', 'r2', 'r3']);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where.recipeId).toEqual({ in: ['r1', 'r2', 'r3'] });
  });

  it('fail-safe: a throwing findMany degrades to neutral (never throws)', async () => {
    on();
    const prisma: any = { recipePrior: { findMany: jest.fn().mockRejectedValue(new Error('db')) }, user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const svc = new RecipePriorService(prisma);
    const out = await svc.valuesForSlate('u1', ['r1']);
    expect(out!.get('r1')).toBe(0.5);
  });

  it('returns null when the recipePrior table/client is absent', async () => {
    on();
    const svc = new RecipePriorService({ user: { findUnique: jest.fn() } } as any);
    expect(await svc.valuesForSlate('u1', ['r1'])).toBeNull();
  });
});
