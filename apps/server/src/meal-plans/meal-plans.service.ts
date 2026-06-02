import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MealPlansService {
  constructor(private prisma: PrismaService) {}

  async getCurrentPlan(userId: string) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

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

    let allRecipes = await this.prisma.recipe.findMany({
      include: { ingredients: true },
    });

    if (userDiet === 'vegetarian' || userDiet === 'vegan') {
      allRecipes = allRecipes.filter(r => r.diet === 'vegetarian' || r.diet === 'vegan');
    }
    if (userAllergies.length > 0) {
      allRecipes = allRecipes.filter(r => {
        const recipeAllergens = r.allergens ? JSON.parse(r.allergens) : [];
        return !userAllergies.some((allergy) => recipeAllergens.includes(allergy));
      });
    }
    if (userSkill === 'beginner') {
      allRecipes = allRecipes.filter(r => r.difficulty !== 'سخت');
    }
    if (userBudget === 'low') {
      allRecipes = allRecipes.filter(r => r.cost === 'کم‌هزینه');
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

    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

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
}