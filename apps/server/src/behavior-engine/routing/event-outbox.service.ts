import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventRouterService } from './event-router.service';

const GRACE_MS = 120_000; // a pending row is a "straggler" the fast path didn't finish only after this
const STALE_PROCESSING_MS = 5 * 60_000; // a row 'processing' longer than this is presumed crashed mid-flight
const MAX_ATTEMPTS = 10; // after this many tries a row is dead-lettered instead of looping forever

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
  async enqueue(eventId: string): Promise<string | null> {
    try {
      const row = await this.prisma.eventOutbox.create({ data: { eventId } });
      return row.id;
    } catch (e: any) {
      this.logger.error(`outbox enqueue failed for ${eventId}: ${e?.message}`);
      return null;
    }
  }

  /** Fast path: route one enqueued row now and mark it done. Safe to call fire-and-forget; never throws. On
   *  failure the row is left pending (attempts++) for the scheduled drain to retry. */
  async processNow(outboxId: string, event: any, userId: string): Promise<void> {
    try {
      await this.router.route(event, userId);
      await this.finishOk(outboxId);
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

  /** Transition a failed row: dead-letter once it exhausts MAX_ATTEMPTS, else back to pending for a retry. */
  private async finishFail(id: string, priorAttempts: number, err?: string): Promise<void> {
    const dead = priorAttempts + 1 >= MAX_ATTEMPTS;
    await this.prisma.eventOutbox
      .update({ where: { id }, data: { status: dead ? 'dead' : 'pending', attempts: { increment: 1 }, error: String(err || '').slice(0, 500) } })
      .catch(() => {});
    if (dead) this.logger.error(`[outbox] DEAD-LETTER ${id} after ${priorAttempts + 1} attempts: ${err}`);
  }

  /** Safety net (scheduled): revive crashed-mid-flight 'processing' rows, then re-route pending stragglers. */
  async drain(opts: { graceMs?: number; staleProcessingMs?: number; limit?: number; maxAttempts?: number } = {}): Promise<{ processed: number; failed: number; dead: number; revived: number }> {
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
    for (const row of rows) {
      const claim = await this.prisma.eventOutbox.updateMany({ where: { id: row.id, status: 'pending' }, data: { status: 'processing', claimedAt: new Date() } });
      if (!claim.count) continue; // another drain claimed it
      const event = await this.prisma.userEvent.findUnique({ where: { id: row.eventId } });
      if (!event) { await this.finishOk(row.id); continue; } // event gone → nothing to route, close it
      try {
        await this.router.route(event, event.userId);
        await this.finishOk(row.id);
        processed++;
      } catch (e: any) {
        const willDie = row.attempts + 1 >= maxAttempts;
        await this.finishFail(row.id, row.attempts, e?.message);
        if (willDie) dead++; else failed++;
      }
    }
    if (processed || failed || dead || stale.length) this.logger.log(`[outbox] drain: processed=${processed} failed=${failed} dead=${dead} revived=${stale.length} (scanned ${rows.length})`);
    return { processed, failed, dead, revived: stale.length };
  }
}
