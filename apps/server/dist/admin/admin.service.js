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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboardStats() {
        const [recipeCount, userCount, ticketCount] = await Promise.all([
            this.prisma.recipe.count(),
            this.prisma.user.count(),
            this.prisma.supportTicket.count(),
        ]);
        return { recipeCount, userCount, ticketCount };
    }
    async getAllTickets() {
        return this.prisma.supportTicket.findMany({
            include: { user: { select: { name: true, phone: true } }, replies: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async respondToTicket(ticketId, message) {
        return this.prisma.ticketReply.create({
            data: { ticketId, message, isStaff: true },
        });
    }
    async updateTicketStatus(ticketId, status) {
        return this.prisma.supportTicket.update({
            where: { id: ticketId },
            data: { status },
        });
    }
    async getAllRecipes() {
        return this.prisma.recipe.findMany({
            include: { author: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async updateRecipeStatus(recipeId, status, adminNote) {
        return this.prisma.recipe.update({
            where: { id: recipeId },
            data: { status, adminNote },
        });
    }
    async getAllUsers() {
        return this.prisma.user.findMany({
            select: { id: true, name: true, phone: true, email: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getRecentEvents(limit = 50) {
        const events = await this.prisma.userEvent.findMany({
            take: limit,
            orderBy: { timestamp: 'desc' },
            include: { user: { select: { name: true, phone: true } } },
        });
        const recipeIds = [];
        for (const event of events) {
            try {
                const p = JSON.parse(event.payload || '{}');
                if (p.recipeId)
                    recipeIds.push(p.recipeId);
            }
            catch { }
        }
        let recipes = [];
        if (recipeIds.length > 0) {
            recipes = await this.prisma.recipe.findMany({
                where: { id: { in: recipeIds } },
                select: { id: true, title: true },
            });
        }
        const recipeMap = new Map(recipes.map(r => [r.id, r.title]));
        return events.map(event => {
            let recipeTitle = null;
            try {
                const p = JSON.parse(event.payload || '{}');
                if (p.recipeId)
                    recipeTitle = recipeMap.get(p.recipeId) || null;
            }
            catch { }
            return { ...event, recipeTitle };
        });
    }
    async getAnalyticsStats() {
        const totalEvents = await this.prisma.userEvent.count();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEvents = await this.prisma.userEvent.count({ where: { timestamp: { gte: today } } });
        return { totalEvents, todayEvents };
    }
    async getTopSearchQueries(limit = 10) {
        const events = await this.prisma.userEvent.findMany({
            where: { type: 'search_query' },
            select: { payload: true },
            take: 1000,
        });
        const countMap = new Map();
        for (const e of events) {
            try {
                const p = JSON.parse(e.payload || '{}');
                if (p.query)
                    countMap.set(p.query, (countMap.get(p.query) || 0) + 1);
            }
            catch { }
        }
        return [...countMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([query, count]) => ({ query, count }));
    }
    async getMealPlanningStats() {
        const [addEvents, generateCount] = await Promise.all([
            this.prisma.userEvent.findMany({ where: { type: 'mealplan_add' }, select: { payload: true } }),
            this.prisma.userEvent.count({ where: { type: 'mealplan_generate' } }),
        ]);
        const recipeCounts = new Map();
        for (const e of addEvents) {
            try {
                const p = JSON.parse(e.payload || '{}');
                if (p.recipeId)
                    recipeCounts.set(p.recipeId, (recipeCounts.get(p.recipeId) || 0) + 1);
            }
            catch { }
        }
        const topIds = [...recipeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
        let topRecipes = [];
        if (topIds.length > 0) {
            const recipes = await this.prisma.recipe.findMany({ where: { id: { in: topIds } }, select: { id: true, title: true } });
            topRecipes = recipes.map(r => ({ id: r.id, title: r.title, count: recipeCounts.get(r.id) || 0 }));
        }
        return { topRecipes, generateCount };
    }
    async getAIInteractionStats() {
        const events = await this.prisma.userEvent.findMany({
            where: { type: 'ai_message_send' },
            select: { enrichment: true },
        });
        const totalMessages = events.length;
        const ingredientMap = new Map();
        const conceptMap = new Map();
        const recipeMap = new Map();
        for (const e of events) {
            try {
                const en = JSON.parse(e.enrichment || '{}');
                for (const ing of (en.ingredients || []))
                    ingredientMap.set(ing, (ingredientMap.get(ing) || 0) + 1);
                for (const c of (en.concepts || []))
                    conceptMap.set(c, (conceptMap.get(c) || 0) + 1);
                for (const r of (en.recipes || []))
                    recipeMap.set(r, (recipeMap.get(r) || 0) + 1);
            }
            catch { }
        }
        const topIngredients = [...ingredientMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
        const topConcepts = [...conceptMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
        const topRecipes = [...recipeMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
        const voiceSearches = await this.prisma.userEvent.count({ where: { type: 'ai_voice_search' } });
        return { totalMessages, topIngredients, topConcepts, topRecipes, voiceSearches };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map