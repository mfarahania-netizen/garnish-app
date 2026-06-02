import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private prisma: PrismaService) {}

  async getFavorites(userId: string) {
    const favorites = await this.prisma.favoriteRecipe.findMany({
      where: { userId },
      include: { recipe: true },
    });
    // اطمینان از اینکه همیشه آرایه برگردد
    return Array.isArray(favorites) ? favorites : [];
  }

  async addFavorite(userId: string, recipeId: string) {
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