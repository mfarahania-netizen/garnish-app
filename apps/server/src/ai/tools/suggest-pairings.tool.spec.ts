import { SuggestPairingsTool } from './suggest-pairings.tool';
import { BehavioralContextSnapshot, ToolContext } from '../ai-core.types';

const SNAP: BehavioralContextSnapshot = { userId: 'u1', generatedAt: 'now', schemaVersion: 1 };
const ctx: ToolContext = { userId: 'u1', snapshot: SNAP };

function makePrisma(recipes: any[], opts: { throw?: boolean } = {}) {
  return {
    recipe: {
      findMany: jest.fn(async () => {
        if (opts.throw) throw new Error('db');
        return recipes;
      }),
    },
  } as any;
}

// زعفران co-occurs with: برنج (x3), پسته (x2), گلاب (x1)
const RECIPES = [
  { id: 'r1', title: 'a', ingredients: [{ name: 'زعفران' }, { name: 'برنج' }, { name: 'پسته' }] },
  { id: 'r2', title: 'b', ingredients: [{ name: 'زعفران' }, { name: 'برنج' }, { name: 'گلاب' }] },
  { id: 'r3', title: 'c', ingredients: [{ name: 'زعفران' }, { name: 'برنج' }, { name: 'پسته' }] },
  { id: 'r4', title: 'd', ingredients: [{ name: 'سیب‌زمینی' }, { name: 'پیاز' }] },
];

describe('SuggestPairingsTool (E47-L4)', () => {
  it('ranks ingredients by FACTUAL co-occurrence across the corpus', async () => {
    const tool = new SuggestPairingsTool(makePrisma(RECIPES));
    const out: any = await tool.handler({ ingredient: 'زعفران' }, ctx);
    expect(out.resultStatus).toBe('ok');
    expect(out.baseRecipeCount).toBe(3);
    expect(out.pairings[0]).toMatchObject({ name: 'برنج', basis: 'co_occurrence', coOccurringRecipes: 3 });
    const names = out.pairings.map((p: any) => p.name);
    expect(names).toEqual(['برنج', 'پسته', 'گلاب']); // ranked by count desc
    // never the base itself
    expect(names).not.toContain('زعفران');
  });

  it('degrades to insufficient_data when the base appears in too few recipes', async () => {
    const tool = new SuggestPairingsTool(makePrisma(RECIPES));
    const out: any = await tool.handler({ ingredient: 'سیب‌زمینی' }, ctx); // only 1 recipe
    expect(out.resultStatus).toBe('insufficient_data');
    expect(out.pairings).toEqual([]);
  });

  it('supports recipeId as the base set and handles missing recipe / empty query', async () => {
    const tool = new SuggestPairingsTool(makePrisma(RECIPES));
    const byRecipe: any = await tool.handler({ recipeId: 'r1' }, ctx);
    // base = {زعفران, برنج, پسته}; co-occurring non-base across base recipes → گلاب
    expect(byRecipe.resultStatus === 'ok' || byRecipe.resultStatus === 'insufficient_data').toBe(true);
    expect((await tool.handler({ recipeId: 'nope' }, ctx) as any).resultStatus).toBe('recipe_not_found');
    expect((await tool.handler({}, ctx) as any).resultStatus).toBe('empty_query');
  });

  it('returns unavailable on DB error', async () => {
    const tool = new SuggestPairingsTool(makePrisma([], { throw: true }));
    expect((await tool.handler({ ingredient: 'زعفران' }, ctx) as any).resultStatus).toBe('unavailable');
  });
});
