import { RankingService } from './ranking.service';

/**
 * FI-STEP-1 — learn from rejection (READ side, the binding effect proof). Shows that when a dismiss has
 * decremented a user's taste signal (via applyNegativeFeedback → UserBehaviorSignal), the LIVE ranker scores
 * the matching recipe LOWER on the next GET /recommendations. This is the live RankingService (the engine
 * users see) — NOT the shadow scorer. We hold everything constant and vary only the one signal the dismiss
 * would have lowered (signal_likes_high_protein 0.9 → 0.4, i.e. a -0.5 negative-feedback step).
 */
function makeService() {
  const prisma: any = {
    recipe: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'protein-bowl', title: 'High Protein Post Workout Bowl', cookingTime: 20, difficulty: 'easy',
          cost: 'medium', diet: 'omnivore', mealType: 'lunch', servings: 4, categories: '["healthy","protein"]',
          createdAt: new Date('2026-06-01'), ingredients: [{ name: 'chicken breast' }, { name: 'rice' }],
          searchTerms: [{ term: 'protein' }, { term: 'high protein' }],
        },
      ]),
    },
    userEvent: { count: jest.fn().mockResolvedValue(0) },
    favoriteRecipe: { count: jest.fn().mockResolvedValue(0) },
  };
  const featureStore = { getFeatureVector: jest.fn() };
  const contributionCalculator = { calculate: jest.fn((scores: any) => scores) };
  const experimentEngine = { getWeights: jest.fn().mockResolvedValue(null) };
  const exposureTracking = { getPenalty: jest.fn().mockResolvedValue(0) };
  // base 0 so the USER's signal drives tasteAffinity (no fixed-base masking) — the realistic dismiss path
  const tasteAffinityBuilder = { build: jest.fn().mockReturnValue({ score: 0, matchedSignals: [] }) };
  const recipeEmbedding = { buildEmbedding: jest.fn().mockReturnValue([0.5, 0.5, 0, 0]) };
  const service = new RankingService(
    prisma, featureStore as any, contributionCalculator as any, experimentEngine as any,
    exposureTracking as any, tasteAffinityBuilder as any, recipeEmbedding as any,
  );
  return { service, featureStore };
}

describe('FI-STEP-1 — a dismiss lowers the LIVE ranker score for the matching recipe', () => {
  it('decrementing signal_likes_high_protein (0.9 → 0.4) lowers protein-bowl finalScore on the live path', async () => {
    const { service, featureStore } = makeService();

    featureStore.getFeatureVector.mockResolvedValueOnce({ signal_likes_high_protein: 0.9, signal_goal_adherence: 0.5 });
    const before = await service.rank('u1', ['protein-bowl']);

    // after a dismiss: applyNegativeFeedback(-0.5) would have lowered the signal to 0.4
    featureStore.getFeatureVector.mockResolvedValueOnce({ signal_likes_high_protein: 0.4, signal_goal_adherence: 0.5 });
    const after = await service.rank('u1', ['protein-bowl']);

    const scoreBefore = before.find((r: any) => r.recipeId === 'protein-bowl')!.finalScore;
    const scoreAfter = after.find((r: any) => r.recipeId === 'protein-bowl')!.finalScore;

    // the point: the live ranker moved — the dismissed dish scores lower for this user afterward
    expect(scoreAfter).toBeLessThan(scoreBefore);
    expect(scoreBefore).toBeGreaterThan(0);
  });
});
