// apps/server/src/governance/data-retention.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RetentionService } from '../retention/retention.service';

/**
 * Legacy monthly retention cron — NEUTRALIZED (E39-1E-1).
 *
 * History: this previously ran an UNGUARDED destructive `userEvent.deleteMany({ timestamp: { lt: now-1y } })`
 * on the 1st of every month, in every environment, with no dry-run / env guard / approval. That contradicted
 * the E39-1E dry-run-first retention policy and was a data-loss path.
 *
 * Now: the direct delete is REMOVED. The cron delegates to the E39-1E `RetentionService`:
 *   - Default (no `RETENTION_DESTRUCTIVE_ENABLED`): runs the count-only DRY-RUN and deletes NOTHING.
 *   - Destructive mode (`RETENTION_DESTRUCTIVE_ENABLED=true`): routed through `RetentionService.executeRetention()`,
 *     which refuses (no deletion path is implemented in this phase) — a real prune requires a separate,
 *     explicitly approved controlled-execution task.
 * There is exactly ONE retention code path (the policy service); no second deletion path remains.
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(private prisma: PrismaService) {}

  @Cron('0 0 1 * *') // 1st of each month
  async cleanupOldEvents() {
    // Stateless policy service (only needs Prisma) — instantiated directly to avoid a second DI wiring.
    const retention = new RetentionService(this.prisma);

    if (!RetentionService.isDestructiveEnabled()) {
      const preview = await retention.previewRetention();
      this.logger.log(
        `retention cron: DRY-RUN only (RETENTION_DESTRUCTIVE_ENABLED not set) — ` +
          `${preview.totalCandidates} candidate rows across ${preview.candidates.length} prunable models; deleted 0.`,
      );
      return; // default-safe: nothing deleted
    }

    // Destructive mode explicitly requested → still routed through the guarded service, which refuses.
    this.logger.warn('retention cron: destructive mode requested; delegating to guarded RetentionService.executeRetention().');
    await retention.executeRetention(); // throws — no deletion path in this phase
  }
}
