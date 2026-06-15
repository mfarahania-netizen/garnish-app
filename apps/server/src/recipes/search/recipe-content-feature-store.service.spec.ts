import { RecipeContentFeatureStore } from './recipe-content-feature-store.service';

const CORPUS = [
  { id: 'r1', title: 'Saffron Chicken Pilaf', description: 'persian rice', diet: 'omnivore', mealType: 'dinner', region: 'persian', category: 'main', categories: '["dinner"]', difficulty: 'easy', cookingTime: 40, ingredients: [{ name: 'chicken' }, { name: 'saffron' }, { name: 'rice' }], searchTerms: [{ term: 'pilaf' }] },
  { id: 'r2', title: 'Chicken Kebab', description: 'grilled', diet: 'omnivore', mealType: 'dinner', region: 'persian', category: 'main', categories: '["dinner"]', difficulty: 'easy', cookingTime: 35, ingredients: [{ name: 'chicken' }, { name: 'onion' }], searchTerms: [{ term: 'kebab' }] },
  { id: 'r3', title: 'Vegan Chocolate Cake', description: 'dessert', diet: 'vegan', mealType: 'dessert', region: 'international', category: 'dessert', categories: '["dessert"]', difficulty: 'medium', cookingTime: 70, ingredients: [{ name: 'flour' }, { name: 'cocoa' }], searchTerms: [{ term: 'cake' }] },
];

function makeStore() {
  const findMany = jest.fn().mockResolvedValue(CORPUS);
  const prisma: any = { recipe: { findMany } };
  return { store: new RecipeContentFeatureStore(prisma), findMany };
}

describe('RecipeContentFeatureStore — content feature contract + caching', () => {
  it('serves a content-feature contract: facets + topTerms + vector + termCount', async () => {
    const { store } = makeStore();
    const f = await store.getContentFeatures('r1');
    expect(f).not.toBeNull();
    expect(f!.facets.cuisine).toBe('persian');
    expect(f!.facets.effortBand).toBe('medium');
    expect(f!.topTerms.length).toBeGreaterThan(0);
    expect(f!.vector).toHaveLength(64);
    expect(f!.termCount).toBeGreaterThan(0);
  });

  it('CACHES the index/features (TTL): repeated reads hit the DB once', async () => {
    const { store, findMany } = makeStore();
    await store.getContentFeatures('r1');
    await store.getContentFeatures('r2');
    await store.getVector('r3');
    await store.neighbors('r1');
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('returns null features for an unknown recipe', async () => {
    const { store } = makeStore();
    expect(await store.getContentFeatures('nope')).toBeNull();
  });

  it('neighbors: self-excluded, explainable, facet-blended (same-cuisine kebab beats far dessert for the pilaf)', async () => {
    const { store } = makeStore();
    const { neighbors, status } = await store.neighbors('r1', 6);
    expect(status).toBe('ok');
    expect(neighbors.find((n) => n.recipeId === 'r1')).toBeUndefined();
    expect(neighbors[0].recipeId).toBe('r2'); // same cuisine + shared 'chicken'
    expect(neighbors[0].why.reasons.length).toBeGreaterThan(0);
    expect(neighbors[0].why.reasons.join(' ')).toMatch(/cuisine|ingredients|effort|terms/);
  });

  it('neighbors of an unknown recipe → recipe_not_found', async () => {
    const { store } = makeStore();
    expect((await store.neighbors('nope')).status).toBe('recipe_not_found');
  });
});
