import { RecommendationPipelineService } from './recommendation-pipeline.service';

describe('RecommendationPipelineService', () => {
  let candidateGenerator: { generate: jest.Mock };
  let rankingService: { rank: jest.Mock };
  let featureStore: { buildFeatureVector: jest.Mock; getDataMaturity: jest.Mock };
  let explainabilityService: { generateExplanation: jest.Mock };
  let service: RecommendationPipelineService;

  beforeEach(() => {
    candidateGenerator = {
      generate: jest.fn().mockResolvedValue(['recipe-1', 'recipe-2', 'recipe-3']),
    };
    rankingService = {
      rank: jest.fn().mockResolvedValue([
        {
          recipeId: 'recipe-1',
          title: 'Recipe 1',
          finalScore: 0.9,
          contributions: { health: 40, taste: 30 },
        },
        {
          recipeId: 'recipe-2',
          title: 'Recipe 2',
          finalScore: 0.8,
          contributions: { health: 20, taste: 40 },
        },
        {
          recipeId: 'recipe-3',
          title: 'Recipe 3',
          finalScore: 0.7,
          contributions: { health: 10, taste: 10 },
        },
      ]),
    };
    featureStore = {
      buildFeatureVector: jest.fn().mockResolvedValue({}),
      getDataMaturity: jest.fn().mockResolvedValue({
        dataMaturity: 'cold_start',
        confidenceLevel: 'cold_start',
        activeDays: 1,
        totalQualifiedEvents: 3,
        realImpressions: 0,
        clicks: 0,
        saves: 0,
        cooks: 0,
        signalConfidenceAvg: 0,
        behavioralReliability: 0.1,
      }),
    };
    explainabilityService = {
      generateExplanation: jest.fn((title) => `${title} explanation`),
    };

    service = new RecommendationPipelineService(
      candidateGenerator as any,
      rankingService as any,
      featureStore as any,
      explainabilityService as any,
    );
  });

  it('builds features, ranks candidates, returns maturity, and does not create impressions on fetch', async () => {
    const recommendations = await service.getRecommendations('user-1', 2);

    expect(featureStore.buildFeatureVector).toHaveBeenCalledWith('user-1');
    expect(candidateGenerator.generate).toHaveBeenCalledWith('user-1', 10);
    expect(rankingService.rank).toHaveBeenCalledWith(
      'user-1',
      ['recipe-1', 'recipe-2', 'recipe-3'],
      undefined, // L0 context: undefined here (ContextService not injected in this unit test) → neutral
    );
    expect(recommendations).toHaveLength(2);
    expect(recommendations[0]).toMatchObject({
      recipeId: 'recipe-1',
      explanation: 'Recipe 1 explanation',
      dataMaturity: { dataMaturity: 'cold_start' },
      trackingPolicy: { fetchCreatesImpression: false },
    });
  });
});
