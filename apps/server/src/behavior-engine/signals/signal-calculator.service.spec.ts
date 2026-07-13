import { SignalCalculatorService } from './signal-calculator.service';

const previousPersonalizationRuntime =
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

function makeHarness() {
  const calls = {
    behaviorFindUnique: jest.fn(),
    behaviorUpdate: jest.fn(),
    behaviorUpsert: jest.fn(),
    recipeFindUnique: jest.fn(),
    recipeCount: jest.fn(),
    recipeIngredientGroupBy: jest.fn(),
  };
  const prisma = {
    userBehaviorSignal: {
      findUnique: calls.behaviorFindUnique,
      update: calls.behaviorUpdate,
      upsert: calls.behaviorUpsert,
    },
    recipe: { findUnique: calls.recipeFindUnique, count: calls.recipeCount },
    recipeIngredient: { groupBy: calls.recipeIngredientGroupBy },
  };
  return { service: new SignalCalculatorService(prisma as any), calls, tx: prisma };
}

describe('SignalCalculatorService personalization runtime gate', () => {
  beforeEach(() => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  });

  afterAll(() => {
    if (previousPersonalizationRuntime === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED =
        previousPersonalizationRuntime;
  });

  const expectNoDbCalls = (calls: ReturnType<typeof makeHarness>['calls']) => {
    for (const call of Object.values(calls))
      expect(call).not.toHaveBeenCalled();
  };

  it('updateSignal returns null and performs zero DB IO when runtime is OFF', async () => {
    const { service, calls } = makeHarness();
    await expect(
      service.updateSignal('u1', 'likes_stew', 'taste', 'behavior', 0.7, 1),
    ).resolves.toBeNull();
    expectNoDbCalls(calls);
  });

  it('applyNegativeFeedback performs zero recipe reads or signal writes when runtime is OFF', async () => {
    const { service, calls } = makeHarness();
    await expect(
      service.applyNegativeFeedback('u1', 'r1', -0.5),
    ).resolves.toBeUndefined();
    expectNoDbCalls(calls);
  });

  it('applyPositiveFeedback performs zero recipe/corpus reads or signal writes when runtime is OFF', async () => {
    const { service, calls } = makeHarness();
    await expect(
      service.applyPositiveFeedback('u1', 'r1', 0.5),
    ).resolves.toBeUndefined();
    expectNoDbCalls(calls);
  });

  it('applyIngredientPreference performs zero signal reads or writes when runtime is OFF', async () => {
    const { service, calls } = makeHarness();
    await expect(
      service.applyIngredientPreference('u1', 'ing_1', 0.2),
    ).resolves.toBeUndefined();
    expectNoDbCalls(calls);
  });

  it('locked reuse method writes through the supplied tx without opening a nested boundary', async () => {
    const { service, calls, tx } = makeHarness();
    calls.behaviorFindUnique.mockResolvedValue(null);
    calls.behaviorUpsert.mockResolvedValue({ id: 'signal' });

    await expect(service.updateSignalInLockedTransaction(
      tx as any,
      'u1',
      'likes_stew',
      'taste',
      'behavior',
      0.7,
      1,
    )).resolves.toEqual({ id: 'signal' });
    expect(calls.behaviorFindUnique).toHaveBeenCalledTimes(1);
    expect(calls.behaviorUpsert).toHaveBeenCalledTimes(1);
  });
});
