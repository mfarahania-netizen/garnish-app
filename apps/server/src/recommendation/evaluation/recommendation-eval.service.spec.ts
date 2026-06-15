import { RecommendationEvalService } from './recommendation-eval.service';

const ing = (name: string, allergens: string[] = []) => ({ name, ingredient: allergens.length ? { allergens: { eu14: allergens, us9: allergens, other: [], mayContain: [] } } : null });
const CATALOG = [
  { id: 'a', title: 'Chicken Pilaf', diet: 'omnivore', difficulty: 'easy', cookingTime: 40, allergens: '[]', categories: '[]', region: 'persian', ingredients: [ing('chicken'), ing('rice')] },
  { id: 'b', title: 'Lentil Soup', diet: 'vegan', difficulty: 'easy', cookingTime: 30, allergens: '[]', categories: '[]', region: 'international', ingredients: [ing('lentil')] },
  { id: 'c', title: 'Peanut Noodles', diet: 'omnivore', difficulty: 'easy', cookingTime: 20, allergens: '["peanut"]', categories: '[]', region: 'asian', ingredients: [ing('peanut', ['peanut'])] },
];

describe('RecommendationEvalService — runnable offline eval', () => {
  it('loads the catalog, runs the harness, and passes the allergy-safety guard', async () => {
    const prisma: any = {
      recipe: { findMany: jest.fn().mockResolvedValue(CATALOG) },
      favoriteRecipe: { groupBy: jest.fn().mockResolvedValue([]) }, // no popularity yet
    };
    const metrics: any = { getLatestMetrics: jest.fn().mockResolvedValue({ totalImpressions: 0 }) };
    const report = await new RecommendationEvalService(prisma, metrics).runOfflineEval(new Date('2026-06-15T12:00:00Z'));
    expect(report.suite).toBe('RECSYS-OFFLINE-L4-15');
    expect(report.catalogSize).toBe(3);
    expect(report.allergySafety.pass).toBe(true);
    expect(report.allergySafety.leaks).toBe(0);
  });

  it('reports HONEST null/"awaiting pilot" for online + popularity when there is no real data', async () => {
    const prisma: any = {
      recipe: { findMany: jest.fn().mockResolvedValue(CATALOG) },
      favoriteRecipe: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const metrics: any = { getLatestMetrics: jest.fn().mockResolvedValue({ totalImpressions: 0, clickThroughRate: 0 }) };
    const report = await new RecommendationEvalService(prisma, metrics).runOfflineEval(new Date('2026-06-15T12:00:00Z'));
    expect(report.online.clickThroughRate.value).toBeNull();
    expect(report.online.clickThroughRate.awaitingPilot).toBe(true);
    expect(report.offline.popularityBias.value).toBeNull();
  });

  it('uses real popularity when favorites exist', async () => {
    const prisma: any = {
      recipe: { findMany: jest.fn().mockResolvedValue(CATALOG) },
      favoriteRecipe: { groupBy: jest.fn().mockResolvedValue([{ recipeId: 'a', _count: { recipeId: 9 } }, { recipeId: 'b', _count: { recipeId: 1 } }]) },
    };
    const metrics: any = { getLatestMetrics: jest.fn().mockResolvedValue({ totalImpressions: 0 }) };
    const report = await new RecommendationEvalService(prisma, metrics).runOfflineEval(new Date('2026-06-15T12:00:00Z'));
    expect(report.offline.popularityBias.value).not.toBeNull(); // real popularity signal present
  });
});
