import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildContentVector, cosineDense, RecipeContentInput } from '../recipes/search/recipe-content';

/**
 * RecipeEmbeddingService (GARNISH-EMBED-L4-13) — now backed by the PRINCIPLED content representation.
 *
 * The former naive 48-dim feature-hash stub is replaced by the deterministic, interpretable content
 * vector (buildContentVector): an explicit facet block + a weighted content-token bag, L2-normalized,
 * reproducible. NO external API / LLM / vector DB / new dependency. The number[] + cosineSimilarity
 * contract is preserved, so existing live consumers (recommendation candidate-generator's embedding
 * bucket + ranking.service) automatically get better content candidates.
 */
@Injectable()
export class RecipeEmbeddingService {
  constructor(private prisma: PrismaService) {}

  async getEmbedding(recipeId: string): Promise<number[]> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        ingredients: { select: { name: true } },
        searchTerms: { select: { term: true } },
      },
    });
    if (!recipe) return [];
    return this.buildEmbedding({
      title: recipe.title,
      diet: recipe.diet,
      mealType: recipe.mealType,
      region: (recipe as any).region,
      category: (recipe as any).category,
      categories: recipe.categories,
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty,
      ingredients: recipe.ingredients.map((item) => item.name),
      searchTerms: recipe.searchTerms.map((item) => item.term),
    });
  }

  /** Principled, deterministic content vector (replaces the 48-dim hash). */
  buildEmbedding(input: {
    title?: string | null;
    diet?: string | null;
    mealType?: string | null;
    region?: string | null;
    category?: string | null;
    categories?: unknown;
    cookingTime?: number | null;
    difficulty?: string | null;
    cost?: string | null; // accepted for caller back-compat; cost is not part of the content vector
    ingredients?: string[];
    searchTerms?: string[];
  }): number[] {
    const content: RecipeContentInput = {
      title: input.title,
      diet: input.diet,
      mealType: input.mealType,
      region: input.region,
      category: input.category,
      categories: input.categories,
      cookingTime: input.cookingTime,
      difficulty: input.difficulty,
      ingredients: input.ingredients ?? [],
      searchTerms: input.searchTerms ?? [],
    };
    return buildContentVector(content);
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    return cosineDense(vecA, vecB);
  }
}
