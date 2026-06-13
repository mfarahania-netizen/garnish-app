import { SearchRecipesTool } from './search-recipes.tool';

const ctx = { userId: 'u1', snapshot: { userId: 'u1', generatedAt: 'now', schemaVersion: 1 } } as any;

describe('SearchRecipesTool (real, read-only)', () => {
  it('returns sanitized real recipes for a known query (visibility filter applied)', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'r1', title: 'کباب کوبیده', description: 'یک کباب خوشمزه با گوشت چرخ‌کرده' },
      { id: 'r2', title: 'خورش قیمه', description: null },
    ]);
    const tool = new SearchRecipesTool({ recipe: { findMany } } as any);
    const out: any = await tool.handler({ query: 'کباب' }, ctx);

    expect(out.resultStatus).toBe('ok');
    expect(out.results).toHaveLength(2);
    expect(out.results[0]).toEqual({
      id: 'r1',
      title: 'کباب کوبیده',
      summary: 'یک کباب خوشمزه با گوشت چرخ‌کرده',
      matchedReason: 'title_match',
    });
    // only small sanitized fields — no full recipe JSON
    expect(Object.keys(out.results[0]).sort()).toEqual(['id', 'matchedReason', 'summary', 'title']);
    // respects visibility
    expect(findMany.mock.calls[0][0].where.isPublic).toBe(true);
  });

  it('returns empty safely for an unknown query', async () => {
    const tool = new SearchRecipesTool({ recipe: { findMany: jest.fn().mockResolvedValue([]) } } as any);
    const out: any = await tool.handler({ query: 'zzqqxx-not-a-recipe' }, ctx);
    expect(out.results).toEqual([]);
    expect(out.resultStatus).toBe('no_results');
  });

  it('short-circuits a too-short query without hitting the DB', async () => {
    const findMany = jest.fn();
    const tool = new SearchRecipesTool({ recipe: { findMany } } as any);
    const out: any = await tool.handler({ query: 'a' }, ctx);
    expect(out.resultStatus).toBe('empty_query');
    expect(findMany).not.toHaveBeenCalled();
  });

  it('degrades safely if the DB query fails', async () => {
    const tool = new SearchRecipesTool({ recipe: { findMany: jest.fn().mockRejectedValue(new Error('db down')) } } as any);
    const out: any = await tool.handler({ query: 'مرغ' }, ctx);
    expect(out.results).toEqual([]);
    expect(out.resultStatus).toBe('unavailable');
  });
});
