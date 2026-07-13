import { MealPlanSignalProcessor } from './meal-plan.signal-processor';
import { PersonalizationSignalProcessor } from './personalization.signal-processor';
import { RecipeSignalProcessor } from './recipe.signal-processor';
import { RecommendationSignalProcessor } from './recommendation.signal-processor';
import { ShoppingSignalProcessor } from './shopping.signal-processor';

const previousPersonalizationRuntime =
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

type DirectProcessor = { process(event: any, userId: string, tx: any): Promise<void> };
type DirectProcessorConstructor = new (
  prisma: any,
  signalCalculator: any,
) => DirectProcessor;

function makeHarness() {
  const dbCalls = {
    signalObservationFindFirst: jest.fn(),
    signalObservationCreate: jest.fn(),
    recommendationAttributionCreate: jest.fn(),
    recipeFindUnique: jest.fn(),
    ingredientFindFirst: jest.fn(),
    userBehaviorSignalFindUnique: jest.fn(),
    userBehaviorSignalUpdate: jest.fn(),
    userBehaviorSignalUpsert: jest.fn(),
    recipeCount: jest.fn(),
    recipeIngredientGroupBy: jest.fn(),
  };
  const calculatorCalls = {
    updateSignalInLockedTransaction: jest.fn(),
    applyNegativeFeedbackInLockedTransaction: jest.fn(),
    applyPositiveFeedbackInLockedTransaction: jest.fn(),
    applyIngredientPreferenceInLockedTransaction: jest.fn(),
  };
  const prisma = {
    signalObservation: {
      findFirst: dbCalls.signalObservationFindFirst,
      create: dbCalls.signalObservationCreate,
    },
    recommendationAttributionEvent: {
      create: dbCalls.recommendationAttributionCreate,
    },
    recipe: {
      findUnique: dbCalls.recipeFindUnique,
      count: dbCalls.recipeCount,
    },
    ingredient: { findFirst: dbCalls.ingredientFindFirst },
    userBehaviorSignal: {
      findUnique: dbCalls.userBehaviorSignalFindUnique,
      update: dbCalls.userBehaviorSignalUpdate,
      upsert: dbCalls.userBehaviorSignalUpsert,
    },
    recipeIngredient: { groupBy: dbCalls.recipeIngredientGroupBy },
  };
  return {
    prisma,
    signalCalculator: calculatorCalls,
    dbCalls,
    calculatorCalls,
  };
}

const cases: Array<[string, DirectProcessorConstructor, any]> = [
  [
    'recipe',
    RecipeSignalProcessor,
    { id: 'e-recipe', type: 'favorite_remove', payload: '{"recipeId":"r1"}' },
  ],
  [
    'recommendation',
    RecommendationSignalProcessor,
    {
      id: 'e-recommendation',
      type: 'recommendation_cook',
      payload: '{"recipeId":"r1"}',
    },
  ],
  [
    'meal-plan',
    MealPlanSignalProcessor,
    { id: 'e-meal-plan', type: 'mealplan_add', payload: '{"recipeId":"r1"}' },
  ],
  [
    'shopping',
    ShoppingSignalProcessor,
    {
      id: 'e-shopping',
      type: 'shopping_add_from_plan',
      payload: '{"added":4}',
    },
  ],
  [
    'personalization',
    PersonalizationSignalProcessor,
    {
      id: 'e-personalization',
      type: 'ingredient_swapped',
      payload: '{"from":"a","to":"b"}',
    },
  ],
];

describe('direct signal processors personalization runtime gate', () => {
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

  it.each(cases)(
    '%s processor returns before dedupe, DB IO, or signal mutation when runtime is OFF',
    async (_name, Processor, event) => {
      const harness = makeHarness();
      const processor = new Processor(harness.prisma, harness.signalCalculator);

      await expect(processor.process(event, 'u1', harness.prisma)).resolves.toBeUndefined();

      for (const call of Object.values(harness.dbCalls))
        expect(call).not.toHaveBeenCalled();
      for (const call of Object.values(harness.calculatorCalls))
        expect(call).not.toHaveBeenCalled();
    },
  );
});
