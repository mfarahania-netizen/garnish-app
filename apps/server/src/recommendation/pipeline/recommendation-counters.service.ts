import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ServedSlateItem {
  recipeId: string;
  score: number;
}

/**
 * "Counters first-class" — logs the served slate (position + score + propensity + context) at serve time.
 * This is the data off-policy / counterfactual learning (IPS) needs from day one: without position +
 * propensity captured AT serve time, the exposure→reward signal can never be debiased and is unrecoverable
 * after the fact. Reward is derived downstream by joining to attribution/UserEvent. The write is
 * fire-and-forget and this service NEVER throws — telemetry must not affect the user response.
 */
@Injectable()
export class RecommendationCountersService {
  private readonly logger = new Logger(RecommendationCountersService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Numerically-stable softmax over slate scores → a per-item selection probability (sums to 1). */
  static propensities(scores: number[]): number[] {
    if (!scores.length) return [];
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp((s ?? 0) - max));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    return exps.map((e) => e / sum);
  }

  /**
   * Log the served slate. NEVER throws (a telemetry fault must not break serving). Returns the row count
   * written (0 on empty/skip/fault).
   */
  async logSlate(
    userId: string,
    items: ServedSlateItem[],
    opts: { surface?: string; sessionId?: string; context?: any; requestId?: string } = {},
  ): Promise<number> {
    try {
      if (!userId || !items?.length) return 0;
      const props = RecommendationCountersService.propensities(items.map((i) => i.score ?? 0));
      const contextJson = opts.context ? JSON.stringify(opts.context) : null;
      const data = items.map((it, i) => ({
        userId,
        recipeId: it.recipeId,
        position: i, // 0-based rank in the served slate
        score: it.score ?? 0,
        propensity: props[i] ?? 0,
        requestId: opts.requestId ?? null, // joins exposure↔reward when the client echoes it on the action event
        surface: opts.surface ?? null,
        sessionId: opts.sessionId ?? null,
        contextJson,
      }));
      // P1-8 (recsys audit): a bounded retry so a transient DB hiccup doesn't silently lose served-slate
      // exposure rows that the IPS/off-policy layer can NEVER recover after serve time. Still fire-and-forget
      // from the caller (never awaited on the serve path) → adds no user-facing latency. A persistent failure
      // escalates debug→warn so the §12 health surface can notice it instead of silently dropping exposure.
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await this.prisma.recommendationServedItem.createMany({ data });
          return res?.count ?? data.length;
        } catch (err) {
          if (attempt >= 2) {
            this.logger.warn(`served-slate log FAILED after 3 attempts (${data.length} rows lost): ${(err as Error)?.message}`);
            return 0;
          }
          await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
        }
      }
    } catch (err) {
      this.logger.debug(`served-slate log skipped: ${(err as Error)?.message}`);
      return 0;
    }
  }
}
