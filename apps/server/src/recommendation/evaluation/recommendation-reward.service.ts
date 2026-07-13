import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { eventRewardValue } from './reward-values';
import { ConsentService } from '../../consent/consent.service';
import { withUserOptionalProcessingBoundary } from '../../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class RecommendationRewardService {
  constructor(
    private prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  async buildRewardProfile(userId: string, windowDays = 14) {
    const consentEpoch = await this.currentPersonalizedAnalyticsEpoch(userId);
    if (!consentEpoch) return null;

    const since = this.maxDate(
      new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000),
      consentEpoch,
    );
    const attributionEvent = (this.prisma as any).recommendationAttributionEvent;
    const exposure = (this.prisma as any).recommendationExposure;

    const [attributionEvents, userEvents, exposureCount] = await Promise.all([
      attributionEvent?.findMany
        ? attributionEvent.findMany({
            where: { userId, occurredAt: { gte: since } },
            select: { eventType: true, value: true },
          })
        : [],
      this.prisma.userEvent?.findMany
        ? this.prisma.userEvent.findMany({
            where: {
              userId,
              consentPurpose: 'personalization',
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
      exposure?.count
        ? exposure.count({
            where: { userId, viewedAt: { gte: since } },
          })
        : 0,
    ]);

    // P1-7 (recsys audit): attribution is the SOURCE OF TRUTH; UserEvent is a fallback only when attribution is
    // absent (it's derived from UserEvent, so summing both double-counts the reward total + funnel counts).
    const events = attributionEvents.length
      ? attributionEvents
      : userEvents.map((event) => ({
          eventType: event.type,
          value: this.defaultEventValue(event.type),
        }));

    const aggregate = events.reduce(
      (acc: Record<string, number>, event: { eventType: string; value: number }) => {
        acc.total += event.value ?? 0;
        acc[event.eventType] = (acc[event.eventType] ?? 0) + 1;
        return acc;
      },
      {
        total: 0,
        recommendation_impression: 0,
        recommendation_click: 0,
        recommendation_save: 0,
        recommendation_cook: 0,
        recommendation_dismiss: 0,
        recommendation_ignore: 0,
      },
    );

    if (aggregate.recommendation_impression === 0 && exposureCount > 0) {
      aggregate.recommendation_impression = exposureCount;
      aggregate.total = Math.max(aggregate.total, exposureCount);
    }

    const rewardScore = this.computeRewardScore(aggregate);

    const boundary = await withUserOptionalProcessingBoundary(
      this.prisma,
      { userId, purposes: ['analytics', 'personalization'], operation: 'recommendation-reward.persist-profile', expectedEpoch: consentEpoch },
      (tx) => tx.userOutcome.create({
        data: {
          userId,
          metricName: 'recommendation_reward',
          metricValue: rewardScore,
          period: 'daily',
          sources: {
            windowDays,
            aggregate,
          },
        },
      }),
    );
    if (boundary.status !== 'executed') return null;
    const outcome = boundary.value;

    return {
      ...outcome,
      windowDays,
      rewardScore,
      aggregate,
    };
  }

  async getLatestReward(userId: string) {
    const consentEpoch = await this.currentPersonalizedAnalyticsEpoch(userId);
    if (!consentEpoch) return null;

    const latest = await this.prisma.userOutcome.findFirst({
      where: {
        userId,
        metricName: 'recommendation_reward',
        recordedAt: { gte: consentEpoch },
      },
      orderBy: { recordedAt: 'desc' },
    });
    const epochAfterRead = await this.currentPersonalizedAnalyticsEpoch(userId);
    return this.sameEpoch(consentEpoch, epochAfterRead) ? latest : null;
  }

  private computeRewardScore(aggregate: Record<string, number>) {
    const positives =
      (aggregate.recommendation_click ?? 0) * 0.2 +
      (aggregate.recommendation_save ?? 0) * 0.6 +
      (aggregate.recommendation_cook ?? 0) * 1.0;
    const negatives =
      (aggregate.recommendation_dismiss ?? 0) * 0.8 +
      (aggregate.recommendation_ignore ?? 0) * 0.4;
    const base = aggregate.total || 1;
    const score = ((positives - negatives) / base) * 100;
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }

  private defaultEventValue(eventType: string) {
    return eventRewardValue(eventType); // shared canonical scale (reward-values.ts)
  }

  private async currentPersonalizedAnalyticsEpoch(userId: string): Promise<Date | null> {
    if (!userId) return null;
    try {
      return await this.consent.currentGrantEpoch(userId, [
        'analytics',
        'personalization',
      ]);
    } catch {
      return null;
    }
  }

  private sameEpoch(before: Date, after: Date | null): boolean {
    return !!after && before.getTime() === after.getTime();
  }

  private maxDate(a: Date, b: Date): Date {
    return a.getTime() >= b.getTime() ? a : b;
  }
}
