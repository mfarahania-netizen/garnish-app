/**
 * E18/E43-A6 integration-safety proof: the shadow runtime hook runs BESIDE the live pipeline and CANNOT
 * change the user-visible response, the live ranking, or break the request. Constructs the real
 * RecommendationPipelineService with mocked collaborators + the real shadow service.
 */
import { RecommendationPipelineService } from '../pipeline/recommendation-pipeline.service';
import { RecommendationShadowRuntimeService } from './recommendation-shadow-runtime.service';

function makeMocks() {
  const candidateGenerator = { generate: jest.fn().mockResolvedValue(['recipe-1', 'recipe-2', 'recipe-3']) };
  const rankingService = {
    rank: jest.fn().mockResolvedValue([
      { recipeId: 'recipe-1', title: 'Recipe 1', finalScore: 0.9, contributions: { health: 40 }, scores: { tasteAffinity: 0.5 }, matchedSignals: ['s1'] },
      { recipeId: 'recipe-2', title: 'Recipe 2', finalScore: 0.8, contributions: { health: 20 }, scores: {}, matchedSignals: [] },
      { recipeId: 'recipe-3', title: 'Recipe 3', finalScore: 0.7, contributions: {}, scores: {}, matchedSignals: [] },
    ]),
  };
  const featureStore = {
    buildFeatureVector: jest.fn().mockResolvedValue({}),
    getDataMaturity: jest.fn().mockResolvedValue({ dataMaturity: 'cold_start' }),
  };
  const explainabilityService = { generateExplanation: jest.fn((title: string) => `${title} explanation`) };
  return { candidateGenerator, rankingService, featureStore, explainabilityService };
}

const build = (m: ReturnType<typeof makeMocks>, shadow?: any) =>
  new RecommendationPipelineService(m.candidateGenerator as any, m.rankingService as any, m.featureStore as any, m.explainabilityService as any, shadow);

describe('shadow runtime integration safety', () => {
  const ENV = process.env;
  afterEach(() => {
    process.env = ENV;
  });

  it('response is deep-equal with shadow ABSENT vs shadow ON', async () => {
    const noShadow = await build(makeMocks()).getRecommendations('user-1', 2);

    process.env = { ...ENV, RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: '1' };
    const withShadow = await build(makeMocks(), new RecommendationShadowRuntimeService()).getRecommendations('user-1', 2);

    expect(withShadow).toEqual(noShadow);
  });

  it('response contains no shadow / divergence / decisionTrace keys', async () => {
    process.env = { ...ENV, RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: '1' };
    const resp = await build(makeMocks(), new RecommendationShadowRuntimeService()).getRecommendations('user-1', 3);
    const json = JSON.stringify(resp);
    expect(json).not.toMatch(/shadow|divergence|decisionTrace|rankingChangedForUser|productUseEnabled/i);
  });

  it('live ranking array is not mutated by the shadow hook', async () => {
    process.env = { ...ENV, RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: '1' };
    const m = makeMocks();
    const rankedResolved = await m.rankingService.rank('user-1', ['recipe-1', 'recipe-2', 'recipe-3']);
    const snapshot = JSON.parse(JSON.stringify(rankedResolved));
    // re-arm the mock to return the same array reference set
    m.rankingService.rank.mockResolvedValue(rankedResolved);

    await build(m, new RecommendationShadowRuntimeService()).getRecommendations('user-1', 2);
    expect(rankedResolved).toEqual(snapshot);
  });

  it('live request is NOT broken if the shadow service throws', async () => {
    const throwingShadow = { observe: jest.fn().mockRejectedValue(new Error('boom')) };
    const resp = await build(makeMocks(), throwingShadow).getRecommendations('user-1', 2);
    expect(resp).toHaveLength(2);
    expect(resp[0]).toMatchObject({ recipeId: 'recipe-1', explanation: 'Recipe 1 explanation' });
    expect(throwingShadow.observe).toHaveBeenCalled();
  });

  it('shadow hook receives recipeIds only (a fresh copy, never live objects)', async () => {
    process.env = { ...ENV, RECOMMENDATION_SHADOW_RUNTIME_MODE: 'shadow', RECOMMENDATION_SHADOW_RUNTIME_SAMPLE_RATE: '1' };
    const spyShadow = { observe: jest.fn().mockResolvedValue({}) };
    await build(makeMocks(), spyShadow).getRecommendations('user-1', 2);
    expect(spyShadow.observe).toHaveBeenCalledTimes(1);
    const arg = spyShadow.observe.mock.calls[0][0];
    expect(arg.liveCandidateIds).toEqual(['recipe-1', 'recipe-2']);
    expect(arg.liveCandidateIds.every((x: unknown) => typeof x === 'string')).toBe(true);
  });

  it('shadow absent (undefined): pipeline behaves exactly as before', async () => {
    const resp = await build(makeMocks()).getRecommendations('user-1', 2);
    expect(resp).toHaveLength(2);
    expect(resp[0]).toMatchObject({ recipeId: 'recipe-1', dataMaturity: { dataMaturity: 'cold_start' } });
  });
});
