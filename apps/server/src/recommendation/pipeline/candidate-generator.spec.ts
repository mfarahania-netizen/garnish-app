import { CandidateGeneratorService } from './candidate-generator';

describe('CandidateGeneratorService', () => {
  let prisma: any;
  let featureStore: any;
  let embeddingService: any;
  let service: CandidateGeneratorService;

  beforeEach(() => {
    prisma = {
      userEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      searchTerm: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ healthGoals: [] }),
      },
      userHealthGoal: { findMany: jest.fn().mockResolvedValue([]) },
      favoriteRecipe: { findMany: jest.fn().mockResolvedValue([]) },
      recipe: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'trend-1' },
          { id: 'trend-2' },
          { id: 'health-1' },
          { id: 'season-1' },
          { id: 'inventory-1' },
          { id: 'cold-1' },
        ]),
      },
      shoppingItem: { findMany: jest.fn().mockResolvedValue([]) },
      recipeIngredient: { findMany: jest.fn().mockResolvedValue([]) },
    };
    featureStore = {};
    embeddingService = {
      getEmbedding: jest.fn().mockResolvedValue([1, 0, 0]),
      cosineSimilarity: jest.fn().mockReturnValue(0.5),
    };
    service = new CandidateGeneratorService(prisma, featureStore, embeddingService);
  });

  it('mixes candidate sources instead of overfilling from one bucket', async () => {
    prisma.userEvent.findMany.mockResolvedValue([
      { payload: '{"recipeId":"similar-1"}' },
      { payload: '{"recipeId":"similar-2"}' },
    ]);
    prisma.searchTerm.findMany
      .mockResolvedValueOnce([{ term: 'protein' }])
      .mockResolvedValueOnce([
        { recipeId: 'similar-3' },
        { recipeId: 'similar-4' },
      ]);
    prisma.user.findUnique.mockResolvedValue({
      healthGoals: [{ healthGoal: { name: 'weight_loss' } }],
      preferences: null,
      cuisines: [],
    });
    prisma.userHealthGoal.findMany.mockResolvedValue([{ userId: 'other' }]);
    prisma.favoriteRecipe.findMany.mockResolvedValue([{ recipeId: 'collab-1' }]);
    prisma.recipe.findMany.mockResolvedValueOnce([
      { id: 'health-1' },
      { id: 'health-2' },
      { id: 'season-1' },
      { id: 'season-2' },
    ]);
    prisma.shoppingItem.findMany.mockResolvedValue([{ name: 'rice' }]);
    prisma.recipeIngredient.findMany.mockResolvedValue([{ recipeId: 'inventory-1' }]);

    const result = await service.generate('u1', 6);

    expect(result).toEqual(
      expect.arrayContaining([
        'similar-3',
        'collab-1',
        'health-1',
        'inventory-1',
      ]),
    );
    expect(result.some((id) => id.startsWith('trend-'))).toBe(true);
    expect(new Set(result).size).toBe(result.length);
  });
});
