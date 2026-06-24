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

  /** Sum of real-provider estimated USD cost for this user since the start of the current UTC day. */
  async consumedEstimatedCostUsdToday(userId: string, now: Date = new Date()): Promise<number> {
    const since = startOfUtcDay(now);
    const agg = await this.prisma.aICallLog.aggregate({
      _sum: { estimatedCost: true },
      where: {
        userId,
        createdAt: { gte: since },
        provider: { not: STUB_PROVIDER_NAME },
        estimatedCost: { not: null },
      },
    });
    return agg._sum.estimatedCost ?? 0;
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
   * calls). DB-AGGREGATE-based (guardian-hardened): one findFirst for the cooldown + one bounded sum aggregate per
   * window — NOT an unbounded findMany that loads up to a 30-day row set into Node on every call. Anonymous user →
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
    if (cooldownMs <= 0 && windows.length === 0) return { allowed: true }; // nothing configured

    const realProvider = { userId, provider: { not: STUB_PROVIDER_NAME }, usageSource: { in: ['provider', 'estimated'] } };
    const nowMs = now.getTime();

    // cooldown: most-recent real-provider call (one indexed row), not a scan.
    if (cooldownMs > 0) {
      const last = await this.prisma.aICallLog.findFirst({
        where: realProvider,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (last && nowMs - last.createdAt.getTime() < cooldownMs) {
        return { allowed: false, window: 'cooldown', reason: 'cooldown' };
      }
    }

    // each window: a bounded SUM aggregate (DB-side), checked tightest-first so the most relevant cap reports.
    const est = Math.max(0, estimatedTokens ?? 0);
    const ordered = [...windows].sort((a, b) => a.durationMs - b.durationMs);
    for (const w of ordered) {
      const agg = await this.prisma.aICallLog.aggregate({
        _sum: { totalTokens: true },
        where: { ...realProvider, createdAt: { gte: new Date(nowMs - w.durationMs) } },
      });
      const consumed = agg._sum.totalTokens ?? 0;
      if (consumed + est > (w.maxTokens as number)) {
        return { allowed: false, window: w.id, reason: `budget_exceeded_${w.id}`, consumedTokens: consumed, limit: w.maxTokens as number };
      }
    }
    return { allowed: true };
  }
}
