/**
 * RecommendationShadowRuntimeService (E18/E43-A6, extended in A7) — the single, default-OFF, try/catch-
 * isolated hook the live pipeline calls AFTER live ranking. It NEVER mutates the live response/ranking,
 * NEVER throws, performs no DB write/read in default-off mode. The shadow result is returned for
 * diagnostics/QA only and is DISCARDED by the caller (never placed in the user response).
 *
 * A6 path (preserved): an optional ShadowScoringInputProvider supplies inputs.
 * A7 path (added): when a ShadowDataPort is wired, inputs are assembled by the A7 input provider; a
 * default-OFF experiment gates participation; on success a REDACTED trace may be persisted (env-gated)
 * via an optional trace store; per-request metrics are accumulated for offline analysis. All A7 work is
 * isolated — any failure (input build, trace write) is swallowed and never affects the live request.
 */

import { Injectable, Optional, Inject } from '@nestjs/common';
import { DecisionContext } from '../intelligence/recommendation-decision.types';
import {
  ShadowConsent,
  ShadowRuntimeConfig,
  ShadowRuntimeResult,
  ShadowScoringInputs,
} from './recommendation-shadow-runtime.types';
import { resolveShadowRuntimeConfig, runRecommendationShadowRuntime } from './recommendation-shadow-runtime-gate';
import {
  ShadowDataPort,
  RecommendationShadowTraceStore,
  ShadowA7Config,
  ShadowMetricsInput,
  ShadowMetricsSummary,
} from './recommendation-shadow-input-provider.types';
import { buildRecommendationShadowInputs } from './recommendation-shadow-input-provider';
import { resolveShadowA7Config, assignRecommendationShadowExperiment } from './recommendation-shadow-experiment';
import { redactRecommendationShadowTrace } from './recommendation-shadow-trace-redaction';
import { summarizeRecommendationShadowMetrics } from './recommendation-shadow-metrics';

export const SHADOW_DATA_PORT = 'SHADOW_DATA_PORT';
export const SHADOW_TRACE_STORE = 'SHADOW_TRACE_STORE';

/** A6 provider (preserved). */
export interface ShadowScoringInputProvider {
  getScoringInputs(userId: string): Promise<{ inputs: ShadowScoringInputs | null; consent?: ShadowConsent; context?: DecisionContext } | null>;
}

export interface ShadowObserveContext {
  userId: string;
  liveCandidateIds: string[];
  topK?: number;
  requestId?: string;
  surface?: string;
  consent?: ShadowConsent;
  configOverride?: ShadowRuntimeConfig;
  a7ConfigOverride?: ShadowA7Config;
  experimentSampleRate?: number;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}

const METRICS_CAP = 1000;

@Injectable()
export class RecommendationShadowRuntimeService {
  private readonly metrics: ShadowMetricsInput[] = [];

  constructor(
    @Optional() private readonly provider?: ShadowScoringInputProvider,
    @Optional() @Inject(SHADOW_DATA_PORT) private readonly dataPort?: ShadowDataPort,
    @Optional() @Inject(SHADOW_TRACE_STORE) private readonly traceStore?: RecommendationShadowTraceStore,
  ) {}

  getConfig(env: NodeJS.ProcessEnv = process.env): ShadowRuntimeConfig {
    return resolveShadowRuntimeConfig(env);
  }

  getMetricsSummary(): ShadowMetricsSummary {
    return summarizeRecommendationShadowMetrics(this.metrics);
  }

  private record(m: ShadowMetricsInput): void {
    this.metrics.push(m);
    if (this.metrics.length > METRICS_CAP) this.metrics.splice(0, this.metrics.length - METRICS_CAP);
  }

