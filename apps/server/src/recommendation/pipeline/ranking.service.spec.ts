import { RankingService } from './ranking.service';
import { buildRealTimeContext } from '../../context/real-time-context';

describe('RankingService', () => {
  let prisma: any;
  let featureStore: any;
  let contributionCalculator: any;
  let experimentEngine: any;
  let exposureTracking: any;
  let tasteAffinityBuilder: any;
  let recipeEmbedding: any;
  let service: RankingService;

  beforeEach(() => {
    prisma = {
      recipe: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'protein-bowl',
            title: 'High Protein Post Workout Bowl',
            cookingTime: 20,
            difficulty: 'easy',
            cost: 'medium',
            diet: 'omnivore',
            mealType: 'lunch',
            servings: 4,
            categories: '["healthy","protein"]',
            createdAt: new Date('2026-06-01'),
            ingredients: [{ name: 'chicken breast' }, { name: 'rice' }],
            searchTerms: [{ term: 'protein' }, { term: 'post workout' }],
          },
          {
            id: 'budget-pasta',
            title: 'Budget Pasta',
            cookingTime: 20,
            difficulty: 'easy',
            cost: 'low',
            diet: 'vegetarian',
            mealType: 'dinner',
            servings: 2,
            categories: '["budget","quick"]',
            createdAt: new Date('2026-05-15'),
            ingredients: [{ name: 'pasta' }, { name: 'tomato' }],
            searchTerms: [{ term: 'cheap' }],
          },
          {
            id: 'family-stew',
            title: 'Family Stew',
            cookingTime: 110,
            difficulty: 'medium',
            cost: 'low',
            diet: 'omnivore',
            mealType: 'dinner',
            servings: 6,
            categories: '["family","stew"]',
            createdAt: new Date('2025-12-20'),
            ingredients: [{ name: 'beef' }, { name: 'potato' }],
            searchTerms: [{ term: 'family' }],
          },
        ]),
      },
      userEvent: {
        count: jest.fn().mockResolvedValue(0),
      },
      favoriteRecipe: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    featureStore = {
      getFeatureVector: jest.fn(),
    };

    contributionCalculator = {
      calculate: jest.fn((scores) => scores),
    };

    experimentEngine = {
      getWeights: jest.fn().mockResolvedValue(null),
    };

    exposureTracking = {
      getPenalty: jest.fn().mockResolvedValue(0),
    };
    tasteAffinityBuilder = {
      build: jest.fn().mockReturnValue({ score: 0.7, matchedSignals: ['likes_high_protein'] }),
    };
    recipeEmbedding = {
      buildEmbedding: jest.fn().mockReturnValue([0.5, 0.5, 0, 0]),
    };

    service = new RankingService(
      prisma,
      featureStore,
      contributionCalculator,
      experimentEngine,
      exposureTracking,
      tasteAffinityBuilder,
      recipeEmbedding,
    );
  });

  it('ranks a fitness user differently from a budget/time-poor user', async () => {
    featureStore.getFeatureVector.mockResolvedValueOnce({
      signal_likes_high_protein: 0.95,
      signal_goal_adherence: 0.8,
      signal_meal_planner: 0.7,
      signal_weight_loss: 0.4,
    });

    const fitnessRank = await service.rank('fitness-user', [
      'protein-bowl',
      'budget-pasta',
      'family-stew',
    ]);

    featureStore.getFeatureVector.mockResolvedValueOnce({
      signal_time_poor: 0.95,
      signal_budget_sensitive: 0.85,
      signal_cooking_novice: 0.6,
    });

    const budgetRank = await service.rank('budget-user', [
      'protein-bowl',
      'budget-pasta',
      'family-stew',
    ]);

    expect(fitnessRank[0].recipeId).toBe('protein-bowl');
    expect(budgetRank[0].recipeId).toBe('budget-pasta');
    expect(fitnessRank[0].recipeId).not.toBe(budgetRank[0].recipeId);
    expect(fitnessRank[0].matchedSignals).toEqual(
      expect.arrayContaining(['likes_high_protein', 'meal_planner']),
    );
    // FI-PHASE-2.2: the time-poor user's effort preference now surfaces via the dedicated effortFit
    // ('effort_fit'), not behaviorFit's old 'time_poor' bit — effort is scored once.
    expect(budgetRank[0].matchedSignals).toEqual(
      expect.arrayContaining(['effort_fit', 'budget_sensitive']),
    );
  });

  // L0 EXIT GATE (clause 2): "recs differ by time-of-day/season". SAME candidate + SAME features —
  // only the real-time context changes → the ranking must change, and no-context must stay neutral.
  it('the same stew ranks higher on a winter dinner than a summer breakfast; no context is neutral', async () => {
    featureStore.getFeatureVector.mockResolvedValue({}); // identical neutral taste → isolate the context effect
    const ids = ['family-stew'];
    const winterDinner = buildRealTimeContext(new Date('2026-01-15T20:00:00+03:30')); // دی، شام
    const summerBreakfast = buildRealTimeContext(new Date('2026-07-15T08:00:00+03:30')); // تیر، صبحانه

    const score = async (ctx?: any) => (await service.rank('u1', ids, ctx)).find((r: any) => r.recipeId === 'family-stew')!.finalScore;
    const stewWinter = await score(winterDinner);
    const stewSummer = await score(summerBreakfast);
    const stewNoCtx = await score();

    expect(stewWinter).toBeGreaterThan(stewSummer); // a winter dinner lifts the stew (the gate)
    expect(stewWinter).toBeGreaterThan(stewNoCtx); // the boost is real
    expect(stewNoCtx).toBe(stewSummer); // no context == neutral (summer breakfast earned no boost either)
  });

  it('re-ranks to avoid a mono-diet top list', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      {
        id: 'a',
        title: 'Protein Bowl 1',
        cookingTime: 20,
        difficulty: 'easy',
        cost: 'medium',
        diet: 'omnivore',
        mealType: 'lunch',
        servings: 2,
        categories: '["protein"]',
        createdAt: new Date('2026-06-01'),
        ingredients: [{ name: 'chicken' }],
        searchTerms: [{ term: 'protein' }],
      },
      {
        id: 'b',
        title: 'Protein Bowl 2',
        cookingTime: 22,
        difficulty: 'easy',
        cost: 'medium',
        diet: 'omnivore',
        mealType: 'lunch',
        servings: 2,
        categories: '["protein"]',
        createdAt: new Date('2026-06-01'),
        ingredients: [{ name: 'chicken' }],
        searchTerms: [{ term: 'protein' }],
      },
      {
        id: 'c',
        title: 'Protein Bowl 3',
        cookingTime: 24,
        difficulty: 'easy',
        cost: 'medium',
        diet: 'omnivore',
        mealType: 'lunch',
        servings: 2,
        categories: '["protein"]',
        createdAt: new Date('2026-06-01'),
        ingredients: [{ name: 'chicken' }],
        searchTerms: [{ term: 'protein' }],
      },
    ]);

    featureStore.getFeatureVector.mockResolvedValue({
      signal_likes_high_protein: 1,
      signal_goal_adherence: 1,
    });

    const ranked = await service.rank('fitness-user', ['a', 'b', 'c']);

    // mealType is a parsed list (string[]) per item — compare by value, not by array reference,
    // to assert the top list stays mono-mealType (all 'lunch').
    expect(new Set(ranked.map((item) => JSON.stringify(item.mealType))).size).toBe(1);
    expect(ranked[0].finalScore).toBeGreaterThanOrEqual(ranked[1].finalScore);
    expect(ranked[1].finalScore).toBeGreaterThanOrEqual(ranked[2].finalScore);
  });

  it('uses the taste affinity builder output in ranking signals', async () => {
    featureStore.getFeatureVector.mockResolvedValue({
      signal_likes_high_protein: 1,
    });

    await service.rank('fitness-user', ['protein-bowl']);

    expect(tasteAffinityBuilder.build).toHaveBeenCalled();
  });
});
