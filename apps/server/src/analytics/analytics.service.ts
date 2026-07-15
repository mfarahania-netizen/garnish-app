// apps/server/src/analytics/analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEnrichmentService } from './event-enrichment.service';
import { EventOutboxService } from '../behavior-engine/routing/event-outbox.service';
import { EventQualityService } from './event-quality.service'; // 👈 جدید
import {
  guardEventForRuntime,
  resolveRuntimeGuardMode,
} from './event-envelope-runtime-guard';
import { ConsentService } from '../consent/consent.service';
import {
  sanitizePayload,
  isKnownEventType,
  isSafePagePath,
  isSafeSessionId,
} from './payload-sanitizer';
import { Prisma, type UserEvent } from '@prisma/client';
import {
  currentEventPopulationWhere,
  requireCurrentConsentPopulation,
} from './intelligence/optional-processing-boundary';
import {
  currentGrantEpochInLockedTransaction,
  withUserOptionalProcessingBoundary,
} from '../consent/optional-processing-transaction-boundary.service';
import type { OptionalConsentPurpose } from '../consent/consent.constants';

type AnalyticsEventInput = {
  userId: string;
  type: string;
  page?: string;
  duration?: number;
  sessionId?: string;
  payload?: Record<string, unknown>;
};

type ConsentBoundEvent = {
  event: UserEvent;
  grantEpoch: Date;
};

