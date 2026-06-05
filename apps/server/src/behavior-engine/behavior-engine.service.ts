import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BehaviorEngineService {
  constructor(private prisma: PrismaService) {}

  /**
   * پردازش رویدادهای یک کاربر خاص و به‌روزرسانی پروفایل رفتاری او
   */
  async processEventsForUser(userId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // فقط رویدادهای ۳۰ روز اخیر
    const recentEvents = await this.prisma.userEvent.findMany({
      where: {
        userId,
        timestamp: { gte: thirtyDaysAgo },
      },
      orderBy: { timestamp: 'asc' },
    });

    // اگر هیچ رویدادی نباشد، پروفایل ساخته نمی‌شود یا صفرها ثبت می‌شود
    if (recentEvents.length === 0) {
      // همچنان می‌توانیم پروفایل را با مقادیر پیش‌فرض به‌روز کنیم
      return this.prisma.userBehaviorProfile.upsert({
        where: { userId },
        create: {
          userId,
          consistencyScore: 0,
          churnRiskScore: 100,
          healthAdherenceScore: 0,
          cookingFrequency: 'rarely',
          budgetScore: 'low',
        },
        update: {
          consistencyScore: 0,
          churnRiskScore: 100,
          healthAdherenceScore: 0,
          cookingFrequency: 'rarely',
          budgetScore: 'low',
        },
      });
    }

    // محاسبه churnRiskScore بر اساس تعداد روزهای فعال در ۳۰ روز گذشته
    const activeDays = new Set(recentEvents.map(e => e.timestamp.toISOString().slice(0, 10))).size;
    const churnRiskScore = Math.max(0, Math.min(100, Math.round(100 - (activeDays / 30) * 100)));

    // محاسبه consistencyScore بر اساس تعداد هفته‌های فعال (شنبه تا جمعه) در ۴ هفته اخیر
    const activeWeeks = new Set<string>();
    for (const event of recentEvents) {
      const d = event.timestamp;
      // محاسبه شروع هفته (شنبه) متناسب با تقویم ایران
      const dayOfWeek = (d.getDay() + 1) % 7; // یک‌شنبه=0 → شنبه=0
      const saturday = new Date(d);
      saturday.setDate(d.getDate() - dayOfWeek);
      activeWeeks.add(saturday.toISOString().slice(0, 10));
    }
    const consistencyScore = Math.min(100, Math.round((activeWeeks.size / 4) * 100));

    // cookingFrequency بر اساس تعداد رویدادهای mealplan در ۳۰ روز
    const mealPlanEvents = recentEvents.filter(e => e.type.startsWith('mealplan_')).length;
    let cookingFrequency: string;
    if (mealPlanEvents >= 10) cookingFrequency = 'daily';
    else if (mealPlanEvents >= 3) cookingFrequency = 'weekly';
    else cookingFrequency = 'rarely';

    // budgetScore بر اساس shoppingEvents در ۳۰ روز
    const shoppingEvents = recentEvents.filter(e => e.type.startsWith('shopping_')).length;
    let budgetScore: string;
    if (shoppingEvents > 5) budgetScore = 'high';
    else if (shoppingEvents > 2) budgetScore = 'medium';
    else budgetScore = 'low';

    // healthAdherenceScore بر اساس رویدادهای nutrition در ۳۰ روز
    const nutritionEvents = recentEvents.filter(e => e.type.startsWith('nutrition_')).length;
    const healthAdherenceScore = Math.round((nutritionEvents / recentEvents.length) * 100);

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
   * (در صورت نیاز می‌توان آن را غیرفعال کرد)
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