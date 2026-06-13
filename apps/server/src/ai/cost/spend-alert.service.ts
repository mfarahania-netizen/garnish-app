import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAiCostPolicy, AiCostPolicy } from './ai-cost-policy';

/**
 * Spend Alert foundation (E47-A10C) — governance only. NOT billing, no charging, no paywall, no
 * email/push. Persists an `AiSpendAlert` row when a per-user DAILY threshold is crossed:
 *   - token_daily: consumed provider tokens today >= dailyTokenAlertThreshold
 *   - estimated_cost_daily: today's estimatedCostUsd >= dailyEstimatedCostAlertUsd (ONLY when a verified
 *     rate produced a real cost; null/absent by default → this alert never fires until rates exist).
 * BEST-EFFORT dedup (check-then-act) to ~one 'triggered' alert per (userId, dayUtc, thresholdType) —
 * NOT race-proof (no DB unique constraint): concurrent calls could create duplicates. Acceptable for the
 * dev/beta baseline (consistent with the A10B TOCTOU posture); a partial unique index would harden it.
 * Writing must never break chat.
 */

export const SPEND_ALERT_SCHEMA_VERSION = 1;

export type ThresholdType = 'token_daily' | 'estimated_cost_daily';

export interface SpendAlertInput {
  userId: string | null | undefined;
  provider?: string | null;
  model?: string | null;
  consumedTokensToday: number;
  estimatedCostUsdToday?: number | null;
}

export function utcDayString(now: Date): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

@Injectable()
export class SpendAlertService {
  private readonly logger = new Logger(SpendAlertService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Evaluate daily thresholds; persist any newly-crossed alert (deduped). Returns created alert ids. */
  async evaluateDaily(input: SpendAlertInput, now: Date = new Date(), policy: AiCostPolicy = resolveAiCostPolicy()): Promise<string[]> {
    if (!input.userId) return []; // no per-user alert for anonymous/null-user logs
    const dayUtc = utcDayString(now);
    const created: string[] = [];

    const tokenThreshold = policy.dailyTokenAlertThreshold;
    if (tokenThreshold != null && input.consumedTokensToday >= tokenThreshold) {
      const id = await this.writeIfNew({
        userId: input.userId, thresholdType: 'token_daily', thresholdValue: tokenThreshold,
        observedValue: input.consumedTokensToday, provider: input.provider, model: input.model, dayUtc,
        severity: this.severityFor(input.consumedTokensToday, policy.perUserDailyMaxTokens),
      });
      if (id) created.push(id);
    }

    const costThreshold = policy.dailyEstimatedCostAlertUsd;
    if (costThreshold != null && input.estimatedCostUsdToday != null && input.estimatedCostUsdToday >= costThreshold) {
      const id = await this.writeIfNew({
        userId: input.userId, thresholdType: 'estimated_cost_daily', thresholdValue: costThreshold,
        observedValue: input.estimatedCostUsdToday, provider: input.provider, model: input.model, dayUtc,
        severity: 'warning',
      });
      if (id) created.push(id);
    }
    return created;
  }

  /** True if a 'triggered' alert already exists for this user/day/threshold (dedup helper). */
  async hasAlert(userId: string, thresholdType: ThresholdType, dayUtc: string): Promise<boolean> {
    const existing = await this.prisma.aiSpendAlert.findFirst({ where: { userId, thresholdType, dayUtc, status: 'triggered' } });
    return !!existing;
  }

  private severityFor(observed: number, hardLimit: number): string {
    return observed >= hardLimit ? 'critical' : 'warning';
  }

  private async writeIfNew(a: {
    userId: string; thresholdType: ThresholdType; thresholdValue: number; observedValue: number;
    provider?: string | null; model?: string | null; dayUtc: string; severity: string;
  }): Promise<string | null> {
    if (await this.hasAlert(a.userId, a.thresholdType, a.dayUtc)) return null; // best-effort dedup (not race-proof)
    const row = await this.prisma.aiSpendAlert.create({
      data: {
        userId: a.userId,
        thresholdType: a.thresholdType,
        thresholdValue: a.thresholdValue,
        observedValue: a.observedValue,
        provider: a.provider ?? null,
        model: a.model ?? null,
        dayUtc: a.dayUtc,
        status: 'triggered',
        severity: a.severity,
        // PII-free: codes/counts only — no prompt text, no userId duplication, no secret.
        metadata: { kind: 'ai_spend_alert' } as unknown as object,
        schemaVersion: SPEND_ALERT_SCHEMA_VERSION,
      },
      select: { id: true },
    });
    this.logger.warn(`AI spend alert: ${a.thresholdType} crossed (observed=${a.observedValue} >= ${a.thresholdValue}) for day ${a.dayUtc}`);
    return row.id;
  }
}
