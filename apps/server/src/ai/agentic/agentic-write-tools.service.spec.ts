import { AgenticWriteToolsService } from './agentic-write-tools.service';

const ctx = { userId: 'u1', snapshot: {} } as any;
const toolByName = (svc: AgenticWriteToolsService, name: string) => svc.build().find((t) => t.spec.name === name)!;

/**
 * The flagship workflow tool: build the shopping list from the WHOLE week plan in one deterministic call.
 * It is a thin wrapper over ShoppingListService.buildFromPlan (which owns aggregation/scaling/de-dupe) — these
 * tests pin the wrapper's contract: owner-scoped call, the three buildFromPlan outcomes, and fail-closed.
 */
describe('AgenticWriteToolsService — add_week_to_shopping_list', () => {
  const make = (buildFromPlan: jest.Mock) =>
    new AgenticWriteToolsService({} as any, {} as any, { buildFromPlan } as any, {} as any);

  it('is registered in build()', () => {
    expect(make(jest.fn()).build().map((t) => t.spec.name)).toContain('add_week_to_shopping_list');
  });

  it('builds from the current-user week plan and reports the added count', async () => {
    const buildFromPlan = jest.fn().mockResolvedValue({ resultStatus: 'ok', added: 12, merged: 3, householdSize: 2 });
    const res: any = await toolByName(make(buildFromPlan), 'add_week_to_shopping_list').execute({}, ctx);
    expect(buildFromPlan).toHaveBeenCalledWith('u1'); // owner-scoped — never another user's plan
    expect(res).toMatchObject({ ok: true, action: 'add_week_to_shopping_list', added: 12 });
  });

  it('asks the user to plan first when the week is empty (no_plan → error, no ok)', async () => {
    const buildFromPlan = jest.fn().mockResolvedValue({ resultStatus: 'no_plan', added: 0, merged: 0, flagged: 0, items: [] });
    const res: any = await toolByName(make(buildFromPlan), 'add_week_to_shopping_list').execute({}, ctx);
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
  });

  it('reports a no-op (added 0) as already-up-to-date, NOT an error', async () => {
    const buildFromPlan = jest.fn().mockResolvedValue({ resultStatus: 'ok', added: 0, merged: 0, householdSize: 1 });
    const res: any = await toolByName(make(buildFromPlan), 'add_week_to_shopping_list').execute({}, ctx);
    expect(res).toMatchObject({ ok: true, added: 0 });
    expect(String(res.note)).toContain('از قبل');
  });

  it('fails closed (returns an error, never throws) when the service throws', async () => {
    const buildFromPlan = jest.fn().mockRejectedValue(new Error('db down'));
    const res: any = await toolByName(make(buildFromPlan), 'add_week_to_shopping_list').execute({}, ctx);
    expect(res.error).toBeDefined();
    expect(res.ok).toBeUndefined();
  });
});
