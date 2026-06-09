import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class HealthOutcomeService {
  constructor(private prisma: PrismaService) {}

  @Cron('0 3 * * 1')
  async calculateWeeklyHealthOutcomes() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const lastWeekStart = new Date();
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const completedMealPlans = await this.prisma.mealPlan.count({
        where: {
          userId: user.id,
          weekStart: { gte: lastWeekStart },
          slots: { some: { recipeId: { not: null } } },
        },
      });
      const metricValue = Math.min(100, completedMealPlans * 25);
      const baseline = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'meal_consistency' },
        orderBy: { recordedAt: 'asc' },
      });
      let improvementPercent: number | null = null;
      if (baseline && baseline.metricValue > 0) {
        improvementPercent = Math.round(((metricValue - baseline.metricValue) / baseline.metricValue) * 100);
      }
      const lastWeekOutcome = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'meal_consistency', period: 'weekly' },
        orderBy: { recordedAt: 'desc' },
      });
      let trend: number = 0;
      if (lastWeekOutcome && metricValue !== lastWeekOutcome.metricValue) {
        trend = metricValue > lastWeekOutcome.metricValue ? 1 : -1;
      }
      await this.prisma.userOutcome.create({
        data: {
          userId: user.id,
          metricName: 'meal_consistency',
          baselineValue: baseline?.metricValue,
          metricValue,
          improvementPercent,
          trend,
          period: 'weekly',
          sources: { mealPlans: completedMealPlans },
        },
      });
    }
  }
}