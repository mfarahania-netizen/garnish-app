import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventRouterService } from './event-router.service';
import { isOptionalPurposeRuntimeEnabled } from '../../consent/consent.constants';
import { withUserOptionalProcessingBoundary } from '../../consent/optional-processing-transaction-boundary.service';

const GRACE_MS = 120_000; // a pending row is a "straggler" the fast path didn't finish only after this
const STALE_PROCESSING_MS = 5 * 60_000; // a row 'processing' longer than this is presumed crashed mid-flight
const MAX_ATTEMPTS = 10; // after this many tries a row is dead-lettered instead of looping forever
const EVENT_PROVENANCE_SELECT = {
  userId: true,
  timestamp: true,
  consentPurpose: true,
} as const;

type StoredRoutingOutcome = 'processed' | 'missing' | 'suppressed';

/**
 * Durable transactional-outbox for event routing — the L0 "no lost signals" guarantee. Every routable event
 * gets a row; the fast path routes immediately and marks it done; a scheduled drain (a) re-routes pending
 * stragglers the fast path never finished and (b) REVIVES rows stuck in 'processing' after a crash mid-flight,
 * and dead-letters anything that exhausts its retries (no silent abandonment).
 *
 * DELIVERY SEMANTICS — honest: this is AT-LEAST-ONCE (no signal is ever lost, which is the gate's promise).
 * It is NOT exactly-once: if route() succeeds but the process dies before the row is marked done, the reaper
 * will re-route it (a rare double). The done-mark is retried to shrink that window to near-zero, but true
 * exactly-once requires IDEMPOTENT CONSUMERS — tracked as L1 hardening (a single clean idempotency key does
 * not exist today: recommendation.signal-processor legitimately writes multiple SignalObservation rows with
 * the same (eventId, signalName) but different recipeId, and some rows have a null recipeId).
 */
@Injectable()
export class EventOutboxService {
  private readonly logger = new Logger(EventOutboxService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly router: EventRouterService,
  ) {}

  /** Record a stored event for durable routing. eventId is unique → idempotent. Returns the row id (or null). */
  async enqueue(eventId: string, expectedUserId?: string): Promise<string | null> {
    if (
      !isOptionalPurposeRuntimeEnabled('analytics') ||
      !isOptionalPurposeRuntimeEnabled('personalization')
    ) {
      return null;
    }
    try {
      const userId = expectedUserId ?? (
        await this.prisma.userEvent.findUnique({
          where: { id: eventId },
          select: { userId: true },
        })
      )?.userId;
      if (!userId) return null;
      const boundary = await withUserOptionalProcessingBoundary(
        this.prisma,
        {
          userId,
          purposes: ['analytics', 'personalization'],
          operation: 'event-outbox.enqueue',
        },
        async (tx, context) => {
          const event = await tx.userEvent.findUnique({
            where: { id: eventId },
            select: {
              userId: true,
              timestamp: true,
              consentPurpose: true,
            },
          });
          if (
            !event ||
            event.userId !== userId ||
            event.consentPurpose !== 'personalization' ||
            event.timestamp.getTime() < context.grantEpoch.getTime()
          ) return null;
          return tx.eventOutbox.upsert({
            where: { eventId },
            create: { eventId },
            update: {},
          });
        },
      );
      return boundary.status === 'executed' ? boundary.value?.id ?? null : null;
    } catch (e: any) {
      this.logger.error(`outbox enqueue failed for ${eventId}: ${e?.message}`);
      return null;
    }
  }

  /** Fast path: route one enqueued row now and mark it done. Safe to call fire-and-forget; never throws. On
   *  failure the row is left pending (attempts++) for the scheduled drain to retry. */
  async processNow(outboxId: string): Promise<void> {
    if (
      !isOptionalPurposeRuntimeEnabled('analytics') ||
      !isOptionalPurposeRuntimeEnabled('personalization')
    ) {
      return;
    }
    try {
      const row = await this.prisma.eventOutbox.findUnique({
        where: { id: outboxId },
        select: { eventId: true },
      });
      if (!row) return;
      const outcome = await this.routeStoredEvent(
        row.eventId,
        'event-outbox.process-now',
      );
      if (outcome === 'suppressed') await this.finishSuppressed(outboxId);
      else await this.finishOk(outboxId);
    } catch (e: any) {
      await this.finishFail(outboxId, 0, e?.message);
      this.logger.debug(`outbox processNow failed (${outboxId}); left for drain: ${e?.message}`);
    }
  }

