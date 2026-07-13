import { RecipeSignalProcessor } from './recipe.signal-processor';

const previousPersonalizationRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

beforeAll(() => {
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
});

afterAll(() => {
  if (previousPersonalizationRuntime === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousPersonalizationRuntime;
});

// L0/C2: a cook/favorite/view must emit a DOTTED `taste.cuisine_affinity` observation (the only shape the
// Food-DNA rebuild bridge routes into the taste dimension) carrying the typed columns. Coarse rows like
// `cooked_recipe` are dropped by that bridge, so this is what actually closes the loop into the graph.
function makeProcessor(region: string | null) {
  const created: any[] = [];
  const prisma: any = {
    recipe: { findUnique: jest.fn().mockResolvedValue({ diet: 'omnivore', categories: '[]', region, ingredients: [{ name: 'گوشت' }] }) },
    signalObservation: { create: jest.fn(async ({ data }: any) => { created.push(data); return data; }) },
  };
  const signalCalculator: any = { updateSignalInLockedTransaction: jest.fn(), applyPositiveFeedbackInLockedTransaction: jest.fn() };
  return { proc: new RecipeSignalProcessor(prisma, signalCalculator), prisma, created };
}
const ev = (type: string) => ({ id: 'e1', type, payload: JSON.stringify({ recipeId: 'r1' }) });
const cuisineRow = (created: any[]) => created.find((c) => c.signalName === 'taste.cuisine_affinity');

describe('RecipeSignalProcessor — cuisine extractor (L0/C2)', () => {
  it('a cook writes a dotted taste.cuisine_affinity row with the typed columns', async () => {
    const { proc, prisma, created } = makeProcessor('persian');
    await proc.process(ev('cook_complete'), 'u1', prisma);
    expect(cuisineRow(created)).toEqual({
      userId: 'u1', signalName: 'taste.cuisine_affinity', eventId: 'e1', weight: 1,
      recipeId: 'r1', dimension: 'taste', value: 'persian', confidence: 1, source: 'cook_complete',
    });
  });

  it('weight/confidence follow the action ladder (cook 1 > favorite 0.8 > view 0.5)', async () => {
    const cook = makeProcessor('persian'); await cook.proc.process(ev('cook_complete'), 'u1', cook.prisma);
    const fav = makeProcessor('persian'); await fav.proc.process(ev('favorite_add'), 'u1', fav.prisma);
    const view = makeProcessor('persian'); await view.proc.process(ev('recipe_view'), 'u1', view.prisma);
    expect([cuisineRow(cook.created).confidence, cuisineRow(fav.created).confidence, cuisineRow(view.created).confidence]).toEqual([1, 0.8, 0.5]);
    expect(cuisineRow(view.created).source).toBe('recipe_view');
  });

  it('region is normalized (trim + lowercase)', async () => {
    const { proc, prisma, created } = makeProcessor('  Persian  ');
    await proc.process(ev('cook_complete'), 'u1', prisma);
    expect(cuisineRow(created).value).toBe('persian');
  });

  it('no region → no cuisine row (only the coarse observation), never throws', async () => {
    const { proc, prisma, created } = makeProcessor(null);
    await proc.process(ev('cook_complete'), 'u1', prisma);
    expect(cuisineRow(created)).toBeUndefined();
    expect(created.some((c) => c.signalName === 'cooked_recipe')).toBe(true);
  });
});