  /**
   * Observe one request beside the live pipeline. Returns a redacted ShadowRuntimeResult (discarded by
   * the caller). NEVER throws, NEVER mutates the live response/ranking.
   */
  async observe(ctx: ShadowObserveContext): Promise<ShadowRuntimeResult> {
    const config = ctx.configOverride ?? this.getConfig(ctx.env);
    const a7 = ctx.a7ConfigOverride ?? resolveShadowA7Config(ctx.env);
    const liveCandidateIds = Array.isArray(ctx.liveCandidateIds) ? [...ctx.liveCandidateIds] : [];

    // off: zero-overhead — never touch provider/dataPort/store, never score.
    if (config.mode !== 'shadow') {
      return runRecommendationShadowRuntime({ config, userId: ctx.userId, liveCandidateIds });
    }

    try {
      // ── default-OFF experiment gate (only when experiment mode is on) ──
      if (a7.experimentMode === 'shadow_only') {
        const assignment = assignRecommendationShadowExperiment(ctx.userId, {
          mode: a7.experimentMode,
          experimentKey: a7.experimentKey,
          sampleRate: ctx.experimentSampleRate ?? config.sampleRate,
        });
        if (!assignment.assigned) {
          this.record({ attempted: false, allowed: false, blockedReason: 'experiment_not_assigned', traceWritten: false, traceWriteFailed: false });
          return runRecommendationShadowRuntime({ config: { mode: 'shadow', sampleRate: 0 }, userId: ctx.userId, liveCandidateIds });
        }
      }

      // ── assemble inputs: A7 data-port path, else A6 provider path, else none ──
      let scoringInputs: ShadowScoringInputs | null = null;
      let consent: ShadowConsent | undefined = ctx.consent;
      let context: DecisionContext | undefined;
      let readinessStatus = 'unknown';
      let canPersistTrace = true; // safe default for the A6/no-port path; overwritten when a data port is used
      let missingInputs: string[] | undefined;

      if (this.dataPort) {
        const bundle = await buildRecommendationShadowInputs(
          { userId: ctx.userId, requestId: ctx.requestId, surface: ctx.surface, consent: ctx.consent },
          liveCandidateIds.map((recipeId) => ({ recipeId })),
          { dataPort: this.dataPort, now: ctx.now },
        );
        scoringInputs = bundle.inputs;
        consent = bundle.consent ?? consent;
        context = bundle.context;
        readinessStatus = bundle.readiness.status;
        canPersistTrace = bundle.readiness.canPersistTrace;
        missingInputs = bundle.readiness.missingInputs;
      } else if (this.provider) {
        try {
          const fetched = await this.provider.getScoringInputs(ctx.userId);
          if (fetched) { scoringInputs = fetched.inputs ?? null; consent = fetched.consent ?? consent; context = fetched.context; }
        } catch { scoringInputs = null; }
      }

      // ── run the A6 gate (pure; never throws) ──
      const result = runRecommendationShadowRuntime({
        config, userId: ctx.userId, liveCandidateIds, scoringInputs, consent, context, now: ctx.now, topK: ctx.topK,
      });
      // for the A6 provider / no-port path, surface the gate's own readiness in the trace.
      if (readinessStatus === 'unknown') readinessStatus = result.readiness.status;

      // ── optional redacted trace persistence (env-gated, isolated) ──
      let traceWritten = false, traceWriteFailed = false;
      if (a7.traceWriteMode === 'redacted' && this.traceStore && result.enabled && canPersistTrace) {
        try {
          const redacted = redactRecommendationShadowTrace(result, {
            userId: ctx.userId, requestId: ctx.requestId, experimentKey: a7.experimentKey,
            decisionId: `${ctx.userId}:${ctx.surface || 'home'}`, readinessStatus,
            generatedAt: (ctx.now ?? new Date()).toISOString(),
          });
          const w = await this.traceStore.writeTrace(redacted, a7.traceWriteMode);
          traceWritten = w.written; traceWriteFailed = !w.written && !!w.errorKind;
        } catch { traceWriteFailed = true; }
      }

      this.record({
        attempted: true,
        allowed: result.enabled,
        blockedReason: result.enabled ? undefined : (result.safety.blockedReasonCodes[0] || result.readiness.status),
        traceWritten, traceWriteFailed,
        topKOverlap: result.divergence.topKOverlap,
        majorDivergence: result.divergence.majorDivergence,
        weakInput: readinessStatus === 'partial' || readinessStatus === 'not_ready',
        unsafeExplanationCount: result.diagnostics.unsafeExplanationCount,
        decisionConfidence: null,
        missingInputs,
      });

      return result;
    } catch {
      // backstop — never let anything escape into the live request.
      return runRecommendationShadowRuntime({ config: { mode: 'off', sampleRate: 0 }, userId: ctx.userId, liveCandidateIds });
    }
  }
}
