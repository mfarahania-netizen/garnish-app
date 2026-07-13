// apps/server/src/behavior-engine/behavior-engine.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentService } from '../consent/consent.service';
import { withUserOptionalProcessingBoundary } from '../consent/optional-processing-transaction-boundary.service';

@Injectable()
export class BehaviorEngineService {
  private readonly logger = new Logger(BehaviorEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  private async currentEventEpoch(userId: string): Promise<Date | null> {
    try {
      return await this.consent.currentGrantEpoch(userId, [
        'analytics',
        'personalization',
      ]);
    } catch (err) {
      this.logger.warn(
        `personalization consent epoch unavailable; behavior processing skipped: ${
          err instanceof Error ? err.name : 'error'
        }`,
      );
      return null;
    }
  }

  private async epochIsCurrent(userId: string, epoch: Date): Promise<boolean> {
    const current = await this.currentEventEpoch(userId);
    return current?.getTime() === epoch.getTime();
  }

  private laterOf(windowStart: Date, epoch: Date): Date {
    return windowStart > epoch ? windowStart : epoch;
  }

  async processEventsForUser(userId: string) {
    // One mutation boundary serves the scheduler and direct callers. Check consent before reading behavioral
    // data or writing a derived profile; an unavailable ledger is a denial, never an implicit grant.
    const epoch = await this.currentEventEpoch(userId);
    if (!epoch) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // رویدادهای ۳۰ روز اخیر
    const recentEvents = await this.prisma.userEvent.findMany({
      where: {
        userId,
        consentPurpose: 'personalization',
        timestamp: { gte: this.laterOf(thirtyDaysAgo, epoch) },
      },
      orderBy: { timestamp: 'asc' },
    });

    // رویدادهای ۶۰ روز اخیر برای favoriteFoods
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const extendedEvents = await this.prisma.userEvent.findMany({
      where: {
        userId,
        consentPurpose: 'personalization',
        timestamp: { gte: this.laterOf(sixtyDaysAgo, epoch) },
      },
      select: { type: true, payload: true },
    });

    // ──── favoriteFoods (بخش ادغام‌شده از BehavioralProfileService) ────
    const recipeCountMap = new Map<string, number>();
    for (const event of extendedEvents) {
      try {
        const p = JSON.parse(event.payload || '{}');
        if (p.recipeId && ['recipe_view', 'favorite_add'].includes(event.type)) {
          recipeCountMap.set(p.recipeId, (recipeCountMap.get(p.recipeId) || 0) + 1);
        }
      } catch {}
    }
    const favoriteFoods = [...recipeCountMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    // ──── shoppingPattern (بخش ادغام‌شده) ────
    const shoppingItems = await this.prisma.shoppingItem.findMany({
      where: { shoppingList: { userId }, addedAt: { gte: epoch } },
      select: { name: true, isChecked: true },
    });
    const itemCounts: Record<string, number> = {};
    for (const item of shoppingItems) {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + 1;
    }
    const shoppingPattern = Object.entries(itemCounts).map(([name, freq]) => ({ name, freq }));

    // ──── حالت بدون رویداد ────
    if (recentEvents.length === 0) {
      const write = await withUserOptionalProcessingBoundary(
        this.prisma,
        {
          userId,
          purposes: ['analytics', 'personalization'],
          operation: 'behavior_engine.profile_upsert_empty',
          expectedEpoch: epoch,
        },
        (tx) =>
          tx.userBehaviorProfile.upsert({
            where: { userId },
            create: {
              userId,
              consistencyScore: 0,
              churnRiskScore: 100,
              healthAdherenceScore: 0,
              cookingFrequency: 'rarely',
              budgetScore: 'low',
              favoriteFoods: JSON.stringify(favoriteFoods),
              shoppingPattern: JSON.stringify(shoppingPattern),
            },
            update: {
              consistencyScore: 0,
              churnRiskScore: 100,
              healthAdherenceScore: 0,
              cookingFrequency: 'rarely',
              budgetScore: 'low',
              favoriteFoods: JSON.stringify(favoriteFoods),
              shoppingPattern: JSON.stringify(shoppingPattern),
            },
          }),
      );
      return write.status === 'executed' ? write.value : null;
    }

    // ──── امتیازات اصلی ────
    const activeDays = new Set(recentEvents.map(e => e.timestamp.toISOString().slice(0, 10))).size;
    const churnRiskScore = Math.max(0, Math.min(100, Math.round(100 - (activeDays / 30) * 100)));

    const activeWeeks = new Set<string>();
    for (const event of recentEvents) {
      const d = event.timestamp;
      const dayOfWeek = (d.getDay() + 1) % 7;
      const saturday = new Date(d);
      saturday.setDate(d.getDate() - dayOfWeek);
      activeWeeks.add(saturday.toISOString().slice(0, 10));
    }
    const consistencyScore = Math.min(100, Math.round((activeWeeks.size / 4) * 100));

    const mealPlanEvents = recentEvents.filter(e => e.type.startsWith('mealplan_')).length;
    let cookingFrequency: string;
    if (mealPlanEvents >= 10) cookingFrequency = 'daily';
    else if (mealPlanEvents >= 3) cookingFrequency = 'weekly';
    else cookingFrequency = 'rarely';

    const shoppingEvents = recentEvents.filter(e => e.type.startsWith('shopping_')).length;
    let budgetScore: string;
    if (shoppingEvents > 5) budgetScore = 'high';
    else if (shoppingEvents > 2) budgetScore = 'medium';
    else budgetScore = 'low';

    // ──── ✨ healthAdherenceScore اصلاح‌شده ✨ ────
    let healthAdherenceScore = 0;

    // ۱. بررسی nutrition events واقعی (اگر وجود داشته باشند)
    const nutritionEvents = recentEvents.filter(e => e.type.startsWith('nutrition_')).length;
    if (nutritionEvents > 0) {
      healthAdherenceScore = Math.round((nutritionEvents / recentEvents.length) * 100);
    } else {
      // ۲. اگر nutrition event وجود ندارد، از healthGoals کاربر استفاده کن
      // Health-goal membership has no consent-epoch timestamp, so it cannot be reused after re-consent.
      const hasHealthGoals = false;
      if (hasHealthGoals) {
        healthAdherenceScore = 50; // baseline
        // فعالیت‌های mealplan امتیاز اضافه می‌کنند
        healthAdherenceScore = Math.min(100, healthAdherenceScore + mealPlanEvents * 3);
        // فعالیت‌های خرید هم نشانهٔ سلامت هستند
        healthAdherenceScore = Math.min(100, healthAdherenceScore + shoppingEvents * 2);
      }
    }

    // ──── upsert نهایی با تمام فیلدها ────
    const write = await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId,
        purposes: ['analytics', 'personalization'],
        operation: 'behavior_engine.profile_upsert',
        expectedEpoch: epoch,
      },
      (tx) =>
        tx.userBehaviorProfile.upsert({
          where: { userId },
          create: {
            userId,
            consistencyScore,
            churnRiskScore,
            healthAdherenceScore,
            cookingFrequency,
            budgetScore,
            favoriteFoods: JSON.stringify(favoriteFoods),
            shoppingPattern: JSON.stringify(shoppingPattern),
          },
          update: {
            consistencyScore,
            churnRiskScore,
            healthAdherenceScore,
            cookingFrequency,
            budgetScore,
            favoriteFoods: JSON.stringify(favoriteFoods),
            shoppingPattern: JSON.stringify(shoppingPattern),
          },
        }),
    );
    return write.status === 'executed' ? write.value : null;
  }

  async getProfile(userId: string) {
    const epoch = await this.currentEventEpoch(userId);
    if (!epoch) return null;
    const profile = await this.prisma.userBehaviorProfile.findFirst({
      where: { userId, updatedAt: { gte: epoch } },
    });
    return (await this.epochIsCurrent(userId, epoch)) ? profile : null;
  }
}
