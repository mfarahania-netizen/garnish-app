/**
 * Recommendation shadow trace store (E18/E43-A7).
 *
 * Persists ONLY the redacted trace, and ONLY when RECOMMENDATION_SHADOW_TRACE_WRITE_MODE=redacted.
 * Default adapter is a no-op. Write failures are swallowed into a structured result (errorKind only — no
 * raw message) so the live request is never affected. A pre-write cleanliness guard refuses to persist a
 * trace that carries any unsafe value.
 */

import {
  RecommendationShadowTraceStore,
  RedactedRecommendationShadowTrace,
  TraceWriteMode,
  TraceWriteResult,
} from './recommendation-shadow-input-provider.types';
import { isRedactedTraceClean } from './recommendation-shadow-trace-redaction';

/** Default: never writes. Used whenever trace persistence is off or no DB-backed store is wired. */
export class NoopRecommendationShadowTraceStore implements RecommendationShadowTraceStore {
  async writeTrace(_trace: RedactedRecommendationShadowTrace, mode: TraceWriteMode): Promise<TraceWriteResult> {
    return { written: false, mode, reason: 'noop store (no persistence)' };
  }
}

/** Minimal client surface the Prisma adapter needs (keeps the adapter unit-testable). */
export interface ShadowTracePrismaClient {
  recommendationShadowTrace: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
}

/**
 * DB-backed adapter (additive `RecommendationShadowTrace` table). Writes ONLY in `redacted` mode and
 * ONLY a clean redacted trace. Any DB error is caught and reported as a swallowed failure.
 */
export class PrismaRecommendationShadowTraceStore implements RecommendationShadowTraceStore {
  constructor(private readonly prisma: ShadowTracePrismaClient) {}

  async writeTrace(trace: RedactedRecommendationShadowTrace, mode: TraceWriteMode): Promise<TraceWriteResult> {
    if (mode !== 'redacted') return { written: false, mode, reason: 'trace write mode is off' };
    if (!isRedactedTraceClean(trace)) return { written: false, mode, reason: 'refused: trace failed cleanliness guard', errorKind: 'unsafe_trace' };
    try {
      await this.prisma.recommendationShadowTrace.create({
        data: {
          userId: trace.userId ?? null,
          requestId: trace.requestId ?? null,
          experimentKey: trace.experimentKey ?? null,
          liveFingerprint: trace.liveFingerprint,
          shadowFingerprint: trace.shadowFingerprint,
          topKOverlap: trace.topKOverlap,
          rankShiftCount: trace.rankShiftCount,
          majorDivergence: trace.majorDivergence,
          reasonCodes: trace.reasonCodes,
          summary: trace.summary,
        },
      });
      return { written: true, mode, reason: 'redacted trace persisted' };
    } catch (e) {
      // never surface a raw error message (could carry sensitive context); report the class only.
      return { written: false, mode, reason: 'trace write failed (swallowed)', errorKind: (e as { code?: string })?.code || (e as { name?: string })?.name || 'error' };
    }
  }
}
