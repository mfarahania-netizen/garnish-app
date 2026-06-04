import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BehaviorEngineService {
  constructor(private prisma: PrismaService) {}

  /**
   * پردازش رویدادهای یک کاربر خاص و به‌روزرسانی پروفایل رفتاری او
   */
  async processEventsForUser(userId: string) {
    const events = await this.prisma.userEvent.findMany({
      where: { userId },
      orderBy: { timestamp: 'asc' },
    });

    if (events.length === 0) return null;

    const totalEvents = events.length;
    const nutritionEvents = events.filter(e => e.type.startsWith('nutrition_')).length;
    const mealPlanEvents = events.filter(e => e.type.startsWith('mealplan_')).length;
    const shoppingEvents = events.filter(e => e.type.startsWith('shopping_')).length;

    const healthAdherenceScore = totalEvents > 0
      ? Math.round((nutritionEvents / totalEvents) * 100)
      : 0;

    const consistencyScore = mealPlanEvents > 0
      ? Math.min(100, mealPlanEvents * 10)
      : 0;

    const churnRiskScore = totalEvents > 0
      ? Math.max(0, 100 - totalEvents)
      : 100;

    const cookingFrequency = mealPlanEvents > 10 ? 'daily' : mealPlanEvents > 3 ? 'weekly' : 'rarely';
    const budgetScore = shoppingEvents > 5 ? 'high' : shoppingEvents > 2 ? 'medium' : 'low';

    return this.prisma.userBehaviorProfile.upsert({
      where: { userId },
      create: {
        userId,
        consistencyScore,
        churnRiskScore,
        healthAdherenceScore,
        cookingFrequency,
        budgetScore,
      },
      update: {
        consistencyScore,
        churnRiskScore,
        healthAdherenceScore,
        cookingFrequency,
        budgetScore,
      },
    });
  }

  /**
   * متد تست خودکار: کاربر تست (09123456789) را پیدا کرده و پردازش می‌کند
   */
  async processEventsForTestUser() {
    const testPhone = '09123456789';
    const user = await this.prisma.user.findUnique({ where: { phone: testPhone } });
    if (!user) {
      return { message: 'کاربر تست با شماره 09123456789 پیدا نشد. لطفاً ابتدا ثبت‌نام کنید.' };
    }
    return this.processEventsForUser(user.id);
  }
}