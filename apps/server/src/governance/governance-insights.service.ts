import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  isOptionalPurposeRuntimeEnabled,
} from '../consent/consent.constants';

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
      this.currentConsentedEventVolume(),
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
      recentEventVolume: recentEvents.value,
      recentEventVolumeAvailable: recentEvents.available,
      recentEventVolumeReason: recentEvents.reason,
      totalUsers: userCount,
    };
  }

  private async currentConsentedEventVolume(): Promise<{
    value: number | null;
    available: boolean;
    reason: string;
  }> {
    if (!isOptionalPurposeRuntimeEnabled('analytics')) {
      return { value: null, available: false, reason: 'analytics_runtime_disabled' };
    }

    try {
      const decisions = await this.prisma.userConsent.findMany({
        where: { purpose: 'analytics' },
        orderBy: { createdAt: 'asc' },
        select: {
          userId: true,
          status: true,
          policyVersion: true,
          createdAt: true,
        },
      });
      const latest = new Map<string, (typeof decisions)[number]>();
      for (const decision of decisions) latest.set(decision.userId, decision);
      const current = [...latest.values()].filter(
        (decision) =>
          decision.status === 'granted' &&
          decision.policyVersion === CURRENT_PRIVACY_POLICY_VERSION,
      );
      if (!current.length) {
        return { value: 0, available: true, reason: 'no_current_analytics_population' };
      }

      const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const value = await this.prisma.userEvent.count({
        where: {
          consentPurpose: { in: ['analytics', 'personalization'] },
          OR: current.map((decision) => ({
            userId: decision.userId,
            timestamp: {
              gte:
                decision.createdAt > windowStart
                  ? decision.createdAt
                  : windowStart,
            },
          })),
        },
      });
      return { value, available: true, reason: 'current_consent_epoch' };
    } catch {
      return { value: null, available: false, reason: 'consent_or_event_read_unavailable' };
    }
  }
}
