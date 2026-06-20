import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventRouterService } from './event-router.service';

/**
 * Durable transactional-outbox for event routing — the L0 "capture every second / no lost signals" guarantee.
 * Today routing was fire-and-forget in-process: a crash between the event write and routing lost the signal
 * forever. Now every routable event gets an outbox row; the fast path routes immediately and marks it done,
 * and a scheduled drain re-routes anything still pending after a grace period. At-least-once into the signal
 * engine; a pending→processing claim guards against double drains.
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

  /** Fast path: route one enqueued row now and mark it done. Safe to call fire-and-forget; on failure the row
   *  is left pending (with attempts++) for the scheduled drain to retry — never throws. */
  async processNow(outboxId: string, event: any, userId: string): Promise<void> {
    try {
      await this.router.route(event, userId);
      await this.prisma.eventOutbox.update({ where: { id: outboxId }, data: { status: 'done', processedAt: new Date() } });
    } catch (e: any) {
      await this.prisma.eventOutbox
        .update({ where: { id: outboxId }, data: { status: 'pending', attempts: { increment: 1 }, error: String(e?.message || '').slice(0, 500) } })
        .catch(() => {});
      this.logger.debug(`outbox processNow failed (${outboxId}); left for drain: ${e?.message}`);
    }
  }

  /** Safety net: re-route rows still pending past the grace period (the fast path never completed). At-least-once;
   *  the pending→processing claim makes concurrent/duplicate drains skip an already-claimed row. */
  async drain(opts: { graceMs?: number; limit?: number; maxAttempts?: number } = {}): Promise<{ processed: number; failed: number }> {
    const graceMs = opts.graceMs ?? 120_000;
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const maxAttempts = opts.maxAttempts ?? 10;
    const cutoff = new Date(Date.now() - graceMs);
    const rows = await this.prisma.eventOutbox.findMany({
      where: { status: 'pending', createdAt: { lt: cutoff }, attempts: { lt: maxAttempts } },
      orderBy: { createdAt: 'asc' }, take: limit,
    });
    let processed = 0;
    let failed = 0;
    for (const row of rows) {
      const claim = await this.prisma.eventOutbox.updateMany({ where: { id: row.id, status: 'pending' }, data: { status: 'processing' } });
      if (!claim.count) continue; // another drain took it
      const event = await this.prisma.userEvent.findUnique({ where: { id: row.eventId } });
      if (!event) {
        await this.prisma.eventOutbox.update({ where: { id: row.id }, data: { status: 'done', processedAt: new Date() } }); // event gone → nothing to route
        continue;
      }
      try {
        await this.router.route(event, event.userId);
        await this.prisma.eventOutbox.update({ where: { id: row.id }, data: { status: 'done', processedAt: new Date() } });
        processed++;
      } catch (e: any) {
        await this.prisma.eventOutbox.update({ where: { id: row.id }, data: { status: 'pending', attempts: { increment: 1 }, error: String(e?.message || '').slice(0, 500) } });
        failed++;
      }
    }
    if (processed || failed) this.logger.log(`[outbox] drained: processed=${processed} failed=${failed} (scanned ${rows.length})`);
    return { processed, failed };
  }
}
