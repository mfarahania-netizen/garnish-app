import { PersonalizationSignalProcessor } from './personalization.signal-processor';

// recsys audit P0-4: the in-session personalization actions must reach learning — but only claim taste when
// the ingredient resolves to a real Ingredient (honesty).
describe('PersonalizationSignalProcessor (recsys P0-4)', () => {
  let prisma: any;
  let sc: any;
  let proc: PersonalizationSignalProcessor;

  beforeEach(() => {
    prisma = {
      signalObservation: { create: jest.fn().mockResolvedValue({}) },
      ingredient: { findFirst: jest.fn() },
    };
    sc = { applyIngredientPreference: jest.fn().mockResolvedValue(undefined) };
    proc = new PersonalizationSignalProcessor(prisma, sc);
  });

  const ev = (type: string, payload: any) => ({ id: 'e1', type, payload: JSON.stringify(payload) });
  const obsNames = () => prisma.signalObservation.create.mock.calls.map((c: any) => c[0].data.signalName);

  it('portion_scaled → a routine.serving_size observation, never an ingredient signal', async () => {
    await proc.process(ev('portion_scaled', { recipeId: 'r1', servedFor: 6, baseServings: 4 }), 'u1');
    expect(obsNames()).toContain('routine.serving_size');
    expect(sc.applyIngredientPreference).not.toHaveBeenCalled();
  });

  it('ingredient_removed (RESOLVED) → soft aversion + taste.personalization', async () => {
    prisma.ingredient.findFirst.mockResolvedValue({ id: 'ing_mushroom' });
    await proc.process(ev('ingredient_removed', { recipeId: 'r1', ingredient: 'قارچ' }), 'u1');
    expect(sc.applyIngredientPreference).toHaveBeenCalledWith('u1', 'ing_mushroom', -0.2);
    expect(obsNames()).toContain('taste.personalization');
  });

  it('ingredient_removed (UNRESOLVED) → NO learning claim, observation-only', async () => {
    prisma.ingredient.findFirst.mockResolvedValue(null);
    await proc.process(ev('ingredient_removed', { ingredient: 'zzqx' }), 'u1');
    expect(sc.applyIngredientPreference).not.toHaveBeenCalled();
    expect(obsNames()).toContain('personalization_unresolved');
  });

  it('ingredient_swapped (both resolved) → from aversion + to affinity', async () => {
    prisma.ingredient.findFirst.mockImplementation((args: any) =>
      Promise.resolve(args.where.OR[0].nameFa.equals === 'کره' ? { id: 'ing_butter' } : { id: 'ing_oil' }),
    );
    await proc.process(ev('ingredient_swapped', { recipeId: 'r1', from: 'کره', to: 'روغن زیتون' }), 'u1');
    expect(sc.applyIngredientPreference).toHaveBeenCalledWith('u1', 'ing_butter', -0.2);
    expect(sc.applyIngredientPreference).toHaveBeenCalledWith('u1', 'ing_oil', 0.15);
  });
});
