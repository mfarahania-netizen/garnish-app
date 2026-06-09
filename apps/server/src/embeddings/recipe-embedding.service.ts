import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      categories: recipe.categories,
      cookingTime: recipe.cookingTime,
      difficulty: recipe.difficulty,
      cost: recipe.cost,
      ingredients: recipe.ingredients.map((item) => item.name),
      searchTerms: recipe.searchTerms.map((item) => item.term),
    });
  }

  buildEmbedding(input: {
    title?: string | null;
    diet?: string | null;
    mealType?: string | null;
    categories?: string | null;
    cookingTime?: number | null;
    difficulty?: string | null;
    cost?: string | null;
    ingredients?: string[];
    searchTerms?: string[];
  }): number[] {
    const vector = new Array(48).fill(0);
    const textValues = [
      input.title,
      input.diet,
      input.mealType,
      input.categories,
      input.difficulty,
      input.cost,
      ...(input.ingredients || []),
      ...(input.searchTerms || []),
    ];

    for (const token of this.tokens(textValues)) {
      vector[this.hash(token) % 32] += 1;
    }

    const cookingTime = Number(input.cookingTime || 0);
    vector[32] = cookingTime > 0 && cookingTime <= 20 ? 1 : 0;
    vector[33] = cookingTime > 20 && cookingTime <= 45 ? 1 : 0;
    vector[34] = cookingTime > 45 ? 1 : 0;
    vector[35] = /vegetarian/i.test(String(input.diet || '')) ? 1 : 0;
    vector[36] = /vegan/i.test(String(input.diet || '')) ? 1 : 0;
    vector[37] = /breakfast/i.test(String(input.mealType || '')) ? 1 : 0;
    vector[38] = /lunch/i.test(String(input.mealType || '')) ? 1 : 0;
    vector[39] = /dinner/i.test(String(input.mealType || '')) ? 1 : 0;
    vector[40] = /easy|beginner/i.test(String(input.difficulty || '')) ? 1 : 0;
    vector[41] = /cheap|budget|low/i.test(String(input.cost || '')) ? 1 : 0;
    vector[42] = this.tokens([input.title, input.categories]).length > 6 ? 1 : 0;

    return this.normalize(vector);
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length === 0 || vecB.length === 0) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    const length = Math.min(vecA.length, vecB.length);

    for (let index = 0; index < length; index += 1) {
      dotProduct += vecA[index] * vecB[index];
      normA += vecA[index] * vecA[index];
      normB += vecB[index] * vecB[index];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private tokens(values: Array<string | null | undefined>) {
    return values
      .filter(Boolean)
      .flatMap((value) =>
        String(value)
          .toLowerCase()
          .replace(/[[\]{}",]/g, ' ')
          .split(/[\s,_-]+/),
      )
      .filter((token) => token.length >= 2);
  }

  private hash(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash);
  }

  private normalize(vector: number[]) {
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) return vector;
    return vector.map((value) => Math.round((value / norm) * 1000) / 1000);
  }
}
