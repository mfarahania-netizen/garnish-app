// apps/server/src/experimentation/experiment-engine.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExperimentEngine {
  constructor(private prisma: PrismaService) {}

  async getWeights(userId: string): Promise<Record<string, number> | null> {
    // @ts-ignore // مدل‌ها پس از generate شناخته می‌شوند
    const experiment = await this.prisma.experiment.findFirst({
      where: { isActive: true },
    });
    if (!experiment) return null;
    if (/^"?test experiment"?$/i.test(String(experiment.name || '').trim())) {
      return null;
    }

    // @ts-ignore
    let assignment = await this.prisma.experimentAssignment.findUnique({
      where: { userId_experimentId: { userId, experimentId: experiment.id } },
    });

    if (!assignment) {
      const variant = Math.random() < 0.5 ? 'A' : 'B';
      // @ts-ignore
      assignment = await this.prisma.experimentAssignment.create({
        data: { userId, experimentId: experiment.id, variant },
      });
    }

    return this.sanitizeWeights(
      assignment.variant === 'A'
        ? (experiment.variantA as Record<string, number>)
        : (experiment.variantB as Record<string, number>),
    );
  }

  private sanitizeWeights(weights: Record<string, number> | null) {
    if (!weights) return null;
    const safeWeights = { ...weights };
    safeWeights.recency = Math.min(Number(safeWeights.recency ?? 0), 0.06);
    safeWeights.popularity = Math.min(Number(safeWeights.popularity ?? 0), 0.08);
    safeWeights.tasteAffinity = Math.max(Number(safeWeights.tasteAffinity ?? 0), 0.25);
    safeWeights.behaviorFit = Math.max(Number(safeWeights.behaviorFit ?? 0), 0.18);
    safeWeights.outcomeFit = Math.max(Number(safeWeights.outcomeFit ?? 0), 0.18);
    return safeWeights;
  }
}
