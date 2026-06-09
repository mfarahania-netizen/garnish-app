import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GovernanceInsightsService {
  constructor(private prisma: PrismaService) {}

  async getGovernanceSummary() {
    const [activeExperiment, activeAssignments, recentEvents, userCount] = await Promise.all([
      this.prisma.experiment.findFirst({
        where: { isActive: true },
      }),
      (this.prisma as any).experimentAssignment.count({
        where: {
          experiment: { isActive: true },
        },
      }),
      this.prisma.userEvent.count({
        where: {
          timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      retentionPolicyDays: 365,
      activeExperiment: activeExperiment
        ? {
            id: activeExperiment.id,
            name: activeExperiment.name,
            variantA: activeExperiment.variantA,
            variantB: activeExperiment.variantB,
          }
        : null,
      activeAssignments,
      recentEventVolume: recentEvents,
      totalUsers: userCount,
    };
  }
}
