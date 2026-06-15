import { RecipeSearchService } from './recipe-search.service';
import { RecipeContentFeatureStore } from './recipe-content-feature-store.service';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();

const CORPUS = [
  { id: 'r1', title: 'Saffron Chicken Pilaf', description: 'persian rice', diet: 'omnivore', mealType: 'dinner', region: 'persian', categories: '["dinner"]', difficulty: 'easy', cookingTime: 40, allergens: '[]', ingredients: [{ name: 'chicken', ingredient: { allergens: { eu14: [], us9: [], other: [], mayContain: [] } } }, { name: 'saffron', ingredient: null }, { name: 'rice', ingredient: null }], searchTerms: [{ term: 'pilaf' }] },
  { id: 'r2', title: 'Vegan Lentil Soup', description: 'healthy soup', diet: 'vegan', mealType: 'lunch', region: 'international', categories: '["soup"]', difficulty: 'easy', cookingTime: 30, allergens: '[]', ingredients: [{ name: 'lentil', ingredient: null }, { name: 'carrot', ingredient: null }], searchTerms: [{ term: 'soup' }] },
  { id: 'r3', title: 'Peanut Noodles', description: 'spicy', diet: 'vegetarian', mealType: 'dinner', region: 'asian', categories: '["noodles"]', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', ingredients: [{ name: 'peanut', ingredient: { allergens: { eu14: ['peanut'], us9: ['peanut'], other: [], mayContain: [] } } }, { name: 'noodles', ingredient: null }], searchTerms: [{ term: 'noodles' }] },
];

function makeService() {
  const prisma: any = { recipe: { findMany: jest.fn().mockResolvedValue(CORPUS) } };
  const declared = buildDeclaredProfile('u1', [{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }], { granted: ['core', 'analytics', 'personalization'] }, { now: NOW });
  declared.dimensions['dietary.allergies_intolerances'] = { ...declared.dimensions['dietary.allergies_intolerances'], status: 'declared', value: ['peanut'], confidence: 0.9, recencyScore: 1 } as any;
  const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(composeLivingUserProfile(declared, null, NOW)) };
  return { svc: new RecipeSearchService(prisma, profiles, new RecipeContentFeatureStore(prisma)), prisma, profiles };
}

describe('RecipeSearchService — semantic search', () => {
  it('ranks the most relevant recipe first with WHY (anonymous base search works)', async () => {
    const { svc, profiles } = makeService();
    const res = await svc.search('saffron chicken');
    expect(res.resultStatus).toBe('ok');
    expect(res.results[0].recipeId).toBe('r1');
    expect(res.results[0].why.matchedTerms).toEqual(expect.arrayContaining(['saffron', 'chicken']));
    expect(res.personalized).toBe(false);
    expect(profiles.getLivingUserProfile).not.toHaveBeenCalled(); // anonymous → no profile
  });

  it('honest empty + records the unmet-search ("wanted but missing") signal', async () => {
    const { svc } = makeService();
    const res = await svc.search('zzqx-not-a-food');
    expect(res.resultStatus).toBe('no_results');
    expect(res.unmetSearch).toBe(true);
    expect(svc.getUnmetSearchCount()).toBe(1);
  });

  it('empty_query for too-short input', async () => {
    const { svc } = makeService();
    expect((await svc.search('x')).resultStatus).toBe('empty_query');
  });
});

describe('RecipeSearchService — similar recipes', () => {
  it('returns explainable nearest neighbors', async () => {
    const { svc } = makeService();
    const res = await svc.similar('r1');
    expect(res.resultStatus).toBe('ok');
    expect(res.results.find((r) => r.recipeId === 'r1')).toBeUndefined(); // self excluded
    expect(res.results[0].why.reasons.length).toBeGreaterThan(0);
  });
});

describe('RecipeSearchService — personalized re-rank (reuse profile) + allergen HARD filter', () => {
  it('demotes an allergen-conflicting recipe below all safe ones, with a caution (never a top "for you" hit)', async () => {
    const { svc, profiles } = makeService();
    // query matches both a safe recipe and the peanut recipe
    const res = await svc.search('dinner', { userId: 'u1', limit: 10 });
    expect(res.personalized).toBe(true);
    expect(profiles.getLivingUserProfile).toHaveBeenCalledWith('u1'); // reuses the canonical profile
    const peanut = res.results.find((r) => r.recipeId === 'r3');
    if (peanut) {
      expect(peanut.personalization?.allergenCaution).toBe(true);
      // every safe result ranks above the allergen-conflicting one
      const peanutIdx = res.results.findIndex((r) => r.recipeId === 'r3');
      const safeBelow = res.results.slice(peanutIdx + 1).filter((r) => !r.personalization?.allergenCaution);
      expect(safeBelow.length).toBe(0);
    }
  });
});
