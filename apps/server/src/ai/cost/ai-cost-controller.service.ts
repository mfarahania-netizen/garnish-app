import { Injectable } from '@nestjs/common';
import { PER_REQUEST_MAX_TOKENS, PER_USER_DAILY_MAX_TOKENS } from './ai-cost-policy';

export interface CostCheckInput {
  userId: string;
  estimatedTokens?: number;
}
export interface CostCheckResult {
  allowed: boolean;
  reason?: string;
}
export interface CostLimits {
  perCallTokenLimit?: number;
  perUserTokenLimit?: number;
}

// Defaults sourced from the AI cost policy (single source of truth — E47-A10A).
const DEFAULT_PER_CALL_TOKEN_LIMIT = PER_REQUEST_MAX_TOKENS;
const DEFAULT_PER_USER_TOKEN_LIMIT = PER_USER_DAILY_MAX_TOKENS;

/**
 * AI Cost Controller (E47-A1).
 *
 * Enforces configurable per-call and per-user token budgets. In-memory accounting only — there is
 * NO real billing/payment logic (out of scope). Wire to a persisted budget/ledger in a later phase.
 */
@Injectable()
export class AiCostControllerService {
  private perCallTokenLimit = DEFAULT_PER_CALL_TOKEN_LIMIT;
  private perUserTokenLimit = DEFAULT_PER_USER_TOKEN_LIMIT;
  private readonly usageByUser = new Map<string, number>();

  /** Configure limits (no constructor args, so NestJS DI resolves it with defaults). */
  configure(limits: CostLimits): this {
    if (limits.perCallTokenLimit != null) this.perCallTokenLimit = limits.perCallTokenLimit;
    if (limits.perUserTokenLimit != null) this.perUserTokenLimit = limits.perUserTokenLimit;
    return this;
  }

  getLimits(): Required<CostLimits> {
    return { perCallTokenLimit: this.perCallTokenLimit, perUserTokenLimit: this.perUserTokenLimit };
  }

  check(input: CostCheckInput): CostCheckResult {
    const estimate = Math.max(0, input.estimatedTokens ?? 0);
    if (estimate > this.perCallTokenLimit) {
      return { allowed: false, reason: `per-call token limit exceeded (${estimate} > ${this.perCallTokenLimit})` };
    }
    const projected = (this.usageByUser.get(input.userId) ?? 0) + estimate;
    if (projected > this.perUserTokenLimit) {
      return { allowed: false, reason: `per-user token limit exceeded (${projected} > ${this.perUserTokenLimit})` };
    }
    return { allowed: true };
  }

  /** Record actual usage after a successful call. */
  record(input: { userId: string; tokens: number }): void {
    const tokens = Math.max(0, input.tokens ?? 0);
    this.usageByUser.set(input.userId, (this.usageByUser.get(input.userId) ?? 0) + tokens);
  }

  getUsage(userId: string): number {
    return this.usageByUser.get(userId) ?? 0;
  }

  reset(userId?: string): void {
    if (userId) this.usageByUser.delete(userId);
    else this.usageByUser.clear();
  }
}
