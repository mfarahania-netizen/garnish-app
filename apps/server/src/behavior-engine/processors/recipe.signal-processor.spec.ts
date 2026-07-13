import { RecipeSignalProcessor } from './recipe.signal-processor';
import { SignalCalculatorService } from '../signals/signal-calculator.service';

const previousPersonalizationRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

beforeAll(() => {
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
});

afterAll(() => {
  if (previousPersonalizationRuntime === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousPersonalizationRuntime;
});

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
      applyPositiveFeedbackInLockedTransaction: jest.fn().mockResolvedValue(undefined),
      applyNegativeFeedbackInLockedTransaction: jest.fn().mockResolvedValue(undefined),
      updateSignalInLockedTransaction: jest.fn().mockResolvedValue(undefined),
    };
    proc = new RecipeSignalProcessor(prisma, signalCalculator);
  });

  const ev = (type: string) => ({ id: 'e1', type, payload: JSON.stringify({ recipeId: 'r1' }) });
  const names = () => prisma.signalObservation.create.mock.calls.map((c: any) => c[0].data.signalName);

  it('favorite_remove → applyNegativeFeedback(-0.3) + an unfavorited_recipe row, NEVER views_recipe', async () => {
    await proc.process(ev('favorite_remove'), 'u1', prisma);
    // P0-1 (re-audit): the factor MUST be negative — a positive factor would INCREASE affinity on an unfavorite.
    expect(signalCalculator.applyNegativeFeedbackInLockedTransaction).toHaveBeenCalledWith(prisma, 'u1', 'r1', -0.3);
    expect(signalCalculator.applyPositiveFeedbackInLockedTransaction).not.toHaveBeenCalled();
    expect(names()).toContain('unfavorited_recipe');
    expect(names()).not.toContain('views_recipe');
  });

  it('SEMANTIC (P0-1): favorite_remove DECREASES a real taste signal (0.7 → 0.4), never increases it', async () => {
    // Drive the WHOLE chain with the REAL SignalCalculator (not a mock) so we assert the actual effect on
    // UserBehaviorSignal.value — the advisor's acceptance criterion. A chicken recipe at likes_chicken=0.7,
    // after favorite_remove, must end at max(0, 0.7 - 0.3) = 0.4.
    const update = jest.fn().mockResolvedValue({});
    const realPrisma: any = {
      signalObservation: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
      recipe: { findUnique: jest.fn().mockResolvedValue({ ingredients: [{ name: 'مرغ' }], categories: '[]', diet: 'omnivore' }) },
      userBehaviorSignal: { findUnique: jest.fn().mockResolvedValue({ value: 0.7, confidence: 0.6 }), update },
    };
    const realCalc = new SignalCalculatorService(realPrisma);
    const p2 = new RecipeSignalProcessor(realPrisma, realCalc);
    await p2.process(ev('favorite_remove'), 'u1', realPrisma);
    expect(update).toHaveBeenCalled();
    const arg = update.mock.calls[0][0];
    expect(arg.data.value).toBeLessThan(0.7); // DECREASED — the entire point of P0-1
    expect(arg.data.value).toBeCloseTo(0.4, 5);
  });

  it('favorite_add still records likes_recipe + positive feedback (no regression)', async () => {
    await proc.process(ev('favorite_add'), 'u1', prisma);
    expect(signalCalculator.applyPositiveFeedbackInLockedTransaction).toHaveBeenCalledWith(prisma, 'u1', 'r1', 0.3);
    expect(signalCalculator.applyNegativeFeedbackInLockedTransaction).not.toHaveBeenCalled();
    expect(names()).toContain('likes_recipe');
  });

  it('recipe_view records views_recipe with no feedback (no regression)', async () => {
    await proc.process(ev('recipe_view'), 'u1', prisma);
    expect(signalCalculator.applyPositiveFeedbackInLockedTransaction).not.toHaveBeenCalled();
    expect(signalCalculator.applyNegativeFeedbackInLockedTransaction).not.toHaveBeenCalled();
    expect(names()).toContain('views_recipe');
  });

  it('P0-6: start_cooking_click → started_cooking_recipe observation + LIGHT positive (0.2), never views/cooked', async () => {
    await proc.process(ev('start_cooking_click'), 'u1', prisma);
    expect(signalCalculator.applyPositiveFeedbackInLockedTransaction).toHaveBeenCalledWith(prisma, 'u1', 'r1', 0.2);
    expect(signalCalculator.applyNegativeFeedbackInLockedTransaction).not.toHaveBeenCalled();
    expect(names()).toContain('started_cooking_recipe');
    expect(names()).not.toContain('views_recipe');
    expect(names()).not.toContain('cooked_recipe');
  });

  it('P0-6: a redelivered event is skipped (alreadyConsumed → no double writes/feedback)', async () => {
    prisma.signalObservation.findFirst.mockResolvedValue({ id: 'existing' });
    await proc.process(ev('favorite_add'), 'u1', prisma);
    expect(prisma.signalObservation.create).not.toHaveBeenCalled();
    expect(signalCalculator.applyPositiveFeedbackInLockedTransaction).not.toHaveBeenCalled();
  });
});
