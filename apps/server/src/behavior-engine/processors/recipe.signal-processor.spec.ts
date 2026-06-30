import { RecipeSignalProcessor } from './recipe.signal-processor';

// recsys audit P0-2: favorite_remove must be a NEGATIVE signal, never a (positive-looking) views_recipe row.
describe('RecipeSignalProcessor — favorite_remove (recsys P0-2)', () => {
  let prisma: any;
  let signalCalculator: any;
  let proc: RecipeSignalProcessor;

  beforeEach(() => {
    prisma = {
      signalObservation: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
      recipe: { findUnique: jest.fn().mockResolvedValue({ diet: null, categories: [], region: 'persian', ingredients: [] }) },
    };
    signalCalculator = {
      applyPositiveFeedback: jest.fn().mockResolvedValue(undefined),
      applyNegativeFeedback: jest.fn().mockResolvedValue(undefined),
      updateSignal: jest.fn().mockResolvedValue(undefined),
    };
    proc = new RecipeSignalProcessor(prisma, signalCalculator);
  });

  const ev = (type: string) => ({ id: 'e1', type, payload: JSON.stringify({ recipeId: 'r1' }) });
  const names = () => prisma.signalObservation.create.mock.calls.map((c: any) => c[0].data.signalName);

  it('favorite_remove → applyNegativeFeedback + an unfavorited_recipe row, NEVER views_recipe', async () => {
    await proc.process(ev('favorite_remove'), 'u1');
    expect(signalCalculator.applyNegativeFeedback).toHaveBeenCalledWith('u1', 'r1', 0.3);
    expect(signalCalculator.applyPositiveFeedback).not.toHaveBeenCalled();
    expect(names()).toContain('unfavorited_recipe');
    expect(names()).not.toContain('views_recipe');
  });

  it('favorite_add still records likes_recipe + positive feedback (no regression)', async () => {
    await proc.process(ev('favorite_add'), 'u1');
    expect(signalCalculator.applyPositiveFeedback).toHaveBeenCalledWith('u1', 'r1', 0.3);
    expect(signalCalculator.applyNegativeFeedback).not.toHaveBeenCalled();
    expect(names()).toContain('likes_recipe');
  });

  it('recipe_view records views_recipe with no feedback (no regression)', async () => {
    await proc.process(ev('recipe_view'), 'u1');
    expect(signalCalculator.applyPositiveFeedback).not.toHaveBeenCalled();
    expect(signalCalculator.applyNegativeFeedback).not.toHaveBeenCalled();
    expect(names()).toContain('views_recipe');
  });

  it('P0-6: a redelivered event is skipped (alreadyConsumed → no double writes/feedback)', async () => {
    prisma.signalObservation.findFirst.mockResolvedValue({ id: 'existing' });
    await proc.process(ev('favorite_add'), 'u1');
    expect(prisma.signalObservation.create).not.toHaveBeenCalled();
    expect(signalCalculator.applyPositiveFeedback).not.toHaveBeenCalled();
  });
});
