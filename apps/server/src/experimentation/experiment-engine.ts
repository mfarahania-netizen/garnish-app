// apps/server/src/experimentation/experiment-engine.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExperimentEngine {
  constructor(private prisma: PrismaService) {}

  async getWeights(userId: string): Promise<Record<string, number> | null> {
    // یافتن آزمایش فعال
    const experiment = await this.prisma.experiment.findFirst({
      where: { isActive: true },
    });
    if (!experiment) return null;

    // بررسی assignment قبلی
    let assignment = await this.prisma.experimentAssignment.findUnique({
      where: { userId_experimentId: { userId, experimentId: experiment.id } },
    });

    if (!assignment) {
      // تخصیص تصادفی
      const variant = Math.random() < 0.5 ? 'A' : 'B';
      assignment = await this.prisma.experimentAssignment.create({
        data: { userId, experimentId: experiment.id, variant },
      });
    }

    return assignment.variant === 'A'
      ? (experiment.variantA as Record<string, number>)
      : (experiment.variantB as Record<string, number>);
  }
}