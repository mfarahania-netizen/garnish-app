import { RankingService } from './ranking.service';
import { buildRealTimeContext } from '../../context/real-time-context';
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../consent/consent.constants';
import { makeP0ATransactionBoundaryPrisma } from '../../test-support/p0-a-epoch-fixture';
import { onboardingV2Features } from '../../onboarding/onboarding-v2.features';

describe('RankingService', () => {
  const epoch = new Date('2099-07-01T00:00:00.000Z');
  let prisma: any;
  let featureStore: any;
  let contributionCalculator: any;
  let experimentEngine: any;
  let exposureTracking: any;
  let tasteAffinityBuilder: any;
  let recipeEmbedding: any;
  let consent: any;
  let tx: any;
  let service: RankingService;

  beforeEach(() => {
    const delegates = {
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
        create: jest.fn(),
      },
      userFeatureVector: {
        findUnique: jest.fn().mockResolvedValue({
          updatedAt: new Date('2099-07-01T00:01:00.000Z'),
        }),
      },
      onboardingProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    ({ prisma, tx } = makeP0ATransactionBoundaryPrisma(delegates, 'u1',
      ['analytics', 'personalization'].map((purpose) => ({
        id: `${purpose}-grant`, userId: 'u1', purpose, status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: epoch,
      })),
    ));

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
      getPenalties: jest.fn().mockResolvedValue(new Map()),
    };
    tasteAffinityBuilder = {
      build: jest.fn().mockReturnValue({ score: 0.7, matchedSignals: ['likes_high_protein'] }),
    };
    recipeEmbedding = {
      buildEmbedding: jest.fn().mockReturnValue([0.5, 0.5, 0, 0]),
    };
    consent = { currentGrantEpoch: jest.fn().mockResolvedValue(epoch) };
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';

    service = new RankingService(
      prisma,
      featureStore,
      contributionCalculator,
      experimentEngine,
      exposureTracking,
      tasteAffinityBuilder,
      recipeEmbedding,
      consent,
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

  it('ranks an under-15-minute recipe above a slow peer on the first post-onboarding slate', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'quick', title: 'Quick', cookingTime: 10, difficulty: 'easy', diet: 'omnivore', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-07-01'), ingredients: [], searchTerms: [] },
      { id: 'slow', title: 'Slow', cookingTime: 90, difficulty: 'easy', diet: 'omnivore', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-07-01'), ingredients: [], searchTerms: [] },
    ]);
    featureStore.getFeatureVector.mockResolvedValue(onboardingV2Features({
      schemaVersion: 2,
      completedAt: new Date(),
      weekdayTimeBucket: 'under_15',
      likedRecipeIds: [],
      dislikedRecipeIds: [],
    }, true));
    tasteAffinityBuilder.build.mockReturnValue({ score: 0.5, matchedSignals: [] });
    const ranked = await service.rank('new-user', ['quick', 'slow']);
    const quick = ranked.find((r) => r.recipeId === 'quick') as any;
    const slow = ranked.find((r) => r.recipeId === 'slow') as any;
    expect(ranked[0].recipeId).toBe('quick');
    expect(quick.scores.effortFit).toBeGreaterThan(slow.scores.effortFit);
  });

  it('uses V2 taste calibration immediately without creating a FavoriteRecipe', async () => {
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'liked', title: 'Liked', imageUrl: '/media/liked.webp', cookingTime: 20, difficulty: 'easy', diet: 'omnivore', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-07-01'), ingredients: [], searchTerms: [] },
      { id: 'disliked', title: 'Disliked', cookingTime: 20, difficulty: 'easy', diet: 'omnivore', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-07-01'), ingredients: [], searchTerms: [] },
    ]);
    featureStore.getFeatureVector.mockResolvedValue(onboardingV2Features({
      schemaVersion: 2,
      completedAt: new Date(),
      weekdayTimeBucket: '30_60',
      likedRecipeIds: ['liked'],
      dislikedRecipeIds: ['disliked'],
    }, true));
    tasteAffinityBuilder.build.mockReturnValue({ score: 0.5, matchedSignals: [] });
    const ranked = await service.rank('new-user', ['liked', 'disliked']);
    const disliked = ranked.find((r) => r.recipeId === 'disliked') as any;
    expect(ranked[0].recipeId).toBe('liked');
    expect(ranked[0].imageUrl).toBe('/media/liked.webp');
    expect(ranked[0].matchedSignals).toContain('onboarding_taste_like');
    expect(ranked[0].scores.tasteAffinity).toBe(0.66);
    expect(disliked.matchedSignals).toContain('onboarding_taste_dislike');
    expect(disliked.scores.tasteAffinity).toBe(0.26);
    expect(prisma.favoriteRecipe.create).not.toHaveBeenCalled();
  });

  describe('live onboarding declarations under independent consent purposes', () => {
    const profile = (overrides: Record<string, unknown> = {}) => ({
      schemaVersion: 2,
      completedAt: new Date('2099-06-30T10:00:00.000Z'),
      weekdayTimeBucket: 'under_15',
      likedRecipeIds: ['liked'],
      dislikedRecipeIds: ['disliked'],
      ...overrides,
    });
    const recipes = [
      { id: 'quick', title: 'Quick', cookingTime: 10, difficulty: 'easy', diet: 'omnivore', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-07-01'), ingredients: [], searchTerms: [] },
      { id: 'slow', title: 'Slow', cookingTime: 90, difficulty: 'easy', diet: 'omnivore', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-07-01'), ingredients: [], searchTerms: [] },
      { id: 'liked', title: 'Liked', cookingTime: 20, difficulty: 'easy', diet: 'omnivore', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-07-01'), ingredients: [], searchTerms: [] },
      { id: 'disliked', title: 'Disliked', cookingTime: 20, difficulty: 'easy', diet: 'omnivore', mealType: 'dinner', servings: 2, categories: '[]', createdAt: new Date('2026-07-01'), ingredients: [], searchTerms: [] },
    ];
    const setConsent = (analytics: boolean, personalization: boolean) => {
      consent.currentGrantEpoch.mockImplementation(async (_userId: string, purposes: string[]) => {
        if (purposes.length === 1 && purposes[0] === 'personalization') {
          return personalization ? epoch : null;
        }
        return analytics && personalization ? epoch : null;
      });
    };

    beforeEach(() => {
      prisma.recipe.findMany.mockResolvedValue(recipes);
      prisma.onboardingProfile.findUnique.mockResolvedValue(profile());
      tasteAffinityBuilder.build.mockReturnValue({ score: 0.5, matchedSignals: [] });
    });

    it('uses completed core time for effort with neither analytics nor personalization', async () => {
      setConsent(false, false);

      const ranked = await service.rank('u1', ['quick', 'slow']);
      const quick = ranked.find((item) => item.recipeId === 'quick')!;
      const slow = ranked.find((item) => item.recipeId === 'slow')!;

      expect(quick.scores.effortFit).toBeGreaterThan(slow.scores.effortFit);
      expect(quick.matchedSignals).toContain('effort_fit');
      expect(ranked.flatMap((item) => item.matchedSignals)).not.toContain('onboarding_taste_like');
      expect(featureStore.getFeatureVector).not.toHaveBeenCalled();
      expect(experimentEngine.getWeights).not.toHaveBeenCalled();
      expect(exposureTracking.getPenalties).not.toHaveBeenCalled();
      expect(prisma.onboardingProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: {
          schemaVersion: true,
          completedAt: true,
          weekdayTimeBucket: true,
        },
      });
    });

    it('uses declared taste with personalization granted even when analytics is absent', async () => {
      setConsent(false, true);

      const ranked = await service.rank('u1', ['liked', 'disliked']);
      const liked = ranked.find((item) => item.recipeId === 'liked')!;
      const disliked = ranked.find((item) => item.recipeId === 'disliked')!;

      expect(liked.scores.tasteAffinity).toBeGreaterThan(disliked.scores.tasteAffinity);
      expect(liked.matchedSignals).toContain('onboarding_taste_like');
      expect(disliked.matchedSignals).toContain('onboarding_taste_dislike');
      expect(featureStore.getFeatureVector).not.toHaveBeenCalled();
      expect(prisma.userEvent.count).not.toHaveBeenCalled();
      expect(exposureTracking.getPenalties).not.toHaveBeenCalled();
      expect(prisma.onboardingProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: expect.objectContaining({ likedRecipeIds: true, dislikedRecipeIds: true }),
      });
    });

    it('fails closed on a concurrent personalization withdrawal while retaining core time', async () => {
      prisma.onboardingProfile.findUnique.mockResolvedValue(profile({ likedRecipeIds: ['slow'], dislikedRecipeIds: [] }));
      let personalizationReads = 0;
      consent.currentGrantEpoch.mockImplementation(async (_userId: string, purposes: string[]) => {
        if (purposes.length !== 1) return null;
        personalizationReads += 1;
        return personalizationReads <= 2 ? epoch : null;
      });

      const ranked = await service.rank('u1', ['quick', 'slow']);
      const quick = ranked.find((item) => item.recipeId === 'quick')!;
      const slow = ranked.find((item) => item.recipeId === 'slow')!;

      expect(personalizationReads).toBe(3);
      expect(quick.scores.effortFit).toBeGreaterThan(slow.scores.effortFit);
      expect(slow.matchedSignals).not.toContain('onboarding_taste_like');
      expect(slow.scores.tasteAffinity).toBe(quick.scores.tasteAffinity);
      expect(featureStore.getFeatureVector).not.toHaveBeenCalled();
      expect(prisma.onboardingProfile.findUnique).toHaveBeenLastCalledWith({
        where: { userId: 'u1' },
        select: {
          schemaVersion: true,
          completedAt: true,
          weekdayTimeBucket: true,
        },
      });
    });

    it('does not use taste for analytics-only consent but still applies core time', async () => {
      setConsent(true, false);

      const ranked = await service.rank('u1', ['quick', 'slow', 'liked']);
      const quick = ranked.find((item) => item.recipeId === 'quick')!;
      const slow = ranked.find((item) => item.recipeId === 'slow')!;
      const liked = ranked.find((item) => item.recipeId === 'liked')!;

      expect(quick.scores.effortFit).toBeGreaterThan(slow.scores.effortFit);
      expect(liked.matchedSignals).not.toContain('onboarding_taste_like');
      expect(featureStore.getFeatureVector).not.toHaveBeenCalled();
      expect(exposureTracking.getPenalties).not.toHaveBeenCalled();
      expect(prisma.onboardingProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        select: {
          schemaVersion: true,
          completedAt: true,
          weekdayTimeBucket: true,
        },
      });
    });
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
    for (const [args] of prisma.userEvent.count.mock.calls) {
      expect(args.where.consentPurpose).toEqual({ in: ['analytics', 'personalization'] });
    }
  });

  it('withdrawal cold-ranks without feature-vector, experiment, or exposure-history reads', async () => {
    consent.currentGrantEpoch.mockResolvedValue(null);

    await service.rank('withdrawn-user', ['protein-bowl']);

    expect(featureStore.getFeatureVector).not.toHaveBeenCalled();
    expect(experimentEngine.getWeights).not.toHaveBeenCalled();
    expect(exposureTracking.getPenalties).not.toHaveBeenCalled();
    expect(prisma.userEvent.count).not.toHaveBeenCalled();
    expect(prisma.favoriteRecipe.count).not.toHaveBeenCalled();
    expect(tasteAffinityBuilder.build).toHaveBeenCalledWith(expect.any(Object), {});
  });

  it('withdrawal also suppresses optional learned weights, recipe priors, and contribution writes', async () => {
    const weightSource = { resolve: jest.fn().mockResolvedValue({ tasteAffinity: 1 }) };
    const priorSource = { valuesForSlate: jest.fn().mockResolvedValue(new Map([['protein-bowl', 1]])) };
    prisma.featureContributionLog = { createMany: jest.fn().mockResolvedValue({ count: 1 }) };
    tx.featureContributionLog = prisma.featureContributionLog;
    consent.currentGrantEpoch.mockResolvedValue(null);
    const guarded = new RankingService(
      prisma,
      featureStore,
      contributionCalculator,
      experimentEngine,
      exposureTracking,
      tasteAffinityBuilder,
      recipeEmbedding,
      consent,
      weightSource as any,
      priorSource as any,
    );

    await guarded.rank('withdrawn-user', ['protein-bowl']);

    expect(weightSource.resolve).not.toHaveBeenCalled();
    expect(priorSource.valuesForSlate).not.toHaveBeenCalled();
    expect(exposureTracking.getPenalties).not.toHaveBeenCalled();
    expect(prisma.featureContributionLog.createMany).not.toHaveBeenCalled();
    expect(prisma.userEvent.count).not.toHaveBeenCalled();
    expect(prisma.favoriteRecipe.count).not.toHaveBeenCalled();
  });

  it('direct rankWithFeatureVector ignores a caller-supplied personal vector after withdrawal', async () => {
    consent.currentGrantEpoch.mockResolvedValue(null);

    await service.rankWithFeatureVector(
      'withdrawn-user',
      ['protein-bowl'],
      { signal_likes_high_protein: 1 },
    );

    expect(exposureTracking.getPenalties).not.toHaveBeenCalled();
    expect(tasteAffinityBuilder.build).toHaveBeenCalledWith(expect.any(Object), {});
  });

  it('consent read failure follows the same cold, no-private-read path', async () => {
    consent.currentGrantEpoch.mockRejectedValue(new Error('consent unavailable'));

    await expect(service.rank('u1', ['protein-bowl'])).resolves.toEqual(expect.any(Array));

    expect(featureStore.getFeatureVector).not.toHaveBeenCalled();
    expect(experimentEngine.getWeights).not.toHaveBeenCalled();
    expect(exposureTracking.getPenalties).not.toHaveBeenCalled();
  });

  it('analytics denial suppresses experiment assignment, learned weights/prior, exposure and contribution logs', async () => {
    const weightSource = { resolve: jest.fn().mockResolvedValue({ tasteAffinity: 1 }) };
    const priorSource = { valuesForSlate: jest.fn().mockResolvedValue(new Map([['protein-bowl', 1]])) };
    prisma.featureContributionLog = { createMany: jest.fn().mockResolvedValue({ count: 1 }) };
    tx.featureContributionLog = prisma.featureContributionLog;
    featureStore.getFeatureVector.mockResolvedValue({ signal_likes_high_protein: 1 });
    consent.currentGrantEpoch.mockResolvedValue(null);
    const guarded = new RankingService(
      prisma,
      featureStore,
      contributionCalculator,
      experimentEngine,
      exposureTracking,
      tasteAffinityBuilder,
      recipeEmbedding,
      consent,
      weightSource as any,
      priorSource as any,
    );

    await guarded.rank('u1', ['protein-bowl']);

    expect(featureStore.getFeatureVector).not.toHaveBeenCalled();
    expect(experimentEngine.getWeights).not.toHaveBeenCalled();
    expect(weightSource.resolve).not.toHaveBeenCalled();
    expect(priorSource.valuesForSlate).not.toHaveBeenCalled();
    expect(exposureTracking.getPenalties).not.toHaveBeenCalled();
    expect(prisma.featureContributionLog.createMany).not.toHaveBeenCalled();
    expect(prisma.userEvent.count).not.toHaveBeenCalled();
    expect(prisma.favoriteRecipe.count).not.toHaveBeenCalled();
  });

  it('does not consume a cached feature vector created before the latest re-grant epoch', async () => {
    prisma.userFeatureVector.findUnique.mockResolvedValue({
      updatedAt: new Date('2099-06-30T23:59:00.000Z'),
    });

    await service.rank('u1', ['protein-bowl']);

    expect(featureStore.getFeatureVector).not.toHaveBeenCalled();
    expect(tasteAffinityBuilder.build).toHaveBeenCalledWith(expect.any(Object), {});
  });

  it('filters popularity events to the latest epoch and suppresses contribution writes after re-grant', async () => {
    const nextEpoch = new Date('2099-07-02T00:00:00.000Z');
    prisma.featureContributionLog = { createMany: jest.fn().mockResolvedValue({ count: 1 }) };
    tx.featureContributionLog = prisma.featureContributionLog;
    featureStore.getFeatureVector.mockResolvedValue({ signal_likes_high_protein: 1 });
    consent.currentGrantEpoch.mockResolvedValue(epoch);
    tx.userConsent.findMany = jest.fn().mockResolvedValue(
      ['analytics', 'personalization'].map((purpose) => ({
        id: `${purpose}-regrant`, userId: 'u1', purpose, status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings', createdAt: nextEpoch,
      })),
    );

    await service.rank('u1', ['protein-bowl']);

    expect(prisma.userEvent.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ timestamp: { gte: epoch } }),
    }));
    expect(prisma.featureContributionLog.createMany).not.toHaveBeenCalled();
  });
});
