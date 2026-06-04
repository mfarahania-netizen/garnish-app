"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealPlansService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const date_utils_1 = require("../utils/date.utils");
let MealPlansService = class MealPlansService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCurrentPlan(userId) {
        const startOfWeek = (0, date_utils_1.getStartOfWeek)();
        return this.prisma.mealPlan.findFirst({
            where: {
                userId,
                weekStart: startOfWeek,
            },
            include: { slots: { include: { recipe: true } } },
        });
    }
    async savePlan(userId, weekStart, slots) {
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
    async generateSmartPlan(userId) {
        const profile = await this.prisma.userPreference.findUnique({
            where: { userId },
        });
        let userAllergies = [];
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
        const where = {};
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
        const planSlots = [];
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
        const startOfWeek = (0, date_utils_1.getStartOfWeek)();
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
    async addMealSlot(userId, dayOfWeek, mealType, recipeId) {
        const startOfWeek = (0, date_utils_1.getStartOfWeek)();
        let plan = await this.prisma.mealPlan.findFirst({
            where: { userId, weekStart: startOfWeek },
        });
        if (!plan) {
            plan = await this.prisma.mealPlan.create({
                data: { userId, weekStart: startOfWeek },
            });
        }
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
    async removeMealSlot(userId, dayOfWeek, mealType) {
        const startOfWeek = (0, date_utils_1.getStartOfWeek)();
        const plan = await this.prisma.mealPlan.findFirst({
            where: { userId, weekStart: startOfWeek },
        });
        if (!plan)
            return null;
        return this.prisma.mealSlot.deleteMany({
            where: { mealPlanId: plan.id, dayOfWeek, mealType },
        });
    }
};
exports.MealPlansService = MealPlansService;
exports.MealPlansService = MealPlansService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MealPlansService);
//# sourceMappingURL=meal-plans.service.js.map