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
exports.PersonalizationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PersonalizationService = class PersonalizationService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getUserRules(userId) {
        const profile = await this.prisma.userPreference.findUnique({
            where: { userId },
        });
        const rules = [];
        if (!profile)
            return rules;
        const userAllergies = await this.prisma.userAllergy.findMany({
            where: { userId },
            include: { allergy: true },
        });
        const allergyNames = userAllergies.map(ua => ua.allergy.name);
        if (allergyNames.length > 0) {
            rules.push({
                name: 'allergy-filter',
                apply: (recipes) => recipes.filter((recipe) => {
                    const recipeAllergens = recipe.allergens ? JSON.parse(recipe.allergens) : [];
                    return !allergyNames.some((allergy) => recipeAllergens.includes(allergy));
                }),
            });
        }
        if (profile.diet) {
            if (profile.diet === 'vegetarian') {
                rules.push({
                    name: 'diet-vegetarian',
                    apply: (recipes) => recipes.filter((r) => r.diet === 'vegetarian' || r.diet === 'vegan'),
                });
            }
            else if (profile.diet === 'vegan') {
                rules.push({
                    name: 'diet-vegan',
                    apply: (recipes) => recipes.filter((r) => r.diet === 'vegan'),
                });
            }
        }
        if (profile.budget) {
            rules.push({
                name: 'budget-priority',
                apply: (recipes) => {
                    const costOrder = { 'کم‌هزینه': 1, 'متوسط': 2, 'گران': 3 };
                    recipes.sort((a, b) => (costOrder[a.cost] || 99) - (costOrder[b.cost] || 99));
                    return recipes;
                },
            });
        }
        if (profile.skillLevel === 'beginner') {
            rules.push({
                name: 'skill-beginner',
                apply: (recipes) => recipes.filter((r) => r.difficulty !== 'سخت'),
            });
        }
        return rules;
    }
    applyRules(recipes, rules) {
        let result = [...recipes];
        for (const rule of rules) {
            result = rule.apply(result);
        }
        return result;
    }
};
exports.PersonalizationService = PersonalizationService;
exports.PersonalizationService = PersonalizationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PersonalizationService);
//# sourceMappingURL=personalization.service.js.map