// apps/server/src/notifications/notification-scheduler.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { getStartOfWeek } from '../utils/date.utils';

@Injectable()
export class NotificationSchedulerService {
  // حافظهٔ موقت برای جلوگیری از ارسال تکراری اعلان‌ها
  private lastMealReminder = new Map<string, Date>();

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 10 * * *')
  async handleDailyReminders() {
    const startOfWeek = getStartOfWeek();

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

    const notifications: Promise<any>[] = [];

    for (const user of usersWithData) {
      const list = user.shoppingList[0];
      if (list && list.items.length > 0) {
        notifications.push(
          this.notificationsService.notifyShoppingReminder(user.id, list.items.length)
        );
      }
      const plan = user.mealPlans[0];
      if (!plan || plan.slots.length === 0) {
        notifications.push(
          this.notificationsService.notifyWeeklyPlanEmpty(user.id)
        );
      }
    }

    await Promise.allSettled(notifications);
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleMealReminders() {
    const now = new Date();
    const todayDayOfWeek = now.getDay();
    const startOfWeek = getStartOfWeek();

    const mealPlans = await this.prisma.mealPlan.findMany({
      where: { weekStart: startOfWeek },
      include: { slots: true },
    });

    for (const plan of mealPlans) {
      const todaySlots = plan.slots.filter(s => s.dayOfWeek === todayDayOfWeek);
      const hasLunch = todaySlots.some(s => s.mealType === 'ناهار');
      const hasDinner = todaySlots.some(s => s.mealType === 'شام');
      const hour = now.getHours();

      // بررسی ناهار
      if (!hasLunch && hour >= 11 && hour < 13) {
        const key = `${plan.userId}:ناهار`;
        const last = this.lastMealReminder.get(key);
        // اگر قبلاً ارسال نشده یا بیش از ۲ ساعت گذشته، ارسال کن
        if (!last || (now.getTime() - last.getTime()) > 2 * 60 * 60 * 1000) {
          await this.notificationsService.notifyMealReminder(plan.userId, 'ناهار');
          this.lastMealReminder.set(key, now);
        }
      }

      // بررسی شام
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

  // 🆕 هر دوشنبه ساعت ۹ صبح – کاربران با ریسک ریزش بالا
  @Cron('0 9 * * 1')
  async handleChurnRiskNotifications() {
    const highRiskUsers = await this.prisma.userBehaviorProfile.findMany({
      where: {
        churnRiskScore: { gte: 70 },
      },
      select: { userId: true },
    });

    console.log(`⚠️ Found ${highRiskUsers.length} users with high churn risk.`);

    const notifications = highRiskUsers.map(profile =>
      this.prisma.notification.create({
        data: {
          userId: profile.userId,
          title: 'دلتنگت شدیم! 😢',
          body: 'مدتیه که کمتر از گارنیش استفاده می‌کنی. بیا دوباره با هم غذاهای خوشمزه بپزیم!',
          type: 'churn_risk',
        },
      })
    );

    const results = await Promise.allSettled(notifications);
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Churn risk notifications sent: ${succeeded} succeeded.`);
  }
}