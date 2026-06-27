import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeSafetyFilterService } from '../recipes/intelligence/recipe-safety-filter.service';
import { isRecipeVisibleTo } from '../recipes/recipe-visibility';
import { getStartOfWeek } from '../utils/date.utils';

@Injectable()
export class MealPlansService {
  constructor(
    private prisma: PrismaService,
    private readonly safety: RecipeSafetyFilterService,
  ) {}

  async getCurrentPlan(userId: string) {
    const startOfWeek = getStartOfWeek();

    const plan = await this.prisma.mealPlan.findFirst({
      where: {
        userId,
        weekStart: startOfWeek,
      },
      include: { slots: { include: { recipe: true } } },
    });
    return this.sanitizePlan(plan, userId);
  }

  /**
   * SECURITY (advisor audit): null out the recipe BODY on any slot whose recipe is not published and not the
   * user's own draft — so a stored reference to someone else's pending/private recipe never echoes its full
   * body back. Byte-identical today (all curated recipes are active+public → every slot recipe stays).
   */
  private sanitizePlan<T extends { slots?: Array<{ recipe?: any }> } | null>(plan: T, userId: string): T {
    if (plan && Array.isArray((plan as any).slots)) {
      for (const slot of (plan as any).slots) {
        if (slot?.recipe && !isRecipeVisibleTo(slot.recipe, userId)) slot.recipe = null;
      }
    }
    return plan;
  }

  async savePlan(userId: string, weekStart: string, slots: { dayOfWeek: number; mealType: string; recipeId?: string; notes?: string }[]) {
    const start = new Date(weekStart);
    const cleanSlots = slots.map(slot => ({
      dayOfWeek: slot.dayOfWeek,
      mealType: slot.mealType,
      recipeId: slot.recipeId || null,
      notes: slot.notes || '',
    }));

    // SECURITY (advisor audit): every referenced recipe must be published (or the user's own draft) — block
    // planning another user's pending/private UGC by a guessed id (which would echo back via getCurrentPlan).
    const recipeIds = [...new Set(cleanSlots.map(s => s.recipeId).filter(Boolean))] as string[];
    if (recipeIds.length) {
      const recipes = await this.prisma.recipe.findMany({
        where: { id: { in: recipeIds } },
        select: { id: true, status: true, isPublic: true, authorId: true },
      });
      const byId = new Map(recipes.map(r => [r.id, r]));
      for (const id of recipeIds) {
        if (!isRecipeVisibleTo(byId.get(id), userId)) throw new NotFoundException(`Recipe ${id} is not available`);
      }
    }

    const plan = await this.prisma.$transaction(async (tx) => {
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
    return this.sanitizePlan(plan, userId);
  }

  async generateSmartPlan(userId: string) {
    const profile = await this.prisma.userPreference.findUnique({
      where: { userId },
    });

    const userDiet = profile?.diet || 'omnivore';
    const userSkill = profile?.skillLevel || 'beginner';
    const userBudget = profile?.budget || 'low';

    const where: any = { status: 'active', isPublic: true }; // advisor audit: plan only from published recipes

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

    // ROBUSTNESS (bug: a fresh/default user has budget='low' → cost='کم‌هزینه', which matched ~0 curated recipes →
    // the generator saved an EMPTY plan; the AI's fill_week_plan and the FE "auto-generate" button both got nothing).
    // If the strict set is too thin for a varied week, relax to diet + safety only (the user-meaningful, safety-critical
    // filters) so a real plan always lands. Soft prefs (budget/skill) shouldn't be able to empty the whole week.
    if (allRecipes.length < 14) {
      const relaxedWhere: any = { status: 'active', isPublic: true };
      if (userDiet === 'vegetarian' || userDiet === 'vegan') relaxedWhere.diet = { in: ['vegetarian', 'vegan'] };
      let relaxed = await this.prisma.recipe.findMany({ where: relaxedWhere, include: { ingredients: true }, take: 200 });
      relaxed = await this.safety.filter(userId, relaxed); // never relax the allergy/pork gate
      if (relaxed.length > allRecipes.length) allRecipes = relaxed;
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

    const plan = await this.prisma.$transaction(async (tx) => {
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
    return this.sanitizePlan(plan, userId); // consistency/defense (source is already published-only)
  }

  // ===== افزودن اسلات با تراکنش (بدون race condition) =====
  async addMealSlot(userId: string, dayOfWeek: number, mealType: string, recipeId: string) {
    const startOfWeek = getStartOfWeek();

    // SECURITY (advisor audit): this is the PRIMARY apply path (POST /meal-plans/slots). Only a published recipe
    // (or the user's own draft) may be placed into a slot — block referencing another user's pending/private UGC
    // by a guessed id, which would otherwise echo the full body back in the response. Byte-identical today.
    if (recipeId) {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: recipeId },
        select: { status: true, isPublic: true, authorId: true },
      });
      if (!isRecipeVisibleTo(recipe, userId)) throw new NotFoundException('Recipe is not available');
    }

    const slot = await this.prisma.$transaction(async (tx) => {
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
    // defense-in-depth: never echo a non-visible recipe body (the pre-check already guarantees this).
    if (slot?.recipe && !isRecipeVisibleTo(slot.recipe as any, userId)) (slot as any).recipe = null;
    return slot;
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