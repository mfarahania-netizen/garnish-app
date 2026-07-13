// apps/server/src/behavior-engine/signals/signal-detector.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SignalCalculatorService } from './signal-calculator.service';
import { SnapshotBuilderService } from '../snapshots/snapshot-builder.service'; // 👈 اضافه شد
import { FeatureStoreService } from '../feature-store/feature-store.service'; // 👈 اضافه شد
import { Cron } from '@nestjs/schedule';
import { ConsentService } from '../../consent/consent.service';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';
import { withUserOptionalProcessingBoundary } from '../../consent/optional-processing-transaction-boundary.service';

export type SignalDetectionResult =
  | {
      status: 'disabled';
      reason: 'optional_processing_disabled';
      usersDiscovered: 0;
    }
  | {
      status: 'completed';
      usersDiscovered: number;
    };

@Injectable()
export class SignalDetectorService {
  constructor(
    private prisma: PrismaService,
    private signalCalculator: SignalCalculatorService,
    private snapshotBuilder: SnapshotBuilderService, // 👈 اضافه شد
    private featureStore: FeatureStoreService, // 👈 اضافه شد
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

  private async epochIsCurrent(userId: string, epoch: Date): Promise<boolean> {
    const current = await this.currentEventEpoch(userId);
    return current?.getTime() === epoch.getTime();
  }

  private laterOf(windowStart: Date, epoch: Date): Date {
    return windowStart > epoch ? windowStart : epoch;
  }

  @Cron('0 0 */6 * * *')
  async detectBatchSignals(): Promise<SignalDetectionResult> {
    // Runtime OFF is a zero-I/O boundary. Do not discover users, read consent,
    // allocate per-user work, or touch optional dependencies before it.
    if (
      !isOptionalPurposeRuntimeEnabled('analytics') ||
      !isOptionalPurposeRuntimeEnabled('personalization')
    ) {
      return {
        status: 'disabled',
        reason: 'optional_processing_disabled',
        usersDiscovered: 0,
      };
    }
    console.log('🔄 Starting batch signal detection...');
    const activeUsers = await this.getActiveUsers();

    for (const userId of activeUsers) {
      const epoch = await this.currentEventEpoch(userId);
      if (!epoch) continue;
      const activeEvents = await this.prisma.userEvent.count({
        where: {
          userId,
          consentPurpose: 'personalization',
          timestamp: {
            gte: this.laterOf(
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              epoch,
            ),
          },
        },
      });
      if (activeEvents === 0) continue;

      // UserHealthGoal lacks an epoch timestamp; it cannot be reused as post-regrant behavioral evidence.
      const hasHealthGoals = false;

      const mealPlanCount = await this.prisma.mealPlan.count({
        where: {
          userId,
          createdAt: {
            gte: this.laterOf(
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              epoch,
            ),
          },
        },
      });

      const isHealthConscious = hasHealthGoals && mealPlanCount >= 2;
      const healthWrite = await withUserOptionalProcessingBoundary(
        this.prisma,
        {
          userId,
          purposes: ['analytics', 'personalization'],
          operation: 'signal-detector.persist-health-signal',
          expectedEpoch: epoch,
        },
        async (tx) => {
          await tx.userBehaviorSignal.deleteMany({
            where: {
              userId,
              signalName: { in: ['health_conscious', 'food_explorer'] },
              updatedAt: { lt: epoch },
            },
          });
          await this.signalCalculator.updateSignalInLockedTransaction(
            tx,
            userId,
            'health_conscious',
            'health',
            'behavior',
            isHealthConscious ? 0.9 : 0.1,
            mealPlanCount,
          );
        },
      );
      if (healthWrite.status !== 'executed') continue;

      // Food Explorer
      const recipeViews = await this.prisma.userEvent.findMany({
        where: {
          userId,
          consentPurpose: 'personalization',
          type: 'recipe_view',
          timestamp: {
            gte: this.laterOf(
              new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
              epoch,
            ),
          },
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
      const explorerWrite = await withUserOptionalProcessingBoundary(
        this.prisma,
        {
          userId,
          purposes: ['analytics', 'personalization'],
          operation: 'signal-detector.persist-explorer-signal',
          expectedEpoch: epoch,
        },
        (tx) => this.signalCalculator.updateSignalInLockedTransaction(
          tx,
          userId,
          'food_explorer',
          'identity',
          'identity',
          isFoodExplorer ? 0.8 : 0.2,
          uniqueRecipes.size,
        ),
      );
      if (explorerWrite.status !== 'executed') continue;

      // 🆕 به‌روزرسانی اسنپ‌شات‌ها و Feature Store
      if (!(await this.epochIsCurrent(userId, epoch))) continue;
      await this.snapshotBuilder.buildAll(userId);
      await this.featureStore.buildFeatureVector(userId);
    }
    console.log(`✅ Batch detection completed for ${activeUsers.length} users.`);
    return { status: 'completed', usersDiscovered: activeUsers.length };
  }

  private async getActiveUsers(): Promise<string[]> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return users.map((user) => user.id);
  }

}
