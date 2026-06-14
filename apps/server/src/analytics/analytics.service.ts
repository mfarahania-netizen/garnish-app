// apps/server/src/analytics/analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEnrichmentService } from './event-enrichment.service';
import { EventRouterService } from '../behavior-engine/routing/event-router.service';
import { EventQualityService } from './event-quality.service'; // 👈 جدید
import { guardEventForRuntime, resolveRuntimeGuardMode } from './event-envelope-runtime-guard';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private enrichmentService: EventEnrichmentService,
    private eventRouter: EventRouterService,
    private eventQuality: EventQualityService, // 👈 جدید
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
  private observeWithRuntimeGuard(data: { userId: string; type: string; page?: string }): void {
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
        { mode, source: 'analytics.service.trackEvent', producerId: 'prod-analytics-trackevent', redactForLogs: true },
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

  async trackEvent(data: {
    userId: string;
    type: string;
    page?: string;
    duration?: number;
    sessionId?: string;
    payload?: any;
  }) {
    if (!data.userId) {
      return null;
    }

    // 🛡️ ارزیابی کیفیت رویداد
    const quality = this.eventQuality.assess(data);
    if (!quality.isValid) {
      console.warn(`⚠️ Event rejected: ${data.type} - ${quality.reason}`);
      return null;
    }

    // E43-A2 shadow runtime guard (observational; never blocks/alters this flow).
    this.observeWithRuntimeGuard(data);

    const eventData: any = {
      userId: data.userId,
      type: data.type,
    };
    if (data.page) eventData.page = data.page;
    if (data.duration) eventData.duration = data.duration;
    if (data.sessionId) eventData.sessionId = data.sessionId;
    if (data.payload) eventData.payload = JSON.stringify(data.payload);

    const event = await this.prisma.userEvent.create({ data: eventData });

    // غنی‌سازی را در پس‌زمینه اجرا کن
    this.enrichmentService.enrichEvent(event.id);

    // 🆕 ارسال رویداد به موتور سیگنال‌ها (بدون منتظر ماندن)
    this.eventRouter.route(event, data.userId).catch(err =>
      console.error(`Event routing failed for event ${event.id}:`, err)
    );

    return event;
  }

  async getPopularRecipes() {
    return this.prisma.userEvent.findMany({
      where: { type: 'recipe_view' },
      select: { payload: true },
      take: 100,
    });
  }
}