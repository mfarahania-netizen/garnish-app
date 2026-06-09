import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class BehaviorOutcomeService {
  constructor(private prisma: PrismaService) {}

  @Cron('0 4 * * 1')
  async calculateWeeklyBehaviorOutcomes() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      const shoppingItems = await this.prisma.shoppingItem.findMany({
        where: { shoppingList: { userId: user.id } },
        select: { isChecked: true },
      });
      const totalItems = shoppingItems.length;
      const checkedItems = shoppingItems.filter(i => i.isChecked).length;
      const metricValue = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
      const baseline = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'shopping_efficiency' },
        orderBy: { recordedAt: 'asc' },
      });
      let improvementPercent: number | null = null;
      if (baseline && baseline.metricValue > 0) {
        improvementPercent = Math.round(((metricValue - baseline.metricValue) / baseline.metricValue) * 100);
      }
      const lastWeekOutcome = await this.prisma.userOutcome.findFirst({
        where: { userId: user.id, metricName: 'shopping_efficiency', period: 'weekly' },
        orderBy: { recordedAt: 'desc' },
      });
      let trend: number = 0;
      if (lastWeekOutcome && metricValue !== lastWeekOutcome.metricValue) {
        trend = metricValue > lastWeekOutcome.metricValue ? 1 : -1;
      }
      await this.prisma.userOutcome.create({
        data: {
          userId: user.id,
          metricName: 'shopping_efficiency',
          baselineValue: baseline?.metricValue,
          metricValue,
          improvementPercent,
          trend,
          period: 'weekly',
          sources: { totalItems, checkedItems },
        },
      });
    }
  }
}