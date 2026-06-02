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
exports.BehavioralProfileService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let BehavioralProfileService = class BehavioralProfileService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async updateOrCreateProfile(userId) {
        const events = await this.prisma.userEvent.findMany({
            where: { userId },
            orderBy: { timestamp: 'desc' },
            take: 500,
        });
        const recipeCountMap = new Map();
        for (const event of events) {
            try {
                const p = JSON.parse(event.payload || '{}');
                if (p.recipeId && ['recipe_view', 'favorite_add'].includes(event.type)) {
                    recipeCountMap.set(p.recipeId, (recipeCountMap.get(p.recipeId) || 0) + 1);
                }
            }
            catch { }
        }
        const favoriteFoods = [...recipeCountMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id]) => id);
        const shoppingItems = await this.prisma.shoppingItem.findMany({
            where: { shoppingList: { userId } },
            select: { name: true, isChecked: true },
        });
        const itemCounts = {};
        for (const item of shoppingItems) {
            itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
        }
        const shoppingPattern = Object.entries(itemCounts).map(([name, freq]) => ({ name, freq }));
        const daysWithEvents = new Set(events.map(e => e.timestamp.toISOString().slice(0, 10))).size;
        const totalDays = 30;
        const consistencyScore = Math.min(daysWithEvents / totalDays, 1.0);
        return this.prisma.userBehaviorProfile.upsert({
            where: { userId },
            update: {
                favoriteFoods: JSON.stringify(favoriteFoods),
                shoppingPattern: JSON.stringify(shoppingPattern),
                consistencyScore,
            },
            create: {
                userId,
                favoriteFoods: JSON.stringify(favoriteFoods),
                shoppingPattern: JSON.stringify(shoppingPattern),
                consistencyScore,
            },
        });
    }
    async getProfile(userId) {
        return this.prisma.userBehaviorProfile.findUnique({ where: { userId } });
    }
};
exports.BehavioralProfileService = BehavioralProfileService;
exports.BehavioralProfileService = BehavioralProfileService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BehavioralProfileService);
//# sourceMappingURL=behavioral-profile.service.js.map