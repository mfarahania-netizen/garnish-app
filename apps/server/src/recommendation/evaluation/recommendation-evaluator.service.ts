import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationRewardService } from './recommendation-reward.service';

@Injectable()
export class RecommendationEvaluatorService {
  constructor(
    private prisma: PrismaService,
    private rewardService: RecommendationRewardService,
  ) {}

  @Cron('0 30 3 * * *')
  async evaluateDailyRecommendationQuality() {
    const users = await this.prisma.user.findMany({ select: { id: true } });

    for (const user of users) {
      await this.buildRecommendationQuality(user.id, 7);
      await this.rewardService.buildRewardProfile(user.id, 7);
    }
  }

  async getLatestRecommendationQuality(userId: string) {
    const latest = await this.prisma.userOutcome.findFirst({
      where: { userId, metricName: 'recommendation_quality' },
      orderBy: { recordedAt: 'desc' },
    });

    if (!latest) return this.buildRecommendationQuality(userId, 7);

    if (Number(latest.metricValue || 0) < 20) {
      const attribution = await this.getRecommendationAttribution(userId);
      if (attribution.clicks > 0 || attribution.saves > 0 || attribution.cooks > 0) {
        return this.buildRecommendationQuality(userId, 7);
      }
    }

    return latest;
  }

  async getLatestRecommendationReward(userId: string) {
    const latest = await this.prisma.userOutcome.findFirst({
      where: { userId, metricName: 'recommendation_reward' },
      orderBy: { recordedAt: 'desc' },
    });

    if (!latest) return this.rewardService.buildRewardProfile(userId, 7);

    if (Number(latest.metricValue || 0) === 0) {
      const attribution = await this.getRecommendationAttribution(userId);
      if (attribution.clicks > 0 || attribution.saves > 0 || attribution.cooks > 0) {
        return this.rewardService.buildRewardProfile(userId, 7);
      }
    }

    return latest;
  }

  async getRecommendationAttribution(userId: string) {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const exposure = (this.prisma as any).recommendationExposure;
    const [attribution, rawExposureCount] = await Promise.all([
      this.collectAttributionMetrics(userId, since),
      exposure?.count
        ? exposure.count({
            where: { userId, viewedAt: { gte: since } },
          })
        : 0,
    ]);
    const exposureCount = Number(rawExposureCount || 0);
    attribution.impressions = Math.max(attribution.impressions, exposureCount);
    const { impressions, clicks, saves, cooks, dismisses } = attribution;

    const clickThroughRate = impressions > 0 ? clicks / impressions : 0;
    const saveRate = clicks > 0 ? saves / clicks : 0;
    const cookRate = saves > 0 ? cooks / saves : 0;
    const frictionRate = impressions > 0 ? dismisses / impressions : 0;

    return {
      windowDays: 14,
      impressions,
      exposures: exposureCount,
      clicks,
      saves,
      cooks,
      dismisses,
      clickThroughRate,
      saveRate,
      cookRate,
      frictionRate,
    };
  }

  async buildRecommendationQuality(userId: string, windowDays = 7) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const exposure = (this.prisma as any).recommendationExposure;
    const featureContributionLog = (this.prisma as any).featureContributionLog;
    const [attribution, rawExposures, topLogs] = await Promise.all([
      this.collectAttributionMetrics(userId, since),
      exposure?.count
        ? exposure.count({
            where: { userId, viewedAt: { gte: since } },
          })
        : 0,
      featureContributionLog?.findMany
        ? featureContributionLog.findMany({
            where: { userId, createdAt: { gte: since } },
            take: 20,
            orderBy: [{ createdAt: 'desc' }, { contribution: 'desc' }],
          })
          : [],
    ]);
    const exposures = Number(rawExposures || 0);

    attribution.impressions = Math.max(attribution.impressions, exposures);

    const qualityScore = this.computeQualityScore({
      impressions: attribution.impressions,
      clicks: attribution.clicks,
      saves: attribution.saves,
      cooks: attribution.cooks,
      dismisses: attribution.dismisses,
      exposures,
    });

    return this.prisma.userOutcome.create({
      data: {
        userId,
        metricName: 'recommendation_quality',
        metricValue: qualityScore,
        period: 'daily',
        sources: {
          windowDays,
          ...attribution,
          exposures,
          topSignals: topLogs.slice(0, 5),
        },
      },
    });
  }

  private async collectAttributionMetrics(userId: string, since: Date) {
    const attributionEvent = (this.prisma as any).recommendationAttributionEvent;
    const [attributionEvents, userEvents] = await Promise.all([
      attributionEvent?.findMany
        ? attributionEvent.findMany({
          where: { userId, occurredAt: { gte: since } },
          select: { eventType: true },
        })
        : [],
      this.prisma.userEvent?.findMany
        ? this.prisma.userEvent.findMany({
            where: {
              userId,
              timestamp: { gte: since },
              type: {
                in: [
                  'recommendation_impression',
                  'recommendation_click',
                  'recommendation_save',
                  'recommendation_cook',
                  'recommendation_dismiss',
                  'recommendation_ignore',
                ],
              },
            },
            select: { type: true },
          })
        : [],
    ]);

    // P1-7 (recsys audit): attribution is the SOURCE OF TRUTH for the recommendation funnel; UserEvent is a
    // FALLBACK only when attribution is absent. attribution is DERIVED from UserEvent, so summing BOTH
    // double-counts impressions/clicks/saves/cooks → CTR/CVR become unreliable. Prefer attribution; fall back
    // to UserEvent only when there is no attribution at all.
    const events = attributionEvents.length
      ? attributionEvents
      : userEvents.map((event) => ({ eventType: event.type }));

    return events.reduce(
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
      { impressions: 0, clicks: 0, saves: 0, cooks: 0, dismisses: 0 },
    );
  }

  private computeQualityScore(metrics: {
    impressions: number;
    clicks: number;
    saves: number;
    cooks: number;
    dismisses: number;
    exposures: number;
  }): number {
    const impressionBase = Math.max(metrics.impressions, 1);
    const clickThroughRate = metrics.clicks / impressionBase;
    const saveRate = metrics.clicks > 0 ? metrics.saves / metrics.clicks : 0;
    const cookRate = metrics.saves > 0 ? metrics.cooks / metrics.saves : 0;
    const frictionRate = metrics.dismisses / impressionBase;
    const positiveEvidence = Math.min(1, (metrics.clicks + metrics.saves + metrics.cooks) / 20);

    const score =
      Math.min(clickThroughRate / 0.15, 1) * 35 +
      Math.min(saveRate / 0.45, 1) * 20 +
      Math.min(cookRate / 0.6, 1) * 20 +
      positiveEvidence * 15 -
      Math.min(frictionRate / 0.2, 1) * 10;

    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }
}