  /** Mark a row done, retried a few times so a transient DB hiccup can't strand a successfully-routed row
   *  (this is what keeps the at-least-once redelivery window near-zero in practice). */
  private async finishOk(id: string): Promise<void> {
    for (let i = 0; i < 3; i++) {
      try {
        await this.prisma.eventOutbox.update({ where: { id }, data: { status: 'done', processedAt: new Date(), error: null } });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }

  /** Consent denial/withdrawal is terminal, not retryable. The ledger-interruption check below is the
   * durable fallback if this best-effort terminal write is temporarily unavailable. */
  private async finishSuppressed(id: string): Promise<void> {
    for (let i = 0; i < 3; i++) {
      try {
        await this.prisma.eventOutbox.update({
          where: { id },
          data: {
            status: 'done',
            processedAt: new Date(),
            error: 'suppressed: personalization consent not granted at routing',
          },
        });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }

  /**
   * Read only non-payload provenance before authorization. The canonical user
   * lock and current joint-consent decision are then resolved in one boundary;
   * only its callback may fetch the complete event and dispatch its processor.
   */
  private async routeStoredEvent(
    eventId: string,
    operation: string,
  ): Promise<StoredRoutingOutcome> {
    const provenance = await this.prisma.userEvent.findUnique({
      where: { id: eventId },
      select: EVENT_PROVENANCE_SELECT,
    });
    if (!provenance) return 'missing';
    const provenanceAt = provenance.timestamp instanceof Date
      ? provenance.timestamp
      : new Date(provenance.timestamp ?? Number.NaN);
    if (
      !provenance.userId ||
      provenance.consentPurpose !== 'personalization' ||
      Number.isNaN(provenanceAt.getTime())
    ) return 'suppressed';

    const boundary = await withUserOptionalProcessingBoundary(
      this.prisma,
      {
        userId: provenance.userId,
        purposes: ['analytics', 'personalization'],
        operation,
      },
      async (tx, context): Promise<StoredRoutingOutcome> => {
        if (provenanceAt.getTime() < context.grantEpoch.getTime()) {
          return 'suppressed';
        }
        // Deliberately no `select`: this is the first and only full-payload read,
        // after the canonical lock and current-grant authorization succeeded.
        const event = await tx.userEvent.findUnique({ where: { id: eventId } });
        if (!event) return 'missing';
        const eventAt = event.timestamp instanceof Date
          ? event.timestamp
          : new Date(event.timestamp ?? Number.NaN);
        if (
          event.userId !== provenance.userId ||
          event.consentPurpose !== 'personalization' ||
          Number.isNaN(eventAt.getTime()) ||
          eventAt.getTime() < context.grantEpoch.getTime()
        ) return 'suppressed';
        await this.router.routeInLockedTransaction(
          event,
          provenance.userId,
          tx,
          context.grantEpoch,
        );
        return 'processed';
      },
    );
    return boundary.status === 'executed' ? boundary.value : 'suppressed';
  }

  /** Transition a failed row: dead-letter once it exhausts MAX_ATTEMPTS, else back to pending for a retry. */
  private async finishFail(id: string, priorAttempts: number, err?: string): Promise<void> {
    const dead = priorAttempts + 1 >= MAX_ATTEMPTS;
    await this.prisma.eventOutbox
      .update({ where: { id }, data: { status: dead ? 'dead' : 'pending', attempts: { increment: 1 }, error: String(err || '').slice(0, 500) } })
      .catch(() => {});
    if (dead) this.logger.error(`[outbox] DEAD-LETTER ${id} after ${priorAttempts + 1} attempts: ${err}`);
  }

  /** Safety net (scheduled): revive crashed-mid-flight 'processing' rows, then re-route pending stragglers. */
  async drain(opts: { graceMs?: number; staleProcessingMs?: number; limit?: number; maxAttempts?: number } = {}): Promise<{ processed: number; failed: number; dead: number; revived: number; suppressed: number }> {
    if (
      !isOptionalPurposeRuntimeEnabled('analytics') ||
      !isOptionalPurposeRuntimeEnabled('personalization')
    ) {
      return { processed: 0, failed: 0, dead: 0, revived: 0, suppressed: 0 };
    }
    const graceMs = opts.graceMs ?? GRACE_MS;
    const staleMs = opts.staleProcessingMs ?? STALE_PROCESSING_MS;
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;

    // (3b) revive rows stuck in 'processing' past the TTL (fast path / a prior drain crashed mid-flight).
    // attempts++ so a permanently-stuck row eventually dead-letters instead of being revived forever.
    const stale = await this.prisma.eventOutbox.findMany({ where: { status: 'processing', claimedAt: { lt: new Date(Date.now() - staleMs) } }, select: { id: true, attempts: true } });
    for (const r of stale) {
      const dead = r.attempts + 1 >= maxAttempts;
      await this.prisma.eventOutbox.update({ where: { id: r.id }, data: { status: dead ? 'dead' : 'pending', attempts: { increment: 1 } } }).catch(() => {});
    }
    if (stale.length) this.logger.warn(`[outbox] revived ${stale.length} stuck 'processing' row(s) (possible at-least-once redelivery)`);

    const rows = await this.prisma.eventOutbox.findMany({
      where: { status: 'pending', createdAt: { lt: new Date(Date.now() - graceMs) }, attempts: { lt: maxAttempts } },
      orderBy: { createdAt: 'asc' }, take: limit,
    });
    let processed = 0;
    let failed = 0;
    let dead = 0;
    let suppressed = 0;
    for (const row of rows) {
      const claim = await this.prisma.eventOutbox.updateMany({ where: { id: row.id, status: 'pending' }, data: { status: 'processing', claimedAt: new Date() } });
      if (!claim.count) continue; // another drain claimed it
      try {
        const outcome = await this.routeStoredEvent(
          row.eventId,
          'event-outbox.drain',
        );
        if (outcome === 'suppressed') {
          await this.finishSuppressed(row.id);
          suppressed++;
        } else {
          await this.finishOk(row.id);
          if (outcome === 'processed') processed++;
        }
      } catch (e: any) {
        const willDie = row.attempts + 1 >= maxAttempts;
        await this.finishFail(row.id, row.attempts, e?.message);
        if (willDie) dead++; else failed++;
      }
    }
    if (processed || failed || dead || suppressed || stale.length) this.logger.log(`[outbox] drain: processed=${processed} failed=${failed} dead=${dead} suppressed=${suppressed} revived=${stale.length} (scanned ${rows.length})`);
    return { processed, failed, dead, revived: stale.length, suppressed };
  }
}
