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
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const event_enrichment_service_1 = require("./event-enrichment.service");
let AnalyticsService = class AnalyticsService {
    prisma;
    enrichmentService;
    constructor(prisma, enrichmentService) {
        this.prisma = prisma;
        this.enrichmentService = enrichmentService;
    }
    async trackEvent(data) {
        const eventData = {
            userId: data.userId,
            type: data.type,
        };
        if (data.page)
            eventData.page = data.page;
        if (data.duration)
            eventData.duration = data.duration;
        if (data.sessionId)
            eventData.sessionId = data.sessionId;
        if (data.payload)
            eventData.payload = JSON.stringify(data.payload);
        const event = await this.prisma.userEvent.create({ data: eventData });
        this.enrichmentService.enrichEvent(event.id);
        return event;
    }
    async getPopularRecipes() {
        return this.prisma.userEvent.findMany({
            where: { type: 'recipe_view' },
            select: { payload: true },
            take: 100,
        });
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        event_enrichment_service_1.EventEnrichmentService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map