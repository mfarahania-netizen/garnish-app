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
exports.RecipesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let RecipesService = class RecipesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(skip = 0, take = 20) {
        const [data, total] = await Promise.all([
            this.prisma.recipe.findMany({
                skip,
                take,
                include: {
                    ingredients: true,
                    steps: true,
                    searchTerms: true,
                    nutrition: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.recipe.count(),
        ]);
        return {
            data,
            total,
            page: Math.floor(skip / take) + 1,
            pageSize: take,
        };
    }
    async findOne(id) {
        return this.prisma.recipe.findUnique({
            where: { id },
            include: {
                ingredients: true,
                steps: true,
                nutrition: true,
                searchTerms: true,
            },
        });
    }
    async getMyRecipes(userId) {
        return this.prisma.recipe.findMany({
            where: { authorId: userId },
            include: { ingredients: true, steps: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async create(userId, data) {
        return this.prisma.recipe.create({
            data: {
                title: data.title,
                description: data.description || '',
                category: data.category || '',
                region: data.region || '',
                difficulty: data.difficulty || '',
                cookingTime: data.cookingTime ?? null,
                servings: data.servings ?? null,
                prepTime: data.prepTime || '',
                totalTime: data.totalTime || '',
                mealType: data.mealType || '',
                diet: data.diet || '',
                cost: data.cost || '',
                tools: JSON.stringify(data.tools || []),
                tips: JSON.stringify(data.tips || []),
                faq: JSON.stringify(data.faq || []),
                categories: JSON.stringify(data.categories || []),
                allergens: JSON.stringify(data.allergens || []),
                occasion: JSON.stringify(data.occasion || []),
                authorId: userId,
                status: 'pending',
                ingredients: {
                    create: (data.ingredients || []).map((ing, idx) => ({
                        name: ing.name || '',
                        amount: ing.amount || null,
                        unit: ing.unit || '',
                        notes: ing.notes || '',
                        order: idx,
                    })),
                },
                steps: {
                    create: (data.steps || []).map((step, idx) => ({
                        instruction: step.instruction || '',
                        order: idx,
                    })),
                },
            },
            include: {
                ingredients: true,
                steps: true,
            },
        });
    }
    async update(id, data) {
        return this.prisma.recipe.update({
            where: { id },
            data: {
                title: data.title,
                description: data.description,
                category: data.category,
                region: data.region,
                difficulty: data.difficulty,
                cookingTime: data.cookingTime,
                servings: data.servings,
                prepTime: data.prepTime,
                totalTime: data.totalTime,
                mealType: data.mealType,
                diet: data.diet,
                cost: data.cost,
                tools: data.tools ? JSON.stringify(data.tools) : undefined,
                tips: data.tips ? JSON.stringify(data.tips) : undefined,
                faq: data.faq ? JSON.stringify(data.faq) : undefined,
                categories: data.categories ? JSON.stringify(data.categories) : undefined,
                allergens: data.allergens ? JSON.stringify(data.allergens) : undefined,
                occasion: data.occasion ? JSON.stringify(data.occasion) : undefined,
            },
        });
    }
};
exports.RecipesService = RecipesService;
exports.RecipesService = RecipesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RecipesService);
//# sourceMappingURL=recipes.service.js.map