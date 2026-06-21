import { RankingService } from './ranking.service';
import type { RecipePriorSource } from './recipe-prior.source';

// L1 step 4 — the recipePrior SEAM is wired but its weight is pinned to 0.0. These tests prove the
// activation-SAFETY invariant: registering a prior source (even one returning extreme values) must NOT change
// the ranked order or finalScores until the weight is raised — i.e. shipping the seam is byte-identical.
const RECIPES = [
  { id: 'protein-bowl', title: 'Protein Bowl', cookingTime: 20, difficulty: 'easy', cost: 'medium', diet: 'omnivore', mealType: 'lunch', servings: 4, categories: '["protein"]', createdAt: new Date('2026-06-01'), ingredients: [{ name: 'chicken' }], searchTerms: [{ term: 'protein' }] },
  { id: 'budget-pasta', title: 'Budget Pasta', cookingTime: 20, difficulty: 'easy', cost: 'low', diet: 'vegetarian', mealType: 'dinner', servings: 2, categories: '["budget"]', createdAt: new Date('2026-05-15'), ingredients: [{ name: 'pasta' }], searchTerms: [{ term: 'cheap' }] },
  { id: 'family-stew', title: 'Family Stew', cookingTime: 110, difficulty: 'medium', cost: 'low', diet: 'omnivore', mealType: 'dinner', servings: 6, categories: '["family"]', createdAt: new Date('2025-12-20'), ingredients: [{ name: 'beef' }], searchTerms: [{ term: 'family' }] },
];
const IDS = RECIPES.map((r) => r.id);

function mocks() {
  return {
    prisma: { recipe: { findMany: jest.fn().mockResolvedValue(RECIPES) }, userEvent: { count: jest.fn().mockResolvedValue(0) }, favoriteRecipe: { count: jest.fn().mockResolvedValue(0) } } as any,
    featureStore: { getFeatureVector: jest.fn().mockResolvedValue({ signal_likes_high_protein: 0.9 }) } as any,
    contributionCalculator: { calculate: jest.fn((s) => s) } as any,
    experimentEngine: { getWeights: jest.fn().mockResolvedValue(null) } as any,
    exposureTracking: { getPenalty: jest.fn().mockResolvedValue(0) } as any,
    tasteAffinityBuilder: { build: jest.fn().mockReturnValue({ score: 0.7, matchedSignals: [] }) } as any,
    recipeEmbedding: { buildEmbedding: jest.fn().mockReturnValue([0.5, 0.5, 0, 0]) } as any,
  };
}
const build = (m: ReturnType<typeof mocks>, prior?: RecipePriorSource) =>
  new RankingService(m.prisma, m.featureStore, m.contributionCalculator, m.experimentEngine, m.exposureTracking, m.tasteAffinityBuilder, m.recipeEmbedding, undefined, prior);

const shape = (ranked: any[]) => ranked.map((r) => ({ id: r.recipeId, finalScore: r.finalScore, rawScore: r.rawScore }));

describe('RankingService — recipePrior seam (L1 step 4)', () => {
  it('default weight is exactly 0.0', () => {
    expect((build(mocks()) as any).defaultWeights.recipePrior).toBe(0);
  });

  it('a registered prior source returning EXTREME values does not change order or finalScores (weight 0)', async () => {
    const baseline = shape(await build(mocks()).rank('u1', IDS));

    // extreme/adversarial values — would dominate if the weight were non-zero
    const prior: RecipePriorSource = { valuesForSlate: jest.fn().mockResolvedValue(new Map([['protein-bowl', 0.0], ['budget-pasta', 1.0], ['family-stew', 0.0]])) };
    const withPrior = shape(await build(mocks(), prior).rank('u1', IDS));

    expect(withPrior).toEqual(baseline); // byte-identical: order + finalScore + rawScore unchanged
  });

  it('flows the prior VALUE into the scores breakdown, neutral 0.5 when unregistered', async () => {
    const unreg = await build(mocks()).rank('u1', IDS);
    expect((unreg.find((r: any) => r.recipeId === 'protein-bowl') as any).scores.recipePrior).toBe(0.5);

    const prior: RecipePriorSource = { valuesForSlate: jest.fn().mockResolvedValue(new Map([['budget-pasta', 0.83]])) };
    const reg = await build(mocks(), prior).rank('u1', IDS);
    expect((reg.find((r: any) => r.recipeId === 'budget-pasta') as any).scores.recipePrior).toBe(0.83);
    expect((reg.find((r: any) => r.recipeId === 'protein-bowl') as any).scores.recipePrior).toBe(0.5); // not in map → neutral
  });

  it('calls the source exactly ONCE per rank for the whole slate (no N+1)', async () => {
    const prior: RecipePriorSource = { valuesForSlate: jest.fn().mockResolvedValue(new Map()) };
    await build(mocks(), prior).rank('u1', IDS);
    expect(prior.valuesForSlate).toHaveBeenCalledTimes(1);
    expect((prior.valuesForSlate as jest.Mock).mock.calls[0][1]).toEqual(IDS);
  });

  it('is fail-safe: a throwing source degrades to neutral (request still succeeds, byte-identical)', async () => {
    const baseline = shape(await build(mocks()).rank('u1', IDS));
    const prior: RecipePriorSource = { valuesForSlate: jest.fn().mockRejectedValue(new Error('boom')) };
    const withThrow = shape(await build(mocks(), prior).rank('u1', IDS));
    expect(withThrow).toEqual(baseline);
  });
});
