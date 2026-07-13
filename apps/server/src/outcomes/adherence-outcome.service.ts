import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { ConsentService } from '../consent/consent.service';
import { isOptionalPurposeRuntimeEnabled } from '../consent/consent.constants';
import { withUserOptionalProcessingBoundary } from '../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class AdherenceOutcomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  @Cron('0 5 * * 1')
  async calculateWeeklyAdherenceOutcomes() {
    if (process.env.OPTIONAL_DERIVED_OUTCOMES_ENABLED !== 'true') return;
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const epoch = await this.consent.currentGrantEpoch(user.id, ['personalization']).catch(() => null);
      if (!epoch) continue;

      const totalWeeks = 4;
      const weeksWithPlan = await this.prisma.mealPlan.count({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) },
        },
      });
      const metricValue = Math.min(100, (weeksWithPlan / totalWeeks) * 100);
      const baseline = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'goal_adherence', recordedAt: { gte: epoch } },
        orderBy: { recordedAt: 'asc' },
      });
      let improvementPercent: number | null = null;
      if (baseline && baseline.metricValue > 0) {
        improvementPercent = Math.round(((metricValue - baseline.metricValue) / baseline.metricValue) * 100);
      }
      const lastWeekOutcome = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'goal_adherence', period: 'weekly', recordedAt: { gte: epoch } },
        orderBy: { recordedAt: 'desc' },
      });
      let trend: number = 0;
      if (lastWeekOutcome && metricValue !== lastWeekOutcome.metricValue) {
        trend = metricValue > lastWeekOutcome.metricValue ? 1 : -1;
      }
      await withUserOptionalProcessingBoundary(
        this.prisma,
        { userId: user.id, purposes: ['personalization'], operation: 'outcomes.persist-adherence', expectedEpoch: epoch },
        (tx) => tx.userOutcome.create({
          data: { userId: user.id, metricName: 'goal_adherence', baselineValue: baseline?.metricValue, metricValue, improvementPercent, trend, period: 'weekly', sources: { weeksWithPlan, totalWeeks } },
        }),
      );
    }
  }
}
