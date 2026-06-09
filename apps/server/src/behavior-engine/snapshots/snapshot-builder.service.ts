// apps/server/src/behavior-engine/snapshots/snapshot-builder.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SnapshotBuilderService {
  constructor(private prisma: PrismaService) {}

  /**
   * ساخت یا بروزرسانی تمام Snapshotها برای یک کاربر
   */
  async buildAll(userId: string) {
    await Promise.all([
      this.buildEngagement(userId),
      this.buildHealth(userId),
      this.buildIdentity(userId),
      this.buildRetention(userId),
    ]);
  }

  // ── Engagement Snapshot ──
  private async buildEngagement(userId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentEvents = await this.prisma.userEvent.findMany({
      where: { userId, timestamp: { gte: thirtyDaysAgo } },
      select: { timestamp: true },
      orderBy: { timestamp: 'asc' },
    });

    const lastMealPlanEvent = await this.prisma.userEvent.findFirst({
      where: { userId, type: { startsWith: 'mealplan_' } },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    const daysSinceLastMealPlan = lastMealPlanEvent
      ? Math.floor((now.getTime() - lastMealPlanEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const activeDays = new Set(recentEvents.map(e => e.timestamp.toISOString().slice(0, 10))).size;

    await this.prisma.userEngagementSnapshot.upsert({
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
    });
  }

  // ── Health Snapshot ──
  private async buildHealth(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [mealPlanEvents, totalEvents] = await Promise.all([
      this.prisma.userEvent.count({
        where: { userId, type: { startsWith: 'mealplan_' }, timestamp: { gte: thirtyDaysAgo } },
      }),
      this.prisma.userEvent.count({
        where: { userId, timestamp: { gte: thirtyDaysAgo } },
      }),
    ]);
    const mealPlanCompletionRate = totalEvents > 0 ? mealPlanEvents / totalEvents : 0;

    const nutritionViews = await this.prisma.userEvent.count({
      where: { userId, type: { startsWith: 'nutrition_' }, timestamp: { gte: thirtyDaysAgo } },
    });
    const nutritionViewFrequency = nutritionViews / 30;

    const userWithGoals = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { healthGoals: true },
    });
    const hasActiveHealthGoal = (userWithGoals?.healthGoals?.length ?? 0) > 0;

    await this.prisma.userHealthSnapshot.upsert({
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
    });
  }

  // ── Identity Snapshot ──
  private async buildIdentity(userId: string) {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [recipeSaveEvents, recipeViewEvents, aiAccepted, aiDismissed] = await Promise.all([
      this.prisma.userEvent.count({ where: { userId, type: 'favorite_add', timestamp: { gte: sixtyDaysAgo } } }),
      this.prisma.userEvent.count({ where: { userId, type: 'recipe_view', timestamp: { gte: sixtyDaysAgo } } }),
      this.prisma.userEvent.count({ where: { userId, type: 'ai_suggestion_generated', timestamp: { gte: sixtyDaysAgo } } }),
      this.prisma.userEvent.count({ where: { userId, type: 'ai_error', timestamp: { gte: sixtyDaysAgo } } }),
    ]);

    const recipeSaveRate = recipeViewEvents > 0 ? recipeSaveEvents / recipeViewEvents : 0;
    const totalAi = aiAccepted + aiDismissed;
    const aiAcceptanceRate = totalAi > 0 ? aiAccepted / totalAi : 0;
    const aiDismissRate = totalAi > 0 ? aiDismissed / totalAi : 0;

    await this.prisma.userIdentitySnapshot.upsert({
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
    });
  }

  // ── Retention Snapshot ──
  private async buildRetention(userId: string) {
    const now = new Date();
    const lastEvent = await this.prisma.userEvent.findFirst({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    const daysSinceLastActive = lastEvent
      ? Math.floor((now.getTime() - lastEvent.timestamp.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    const churnRisk = Math.min(100, Math.round((daysSinceLastActive / 30) * 100));

    await this.prisma.userRetentionSnapshot.upsert({
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
    });
  }
}