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

  // The dead-assistant fix: a natural-language turn must be tokenized into content terms and OR-matched,
  // NOT searched as one literal substring (which never matches a title and dead-ends every chat turn).
  it('tokenizes a natural-language question into content terms (not a whole-string contains)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const tool = new SearchRecipesTool({ recipe: { findMany } } as any);
    await tool.handler({ query: 'با مرغ و سبزی چی بپزم؟' }, ctx);

    const where = findMany.mock.calls[0][0].where;
    const orTitles = where.OR.filter((c: any) => c.title).map((c: any) => c.title.contains);
    expect(orTitles).toContain('مرغ');
    expect(orTitles).toContain('سبزی');
    // the whole sentence is NEVER used as a search term
    expect(orTitles.some((t: string) => t.includes('بپزم'))).toBe(false);
    expect(where.isPublic).toBe(true);
    expect(where.status).toBe('active');
  });

  it('builds a NOT/exclude clause for «بدون X» so the negated ingredient is filtered out (correctness)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const tool = new SearchRecipesTool({ recipe: { findMany } } as any);
    await tool.handler({ query: 'یه غذای بدون گوشت بپز' }, ctx);
    const where = findMany.mock.calls[0][0].where;
    expect(where.AND).toBeDefined();
    const notClause = where.AND.find((c: any) => c.NOT);
    expect(notClause).toBeDefined();
    const excluded = notClause.NOT.OR.filter((c: any) => c.title).map((c: any) => c.title.contains);
    expect(excluded).toContain('گوشت'); // recipes with گوشت are excluded
  });

  it('builds a diet filter for «گیاهی»/«وگان»', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const tool = new SearchRecipesTool({ recipe: { findMany } } as any);
    await tool.handler({ query: 'یه غذای وگان' }, ctx);
    const where = findMany.mock.calls[0][0].where;
    const dietClause = where.AND.find((c: any) => c.diet);
    expect(dietClause.diet.in).toEqual(['vegan']);
  });

  it('ranks a recipe matching more query terms above one matching fewer', async () => {
    const findMany = jest.fn().mockResolvedValue([
      { id: 'one', title: 'خورش سبزی', description: null, ingredients: [{ name: 'سبزی' }] },
      { id: 'both', title: 'مرغ و سبزی', description: null, ingredients: [{ name: 'مرغ' }, { name: 'سبزی' }] },
    ]);
    const tool = new SearchRecipesTool({ recipe: { findMany } } as any);
    const out: any = await tool.handler({ query: 'مرغ و سبزی', limit: 5 }, ctx);
    expect(out.results.map((r: any) => r.id)).toEqual(['both', 'one']);
  });
});
