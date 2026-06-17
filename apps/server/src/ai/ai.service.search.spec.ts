import { AiService } from './ai.service';

/**
 * FIX 2 regression: the chat recipe search must match ingredient names by SUBSTRING (contains), not
 * exact equality. A query term «مرغ» has to match recipe ingredients like «ران مرغ» / «سینه مرغ».
 * The old `name: { in: ingredients }` required an exact equal → matched nothing → random fallback.
 */
describe('AiService recipe search — ingredient match uses contains, not exact `in`', () => {
  const make = () => new AiService({} as any, { get: async () => undefined, set: async () => undefined } as any);

  it('builds an ingredient clause with `contains` (substring), never `in` (exact)', () => {
    const where: any = (make() as any).buildWhereClause(['مرغ'], {}, null, []);
    // new behavior: ingredients.some.OR[].name.contains
    expect(where.ingredients?.some?.OR).toBeDefined();
    expect(Array.isArray(where.ingredients.some.OR)).toBe(true);
    expect(where.ingredients.some.OR[0].name.contains).toBe('مرغ');
    // old exact-match bug is gone
    expect(where.ingredients.some.name?.in).toBeUndefined();
  });

  it('matches each query term by contains (so «مرغ» can match «ران مرغ»)', () => {
    const where: any = (make() as any).buildWhereClause(['مرغ', 'سبزی'], {}, null, []);
    const terms = where.ingredients.some.OR.map((c: any) => c.name.contains);
    expect(terms).toEqual(expect.arrayContaining(['مرغ', 'سبزی']));
    expect(where.ingredients.some.OR.every((c: any) => 'contains' in c.name)).toBe(true);
  });
});
