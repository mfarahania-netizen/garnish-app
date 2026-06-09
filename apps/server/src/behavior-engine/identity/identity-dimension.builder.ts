// apps/server/src/behavior-engine/identity/identity-dimension.builder.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdentityDimensionBuilder {
  constructor(private prisma: PrismaService) {}

  async buildAll(userId: string) {
    // خواندن Snapshotها و Signals
    const [signals, identitySnapshot, healthSnapshot, retentionSnapshot] = await Promise.all([
      this.prisma.userBehaviorSignal.findMany({ where: { userId } }),
      this.prisma.userIdentitySnapshot.findUnique({ where: { userId } }),
      this.prisma.userHealthSnapshot.findUnique({ where: { userId } }),
      this.prisma.userRetentionSnapshot.findUnique({ where: { userId } }),
    ]);

    const dimensions: { key: string; value: number; confidence: number }[] = [];

    // ۱. weight_loss (از health goals)
    const hasHealthGoal = healthSnapshot?.hasActiveHealthGoal ?? false;
    dimensions.push({
      key: 'weight_loss',
      value: hasHealthGoal ? 0.8 : 0.2,
      confidence: hasHealthGoal ? 0.7 : 0.3,
    });

    // ۲. family_coordinator (از meal plan consistency)
    const mealPlanRate = healthSnapshot?.mealPlanCompletionRate ?? 0;
    dimensions.push({
      key: 'family_coordinator',
      value: mealPlanRate > 0.5 ? 0.7 : 0.3,
      confidence: 0.6,
    });

    // ۳. budget_sensitivity (از shopping signals)
    const budgetSignal = signals.find(s => s.signalName === 'budget_sensitive');
    dimensions.push({
      key: 'budget_sensitivity',
      value: budgetSignal?.value ?? 0.5,
      confidence: budgetSignal?.confidence ?? 0.3,
    });

    // ۴. health_consciousness (از health signal)
    const healthSignal = signals.find(s => s.signalName === 'health_conscious');
    dimensions.push({
      key: 'health_consciousness',
      value: healthSignal?.value ?? 0.5,
      confidence: healthSignal?.confidence ?? 0.3,
    });

    // ۵. food_explorer (از identity signal)
    const explorerSignal = signals.find(s => s.signalName === 'food_explorer');
    dimensions.push({
      key: 'food_explorer',
      value: explorerSignal?.value ?? 0.5,
      confidence: explorerSignal?.confidence ?? 0.3,
    });

    // ۶. consistency (از retention snapshot)
    const retentionScore = retentionSnapshot?.retentionScore ?? 50;
    dimensions.push({
      key: 'consistency',
      value: retentionScore / 100,
      confidence: 0.5,
    });

    // ذخیره‌سازی ابعاد
    const upserts = dimensions.map(dim =>
      this.prisma.userIdentityDimension.upsert({
        where: { userId_dimensionKey: { userId, dimensionKey: dim.key } },
        create: {
          userId,
          dimensionKey: dim.key,
          value: dim.value,
          confidence: dim.confidence,
          evidenceCount: 1,
          lastEvidenceAt: new Date(),
        },
        update: {
          value: dim.value,
          confidence: dim.confidence,
          evidenceCount: { increment: 1 },
          lastEvidenceAt: new Date(),
        },
      })
    );

    await Promise.all(upserts);
    return dimensions;
  }
}