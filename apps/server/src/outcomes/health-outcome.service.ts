import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { ConsentService } from '../consent/consent.service';
import { isOptionalPurposeRuntimeEnabled } from '../consent/consent.constants';
import { withUserOptionalProcessingBoundary } from '../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class HealthOutcomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  @Cron('0 3 * * 1')
  async calculateWeeklyHealthOutcomes() {
    if (process.env.OPTIONAL_DERIVED_OUTCOMES_ENABLED !== 'true') return;
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const epoch = await this.consent.currentGrantEpoch(user.id, ['personalization']).catch(() => null);
      if (!epoch) continue;

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
        where: { userId: user.id, metricName: 'meal_consistency', recordedAt: { gte: epoch } },
        orderBy: { recordedAt: 'asc' },
      });
      let improvementPercent: number | null = null;
      if (baseline && baseline.metricValue > 0) {
        improvementPercent = Math.round(((metricValue - baseline.metricValue) / baseline.metricValue) * 100);
      }
      const lastWeekOutcome = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'meal_consistency', period: 'weekly', recordedAt: { gte: epoch } },
        orderBy: { recordedAt: 'desc' },
      });
      let trend: number = 0;
      if (lastWeekOutcome && metricValue !== lastWeekOutcome.metricValue) {
        trend = metricValue > lastWeekOutcome.metricValue ? 1 : -1;
      }
      await withUserOptionalProcessingBoundary(
        this.prisma,
        { userId: user.id, purposes: ['personalization'], operation: 'outcomes.persist-health', expectedEpoch: epoch },
        (tx) => tx.userOutcome.create({
          data: { userId: user.id, metricName: 'meal_consistency', baselineValue: baseline?.metricValue, metricValue, improvementPercent, trend, period: 'weekly', sources: { mealPlans: completedMealPlans } },
        }),
      );
    }
  }
}