const JOINT_CONSENT_EVENT_TYPES = new Set(['recommendation_impression']);

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private enrichmentService: EventEnrichmentService,
    private outbox: EventOutboxService,
    private eventQuality: EventQualityService, // 👈 جدید
    private readonly consent: ConsentService,
  ) {}

  /**
   * E43-A2 shadow runtime integration — OBSERVATIONAL ONLY.
   * Validates/normalizes the incoming event against the Canonical Event Envelope contract without
   * changing this ingest path: it never drops/alters the event, never throws, writes nothing to the
   * DB, and only logs a REDACTED line (debug) when the event is not yet canonical. Default mode is
   * `shadow` (configurable via EVENT_ENVELOPE_RUNTIME_GUARD_MODE=off|shadow|strict). Even in `strict`
   * this method does not drop events — producer migration is staged; the guard verdict is observed,
   * not enforced here.
   */
  private observeWithRuntimeGuard(data: {
    userId: string;
    type: string;
    page?: string;
  }): void {
    try {
      const mode = resolveRuntimeGuardMode();
      if (mode === 'off') return;
      const verdict = guardEventForRuntime(
        {
          eventType: data.type,
          actorType: 'user',
          actorId: data.userId,
          source: data.page ? 'web-pwa' : 'server',
          surface: data.page,
          // legacy payload is intentionally NOT forwarded (untrusted / possible PII).
        },
        {
          mode,
          source: 'analytics.service.trackEvent',
          producerId: 'prod-analytics-trackevent',
          redactForLogs: true,
        },
      );
      if (verdict.status !== 'accepted') {
        this.logger.debug(
          `[event-envelope-guard:${verdict.mode}] producer=${verdict.producerId} status=${verdict.status} ` +
            `warnings=${verdict.warnings.length} errors=${verdict.errors.length} ` +
            `redacted=${JSON.stringify(verdict.redactedEvent)}`,
        );
      }
      // Observational: do NOT drop events even when verdict.allowed is false (staged migration).
    } catch {
      /* guard is best-effort; it must never affect ingest */
    }
  }

  async trackEvent(data: AnalyticsEventInput) {
    const purposes: readonly OptionalConsentPurpose[] =
      JOINT_CONSENT_EVENT_TYPES.has(data.type)
        ? ['analytics', 'personalization']
        : ['analytics'];
    const result = await this.trackEventWithinConsentBoundary(data, purposes);
    return result?.event ?? null;
  }

  /**
   * Recommendation impressions are collected specifically to influence a user's future ranking.
   * Return the locked grant epoch so the exposure write can reject a withdraw/re-grant race instead
   * of attaching an old impression to a new consent epoch.
   */
  async trackRecommendationImpression(
    data: Omit<AnalyticsEventInput, 'type'>,
  ): Promise<ConsentBoundEvent | null> {
    return this.trackEventWithinConsentBoundary(
      { ...data, type: 'recommendation_impression' },
      ['analytics', 'personalization'],
    );
  }

  private async trackEventWithinConsentBoundary(
    data: AnalyticsEventInput,
    requiredPurposes: readonly OptionalConsentPurpose[],
  ): Promise<ConsentBoundEvent | null> {
    if (!data.userId) {
      return null;
    }

    const safePage = isSafePagePath(data.page) ? data.page : undefined;
    const safeSessionId = isSafeSessionId(data.sessionId)
      ? data.sessionId
      : undefined;

    // 🛡️ ارزیابی کیفیت رویداد
    const quality = this.eventQuality.assess(data);
    if (!quality.isValid) {
      console.warn(`⚠️ Event rejected: ${data.type} - ${quality.reason}`);
      return null;
    }

    // E43-A2 shadow runtime guard (observational; never blocks/alters this flow).
    this.observeWithRuntimeGuard({ ...data, page: safePage });

    // Taxonomy drift (advisor audit): flag unknown event types so the signal layer stays clean — but NEVER
    // drop the event (no lost signals). The known-type set is completed from observed flags over time.
    if (!isKnownEventType(data.type)) {
      this.logger.debug(
        `[event-taxonomy] unknown event type stored (not dropped): ${data.type}`,
      );
    }

    const eventData: Prisma.UserEventUncheckedCreateInput = {
      userId: data.userId,
      type: data.type,
    };
    if (safePage) eventData.page = safePage;
    if (data.duration) eventData.duration = data.duration;
    if (safeSessionId) eventData.sessionId = safeSessionId;
    // PRIVACY (advisor audit): persist a REDACTED payload — free-text/PII keys dropped, strings capped. The raw
    // payload stays in-memory only (used for the recipeId denorm below + passed to enrichment), never stored.
    const safePayload = data.payload ? sanitizePayload(data.payload) : null;
    if (safePayload && Object.keys(safePayload).length > 0)
      eventData.payload = JSON.stringify(safePayload);
    // L0/B — denormalize recipeId from the payload onto the row for fast recipe-level signal queries
    // (it previously lived only inside the opaque payload string). Processors still read payload.recipeId
    // unchanged; this is a purely additive column write.
    const rid = safePayload?.recipeId;
    if (typeof rid === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(rid)) {
      eventData.recipeId = rid;
    }

    // Authorization and persistence share one serialized transaction. Analytics is required for collection;
    // personalization promotion is decided from the same locked ledger snapshot. There is no compensating
    // delete: either the insert commits before a later withdrawal, or a committed withdrawal is observed first.
    const boundary = await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId: data.userId,
        purposes: requiredPurposes,
        operation: 'analytics.track-event',
      },
      async (tx) => {
        const personalizationRequired =
          requiredPurposes.includes('personalization');
        const personalizationEpoch = await currentGrantEpochInLockedTransaction(
          tx,
          data.userId,
          ['analytics', 'personalization'],
        );
        // The generic analytics endpoint can also receive recommendation_impression.
        // Never downgrade that event to analytics-only storage when personalization is absent.
        if (personalizationRequired && !personalizationEpoch) return null;
        const collectedEvent = await tx.userEvent.create({
          data: {
            ...eventData,
            consentPurpose: personalizationRequired
              ? 'personalization'
              : 'analytics',
          },
        });
        if (personalizationRequired || !personalizationEpoch) {
          return collectedEvent;
        }
        return tx.userEvent.update({
          where: { id: collectedEvent.id },
          data: { consentPurpose: 'personalization' },
        });
      },
    ).catch((error) => {
      this.logger.warn(
        `analytics write suppressed: ${
          error instanceof Error ? error.name : 'boundary_error'
        }`,
      );
      return null;
    });
    if (!boundary || boundary.status !== 'executed' || !boundary.value) {
      return null;
    }
    const event = boundary.value;
    if (event.consentPurpose !== 'personalization') {
      return { event, grantEpoch: boundary.grantEpoch };
    }

    // Raw-payload enrichment derives durable profile signals, so analytics consent alone is insufficient.
    // It runs only after a current personalization grant has been verified.
    void this.enrichmentService.enrichEvent(
      event.id,
      data.payload,
      data.userId,
    );

    // L0 — durable routing via the outbox: persist a routing record, then route immediately (fast path). If
    // this process crashes before routing completes, the scheduled drain re-routes the pending row — the signal
    // is never lost ("capture every second"). enqueue is idempotent (unique eventId).
    const outboxId = await this.outbox.enqueue(event.id, data.userId);
    if (outboxId) {
      this.outbox
        .processNow(outboxId)
        .catch((err) =>
          console.error(`Event routing failed for event ${event.id}:`, err),
        );
    }

    return { event, grantEpoch: boundary.grantEpoch };
  }

  async getPopularRecipes() {
    const subjects = await requireCurrentConsentPopulation(
      this.prisma,
      'analytics',
      'analytics.popular-recipes',
    );
    return this.prisma.userEvent.findMany({
      where: {
        type: 'recipe_view',
        ...currentEventPopulationWhere(subjects, 'analytics'),
      },
      select: { payload: true },
      take: 100,
    });
  }
}
