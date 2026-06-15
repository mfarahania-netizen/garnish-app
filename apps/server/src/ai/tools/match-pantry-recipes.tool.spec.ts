import { MatchPantryRecipesTool } from './match-pantry-recipes.tool';
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

const RECIPES = [
  { id: 'r1', title: 'املت', ingredients: [{ name: 'تخم‌مرغ' }, { name: 'گوجه' }, { name: 'نمک' }] },
  { id: 'r2', title: 'خورش قیمه', ingredients: [{ name: 'گوشت' }, { name: 'لپه' }, { name: 'سیب‌زمینی' }, { name: 'گوجه' }] },
  { id: 'r3', title: 'سالاد', ingredients: [{ name: 'کاهو' }, { name: 'گوجه' }] },
];

describe('MatchPantryRecipesTool (E47-L4)', () => {
  it('ranks recipes by ingredient overlap and shows matched + missing', async () => {
    const tool = new MatchPantryRecipesTool(makePrisma(RECIPES));
    const out: any = await tool.handler({ have: ['تخم‌مرغ', 'گوجه', 'نمک'] }, ctx);
    expect(out.resultStatus).toBe('ok');
    // املت: 3/3 matched (best coverage) should rank first
    expect(out.matches[0].recipeId).toBe('r1');
    expect(out.matches[0].coveragePct).toBe(100);
    expect(out.matches[0].missing).toEqual([]);
    // every match explains matched + missing, grounded in real recipe ingredients
    const salad = out.matches.find((m: any) => m.recipeId === 'r3');
    expect(salad.matched).toEqual(['گوجه']);
    expect(salad.missing).toEqual(['کاهو']);
  });

  it('degrades to empty_pantry when no ingredients given', async () => {
    const tool = new MatchPantryRecipesTool(makePrisma(RECIPES));
    expect((await tool.handler({ have: [] }, ctx) as any).resultStatus).toBe('empty_pantry');
  });

  it('degrades to no_match when nothing overlaps (never invents a recipe)', async () => {
    const tool = new MatchPantryRecipesTool(makePrisma(RECIPES));
    const out: any = await tool.handler({ have: ['موز'] }, ctx);
    expect(out.resultStatus).toBe('no_match');
    expect(out.matches).toEqual([]);
  });

  it('respects the limit and returns unavailable on DB error', async () => {
    const tool = new MatchPantryRecipesTool(makePrisma(RECIPES));
    const out: any = await tool.handler({ have: ['گوجه'], limit: 1 }, ctx);
    expect(out.matches).toHaveLength(1);
    const tool2 = new MatchPantryRecipesTool(makePrisma([], { throw: true }));
    expect((await tool2.handler({ have: ['گوجه'] }, ctx) as any).resultStatus).toBe('unavailable');
  });
});
