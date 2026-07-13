// apps/server/src/behavior-engine/snapshots/snapshot-builder.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsentService } from '../../consent/consent.service';
import { withUserOptionalProcessingBoundary } from '../../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class SnapshotBuilderService {
  constructor(
    private prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  private async currentEventEpoch(userId: string): Promise<Date | null> {
    try {
      return await this.consent.currentGrantEpoch(userId, [
        'analytics',
        'personalization',
      ]);
    } catch {
      return null;
    }
  }

  private laterOf(windowStart: Date, epoch: Date): Date {
    return windowStart > epoch ? windowStart : epoch;
  }

  /**
   * ساخت یا بروزرسانی تمام Snapshotها برای یک کاربر
   */
  async buildAll(userId: string) {
    const epoch = await this.currentEventEpoch(userId);
    if (!epoch) return null;
    await Promise.all([
      this.buildEngagement(userId, epoch),
      this.buildHealth(userId, epoch),
      this.buildIdentity(userId, epoch),
      this.buildRetention(userId, epoch),
    ]);
  }

  // ── Engagement Snapshot ──
  private async buildEngagement(userId: string, epoch: Date) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentEvents = await this.prisma.userEvent.findMany({
      where: {
        userId,
        consentPurpose: 'personalization',
        timestamp: { gte: this.laterOf(thirtyDaysAgo, epoch) },
      },
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const lastMealPlanEvent = await this.prisma.userEvent.findFirst({
      where: {
        userId,
        consentPurpose: 'personalization',
        type: { startsWith: 'mealplan_' },
        timestamp: { gte: epoch },
      },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    const daysSinceLastMealPlan = lastMealPlanEvent
      ? Math.floor((now.getTime() - lastMealPlanEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const activeDays = new Set(recentEvents.map(e => e.timestamp.toISOString().slice(0, 10))).size;

    await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId,
        purposes: ['analytics', 'personalization'],
        operation: 'snapshot.engagement_upsert',
        expectedEpoch: epoch,
      },
      (tx) =>
        tx.userEngagementSnapshot.upsert({
          where: { userId },
          create: {
            userId,
            activeDaysLast30: activeDays,
            daysSinceLastMealPlan,
            avgSessionDuration: recentEvents.length > 0 ? 120 : 0,
            avgTimeBetweenSessions: activeDays > 1 ? 24 : 0,
          },
          update: {
            activeDaysLast30: activeDays,
            daysSinceLastMealPlan,
            schemaVersion: 1,
          },
        }),
    );
  }

  // ── Health Snapshot ──
  private async buildHealth(userId: string, epoch: Date) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [mealPlanEvents, totalEvents] = await Promise.all([
      this.prisma.userEvent.count({
        where: {
          userId,
          consentPurpose: 'personalization',
          type: { startsWith: 'mealplan_' },
          timestamp: { gte: this.laterOf(thirtyDaysAgo, epoch) },
        },
      }),
      this.prisma.userEvent.count({
        where: {
          userId,
          consentPurpose: 'personalization',
          timestamp: { gte: this.laterOf(thirtyDaysAgo, epoch) },
        },
      }),
    ]);
    const mealPlanCompletionRate = totalEvents > 0 ? mealPlanEvents / totalEvents : 0;

    const nutritionViews = await this.prisma.userEvent.count({
      where: {
        userId,
        consentPurpose: 'personalization',
        type: { startsWith: 'nutrition_' },
        timestamp: { gte: this.laterOf(thirtyDaysAgo, epoch) },
      },
    });
    const nutritionViewFrequency = nutritionViews / 30;

    // UserHealthGoal has no epoch timestamp; keep this derived field neutral after a consent boundary.
    const hasActiveHealthGoal = false;

    await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId,
        purposes: ['analytics', 'personalization'],
        operation: 'snapshot.health_upsert',
        expectedEpoch: epoch,
      },
      (tx) =>
        tx.userHealthSnapshot.upsert({
          where: { userId },
          create: {
            userId,
            mealPlanCompletionRate,
            nutritionViewFrequency,
            hasActiveHealthGoal,
          },
          update: {
            mealPlanCompletionRate,
            nutritionViewFrequency,
            hasActiveHealthGoal,
            schemaVersion: 1,
          },
        }),
    );
  }

  // ── Identity Snapshot ──
  private async buildIdentity(userId: string, epoch: Date) {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [recipeSaveEvents, recipeViewEvents, aiAccepted, aiDismissed] = await Promise.all([
      this.prisma.userEvent.count({ where: { userId, consentPurpose: 'personalization', type: 'favorite_add', timestamp: { gte: this.laterOf(sixtyDaysAgo, epoch) } } }),
      this.prisma.userEvent.count({ where: { userId, consentPurpose: 'personalization', type: 'recipe_view', timestamp: { gte: this.laterOf(sixtyDaysAgo, epoch) } } }),
      this.prisma.userEvent.count({ where: { userId, consentPurpose: 'personalization', type: 'ai_suggestion_generated', timestamp: { gte: this.laterOf(sixtyDaysAgo, epoch) } } }),
      this.prisma.userEvent.count({ where: { userId, consentPurpose: 'personalization', type: 'ai_error', timestamp: { gte: this.laterOf(sixtyDaysAgo, epoch) } } }),
    ]);

    const recipeSaveRate = recipeViewEvents > 0 ? recipeSaveEvents / recipeViewEvents : 0;
    const totalAi = aiAccepted + aiDismissed;
    const aiAcceptanceRate = totalAi > 0 ? aiAccepted / totalAi : 0;
    const aiDismissRate = totalAi > 0 ? aiDismissed / totalAi : 0;

    await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId,
        purposes: ['analytics', 'personalization'],
        operation: 'snapshot.identity_upsert',
        expectedEpoch: epoch,
      },
      (tx) =>
        tx.userIdentitySnapshot.upsert({
          where: { userId },
          create: {
            userId,
            recipeSaveRate,
            shoppingCompletionRate: 0.5,
            aiAcceptanceRate,
            aiDismissRate,
          },
          update: {
            recipeSaveRate,
            aiAcceptanceRate,
            aiDismissRate,
            schemaVersion: 1,
          },
        }),
    );
  }

  // ── Retention Snapshot ──
  private async buildRetention(userId: string, epoch: Date) {
    const now = new Date();
    const lastEvent = await this.prisma.userEvent.findFirst({
      where: {
        userId,
        consentPurpose: 'personalization',
        timestamp: { gte: epoch },
      },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    const daysSinceLastActive = lastEvent
      ? Math.floor((now.getTime() - lastEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const churnRisk = Math.min(100, Math.round((daysSinceLastActive / 30) * 100));

    await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId,
        purposes: ['analytics', 'personalization'],
        operation: 'snapshot.retention_upsert',
        expectedEpoch: epoch,
      },
      (tx) =>
        tx.userRetentionSnapshot.upsert({
          where: { userId },
          create: {
            userId,
            daysSinceLastActive,
            churnRisk,
            sessionTrend: 0,
            engagementTrend: 0,
            retentionScore: 100 - churnRisk,
          },
          update: {
            daysSinceLastActive,
            churnRisk,
            retentionScore: 100 - churnRisk,
            schemaVersion: 1,
          },
        }),
    );
  }
}
