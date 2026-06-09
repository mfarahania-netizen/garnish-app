import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class AdherenceOutcomeService {
  constructor(private prisma: PrismaService) {}

  @Cron('0 5 * * 1')
  async calculateWeeklyAdherenceOutcomes() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const totalWeeks = 4;
      const weeksWithPlan = await this.prisma.mealPlan.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
        },
      });
      const metricValue = Math.min(100, (weeksWithPlan / totalWeeks) * 100);
      const baseline = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'goal_adherence' },
        orderBy: { recordedAt: 'asc' },
      });
      let improvementPercent: number | null = null;
      if (baseline && baseline.metricValue > 0) {
        improvementPercent = Math.round(((metricValue - baseline.metricValue) / baseline.metricValue) * 100);
      }
      const lastWeekOutcome = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'goal_adherence', period: 'weekly' },
        orderBy: { recordedAt: 'desc' },
      });
      let trend: number = 0;
      if (lastWeekOutcome && metricValue !== lastWeekOutcome.metricValue) {
        trend = metricValue > lastWeekOutcome.metricValue ? 1 : -1;
      }
      await this.prisma.userOutcome.create({
        data: {
          userId: user.id,
          metricName: 'goal_adherence',
          baselineValue: baseline?.metricValue,
          metricValue,
          improvementPercent,
          trend,
          period: 'weekly',
          sources: { weeksWithPlan, totalWeeks },
        },
      });
    }
  }
}