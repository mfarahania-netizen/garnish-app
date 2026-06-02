import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // ---- متد پایه (ایجاد اعلان) ----
  private async createAndSendNotification(
    userId: string,
    title: string,
    body: string,
    type = 'system',
    data?: any,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        body,
        type,
        data: data ? JSON.stringify(data) : null,
      },
    });
    // در آینده: اینجا Push Notification هم ارسال می‌شود
    return notification;
  }

  // ---- متدهای تخصصی برای رویدادها ----

  async notifyTicketReply(userId: string, ticketSubject: string) {
    return this.createAndSendNotification(
      userId,
      '📬 پاسخ جدید برای تیکت شما',
      `پشتیبانی به تیکت «${ticketSubject}» پاسخ داد.`,
      'ticket_reply',
    );
  }

  async notifyMealPlanned(userId: string, mealTitle: string, day: string, mealType: string) {
    return this.createAndSendNotification(
      userId,
      '🍽️ وعدهٔ جدید در برنامه',
      `${mealTitle} به ${mealType} روز ${day} اضافه شد.`,
      'meal_added',
    );
  }

  async notifyBadgeEarned(userId: string, badgeTitle: string) {
    return this.createAndSendNotification(
      userId,
      '🏆 نشان جدید دریافت کردید!',
      `شما نشان «${badgeTitle}» را کسب کردید.`,
      'badge_earned',
    );
  }

  async notifyShoppingReminder(userId: string, uncheckedCount: number) {
    return this.createAndSendNotification(
      userId,
      '🛒 یادآوری خرید',
      `${uncheckedCount} قلم از لیست خرید شما هنوز خریده نشده‌اند.`,
      'shopping_reminder',
    );
  }

  async notifyWeeklyPlanEmpty(userId: string) {
    return this.createAndSendNotification(
      userId,
      '📅 برنامه هفتگی خالی است',
      'به‌نظر می‌رسد این هفته را هنوز برنامه‌ریزی نکرده‌اید. دوست دارید چند پیشنهاد ببینید؟',
      'plan_empty',
    );
  }

  async notifyMealReminder(userId: string, mealType: string) {
    return this.createAndSendNotification(
      userId,
      `⏰ یادآوری ${mealType}`,
      `هنوز برای ${mealType} امروز برنامه‌ای ثبت نکرده‌اید.`,
      'meal_reminder',
    );
  }

  // ---- متدهای عمومی (برای کنترلر) ----

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId },
    });
  }

  async generateSmartSuggestion(userId: string) {
    // همان کد generateSmartNotification قبلی (بدون تغییر)
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
}