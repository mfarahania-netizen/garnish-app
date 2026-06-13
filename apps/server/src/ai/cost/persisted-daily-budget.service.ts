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
}
