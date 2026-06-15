import { CandidateGeneratorService } from './candidate-generator';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

const NOW = new Date('2026-06-15T12:00:00.000Z');
function profileWithAllergy(allergens: string[]) {
  const declared = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: 'omnivore', declaredAt: NOW.toISOString() }], { granted: ['core', 'analytics', 'personalization'] }, { now: NOW });
  if (allergens.length) declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: allergens, confidence: 0.9, recencyScore: 1 } as any;
  return composeLivingUserProfile(declared, null, NOW);
}

describe('CandidateGeneratorService', () => {
  let prisma: any;
  let featureStore: any;
  let embeddingService: any;
  let profiles: any;
  let content: any;
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
    profiles = { getLivingUserProfile: jest.fn().mockResolvedValue(profileWithAllergy([])) };
    content = { neighbors: jest.fn().mockResolvedValue({ neighbors: [], status: 'no_similar' }) };
    service = new CandidateGeneratorService(prisma, featureStore, embeddingService, profiles, content);
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

describe('CandidateGeneratorService — COLDSTART-L4-14 (profile-grounded, allergy-safe)', () => {
  const SAFE = { id: 'safe', title: 'Lentil Stew', diet: 'omnivore', difficulty: 'easy', cookingTime: 30, allergens: '[]', categories: '[]', region: 'persian', ingredients: [{ name: 'lentil', ingredient: null }] };
  const PEANUT = { id: 'peanut', title: 'Peanut Noodles', diet: 'omnivore', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', categories: '[]', region: 'asian', ingredients: [{ name: 'peanut', ingredient: { allergens: { eu14: ['peanut'], us9: ['peanut'], other: [], mayContain: [] } } }] };

  function makeService(opts: { profile: any; pool: any[]; neighbors?: any[] }) {
    const prisma: any = {
      userEvent: { count: jest.fn().mockResolvedValue(0) }, // cold-start user
      recipe: { findMany: jest.fn().mockResolvedValue(opts.pool) },
    };
    const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(opts.profile) };
    const content: any = { neighbors: jest.fn().mockResolvedValue({ neighbors: opts.neighbors ?? [], status: 'ok' }) };
    return { svc: new CandidateGeneratorService(prisma, {} as any, {} as any, profiles, content), prisma, profiles, content };
  }

  it('reads getLivingUserProfile (NOT raw user.preferences)', async () => {
    const { svc, profiles } = makeService({ profile: profileWithAllergy([]), pool: [SAFE] });
    await svc.coldStartCandidates('u1');
    expect(profiles.getLivingUserProfile).toHaveBeenCalledWith('u1');
  });

  it('ALLERGY SAFETY: a declared-peanut user gets ZERO peanut recipes from cold-start', async () => {
    const { svc } = makeService({ profile: profileWithAllergy(['peanut']), pool: [SAFE, PEANUT] });
    const candidates = await svc.coldStartCandidates('u1');
    expect(candidates.map((c) => c.recipeId)).not.toContain('peanut');
    expect(candidates.every((c) => c.recommendation !== 'avoid_allergen')).toBe(true);
    expect(candidates.map((c) => c.recipeId)).toContain('safe');
  });

  it('ALLERGY SAFETY also covers content-augmented neighbours (S9)', async () => {
    // pool fetch (#1) returns the safe anchor; the neighbour fetch (#2) returns a peanut recipe → must be dropped
    const prisma: any = {
      userEvent: { count: jest.fn().mockResolvedValue(0) },
      recipe: { findMany: jest.fn().mockResolvedValueOnce([SAFE]).mockResolvedValueOnce([PEANUT]).mockResolvedValue([]) },
    };
    const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(profileWithAllergy(['peanut'])) };
    const content: any = { neighbors: jest.fn().mockResolvedValue({ neighbors: [{ recipeId: 'peanut' }], status: 'ok' }) };
    const svc = new CandidateGeneratorService(prisma, {} as any, {} as any, profiles, content);
    const candidates = await svc.coldStartCandidates('u1');
    expect(candidates.map((c) => c.recipeId)).not.toContain('peanut');
    expect(candidates.map((c) => c.recipeId)).toContain('safe');
  });

  it('ranked by FIT (not createdAt) and explainable (reasons present)', async () => {
    const { svc } = makeService({ profile: profileWithAllergy([]), pool: [SAFE] });
    const candidates = await svc.coldStartCandidates('u1');
    expect(candidates[0].fitScore).toBeGreaterThan(0);
    expect(Array.isArray(candidates[0].reasons)).toBe(true);
  });

  it('reuses the S9 content store for content-based cold-start similarity', async () => {
    const { svc, content } = makeService({ profile: profileWithAllergy([]), pool: [SAFE], neighbors: [] });
    await svc.coldStartCandidates('u1');
    expect(content.neighbors).toHaveBeenCalled();
  });
});
