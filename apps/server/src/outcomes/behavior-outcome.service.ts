import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { ConsentService } from '../consent/consent.service';
import { isOptionalPurposeRuntimeEnabled } from '../consent/consent.constants';
import { withUserOptionalProcessingBoundary } from '../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class BehaviorOutcomeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  @Cron('0 4 * * 1')
  async calculateWeeklyBehaviorOutcomes() {
    if (process.env.OPTIONAL_DERIVED_OUTCOMES_ENABLED !== 'true') return;
    if (!isOptionalPurposeRuntimeEnabled('personalization')) return;
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const epoch = await this.consent.currentGrantEpoch(user.id, ['personalization']).catch(() => null);
      if (!epoch) continue;

      const shoppingItems = await this.prisma.shoppingItem.findMany({
        where: { shoppingList: { userId: user.id } },
        select: { isChecked: true },
      });
      const totalItems = shoppingItems.length;
      const checkedItems = shoppingItems.filter(i => i.isChecked).length;
      const metricValue = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
      const baseline = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'shopping_efficiency', recordedAt: { gte: epoch } },
        orderBy: { recordedAt: 'asc' },
      });
      let improvementPercent: number | null = null;
      if (baseline && baseline.metricValue > 0) {
        improvementPercent = Math.round(((metricValue - baseline.metricValue) / baseline.metricValue) * 100);
      }
      const lastWeekOutcome = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'shopping_efficiency', period: 'weekly', recordedAt: { gte: epoch } },
        orderBy: { recordedAt: 'desc' },
      });
      let trend: number = 0;
      if (lastWeekOutcome && metricValue !== lastWeekOutcome.metricValue) {
        trend = metricValue > lastWeekOutcome.metricValue ? 1 : -1;
      }
      await withUserOptionalProcessingBoundary(
        this.prisma,
        { userId: user.id, purposes: ['personalization'], operation: 'outcomes.persist-behavior', expectedEpoch: epoch },
        (tx) => tx.userOutcome.create({
          data: { userId: user.id, metricName: 'shopping_efficiency', baselineValue: baseline?.metricValue, metricValue, improvementPercent, trend, period: 'weekly', sources: { totalItems, checkedItems } },
        }),
      );
    }
  }
}
