import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Onboarding v1 — abandoned-guest reaper. The passwordless guest mint creates a real User row per session, so a
 * bot (or a client that never persists+resends its deviceKey) could bloat the User table. The edge rate-limit /
 * ThrottlerGuard is the abuse THROTTLE; this is the CLEANUP.
 *
 * SAFETY (guardian-hardened): every User.* relation is onDelete:Cascade, so a plain delete would SILENTLY destroy
 * any child rows (declared allergies, a granted GDPR consent, favorites, …). So a guest is reaped ONLY when it is
 * empty across EVERY relation. The guard is generated from the Prisma schema (DMMF) rather than a hand-maintained
 * list, so a relation added later is AUTOMATICALLY required-empty too (no drift, no silent data loss). Deletion is
 * an atomic deleteMany re-applying the same guard, so a guest that became active between scan and delete (TOCTOU)
 * no longer matches and is left untouched.
 */
const TTL_HOURS = 48;
const BATCH = 2000;

@Injectable()
export class GuestReaperService {
  private readonly logger = new Logger('GuestReaper');
  constructor(private readonly prisma: PrismaService) {}

  // Every 6 hours at :30 (off the top-of-hour where other crons cluster).
  @Cron('0 30 */6 * * *')
  async reap(): Promise<void> {
    await this.reapOnce();
  }

  /** isGuest + older than TTL + EVERY relation empty (DMMF-driven so future relations are covered automatically). */
  emptyGuestWhere(now: Date): Prisma.UserWhereInput {
    const where: any = {
      isGuest: true,
      createdAt: { lt: new Date(now.getTime() - TTL_HOURS * 3600_000) },
    };
    const userModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'User');
    for (const f of userModel?.fields ?? []) {
      if (f.kind === 'object') where[f.name] = f.isList ? { none: {} } : { is: null };
    }
    return where;
  }

  /** `now` injectable for deterministic testing. Returns counts; never aborts the batch on a single error. */
  async reapOnce(now: Date = new Date()): Promise<{ deleted: number; scanned: number }> {
    const guard = this.emptyGuestWhere(now);
    const candidates = await this.prisma.user.findMany({ where: guard, select: { id: true }, take: BATCH });

    let deleted = 0;
    for (const { id } of candidates) {
      try {
        // re-apply the FULL emptiness guard at delete time → atomic check-and-delete (closes the TOCTOU; a guest
        // that gained any row mid-pass no longer matches, so count is 0 and nothing is destroyed)
        const res = await this.prisma.user.deleteMany({ where: { ...guard, id } });
        deleted += res.count;
      } catch (e: any) {
        this.logger.warn(`reap skip ${id}: ${e?.code || e?.message}`);
      }
    }
    if (deleted) this.logger.log(`reaped ${deleted}/${candidates.length} abandoned empty guests (>${TTL_HOURS}h old)`);
    return { deleted, scanned: candidates.length };
  }
}
