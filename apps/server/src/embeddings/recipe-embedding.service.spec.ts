import { RecipeEmbeddingService } from './recipe-embedding.service';
import { CONTENT_VECTOR_DIM } from '../recipes/search/recipe-content';

const pilaf = { id: 'r1', title: 'Saffron Chicken Pilaf', diet: 'omnivore', mealType: 'dinner', region: 'persian', category: 'main', categories: '["dinner"]', cookingTime: 40, difficulty: 'easy', ingredients: [{ name: 'chicken' }, { name: 'rice' }], searchTerms: [{ term: 'pilaf' }] };

function makeService(recipe: any = pilaf) {
  const prisma: any = { recipe: { findUnique: jest.fn().mockResolvedValue(recipe) } };
  return { svc: new RecipeEmbeddingService(prisma), prisma };
}

describe('RecipeEmbeddingService — principled content vector (replaces 48-dim hash)', () => {
  it('getEmbedding returns the principled, fixed-dim, deterministic vector', async () => {
    const { svc } = makeService();
    const a = await svc.getEmbedding('r1');
    const b = await svc.getEmbedding('r1');
    expect(a).toHaveLength(CONTENT_VECTOR_DIM);
    expect(a).toEqual(b); // deterministic — no randomness
  });

  it('returns [] for a missing recipe', async () => {
    const { svc } = makeService(null);
    expect(await svc.getEmbedding('nope')).toEqual([]);
  });

  it('buildEmbedding tolerates the legacy caller shape (incl. cost) and is deterministic', () => {
    const { svc } = makeService();
    const v = svc.buildEmbedding({ title: 'Chicken Kebab', diet: 'omnivore', mealType: 'dinner', categories: '[]', cookingTime: 35, difficulty: 'easy', cost: 'low', ingredients: ['chicken', 'onion'], searchTerms: ['kebab'] });
    expect(v).toHaveLength(CONTENT_VECTOR_DIM);
    expect(svc.buildEmbedding({ title: 'Chicken Kebab', cost: 'low', ingredients: ['chicken', 'onion'] }).length).toBe(CONTENT_VECTOR_DIM);
  });

  it('cosineSimilarity ranks a related dish above an unrelated one (better content candidates)', () => {
    const { svc } = makeService();
    const pilafV = svc.buildEmbedding({ title: 'Saffron Chicken Pilaf', diet: 'omnivore', mealType: 'dinner', region: 'persian', cookingTime: 40, ingredients: ['chicken', 'rice'] });
    const kebabV = svc.buildEmbedding({ title: 'Chicken Kebab', diet: 'omnivore', mealType: 'dinner', region: 'persian', cookingTime: 35, ingredients: ['chicken', 'onion'] });
    const cakeV = svc.buildEmbedding({ title: 'Vegan Chocolate Cake', diet: 'vegan', mealType: 'dessert', region: 'international', cookingTime: 70, ingredients: ['flour', 'cocoa'] });
    expect(svc.cosineSimilarity(pilafV, kebabV)).toBeGreaterThan(svc.cosineSimilarity(pilafV, cakeV));
  });
});
