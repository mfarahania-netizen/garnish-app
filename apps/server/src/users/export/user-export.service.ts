import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { sanitizeUser, SafeUser } from '../../common/serializers/user.serializer';
import { sanitizeRecord, sanitizeRecords } from './export-sanitizer';

export interface UserExport {
  exportVersion: string;
  generatedAt: string;
  userId: string;
  subject: SafeUser | null;
  sections: Record<string, unknown>;
  metadata: {
    includedSections: string[];
    omittedSections: string[];
    warnings: string[];
    limitPerSection: number;
  };
}

const SECTION_LIMIT = 1000; // v1: cap potentially large tables; warn on truncation. No streaming/files yet.

/**
 * GDPR data-portability export (E39-1D) for the CURRENT authenticated user only.
 *
 * Builds a stable, PII-aware JSON of the user's own data across every user-linked model in the schema.
 * Safety:
 *   - `userId` is supplied by the controller from the verified JWT (`req.user.userId`) — NEVER from client input.
 *   - the account/profile section is the allow-list `sanitizeUser` (password/hash can never leak);
 *   - every other row passes through `sanitizeRecord` (drops secret-ish keys, caps oversized blobs);
 *   - AICallLog is fetched with an explicit safe `select` (no `errorMessage` — may hold stack traces);
 *   - each section is fault-isolated: a missing/failing module becomes a warning, not a crashed export;
 *   - large tables are capped at SECTION_LIMIT with a truncation warning.
 */
