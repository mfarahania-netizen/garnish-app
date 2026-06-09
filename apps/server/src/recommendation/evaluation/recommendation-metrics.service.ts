import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecommendationMetricsService {
  constructor(private prisma: PrismaService) {}

  @Cron('0 45 3 * * *')
  async buildDailyMetricsSnapshot() {
    await this.buildMetricsForWindow(7);
    await this.buildMetricsForWindow(30);
    await this.buildMetricsForWindow(90);
  }

  async buildMetricsForWindow(windowDays: number) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const attributionEvent = (this.prisma as any).recommendationAttributionEvent;
    const exposure = (this.prisma as any).recommendationExposure;
    const featureContributionLog = (this.prisma as any).featureContributionLog;
    const recommendationMetrics = (this.prisma as any).recommendationMetrics;

    const [attributionEvents, rawExposures, qualityOutcomes, rewardOutcomes, topSignals, topFeatures] =
      await Promise.all([
        attributionEvent?.findMany
          ? attributionEvent.findMany({
              where: { occurredAt: { gte: since } },
              select: { eventType: true },
            })
          : [],
        exposure?.count
          ? exposure.count({
              where: { viewedAt: { gte: since } },
            })
          : 0,
        this.prisma.userOutcome.findMany({
          where: { metricName: 'recommendation_quality', recordedAt: { gte: since } },
          select: { metricValue: true },
        }),
        this.prisma.userOutcome.findMany({
          where: { metricName: 'recommendation_reward', recordedAt: { gte: since } },
          select: { metricValue: true },
        }),
        featureContributionLog?.findMany
          ? featureContributionLog.findMany({
              where: { createdAt: { gte: since } },
              orderBy: [{ contribution: 'desc' }, { createdAt: 'desc' }],
              take: 10,
            })
          : [],
        featureContributionLog?.findMany
          ? featureContributionLog.findMany({
              where: { createdAt: { gte: since } },
              distinct: ['featureKey'],
              orderBy: [{ contribution: 'desc' }, { createdAt: 'desc' }],
              take: 10,
            })
          : [],
      ]);

    const counts = attributionEvents.reduce(
      (acc: any, event: { eventType: string }) => {
        if (event.eventType === 'recommendation_impression') acc.impressions += 1;
        if (event.eventType === 'recommendation_click') acc.clicks += 1;
        if (event.eventType === 'recommendation_save') acc.saves += 1;
        if (event.eventType === 'recommendation_cook') acc.cooks += 1;
        if (
          event.eventType === 'recommendation_dismiss' ||
          event.eventType === 'recommendation_ignore'
        ) {
          acc.dismisses += 1;
        }
        return acc;
      },
      {
        impressions: 0,
        clicks: 0,
        saves: 0,
        cooks: 0,
        dismisses: 0,
      },
    );
    const exposures = Number(rawExposures || 0);
    counts.impressions = Math.max(counts.impressions, exposures);

    const clickThroughRate = counts.impressions > 0 ? counts.clicks / counts.impressions : 0;
    const saveRate = counts.clicks > 0 ? counts.saves / counts.clicks : 0;
    const cookRate = counts.saves > 0 ? counts.cooks / counts.saves : 0;
    const frictionRate = counts.impressions > 0 ? counts.dismisses / counts.impressions : 0;
    const recommendationQuality = this.average(qualityOutcomes.map((item) => item.metricValue));
    const recommendationReward = this.average(rewardOutcomes.map((item) => item.metricValue));

    if (!recommendationMetrics?.upsert) {
      return {
        windowDays,
        ...counts,
        exposures,
        clickThroughRate,
        saveRate,
        cookRate,
        frictionRate,
        recommendationQuality,
        recommendationReward,
        topSignals: topSignals.slice(0, 5),
        topFeatures: topFeatures.slice(0, 5),
      };
    }

    await recommendationMetrics.upsert({
      where: {
        metricDate_windowDays: {
          metricDate: this.toDayBoundary(new Date()),
          windowDays,
        },
      },
      create: {
        metricDate: this.toDayBoundary(new Date()),
        windowDays,
        totalImpressions: counts.impressions,
        totalClicks: counts.clicks,
        totalSaves: counts.saves,
        totalCooks: counts.cooks,
        totalDismisses: counts.dismisses,
        totalExposures: exposures,
        clickThroughRate,
        saveRate,
        cookRate,
        frictionRate,
        recommendationQuality,
        recommendationReward,
        topSignals: topSignals.slice(0, 5),
        topFeatures: topFeatures.slice(0, 5),
      },
      update: {
        totalImpressions: counts.impressions,
        totalClicks: counts.clicks,
        totalSaves: counts.saves,
        totalCooks: counts.cooks,
        totalDismisses: counts.dismisses,
        totalExposures: exposures,
        clickThroughRate,
        saveRate,
        cookRate,
        frictionRate,
        recommendationQuality,
        recommendationReward,
        topSignals: topSignals.slice(0, 5),
        topFeatures: topFeatures.slice(0, 5),
      },
    });

    return {
      windowDays,
      ...counts,
      exposures,
      clickThroughRate,
      saveRate,
      cookRate,
      frictionRate,
      recommendationQuality,
      recommendationReward,
      topSignals: topSignals.slice(0, 5),
      topFeatures: topFeatures.slice(0, 5),
    };
  }

  async getLatestMetrics(windowDays = 7) {
    const recommendationMetrics = (this.prisma as any).recommendationMetrics;
    if (!recommendationMetrics?.findFirst) return this.buildMetricsForWindow(windowDays);

    const latest = await recommendationMetrics.findFirst({
      where: { windowDays },
      orderBy: { metricDate: 'desc' },
    });

    return latest ?? this.buildMetricsForWindow(windowDays);
  }

  private average(values: number[]) {
    if (!values.length) return 0;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }

  private toDayBoundary(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
