import { RecipeSignalProcessor } from './recipe.signal-processor';
import { ProcessorRegistry } from '../routing/processor.registry';

const previousPersonalizationRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

beforeAll(() => {
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
});

afterAll(() => {
  if (previousPersonalizationRuntime === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousPersonalizationRuntime;
});

// L0/C1: cooking is the strongest taste signal. Before this, `cook_complete` was dropped by the router
// (no registry entry) and the processor ignored it — so the loop never closed. These guard the fix.
function makeProcessor() {
  const created: any[] = [];
  const updated: any[] = [];
  const prisma: any = {
    recipe: { findUnique: jest.fn().mockResolvedValue({ diet: 'omnivore', categories: '[]', ingredients: [{ name: 'گوشت' }] }) },
    signalObservation: { create: jest.fn(async ({ data }: any) => { created.push(data); return data; }) },
  };
  const feedback: any[] = [];
  const signalCalculator: any = {
    updateSignalInLockedTransaction: jest.fn(async (_tx: any, ...a: any[]) => { updated.push(a); }),
    applyPositiveFeedbackInLockedTransaction: jest.fn(async (_tx: any, ...a: any[]) => { feedback.push(a); }),
  };
  return { proc: new RecipeSignalProcessor(prisma, signalCalculator), prisma, created, updated, feedback };
}

const cookEvent = { id: 'e1', type: 'cook_complete', payload: JSON.stringify({ recipeId: 'r1' }) };

describe('RecipeSignalProcessor — cook loop (L0/C1)', () => {
  it('a cook writes the heaviest observation (cooked_recipe, weight 1.5)', async () => {
    const { proc, created } = makeProcessor();
    await proc.process(cookEvent, 'u1', (proc as any).prisma);
    expect(created).toEqual([{ userId: 'u1', signalName: 'cooked_recipe', eventId: 'e1', weight: 1.5 }]);
  });

  it('a cook fires the taste extractor at full confidence (it never did before)', async () => {
    const { proc, prisma, updated } = makeProcessor();
    await proc.process(cookEvent, 'u1', prisma);
    // updateSignal(userId, name, dimension, type, value, confidence)
    const highProtein = updated.find((a) => a[1] === 'likes_high_protein');
    expect(highProtein).toBeDefined();
    expect(highProtein[5]).toBe(1); // cook = hard evidence → confidence 1 (favorite is 0.8, view 0.5)
  });

  it('a cook is heavier than a favorite which is heavier than a view', async () => {
    const { proc, prisma, created } = makeProcessor();
    await proc.process({ id: 'e2', type: 'favorite_add', payload: JSON.stringify({ recipeId: 'r1' }) }, 'u1', prisma);
    await proc.process({ id: 'e3', type: 'recipe_view', payload: JSON.stringify({ recipeId: 'r1' }) }, 'u1', prisma);
    const weights = created.map((c) => c.weight);
    expect(weights).toEqual([1.0, 0.5]); // favorite, view — both below the cook's 1.5
  });

  // EXIT-GATE clause 1: a cook must feed dish-type/ingredient taste signals (likes_stew, …) into the
  // ranker's feature vector — via applyPositiveFeedback — so "cook N stews → stews rank up" becomes real.
  it('a cook fires applyPositiveFeedback (dish-type taste signals) stronger than a favorite; a view does not', async () => {
    const cook = makeProcessor();
    await cook.proc.process(cookEvent, 'u1', cook.prisma);
    expect(cook.feedback).toEqual([['u1', 'r1', 0.5]]); // cook → factor 0.5

    const fav = makeProcessor();
    await fav.proc.process({ id: 'e2', type: 'favorite_add', payload: JSON.stringify({ recipeId: 'r1' }) }, 'u1', fav.prisma);
    expect(fav.feedback).toEqual([['u1', 'r1', 0.3]]); // favorite → weaker factor

    const view = makeProcessor();
    await view.proc.process({ id: 'e3', type: 'recipe_view', payload: JSON.stringify({ recipeId: 'r1' }) }, 'u1', view.prisma);
    expect(view.feedback).toEqual([]); // a view is too weak for a taste commitment
  });

  it('the router registry now routes cook_complete (was silently dropped)', () => {
    const recipeProc: any = { process: jest.fn() };
    const reg = new ProcessorRegistry(recipeProc, {} as any, {} as any, {} as any, {} as any);
    expect(reg.get('cook_complete')).toBe(recipeProc);
    expect(reg.get('recipe_cooked')).toBe(recipeProc);
  });
});