@Injectable()
export class UserExportService {
  private readonly logger = new Logger(UserExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  async exportUser(userId: string): Promise<UserExport> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        allergies: { include: { allergy: true } },
        cuisines: { include: { cuisine: true } },
        healthGoals: { include: { healthGoal: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const includedSections: string[] = [];
    const omittedSections: string[] = [];
    const warnings: string[] = [];

    // findMany section with limit + truncation detection + fault isolation.
    const many = async (name: string, fn: () => Promise<Array<Record<string, unknown>>>): Promise<Array<Record<string, unknown>>> => {
      try {
        const rows = await fn();
        if (Array.isArray(rows) && rows.length >= SECTION_LIMIT) warnings.push(`${name}: truncated at ${SECTION_LIMIT} rows`);
        includedSections.push(name);
        return sanitizeRecords(rows);
      } catch (e) {
        omittedSections.push(name);
        warnings.push(`${name}: unavailable (${(e as { code?: string; name?: string }).code ?? (e as Error).name ?? 'error'})`);
        return [];
      }
    };

    // findUnique (1:1) section with fault isolation.
    const one = async (name: string, fn: () => Promise<Record<string, unknown> | null>): Promise<Record<string, unknown> | null> => {
      try {
        const row = await fn();
        includedSections.push(name);
        return sanitizeRecord(row);
      } catch (e) {
        omittedSections.push(name);
        warnings.push(`${name}: unavailable (${(e as { code?: string; name?: string }).code ?? (e as Error).name ?? 'error'})`);
        return null;
      }
    };

    const p = this.prisma;
    const byUser = { where: { userId } } as const;
    const take = SECTION_LIMIT;

    const dietary = {
      allergies: (user.allergies ?? []).map((a) => a.allergy?.name).filter(Boolean),
      cuisines: (user.cuisines ?? []).map((c) => c.cuisine?.name).filter(Boolean),
      healthGoals: (user.healthGoals ?? []).map((h) => h.healthGoal?.name).filter(Boolean),
    };

    const sections: Record<string, unknown> = {
      profile: sanitizeUser(user),

      preferences: {
        preference: await one('preferences.preference', () => p.userPreference.findUnique({ where: { userId } })),
        dietary,
        history: await many('preferences.history', () => p.preferenceHistory.findMany({ ...byUser, take, orderBy: { changedAt: 'desc' } })),
      },

      onboarding: {
        profile: await one('onboarding.profile', () => p.onboardingProfile.findUnique({ where: { userId } })),
        // Bounded metadata-only replay rows are user-owned, exported here, and
        // cascade on erasure with their owner; profile answers live only above.
        mutations: await many('onboarding.mutations', () =>
          p.onboardingMutation.findMany({ ...byUser, take, orderBy: { createdAt: 'desc' } }),
        ),
      },

      consents: await many('consents', () => p.consentLog.findMany({ ...byUser, take, orderBy: { createdAt: 'desc' } })),

      sessions: await many('sessions', () => p.userSession.findMany({ ...byUser, take, orderBy: { startTime: 'desc' } })),

      events: await many('events', () => p.userEvent.findMany({ ...byUser, take, orderBy: { timestamp: 'desc' } })),

      behavior: {
        profile: await one('behavior.profile', () => p.userBehaviorProfile.findUnique({ where: { userId } })),
        signals: await many('behavior.signals', () => p.userBehaviorSignal.findMany({ ...byUser, take })),
        signalObservations: await many('behavior.signalObservations', () => p.signalObservation.findMany({ ...byUser, take, orderBy: { observedAt: 'desc' } })),
        timeline: await many('behavior.timeline', () => p.userBehaviorTimeline.findMany({ ...byUser, take, orderBy: { recordedAt: 'desc' } })),
        identityDimensions: await many('behavior.identityDimensions', () => p.userIdentityDimension.findMany({ ...byUser, take })),
        featureVector: await one('behavior.featureVector', () => p.userFeatureVector.findUnique({ where: { userId } })),
        features: await many('behavior.features', () => p.userFeature.findMany({ ...byUser, take })),
        outcomes: await many('behavior.outcomes', () => p.userOutcome.findMany({ ...byUser, take, orderBy: { recordedAt: 'desc' } })),
        snapshots: {
          engagement: await one('behavior.snapshots.engagement', () => p.userEngagementSnapshot.findUnique({ where: { userId } })),
          health: await one('behavior.snapshots.health', () => p.userHealthSnapshot.findUnique({ where: { userId } })),
          identity: await one('behavior.snapshots.identity', () => p.userIdentitySnapshot.findUnique({ where: { userId } })),
          retention: await one('behavior.snapshots.retention', () => p.userRetentionSnapshot.findUnique({ where: { userId } })),
        },
      },

      recommendations: {
        exposures: await many('recommendations.exposures', () => p.recommendationExposure.findMany({ ...byUser, take, orderBy: { viewedAt: 'desc' } })),
        attributions: await many('recommendations.attributions', () => p.recommendationAttributionEvent.findMany({ ...byUser, take, orderBy: { occurredAt: 'desc' } })),
        featureContributions: await many('recommendations.featureContributions', () => p.featureContributionLog.findMany({ ...byUser, take, orderBy: { createdAt: 'desc' } })),
      },

      ai: {
        chatMessages: await many('ai.chatMessages', () => p.chatMessage.findMany({ ...byUser, take, orderBy: { createdAt: 'desc' } })),
        userFacts: await many('ai.userFacts', () => p.userFact.findMany({ ...byUser, take })),
        // Explicit safe select — NEVER errorMessage (may hold a stack trace). `metadata` is PII-free by a
        // write-time guard (assertNoPIIInMetadata) AND is recursively secret-key-scrubbed by the sanitizer.
        callLogs: await many('ai.callLogs', () =>
          p.aICallLog.findMany({
            ...byUser,
            take,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true, eventId: true, conversationId: true, surface: true, model: true, provider: true, status: true,
              latencyMs: true, estimatedInputTokens: true, estimatedOutputTokens: true, estimatedCost: true, intent: true, tier: true, cacheHit: true, cacheTokens: true,
              guardHits: true, toolCalls: true, metadata: true, errorCode: true, createdAt: true,
            },
          }),
        ),
      },

      mealPlans: await many('mealPlans', () => p.mealPlan.findMany({ ...byUser, take, include: { slots: true }, orderBy: { weekStart: 'desc' } })),

      shopping: await many('shopping', () => p.shoppingList.findMany({ ...byUser, take, include: { items: true }, orderBy: { createdAt: 'desc' } })),

      favorites: await many('favorites', () => p.favoriteRecipe.findMany({ ...byUser, take, orderBy: { addedAt: 'desc' } })),

      notifications: await many('notifications', () => p.notification.findMany({ ...byUser, take, orderBy: { createdAt: 'desc' } })),

      support: await many('support', () => p.supportTicket.findMany({ ...byUser, take, include: { replies: true }, orderBy: { createdAt: 'desc' } })),

      authoredRecipes: await many('authoredRecipes', () =>
        p.recipe.findMany({
          where: { authorId: userId },
          take,
          include: { ingredients: true, steps: true, nutrition: true, searchTerms: true },
          orderBy: { createdAt: 'desc' },
        }),
      ),

      analytics: {
        dataAccessLogs: await many('analytics.dataAccessLogs', () => p.dataAccessLog.findMany({ ...byUser, take, orderBy: { accessedAt: 'desc' } })),
        auditLogs: await many('analytics.auditLogs', () => p.userAuditLog.findMany({ ...byUser, take, orderBy: { createdAt: 'desc' } })),
        experimentAssignments: await many('analytics.experimentAssignments', () => p.experimentAssignment.findMany({ ...byUser, take })),
        erasureEvents: await many('analytics.erasureEvents', () => p.erasureEvent.findMany({ ...byUser, take, orderBy: { createdAt: 'desc' } })),
      },
    };

    this.logger.log(`exportUser completed: included=${includedSections.length} omitted=${omittedSections.length} warnings=${warnings.length}`);

    return {
      exportVersion: 'v1',
      generatedAt: new Date().toISOString(),
      userId,
      subject: sanitizeUser(user),
      sections,
      metadata: { includedSections, omittedSections, warnings, limitPerSection: SECTION_LIMIT },
    };
  }
}
