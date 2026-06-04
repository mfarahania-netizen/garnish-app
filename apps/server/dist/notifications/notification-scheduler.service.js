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
const date_utils_1 = require("../utils/date.utils");
let NotificationSchedulerService = class NotificationSchedulerService {
    prisma;
    notificationsService;
    lastMealReminder = new Map();
    constructor(prisma, notificationsService) {
        this.prisma = prisma;
        this.notificationsService = notificationsService;
    }
    async handleDailyReminders() {
        const startOfWeek = (0, date_utils_1.getStartOfWeek)();
        const usersWithData = await this.prisma.user.findMany({
            select: {
                id: true,
                shoppingList: {
                    take: 1,
                    include: { items: { where: { isChecked: false } } },
                    orderBy: { createdAt: 'desc' },
                },
                mealPlans: {
                    take: 1,
                    where: { weekStart: startOfWeek },
                    include: { slots: true },
                },
            },
        });
        const notifications = [];
        for (const user of usersWithData) {
            const list = user.shoppingList[0];
            if (list && list.items.length > 0) {
                notifications.push(this.notificationsService.notifyShoppingReminder(user.id, list.items.length));
            }
            const plan = user.mealPlans[0];
            if (!plan || plan.slots.length === 0) {
                notifications.push(this.notificationsService.notifyWeeklyPlanEmpty(user.id));
            }
        }
        await Promise.allSettled(notifications);
    }
    async handleMealReminders() {
        const now = new Date();
        const todayDayOfWeek = now.getDay();
        const startOfWeek = (0, date_utils_1.getStartOfWeek)();
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
                const key = `${plan.userId}:ناهار`;
                const last = this.lastMealReminder.get(key);
                if (!last || (now.getTime() - last.getTime()) > 2 * 60 * 60 * 1000) {
                    await this.notificationsService.notifyMealReminder(plan.userId, 'ناهار');
                    this.lastMealReminder.set(key, now);
                }
            }
            if (!hasDinner && hour >= 16 && hour < 18) {
                const key = `${plan.userId}:شام`;
                const last = this.lastMealReminder.get(key);
                if (!last || (now.getTime() - last.getTime()) > 2 * 60 * 60 * 1000) {
                    await this.notificationsService.notifyMealReminder(plan.userId, 'شام');
                    this.lastMealReminder.set(key, now);
                }
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