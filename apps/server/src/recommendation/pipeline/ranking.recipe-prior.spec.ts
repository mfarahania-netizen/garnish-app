import { RankingService } from './ranking.service';
import type { RecipePriorSource } from './recipe-prior.source';

// P0-A Option B: RecipePriorSource currently returns only Map<recipeId, number>.
// It carries no observation time, purpose, policy version, or grant epoch, so it
// is not an authorization-bearing source. Ranking must stay neutral even when a
// legacy source is registered and scoring flags are set.
const RECIPES = [
  { id: 'protein-bowl', title: 'Protein Bowl', cookingTime: 20, difficulty: 'easy', cost: 'medium', diet: 'omnivore', mealType: 'lunch', servings: 4, categories: '["protein"]', createdAt: new Date('2026-06-01'), ingredients: [{ name: 'chicken' }], searchTerms: [{ term: 'protein' }] },
  { id: 'budget-pasta', title: 'Budget Pasta', cookingTime: 20, difficulty: 'easy', cost: 'low', diet: 'vegetarian', mealType: 'dinner', servings: 2, categories: '["budget"]', createdAt: new Date('2026-05-15'), ingredients: [{ name: 'pasta' }], searchTerms: [{ term: 'cheap' }] },
  { id: 'family-stew', title: 'Family Stew', cookingTime: 110, difficulty: 'medium', cost: 'low', diet: 'omnivore', mealType: 'dinner', servings: 6, categories: '["family"]', createdAt: new Date('2025-12-20'), ingredients: [{ name: 'beef' }], searchTerms: [{ term: 'family' }] },
];
const IDS = RECIPES.map((recipe) => recipe.id);
const GRANT_EPOCH = new Date('2026-07-13T00:00:00.000Z');

function mocks(grantEpoch: Date | null = GRANT_EPOCH) {
  return {
    prisma: {
      recipe: { findMany: jest.fn().mockResolvedValue(RECIPES) },
      userEvent: { count: jest.fn().mockResolvedValue(0) },
      favoriteRecipe: { count: jest.fn().mockResolvedValue(0) },
      userFeatureVector: {
        findUnique: jest.fn().mockResolvedValue({
          updatedAt: new Date(GRANT_EPOCH.getTime() + 1_000),
        }),
      },
    } as any,
    featureStore: {
      getFeatureVector: jest.fn().mockResolvedValue({ signal_likes_high_protein: 0.9 }),
    } as any,
    contributionCalculator: { calculate: jest.fn((scores) => scores) } as any,
    experimentEngine: { getWeights: jest.fn().mockResolvedValue(null) } as any,
    exposureTracking: { getPenalties: jest.fn().mockResolvedValue(new Map()) } as any,
    tasteAffinityBuilder: {
      build: jest.fn().mockReturnValue({ score: 0.7, matchedSignals: [] }),
    } as any,
    recipeEmbedding: { buildEmbedding: jest.fn().mockReturnValue([0.5, 0.5, 0, 0]) } as any,
    consent: { currentGrantEpoch: jest.fn().mockResolvedValue(grantEpoch) } as any,
  };
}

const build = (m: ReturnType<typeof mocks>, prior?: RecipePriorSource) =>
  new RankingService(
    m.prisma,
    m.featureStore,
    m.contributionCalculator,
    m.experimentEngine,
    m.exposureTracking,
    m.tasteAffinityBuilder,
    m.recipeEmbedding,
    m.consent,
    undefined,
    prior,
  );

const shape = (ranked: any[]) => ranked.map((item) => ({
  id: item.recipeId,
  finalScore: item.finalScore,
  rawScore: item.rawScore,
  recipePrior: item.scores.recipePrior,
}));

describe('RankingService — recipe-prior provenance decision (P0-A Option B)', () => {
  afterEach(() => {
    delete process.env.L1_PRIOR_STEP5_WEIGHT;
    delete process.env.L1_RECIPE_PRIOR_ENABLED;
  });

  it('keeps the linear recipe-prior component weight at exactly zero', () => {
    expect((build(mocks()) as any).defaultWeights.recipePrior).toBe(0);
  });

  it('does not call or consume a registered value-only source, even with current joint consent', async () => {
    const prior: RecipePriorSource = {
      valuesForSlate: jest.fn().mockResolvedValue(new Map([
        ['protein-bowl', 0],
        ['budget-pasta', 1],
        ['family-stew', 0],
      ])),
    };

    const ranked = await build(mocks(), prior).rank('u1', IDS);

    expect(prior.valuesForSlate).not.toHaveBeenCalled();
    expect(ranked.map((item: any) => item.scores.recipePrior)).toEqual([0.5, 0.5, 0.5]);
  });

  it('is byte-identical to no source when an extreme unprovenanced source is registered', async () => {
    const baseline = shape(await build(mocks()).rank('u1', IDS));
    const prior: RecipePriorSource = {
      valuesForSlate: jest.fn().mockResolvedValue(new Map([
        ['protein-bowl', 0],
        ['budget-pasta', 1],
        ['family-stew', 0],
      ])),
    };

    const withPrior = shape(await build(mocks(), prior).rank('u1', IDS));

    expect(prior.valuesForSlate).not.toHaveBeenCalled();
    expect(withPrior).toEqual(baseline);
  });

  it('cannot be activated by flags while the source lacks the future evidence envelope', async () => {
    process.env.L1_RECIPE_PRIOR_ENABLED = 'true';
    process.env.L1_PRIOR_STEP5_WEIGHT = '0.3';
    const baseline = shape(await build(mocks()).rank('u1', IDS));
    const prior: RecipePriorSource = {
      valuesForSlate: jest.fn().mockResolvedValue(new Map([
        ['protein-bowl', 1],
        ['budget-pasta', 0],
        ['family-stew', 1],
      ])),
    };

    const attemptedActivation = shape(await build(mocks(), prior).rank('u1', IDS));

    expect(prior.valuesForSlate).not.toHaveBeenCalled();
    expect(attemptedActivation).toEqual(baseline);
    expect(attemptedActivation.every((item) => item.recipePrior === 0.5)).toBe(true);
  });

  it('performs no legacy prior read when current joint consent is absent', async () => {
    const prior: RecipePriorSource = {
      valuesForSlate: jest.fn().mockResolvedValue(new Map([['protein-bowl', 1]])),
    };

    const ranked = await build(mocks(null), prior).rank('u1', IDS);

    expect(prior.valuesForSlate).not.toHaveBeenCalled();
    expect(ranked.every((item: any) => item.scores.recipePrior === 0.5)).toBe(true);
  });

  it('does not treat a new re-grant epoch as provenance for legacy aggregate values', async () => {
    const regrantEpoch = new Date(GRANT_EPOCH.getTime() + 86_400_000);
    const prior: RecipePriorSource = {
      valuesForSlate: jest.fn().mockResolvedValue(new Map([['protein-bowl', 1]])),
    };

    const ranked = await build(mocks(regrantEpoch), prior).rank('u1', IDS);

    expect(prior.valuesForSlate).not.toHaveBeenCalled();
    expect(ranked.every((item: any) => item.scores.recipePrior === 0.5)).toBe(true);
  });

  it('does not probe a throwing legacy source and still completes neutrally', async () => {
    const baseline = shape(await build(mocks()).rank('u1', IDS));
    const prior: RecipePriorSource = {
      valuesForSlate: jest.fn().mockRejectedValue(new Error('must not be reached')),
    };

    const ranked = shape(await build(mocks(), prior).rank('u1', IDS));

    expect(prior.valuesForSlate).not.toHaveBeenCalled();
    expect(ranked).toEqual(baseline);
  });
});
