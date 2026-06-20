import { RecipeSignalProcessor } from './recipe.signal-processor';
import { ProcessorRegistry } from '../routing/processor.registry';

// L0/C1: cooking is the strongest taste signal. Before this, `cook_complete` was dropped by the router
// (no registry entry) and the processor ignored it — so the loop never closed. These guard the fix.
function makeProcessor() {
  const created: any[] = [];
  const updated: any[] = [];
  const prisma: any = {
    recipe: { findUnique: jest.fn().mockResolvedValue({ diet: 'omnivore', categories: '[]', ingredients: [{ name: 'گوشت' }] }) },
    signalObservation: { create: jest.fn(async ({ data }: any) => { created.push(data); return data; }) },
  };
  const signalCalculator: any = { updateSignal: jest.fn(async (...a: any[]) => { updated.push(a); }) };
  return { proc: new RecipeSignalProcessor(prisma, signalCalculator), prisma, created, updated };
}

const cookEvent = { id: 'e1', type: 'cook_complete', payload: JSON.stringify({ recipeId: 'r1' }) };

describe('RecipeSignalProcessor — cook loop (L0/C1)', () => {
  it('a cook writes the heaviest observation (cooked_recipe, weight 1.5)', async () => {
    const { proc, created } = makeProcessor();
    await proc.process(cookEvent, 'u1');
    expect(created).toEqual([{ userId: 'u1', signalName: 'cooked_recipe', eventId: 'e1', weight: 1.5 }]);
  });

  it('a cook fires the taste extractor at full confidence (it never did before)', async () => {
    const { proc, updated } = makeProcessor();
    await proc.process(cookEvent, 'u1');
    // updateSignal(userId, name, dimension, type, value, confidence)
    const highProtein = updated.find((a) => a[1] === 'likes_high_protein');
    expect(highProtein).toBeDefined();
    expect(highProtein[5]).toBe(1); // cook = hard evidence → confidence 1 (favorite is 0.8, view 0.5)
  });

  it('a cook is heavier than a favorite which is heavier than a view', async () => {
    const { proc, created } = makeProcessor();
    await proc.process({ id: 'e2', type: 'favorite_add', payload: JSON.stringify({ recipeId: 'r1' }) }, 'u1');
    await proc.process({ id: 'e3', type: 'recipe_view', payload: JSON.stringify({ recipeId: 'r1' }) }, 'u1');
    const weights = created.map((c) => c.weight);
    expect(weights).toEqual([1.0, 0.5]); // favorite, view — both below the cook's 1.5
  });

  it('the router registry now routes cook_complete (was silently dropped)', () => {
    const recipeProc: any = { process: jest.fn() };
    const reg = new ProcessorRegistry(recipeProc, {} as any, {} as any, {} as any);
    expect(reg.get('cook_complete')).toBe(recipeProc);
    expect(reg.get('recipe_cooked')).toBe(recipeProc);
  });
});
