import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class RecommendationService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
  ) {}

  async getRecommendations(userId: string, limit = 10) {
    const profile = await this.prisma.userBehaviorProfile.findUnique({
      where: { userId },
    });

    const preferences = await this.usersService.getPreferences(userId);

    const where: any = {};

    const effectiveDiet =
      preferences?.diet || (profile?.healthAdherenceScore != null && profile.healthAdherenceScore >= 70 ? 'vegetarian' : undefined);

    if (effectiveDiet) {
      where.diet = effectiveDiet;
    }

    const allergies: string[] = preferences?.allergies || [];

    if (preferences?.cuisine?.length) {
      where.region = { in: preferences.cuisine };
    }

    const healthGoals: string[] = preferences?.healthGoals || [];
    const wantsHealthy =
      healthGoals.some(g => ['کاهش وزن', 'تناسب اندام', 'سلامت قلب'].includes(g)) ||
      (profile?.healthAdherenceScore != null && profile.healthAdherenceScore >= 60);

    if (wantsHealthy && !where.diet) {
      where.diet = { in: ['vegetarian', 'vegan'] };
    }

    const skillLevel = preferences?.skillLevel || 'beginner';
    const cookingFreq = profile?.cookingFrequency;

    if (cookingFreq === 'daily' || cookingFreq === 'weekly') {
      if (skillLevel !== 'advanced') {
        where.cookingTime = { lte: 45 };
      }
    } else {
      where.cookingTime = { lte: 30 };
    }

    let recipes = await this.prisma.recipe.findMany({
      where,
      take: limit * 2,
      include: { ingredients: { take: 5 } },
      orderBy: { createdAt: 'desc' },
    });

    if (allergies.length && recipes.length) {
      recipes = recipes.filter(recipe => {
        const r = recipe as any;
        const ingredientList = r.ingredients || [];
        const ingredientNames = ingredientList.map((i: any) => i.name || '');
        return !allergies.some(allergy =>
          ingredientNames.some((ing: string) => ing.includes(allergy))
        );
      });
    }

    // اصلاحیه: safe parse favoriteFoods
    if (profile?.favoriteFoods) {
      let favArray: string[] = [];
      if (Array.isArray(profile.favoriteFoods)) {
        favArray = profile.favoriteFoods.filter(f => typeof f === 'string');
      } else if (typeof profile.favoriteFoods === 'string') {
        try {
          const parsed = JSON.parse(profile.favoriteFoods);
          if (Array.isArray(parsed)) favArray = parsed.filter(f => typeof f === 'string');
        } catch {}
      }

      if (favArray.length) {
        const favSet = new Set(favArray.map(f => f.toLowerCase()));
        recipes.sort((a, b) => {
          const ra = a as any, rb = b as any;
          const aCategories: string[] = ra.categories || [];
          const bCategories: string[] = rb.categories || [];
          const aScore = (favSet.has(ra.title?.toLowerCase()) ? 2 : 0) +
                         (aCategories.some((c: string) => favSet.has(c.toLowerCase())) ? 1 : 0);
          const bScore = (favSet.has(rb.title?.toLowerCase()) ? 2 : 0) +
                         (bCategories.some((c: string) => favSet.has(c.toLowerCase())) ? 1 : 0);
          return bScore - aScore;
        });
      }
    }

    return recipes.slice(0, limit);
  }
}