import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Onboarding v1 — abandoned-guest reaper. The passwordless guest mint creates a real User row per session, so a
 * bot (or a client that never persists+resends its deviceKey) could bloat the User table. The edge rate-limit /
 * ThrottlerGuard is the abuse THROTTLE; this is the CLEANUP: it deletes guests that are truly EMPTY (no declared
 * safety profile, no activity of any kind) and older than a short TTL. ANY trace — a declared allergy, a favorite,
 * a meal plan, an event, a saved preference — protects the row, so a real (even briefly-active) guest is never lost.
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

  /** Exposed (and `now` injectable) for deterministic testing. Returns counts; never throws on a single bad row. */
  async reapOnce(now: Date = new Date()): Promise<{ deleted: number; scanned: number }> {
    const cutoff = new Date(now.getTime() - TTL_HOURS * 3600_000);
    const candidates = await this.prisma.user.findMany({
      where: {
        isGuest: true,
        createdAt: { lt: cutoff },
        // every relation that would represent a "trace" must be empty
        allergies: { none: {} },
        cuisines: { none: {} },
        healthGoals: { none: {} },
        favorites: { none: {} },
        mealPlans: { none: {} },
        shoppingList: { none: {} },
        events: { none: {} },
        recipes: { none: {} },
        chatMessages: { none: {} },
        preferences: { is: null },
      },
      select: { id: true },
      take: BATCH,
    });

    let deleted = 0;
    for (const { id } of candidates) {
      try {
        await this.prisma.user.delete({ where: { id } });
        deleted++;
      } catch (e: any) {
        // an unexpected residual FK row → keep the guest (safe), log, move on (never abort the batch)
        this.logger.warn(`reap skip ${id}: ${e?.code || e?.message}`);
      }
    }
    if (deleted) this.logger.log(`reaped ${deleted}/${candidates.length} abandoned empty guests (>${TTL_HOURS}h old)`);
    return { deleted, scanned: candidates.length };
  }
}
