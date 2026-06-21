import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isRecipeVisibleTo } from '../recipes/recipe-visibility';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async getFavorites(userId: string) {
    const favorites = await this.prisma.favoriteRecipe.findMany({
      where: { userId },
      include: { recipe: true },
    });
    if (!Array.isArray(favorites)) return [];
    // SECURITY (advisor audit): never echo an unpublished recipe the user doesn't own — even one they somehow
    // favorited. Published-or-owned only. Byte-identical today (all curated recipes are active+public).
    return favorites.filter((f) => isRecipeVisibleTo(f.recipe as any, userId));
  }

  async addFavorite(userId: string, recipeId: string) {
    // SECURITY (advisor audit): you may only favorite a PUBLISHED recipe (or your own draft) — block referencing
    // another user's pending/private UGC by a guessed id (which would then be readable via getFavorites).
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { status: true, isPublic: true, authorId: true },
    });
    if (!isRecipeVisibleTo(recipe, userId)) throw new NotFoundException('Recipe not found');

    // بررسی وجود علاقه‌مندی تکراری
    const existing = await this.prisma.favoriteRecipe.findUnique({
      where: { userId_recipeId: { userId, recipeId } },
    });
    if (existing) return existing; // اگر بود اضافه نکند
    return this.prisma.favoriteRecipe.create({
      data: { userId, recipeId },
    });
  }

  async removeFavorite(userId: string, recipeId: string) {
    return this.prisma.favoriteRecipe.delete({
      where: { userId_recipeId: { userId, recipeId } },
    });
  }
}
