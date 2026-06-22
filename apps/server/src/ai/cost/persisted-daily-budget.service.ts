import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAiCostPolicy } from './ai-cost-policy';

/**
 * Persisted per-user DAILY budget (E47-A10B) — DB-backed via the A10A AICallLog cost ledger.
 *
 * Replaces the process-lifetime in-memory per-user cap with a durable per-UTC-day sum that survives
 * restarts. Counts ONLY real provider token usage (so the free stub/deterministic path never blocks):
 *   sum(totalTokens) where userId = X AND createdAt >= start-of-UTC-day
 *                     AND provider <> 'stub-model' AND usageSource IN ('provider','estimated')
 * blocked-before-provider / provider-error rows have usageSource='unavailable' → excluded (0).
 *
 * NOT billing. No money, no rates here — purely a token-budget safety gate (R3).
 */

/** The deterministic stub provider's name (StubModelProvider.name) — its usage is never billed/budgeted. */
export const STUB_PROVIDER_NAME = 'stub-model';

export interface DailyBudgetResult {
  allowed: boolean;
  consumedTokens: number;
  limit: number;
  projectedTokens: number;
  reason?: string;
}

export interface MultiWindowBudgetResult {
  allowed: boolean;
  /** the window id that blocked (e.g. '5h','weekly') or 'cooldown'; undefined when allowed. */
  window?: string;
  reason?: string;
  consumedTokens?: number;
  limit?: number;
}

export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class PersistedDailyBudgetService {
  private readonly logger = new Logger(PersistedDailyBudgetService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Sum of real-provider tokens consumed by this user since the start of the current UTC day. */
  async consumedTokensToday(userId: string, now: Date = new Date()): Promise<number> {
    const since = startOfUtcDay(now);
    const agg = await this.prisma.aICallLog.aggregate({
      _sum: { totalTokens: true },
      where: {
        userId,
        createdAt: { gte: since },
        provider: { not: STUB_PROVIDER_NAME },
        usageSource: { in: ['provider', 'estimated'] },
      },
    });
    return agg._sum.totalTokens ?? 0;
  }

  /**
   * Check whether a live provider call is within the per-user daily token budget.
   * Anonymous/null user → no per-user budget applies (the per-request cap still guards each call).
   * Throws on DB error — the caller decides fail-open/closed (the orchestrator fails CLOSED for live).
   */
  async check(userId: string | null | undefined, estimatedTokens: number = 0, now: Date = new Date()): Promise<DailyBudgetResult> {
    const limit = resolveAiCostPolicy().perUserDailyMaxTokens;
    if (!userId) {
      return { allowed: true, consumedTokens: 0, limit, projectedTokens: 0 };
    }
    const consumed = await this.consumedTokensToday(userId, now);
    const projected = consumed + Math.max(0, estimatedTokens ?? 0);
    if (projected > limit) {
      return { allowed: false, consumedTokens: consumed, limit, projectedTokens: projected, reason: 'daily_budget_exceeded' };
    }
    return { allowed: true, consumedTokens: consumed, limit, projectedTokens: projected };
  }

  /**
   * MULTI-WINDOW per-user budget + cooldown (founder: 5h/daily/weekly/monthly caps + a 15s gap between live
   * calls). ONE query pulls the user's real-provider rows within the widest window; the cooldown and every
   * rolling window are computed in memory from that one result set (no per-window round-trips). Anonymous user →
   * always allowed (the per-request cap still guards each call). Rolling windows (now − duration), not calendar.
   * Throws on DB error — the caller fails CLOSED (no paid call when the budget cannot be verified).
   */
  async checkAllWindows(
    userId: string | null | undefined,
    estimatedTokens: number = 0,
    now: Date = new Date(),
  ): Promise<MultiWindowBudgetResult> {
    if (!userId) return { allowed: true };
    const policy = resolveAiCostPolicy();
    const windows = policy.perUserBudgetWindows.filter((w) => w.maxTokens != null);
    const cooldownMs = Math.max(0, policy.perUserCooldownMs ?? 0);
    const widest = Math.max(cooldownMs, 0, ...windows.map((w) => w.durationMs));
    if (widest <= 0) return { allowed: true }; // nothing configured

    const since = new Date(now.getTime() - widest);
    const rows = await this.prisma.aICallLog.findMany({
      where: {
        userId,
        createdAt: { gte: since },
        provider: { not: STUB_PROVIDER_NAME },
        usageSource: { in: ['provider', 'estimated'] },
      },
      select: { createdAt: true, totalTokens: true },
    });

    const nowMs = now.getTime();
    // cooldown: reject if the most recent live call was within the cooldown window.
    if (cooldownMs > 0 && rows.length > 0) {
      const lastMs = Math.max(...rows.map((r) => r.createdAt.getTime()));
      if (nowMs - lastMs < cooldownMs) {
        return { allowed: false, window: 'cooldown', reason: 'cooldown' };
      }
    }

    const est = Math.max(0, estimatedTokens ?? 0);
    for (const w of windows) {
      const start = nowMs - w.durationMs;
      const consumed = rows.reduce((s, r) => (r.createdAt.getTime() >= start ? s + (r.totalTokens ?? 0) : s), 0);
      if (consumed + est > (w.maxTokens as number)) {
        return { allowed: false, window: w.id, reason: `budget_exceeded_${w.id}`, consumedTokens: consumed, limit: w.maxTokens as number };
      }
    }
    return { allowed: true };
  }
}
