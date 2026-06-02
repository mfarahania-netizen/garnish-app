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
exports.NotificationSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const notifications_service_1 = require("./notifications.service");
let NotificationSchedulerService = class NotificationSchedulerService {
    prisma;
    notificationsService;
    constructor(prisma, notificationsService) {
        this.prisma = prisma;
        this.notificationsService = notificationsService;
    }
    async handleDailyReminders() {
        const users = await this.prisma.user.findMany({ select: { id: true } });
        for (const user of users) {
            const shoppingList = await this.prisma.shoppingList.findFirst({
                where: { userId: user.id },
                include: { items: true },
            });
            if (shoppingList) {
                const unchecked = shoppingList.items.filter(item => !item.isChecked);
                if (unchecked.length > 0) {
                    await this.notificationsService.notifyShoppingReminder(user.id, unchecked.length);
                }
            }
            const now = new Date();
            const startOfWeek = new Date(now);
            const dayOfWeek = now.getDay();
            startOfWeek.setDate(now.getDate() - dayOfWeek);
            startOfWeek.setHours(0, 0, 0, 0);
            const mealPlan = await this.prisma.mealPlan.findFirst({
                where: { userId: user.id, weekStart: startOfWeek },
                include: { slots: true },
            });
            if (!mealPlan || mealPlan.slots.length === 0) {
                await this.notificationsService.notifyWeeklyPlanEmpty(user.id);
            }
        }
    }
    async handleMealReminders() {
        const now = new Date();
        const todayDayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - todayDayOfWeek);
        startOfWeek.setHours(0, 0, 0, 0);
        const mealPlans = await this.prisma.mealPlan.findMany({
            where: { weekStart: startOfWeek },
            include: { slots: true },
        });
        for (const plan of mealPlans) {
            const todaySlots = plan.slots.filter(s => s.dayOfWeek === todayDayOfWeek);
            const hasLunch = todaySlots.some(s => s.mealType === 'ناهار');
            const hasDinner = todaySlots.some(s => s.mealType === 'شام');
            const hour = now.getHours();
            if (!hasLunch && hour >= 11 && hour < 13) {
                await this.notificationsService.notifyMealReminder(plan.userId, 'ناهار');
            }
            if (!hasDinner && hour >= 16 && hour < 18) {
                await this.notificationsService.notifyMealReminder(plan.userId, 'شام');
            }
        }
    }
};
exports.NotificationSchedulerService = NotificationSchedulerService;
__decorate([
    (0, schedule_1.Cron)('0 10 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationSchedulerService.prototype, "handleDailyReminders", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_30_MINUTES),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationSchedulerService.prototype, "handleMealReminders", null);
exports.NotificationSchedulerService = NotificationSchedulerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notifications_service_1.NotificationsService])
], NotificationSchedulerService);
//# sourceMappingURL=notification-scheduler.service.js.map