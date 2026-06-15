// apps/server/src/recommendation/pipeline/candidate-generator.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureStoreService } from '../../behavior-engine/feature-store/feature-store.service';
import { RecipeEmbeddingService } from '../../embeddings/recipe-embedding.service';

@Injectable()
export class CandidateGeneratorService {
  constructor(
    private prisma: PrismaService,
    private featureStore: FeatureStoreService,
    private embeddingService: RecipeEmbeddingService,
  ) {}

  async generate(userId: string, limit = 50): Promise<string[]> {
    const buckets = [
      { source: 'similar', ids: await this.getSimilarRecipes(userId) },
      { source: 'embedding', ids: await this.getEmbeddingSimilarRecipes(userId) },
      { source: 'collaborative', ids: await this.getCollaborativeRecipes(userId) },
      { source: 'trending', ids: await this.getTrendingRecipes() },
      { source: 'health', ids: await this.getHealthGoalRecipes(userId) },
      { source: 'seasonal', ids: await this.getSeasonalRecipes() },
      { source: 'inventory', ids: await this.getInventoryRecipes(userId) },
      { source: 'cold_start', ids: await this.getColdStartRecipes(userId) },
    ];

    const target = Math.max(limit, 1);
    const quotas = new Map<string, number>();
    const activeBuckets = buckets.filter((bucket) => bucket.ids.length > 0);
    const baseQuota = Math.max(1, Math.floor(target / Math.max(activeBuckets.length || 1, 1)));

    for (const bucket of activeBuckets) {
      quotas.set(bucket.source, baseQuota);
    }

    let remainder = target - baseQuota * activeBuckets.length;
    for (const bucket of activeBuckets) {
      if (remainder <= 0) break;
      quotas.set(bucket.source, (quotas.get(bucket.source) || 0) + 1);
      remainder -= 1;
    }

    const candidates: string[] = [];
    const seen = new Set<string>();

    for (const bucket of buckets) {
      const quota = quotas.get(bucket.source) ?? 0;
      for (const recipeId of bucket.ids.slice(0, quota)) {
        if (seen.has(recipeId)) continue;
        seen.add(recipeId);
        candidates.push(recipeId);
        if (candidates.length >= target) return candidates;
      }
    }

    if (candidates.length < target) {
      for (const bucket of buckets) {
        for (const recipeId of bucket.ids) {
          if (seen.has(recipeId)) continue;
          seen.add(recipeId);
          candidates.push(recipeId);
          if (candidates.length >= target) return candidates;
        }
      }
    }

    return candidates;
  }

  private async getSimilarRecipes(userId: string): Promise<string[]> {
    const recentViews = await this.prisma.userEvent.findMany({
      where: { userId, type: { in: ['recipe_view', 'favorite_add'] } },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    const recipeIds = new Set<string>();
    for (const event of recentViews) {
      try {
        const p = JSON.parse(event.payload || '{}');
        if (p.recipeId) recipeIds.add(p.recipeId);
      } catch {}
    }

    if (recipeIds.size === 0) return [];

    const searchTerms = await this.prisma.searchTerm.findMany({
      where: { recipeId: { in: [...recipeIds] } },
      select: { term: true },
    });
    const terms = [...new Set(searchTerms.map(s => s.term))];

    const similarRecipes: { recipeId: string }[] = await this.prisma.searchTerm.findMany({
      where: { term: { in: terms }, recipeId: { notIn: [...recipeIds] } },
      select: { recipeId: true },
      take: 20,
    });

    return [...new Set(similarRecipes.map(s => s.recipeId))];
  }

  private async getEmbeddingSimilarRecipes(userId: string): Promise<string[]> {
    const recentViews = await this.prisma.userEvent.findMany({
      where: { userId, type: 'recipe_view' },
      orderBy: { timestamp: 'desc' },
      take: 3,
      select: { payload: true },
    });

    const recentRecipeIds = recentViews
      .flatMap((event) => {
        try {
          const payload = JSON.parse(event.payload || '{}');
          return payload.recipeId ? [payload.recipeId] : [];
        } catch {
          return [];
        }
      })
      .filter(Boolean);

    if (recentRecipeIds.length === 0) return [];

    const allRecipes = await this.prisma.recipe.findMany({
      where: { isPublic: true },
      select: { id: true },
      take: 50,
    });

    const recentEmbeddings = await Promise.all(
      recentRecipeIds.map((recipeId) => this.embeddingService.getEmbedding(recipeId)),
    );

    const scored = await Promise.all(
      allRecipes.map(async (recipe) => {
        if (recentRecipeIds.includes(recipe.id)) return null;
        const embedding = await this.embeddingService.getEmbedding(recipe.id);
        if (embedding.length === 0) return null;

        const similarity = recentEmbeddings.reduce((best, current) => {
          return Math.max(best, this.embeddingService.cosineSimilarity(current, embedding));
        }, 0);

        return { recipeId: recipe.id, similarity };
      }),
    );

    return scored
      .filter((item): item is { recipeId: string; similarity: number } => !!item && item.similarity > 0.25)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map((item) => item.recipeId);
  }

  private async getCollaborativeRecipes(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { healthGoals: { select: { healthGoal: { select: { name: true } } } } },
    });
    if (!user || user.healthGoals.length === 0) return [];

    const goalNames = user.healthGoals.map(g => g.healthGoal.name);
    const similarUsers = await this.prisma.userHealthGoal.findMany({
      where: { healthGoal: { name: { in: goalNames } }, userId: { not: userId } },
      select: { userId: true },
      take: 10,
    });

    if (similarUsers.length === 0) return [];

    const similarUserIds = similarUsers.map(u => u.userId);
    const favoriteRecipes: { recipeId: string }[] = await this.prisma.favoriteRecipe.findMany({
      where: { userId: { in: similarUserIds } },
      select: { recipeId: true },
      take: 20,
    });

    return [...new Set(favoriteRecipes.map(f => f.recipeId))];
  }

