import { ExplainRecipeStepTool } from './explain-recipe-step.tool';
import { BehavioralContextSnapshot, ToolContext } from '../ai-core.types';

const SNAP: BehavioralContextSnapshot = { userId: 'u1', generatedAt: 'now', schemaVersion: 1 };
const ctx: ToolContext = { userId: 'u1', snapshot: SNAP };

function makePrisma(recipe: any, opts: { throw?: boolean } = {}) {
  return {
    recipe: {
      // tool now uses findFirst (filters status:'active'+isPublic in the where — published-only)
      findFirst: jest.fn(async () => {
        if (opts.throw) throw new Error('db');
        return recipe;
      }),
    },
  } as any;
}

const RECIPE = {
  id: 'r1',
  title: 'کباب کوبیده',
  tips: '["گوشت را خوب ورز بده"]',
  tools: '["سیخ","منقل"]',
  steps: [
    { order: 1, title: 'آماده‌سازی', instruction: 'گوشت و پیاز را چرخ کن.', duration: 10 },
    { order: 2, title: 'ورز دادن', instruction: 'مخلوط را ۱۰ دقیقه ورز بده تا چسبناک شود.', duration: 10 },
    { order: 3, title: 'پخت', instruction: 'روی منقل کباب کن.', duration: 15 },
  ],
};

describe('ExplainRecipeStepTool (E47-L4)', () => {
  it('returns an overview (step count + titles + tips/tools) when no step given', async () => {
    const tool = new ExplainRecipeStepTool(makePrisma(RECIPE));
    const out: any = await tool.handler({ recipeId: 'r1' }, ctx);
    expect(out.resultStatus).toBe('ok');
    expect(out.stepCount).toBe(3);
    expect(out.steps.map((s: any) => s.title)).toEqual(['آماده‌سازی', 'ورز دادن', 'پخت']);
    expect(out.tips).toEqual(['گوشت را خوب ورز بده']);
    expect(out.tools).toEqual(['سیخ', 'منقل']);
  });

  it('explains a specific step VERBATIM from the recipe data (never invented)', async () => {
    const tool = new ExplainRecipeStepTool(makePrisma(RECIPE));
    const out: any = await tool.handler({ recipeId: 'r1', step: 2 }, ctx);
    expect(out.resultStatus).toBe('ok');
    expect(out.step).toBe(2);
    expect(out.instruction).toBe('مخلوط را ۱۰ دقیقه ورز بده تا چسبناک شود.'); // exact data, no invention
    expect(out.durationMinutes).toBe(10);
  });

  it('degrades: step_out_of_range / recipe_not_found / no_steps', async () => {
    const t1 = new ExplainRecipeStepTool(makePrisma(RECIPE));
    expect((await t1.handler({ recipeId: 'r1', step: 9 }, ctx) as any).resultStatus).toBe('step_out_of_range');
    const t2 = new ExplainRecipeStepTool(makePrisma(null));
    expect((await t2.handler({ recipeId: 'missing' }, ctx) as any).resultStatus).toBe('recipe_not_found');
    const t3 = new ExplainRecipeStepTool(makePrisma({ ...RECIPE, steps: [] }));
    expect((await t3.handler({ recipeId: 'r1' }, ctx) as any).resultStatus).toBe('no_steps');
  });

  it('returns unavailable on DB error and empty_query without a recipeId', async () => {
    const t1 = new ExplainRecipeStepTool(makePrisma(RECIPE, { throw: true }));
    expect((await t1.handler({ recipeId: 'r1' }, ctx) as any).resultStatus).toBe('unavailable');
    const t2 = new ExplainRecipeStepTool(makePrisma(RECIPE));
    expect((await t2.handler({}, ctx) as any).resultStatus).toBe('empty_query');
  });
});
