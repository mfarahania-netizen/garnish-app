import { AgenticWriteToolsService } from './agentic-write-tools.service';

const ctx = { userId: 'u1', snapshot: {} } as any;
const toolByName = (svc: AgenticWriteToolsService, name: string) => svc.build().find((t) => t.spec.name === name)!;

/** Construct the service with only the deps a given test exercises mocked; the rest are inert. */
const make = (deps: { buildFromPlan?: jest.Mock; findIngredients?: jest.Mock; correctTaste?: jest.Mock } = {}) =>
  new AgenticWriteToolsService(
    { ingredient: { findMany: deps.findIngredients ?? jest.fn().mockResolvedValue([]) } } as any, // prisma
    {} as any, // favorites
    { buildFromPlan: deps.buildFromPlan ?? jest.fn() } as any, // shoppingList
    {} as any, // mealPlans
    { correctTastePreference: deps.correctTaste ?? jest.fn().mockResolvedValue({ ok: true }) } as any, // taste
  );

/**
 * The flagship workflow tool: build the shopping list from the WHOLE week plan in one deterministic call.
 * Thin wrapper over ShoppingListService.buildFromPlan (which owns aggregation/scaling/de-dupe).
 */
describe('AgenticWriteToolsService — add_week_to_shopping_list', () => {
  it('is registered in build()', () => {
    expect(make().build().map((t) => t.spec.name)).toContain('add_week_to_shopping_list');
  });

  it('builds from the current-user week plan and reports the added count', async () => {
    const buildFromPlan = jest.fn().mockResolvedValue({ resultStatus: 'ok', added: 12, merged: 3, householdSize: 2 });
    const res: any = await toolByName(make({ buildFromPlan }), 'add_week_to_shopping_list').execute({}, ctx);
    expect(buildFromPlan).toHaveBeenCalledWith('u1'); // owner-scoped — never another user's plan
    expect(res).toMatchObject({ ok: true, action: 'add_week_to_shopping_list', added: 12 });
  });

  it('asks the user to plan first when the week is empty (no_plan → error, no ok)', async () => {
    const buildFromPlan = jest.fn().mockResolvedValue({ resultStatus: 'no_plan', added: 0, merged: 0, flagged: 0, items: [] });
    const res: any = await toolByName(make({ buildFromPlan }), 'add_week_to_shopping_list').execute({}, ctx);
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
  });

  it('reports a no-op (added 0) as already-up-to-date, NOT an error', async () => {
    const buildFromPlan = jest.fn().mockResolvedValue({ resultStatus: 'ok', added: 0, merged: 0, householdSize: 1 });
    const res: any = await toolByName(make({ buildFromPlan }), 'add_week_to_shopping_list').execute({}, ctx);
    expect(res).toMatchObject({ ok: true, added: 0 });
    expect(String(res.note)).toContain('از قبل');
  });

  it('fails closed (returns an error, never throws) when the service throws', async () => {
    const buildFromPlan = jest.fn().mockRejectedValue(new Error('db down'));
    const res: any = await toolByName(make({ buildFromPlan }), 'add_week_to_shopping_list').execute({}, ctx);
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
  });
});

/**
 * User-model write: record stated taste. The safety-relevant parts are (a) resolving the free name to a REAL
 * dictionary id (never a taste signal for a non-existent ingredient) and (b) it being SOFT taste, never the allergy gate.
 */
describe('AgenticWriteToolsService — set_ingredient_taste', () => {
  it('is registered in build()', () => {
    expect(make().build().map((t) => t.spec.name)).toContain('set_ingredient_taste');
  });

  it('resolves a Persian mention to a real ingredient id and records the stance', async () => {
    const findIngredients = jest.fn().mockResolvedValue([{ id: 'ing_eggplant', nameFa: 'بادمجان خام', nameEn: 'eggplant' }]);
    const correctTaste = jest.fn().mockResolvedValue({ ok: true, ingredientId: 'ing_eggplant', stance: 'dislike' });
    const res: any = await toolByName(make({ findIngredients, correctTaste }), 'set_ingredient_taste').execute({ ingredient: 'بادمجان', stance: 'dislike' }, ctx);
    expect(correctTaste).toHaveBeenCalledWith('u1', 'ing_eggplant', 'dislike'); // owner-scoped + resolved id, not the raw word
    expect(res).toMatchObject({ ok: true, action: 'set_ingredient_taste', stance: 'dislike' });
  });

  it('REFUSES an unknown ingredient — never writes a taste signal for a non-existent id', async () => {
    const findIngredients = jest.fn().mockResolvedValue([]); // nothing resolves
    const correctTaste = jest.fn();
    const res: any = await toolByName(make({ findIngredients, correctTaste }), 'set_ingredient_taste').execute({ ingredient: 'یه‌چیزِ‌نامعلوم', stance: 'like' }, ctx);
    expect(correctTaste).not.toHaveBeenCalled();
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
  });

  it('rejects an invalid stance before touching the DB', async () => {
    const findIngredients = jest.fn();
    const res: any = await toolByName(make({ findIngredients }), 'set_ingredient_taste').execute({ ingredient: 'گردو', stance: 'maybe' }, ctx);
    expect(findIngredients).not.toHaveBeenCalled();
    expect(res.error).toBeDefined();
  });
});
