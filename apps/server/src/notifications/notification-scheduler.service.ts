import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationSchedulerService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  @Cron('0 10 * * *')
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

  @Cron(CronExpression.EVERY_30_MINUTES)
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
}