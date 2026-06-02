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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let NotificationsService = class NotificationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createAndSendNotification(userId, title, body, type = 'system', data) {
        const notification = await this.prisma.notification.create({
            data: {
                userId,
                title,
                body,
                type,
                data: data ? JSON.stringify(data) : null,
            },
        });
        return notification;
    }
    async notifyTicketReply(userId, ticketSubject) {
        return this.createAndSendNotification(userId, '📬 پاسخ جدید برای تیکت شما', `پشتیبانی به تیکت «${ticketSubject}» پاسخ داد.`, 'ticket_reply');
    }
    async notifyMealPlanned(userId, mealTitle, day, mealType) {
        return this.createAndSendNotification(userId, '🍽️ وعدهٔ جدید در برنامه', `${mealTitle} به ${mealType} روز ${day} اضافه شد.`, 'meal_added');
    }
    async notifyBadgeEarned(userId, badgeTitle) {
        return this.createAndSendNotification(userId, '🏆 نشان جدید دریافت کردید!', `شما نشان «${badgeTitle}» را کسب کردید.`, 'badge_earned');
    }
    async notifyShoppingReminder(userId, uncheckedCount) {
        return this.createAndSendNotification(userId, '🛒 یادآوری خرید', `${uncheckedCount} قلم از لیست خرید شما هنوز خریده نشده‌اند.`, 'shopping_reminder');
    }
    async notifyWeeklyPlanEmpty(userId) {
        return this.createAndSendNotification(userId, '📅 برنامه هفتگی خالی است', 'به‌نظر می‌رسد این هفته را هنوز برنامه‌ریزی نکرده‌اید. دوست دارید چند پیشنهاد ببینید؟', 'plan_empty');
    }
    async notifyMealReminder(userId, mealType) {
        return this.createAndSendNotification(userId, `⏰ یادآوری ${mealType}`, `هنوز برای ${mealType} امروز برنامه‌ای ثبت نکرده‌اید.`, 'meal_reminder');
    }
    async getUserNotifications(userId) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async markAsRead(notificationId, userId) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }
    async deleteNotification(notificationId, userId) {
        return this.prisma.notification.deleteMany({
            where: { id: notificationId, userId },
        });
    }
    async generateSmartSuggestion(userId) {
        const profile = await this.prisma.userPreference.findUnique({ where: { userId } });
        const mealPlan = await this.prisma.mealPlan.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { slots: { include: { recipe: true } } },
        });
        const favorites = await this.prisma.favoriteRecipe.findMany({
            where: { userId },
            include: { recipe: true },
            take: 5,
        });
        const today = new Date();
        const dayNames = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
        const todayName = dayNames[today.getDay()];
        const todaySlots = mealPlan?.slots?.filter(s => s.dayOfWeek === today.getDay()) || [];
        const plannedTitles = todaySlots.map(s => s.recipe?.title).filter(Boolean).join('، ') || 'بدون برنامه';
        const favTitles = favorites.map(f => f.recipe.title).join('، ') || 'بدون علاقه‌مندی';
        const diet = profile?.diet === 'vegetarian' ? 'گیاه‌خوار' : profile?.diet === 'vegan' ? 'وگان' : 'همه‌چیزخوار';
        const message = `امروز ${todayName} است! با توجه به رژیم ${diet} و علاقه‌مندی‌های شما (${favTitles})، چطوره امروز یک غذای جدید امتحان کنید؟`;
        return this.prisma.notification.create({
            data: {
                userId,
                title: `🍽️ پیشنهاد امروز`,
                body: message,
                type: 'suggestion',
                isRead: false,
            },
        });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map