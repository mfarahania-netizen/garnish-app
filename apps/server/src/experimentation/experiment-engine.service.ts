import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConsentService } from '../consent/consent.service';
import { withUserOptionalProcessingBoundary } from '../consent/optional-processing-transaction-boundary.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExperimentEngine {
  private readonly logger = new Logger(ExperimentEngine.name);
  constructor(
    private readonly prisma: PrismaService,
    // Retained for Nest/module and test-constructor compatibility. Authorization is intentionally read through
    // the transaction client in the canonical boundary, never through an independently-timed service read.
    @Optional() _consent?: ConsentService,
  ) {}

  async getWeights(
    userId: string,
    expectedEpoch?: Date,
  ): Promise<Record<string, number> | null> {
    const boundary = await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId,
        purposes: ['analytics', 'personalization'],
        operation: 'experiment-engine.get-weights',
        expectedEpoch,
      },
      async (tx, context) => {
        const experiment = await tx.experiment.findFirst({
          where: { isActive: true },
        });
        if (!experiment) return null;
        if (/^"?test experiment"?$/i.test(String(experiment.name || '').trim())) {
          return null;
        }

        let assignment = await tx.experimentAssignment.findUnique({
          where: {
            userId_experimentId: { userId, experimentId: experiment.id },
          },
        });
        if (assignment) {
          const assignedAt = new Date(assignment.createdAt).getTime();
          if (
            !Number.isFinite(assignedAt) ||
            assignedAt < context.grantEpoch.getTime()
          ) return null;
        } else {
          const variant = Math.random() < 0.5 ? 'A' : 'B';
          assignment = await tx.experimentAssignment.create({
            data: { userId, experimentId: experiment.id, variant },
          });
        }

        return this.sanitizeWeights(
          assignment.variant === 'A'
            ? (experiment.variantA as Record<string, number>)
            : (experiment.variantB as Record<string, number>),
        );
      },
    ).catch((error) => {
      this.logger.warn(
        `experiment assignment suppressed: ${error instanceof Error ? error.name : 'boundary_error'}`,
      );
      return null;
    });

    return boundary?.status === 'executed' ? boundary.value : null;
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