  private async getTrendingRecipes(): Promise<string[]> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trending = await this.prisma.userEvent.groupBy({
      by: ['payload'],
      where: { type: 'recipe_view', timestamp: { gte: oneWeekAgo } },
      _count: { payload: true },
      orderBy: { _count: { payload: 'desc' } },
      take: 10,
    });

    const recipeIds: string[] = [];
    for (const item of trending) {
      try {
        const p = JSON.parse((item.payload as string) || '{}');
        if (p.recipeId) recipeIds.push(p.recipeId);
      } catch {}
    }
    return recipeIds;
  }

  private async getHealthGoalRecipes(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { healthGoals: { select: { healthGoal: { select: { name: true } } } } },
    });
    if (!user || user.healthGoals.length === 0) return [];

    const goalNames = user.healthGoals.map(g => g.healthGoal.name);
    const recipes = await this.prisma.recipe.findMany({
      where: {
        OR: goalNames.map((goal) => ({ categories: { contains: goal } })),
      },
      select: { id: true },
      take: 10,
    });

    return recipes.map(r => r.id);
  }

  private async getSeasonalRecipes(): Promise<string[]> {
    const recipes = await this.prisma.recipe.findMany({
      where: {
        categories: { contains: 'فصل' },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
      take: 10,
    });
    return recipes.map(r => r.id);
  }

  private async getInventoryRecipes(userId: string): Promise<string[]> {
    const shoppingItems = await this.prisma.shoppingItem.findMany({
      where: { shoppingList: { userId } },
      select: { name: true },
      take: 20,
    });

    if (shoppingItems.length === 0) return [];

    const ingredientNames = shoppingItems.map(i => i.name);
    const recipes: { recipeId: string }[] = await this.prisma.recipeIngredient.findMany({
      where: { name: { in: ingredientNames } },
      select: { recipeId: true },
      take: 20,
    });

    return [...new Set(recipes.map(r => r.recipeId))];
  }

  private async getColdStartRecipes(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true,
        healthGoals: { include: { healthGoal: true } },
        cuisines: { include: { cuisine: true } },
      },
    });

    if (!user) return [];

    const hasBehaviorHistory = await this.prisma.userEvent.count({
      where: { userId, timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });

    if (hasBehaviorHistory > 5) return [];

    const where: any = {};

    if (user.preferences?.diet) {
      where.diet = user.preferences.diet;
    }

    if (user.preferences?.skillLevel && user.preferences.skillLevel !== 'advanced') {
      where.cookingTime = { lte: user.preferences.skillLevel === 'beginner' ? 30 : 45 };
    }

    if (user.preferences?.budget) {
      where.cost = { contains: user.preferences.budget };
    }

    const healthGoalNames = user.healthGoals.map((item: any) => item.healthGoal.name);
    if (healthGoalNames.length > 0) {
      where.OR = [
        ...(where.OR || []),
        ...healthGoalNames.map((goal: string) => ({ categories: { contains: goal } })),
      ];
    }

    const cuisineNames = user.cuisines.map((item: any) => item.cuisine.name);
    if (cuisineNames.length > 0) {
      where.region = { in: cuisineNames };
    }

    const recipes = await this.prisma.recipe.findMany({
      where,
      select: { id: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    if (recipes?.length > 0) {
      return recipes.map((recipe) => recipe.id);
    }

    const fallback = await this.prisma.recipe.findMany({
      where: {
        isPublic: true,
      },
      select: { id: true },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    return (fallback || []).map((recipe) => recipe.id);
  }
}
