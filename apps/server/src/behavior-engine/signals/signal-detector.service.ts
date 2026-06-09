// apps/server/src/behavior-engine/signals/signal-detector.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from './signal-calculator.service';
import { SnapshotBuilderService } from '../snapshots/snapshot-builder.service'; // 👈 اضافه شد
import { FeatureStoreService } from '../feature-store/feature-store.service'; // 👈 اضافه شد
import { Cron } from '@nestjs/schedule';

@Injectable()
export class SignalDetectorService {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
    private snapshotBuilder: SnapshotBuilderService, // 👈 اضافه شد
    private featureStore: FeatureStoreService, // 👈 اضافه شد
  ) {}

  @Cron('0 0 */6 * * *')
  async detectBatchSignals() {
    console.log('🔄 Starting batch signal detection...');
    const activeUsers = await this.getActiveUsers();

    for (const userId of activeUsers) {
      const userWithGoals = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { healthGoals: true },
      });
      const hasHealthGoals = (userWithGoals?.healthGoals?.length ?? 0) > 0;

      const mealPlanCount = await this.prisma.mealPlan.count({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      });

      const isHealthConscious = hasHealthGoals && mealPlanCount >= 2;
      await this.signalCalculator.updateSignal(
        userId,
        'health_conscious',
        'health',
        'behavior',
        isHealthConscious ? 0.9 : 0.1,
        mealPlanCount,
      );

      // Food Explorer
      const recipeViews = await this.prisma.userEvent.findMany({
        where: {
          userId,
          type: 'recipe_view',
          timestamp: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        },
        select: { payload: true },
      });
      const uniqueRecipes = new Set<string>();
      for (const event of recipeViews) {
        try {
          const p = JSON.parse(event.payload || '{}');
          if (p.recipeId) uniqueRecipes.add(p.recipeId);
        } catch {}
      }
      const isFoodExplorer = uniqueRecipes.size >= 10;
      await this.signalCalculator.updateSignal(
        userId,
        'food_explorer',
        'identity',
        'identity',
        isFoodExplorer ? 0.8 : 0.2,
        uniqueRecipes.size,
      );

      // 🆕 به‌روزرسانی اسنپ‌شات‌ها و Feature Store
      await this.snapshotBuilder.buildAll(userId);
      await this.featureStore.buildFeatureVector(userId);
    }
    console.log(`✅ Batch detection completed for ${activeUsers.length} users.`);
  }

  private async getActiveUsers(): Promise<string[]> {
    const users = await this.prisma.userEvent.findMany({
      where: { timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { userId: true },
      distinct: ['userId'],
    });
    return users.map(u => u.userId);
  }
}