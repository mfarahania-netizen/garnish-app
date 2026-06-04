import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getStartOfWeek } from '../utils/date.utils';

@Injectable()
export class MealPlansService {
  constructor(private prisma: PrismaService) {}

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

    let userAllergies: string[] = [];
    if (profile) {
      const allergies = await this.prisma.userAllergy.findMany({
        where: { userId },
        include: { allergy: true },
      });
      userAllergies = allergies.map(ua => ua.allergy.name);
    }

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

    if (userAllergies.length > 0) {
      allRecipes = allRecipes.filter(r => {
        const recipeAllergens = r.allergens ? JSON.parse(r.allergens) : [];
        return !userAllergies.some(allergy => recipeAllergens.includes(allergy));
      });
    }

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

  // ===== متدهای جدید برای افزودن/حذف اتمیک =====

  async addMealSlot(userId: string, dayOfWeek: number, mealType: string, recipeId: string) {
    const startOfWeek = getStartOfWeek();

    let plan = await this.prisma.mealPlan.findFirst({
      where: { userId, weekStart: startOfWeek },
    });

    if (!plan) {
      plan = await this.prisma.mealPlan.create({
        data: { userId, weekStart: startOfWeek },
      });
    }

    // اگر قبلاً این وعده وجود داشت، حذفش کن (جایگزینی)
    await this.prisma.mealSlot.deleteMany({
      where: { mealPlanId: plan.id, dayOfWeek, mealType },
    });

    return this.prisma.mealSlot.create({
      data: {
        mealPlanId: plan.id,
        dayOfWeek,
        mealType,
        recipeId,
      },
      include: { recipe: true },
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