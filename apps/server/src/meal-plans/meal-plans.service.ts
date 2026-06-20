import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeSafetyFilterService } from '../recipes/intelligence/recipe-safety-filter.service';
import { getStartOfWeek } from '../utils/date.utils';

@Injectable()
export class MealPlansService {
  constructor(
    private prisma: PrismaService,
    private readonly safety: RecipeSafetyFilterService,
  ) {}

  async getCurrentPlan(userId: string) {
    const startOfWeek = getStartOfWeek();

    return this.prisma.mealPlan.findFirst({
      where: {
        userId,
        weekStart: startOfWeek,
      },
      include: { slots: { include: { recipe: true } } },
    });
  }

  async savePlan(userId: string, weekStart: string, slots: { dayOfWeek: number; mealType: string; recipeId?: string; notes?: string }[]) {
    const start = new Date(weekStart);
    const cleanSlots = slots.map(slot => ({
      dayOfWeek: slot.dayOfWeek,
      mealType: slot.mealType,
      recipeId: slot.recipeId || null,
      notes: slot.notes || '',
    }));

    return this.prisma.$transaction(async (tx) => {
      await tx.mealSlot.deleteMany({ where: { mealPlan: { userId, weekStart: start } } });
      await tx.mealPlan.deleteMany({ where: { userId, weekStart: start } });

      return tx.mealPlan.create({
        data: {
          userId,
          weekStart: start,
          slots: { create: cleanSlots },
        },
        include: { slots: { include: { recipe: true } } },
      });
    });
  }

  async generateSmartPlan(userId: string) {
    const profile = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    const userDiet = profile?.diet || 'omnivore';
    const userSkill = profile?.skillLevel || 'beginner';
    const userBudget = profile?.budget || 'low';

    const where: any = {};

    if (userDiet === 'vegetarian' || userDiet === 'vegan') {
      where.diet = { in: ['vegetarian', 'vegan'] };
    }

    if (userSkill === 'beginner') {
      where.difficulty = { not: 'سخت' };
    }

    if (userBudget === 'low') {
      where.cost = 'کم‌هزینه';
    }

    let allRecipes = await this.prisma.recipe.findMany({
      where,
      include: { ingredients: true },
      take: 200,
    });

    // HARD safety gate — the ONE reusable filter (derived allergens + looseMatch + pork/observance,
    // fail-closed). Replaces a weaker declared-only exact-match filter that leaked (guardian H1/H2 rework).
    allRecipes = await this.safety.filter(userId, allRecipes);

    const breakfastOptions = allRecipes.filter(r => r.mealType?.includes('breakfast'));
    const lunchOptions = allRecipes.filter(r => r.mealType?.includes('lunch'));
    const dinnerOptions = allRecipes.filter(r => r.mealType?.includes('dinner'));

    const planSlots: { dayOfWeek: number; mealType: string; recipeId: string; notes: string }[] = [];

    for (let i = 0; i < 7; i++) {
      if (lunchOptions.length > 0) {
        const lunch = lunchOptions[i % lunchOptions.length];
        planSlots.push({ dayOfWeek: i, mealType: 'ناهار', recipeId: lunch.id, notes: '' });
      }
      if (dinnerOptions.length > 0) {
        const dinner = dinnerOptions[i % dinnerOptions.length];
        planSlots.push({ dayOfWeek: i, mealType: 'شام', recipeId: dinner.id, notes: '' });
      }
      if (breakfastOptions.length > 0) {
        const breakfast = breakfastOptions[i % breakfastOptions.length];
        planSlots.push({ dayOfWeek: i, mealType: 'صبحانه', recipeId: breakfast.id, notes: '' });
      }
    }

    if (planSlots.length === 0) {
      for (let i = 0; i < 7; i++) {
        if (allRecipes.length > 0) {
          const recipe = allRecipes[i % allRecipes.length];
          planSlots.push({ dayOfWeek: i, mealType: 'ناهار', recipeId: recipe.id, notes: '' });
          if (allRecipes.length > 1) {
            const dinnerRecipe = allRecipes[(i + 1) % allRecipes.length];
            planSlots.push({ dayOfWeek: i, mealType: 'شام', recipeId: dinnerRecipe.id, notes: '' });
          }
        }
      }
    }

    const startOfWeek = getStartOfWeek();

    const cleanSlots = planSlots.map(slot => ({
      dayOfWeek: slot.dayOfWeek,
      mealType: slot.mealType,
      recipeId: slot.recipeId || null,
      notes: slot.notes || '',
    }));

    return this.prisma.$transaction(async (tx) => {
      await tx.mealSlot.deleteMany({ where: { mealPlan: { userId, weekStart: startOfWeek } } });
      await tx.mealPlan.deleteMany({ where: { userId, weekStart: startOfWeek } });

      return tx.mealPlan.create({
        data: {
          userId,
          weekStart: startOfWeek,
          slots: { create: cleanSlots },
        },
        include: { slots: { include: { recipe: true } } },
      });
    });
  }

  // ===== افزودن اسلات با تراکنش (بدون race condition) =====
  async addMealSlot(userId: string, dayOfWeek: number, mealType: string, recipeId: string) {
    const startOfWeek = getStartOfWeek();

    return this.prisma.$transaction(async (tx) => {
      let plan = await tx.mealPlan.findFirst({
        where: { userId, weekStart: startOfWeek },
      });

      if (!plan) {
        plan = await tx.mealPlan.create({
          data: { userId, weekStart: startOfWeek },
        });
      }

      // حذف وعده قبلی برای این روز/نوع
      await tx.mealSlot.deleteMany({
        where: { mealPlanId: plan.id, dayOfWeek, mealType },
      });

      return tx.mealSlot.create({
        data: {
          mealPlanId: plan.id,
          dayOfWeek,
          mealType,
          recipeId,
        },
        include: { recipe: true },
      });
    });
  }

  async removeMealSlot(userId: string, dayOfWeek: number, mealType: string) {
    const startOfWeek = getStartOfWeek();

    const plan = await this.prisma.mealPlan.findFirst({
      where: { userId, weekStart: startOfWeek },
    });

    if (!plan) return null;

    return this.prisma.mealSlot.deleteMany({
      where: { mealPlanId: plan.id, dayOfWeek, mealType },
    });
  }
}