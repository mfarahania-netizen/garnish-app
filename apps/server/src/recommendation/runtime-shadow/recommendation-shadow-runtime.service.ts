/**
 * RecommendationShadowRuntimeService (E18/E43-A6) — thin NestJS adapter around the pure shadow runtime
 * gate. It is the single, default-OFF, try/catch-isolated hook the live pipeline calls AFTER live
 * ranking. It NEVER mutates the live response/ranking, NEVER throws, performs no DB write and no network
 * call. The shadow result is returned for diagnostics/QA only and is DISCARDED by the live caller (never
 * placed in the user response).
 *
 * Scoring inputs (graph + candidate metadata + history) come from an OPTIONAL provider. In A6 no provider
 * is wired (default live path → no DB reads, shadow reports `shadow_collected` with the live fingerprint
 * only). A7 will wire a read-only, consent-gated provider.
 */

import { Injectable, Optional } from '@nestjs/common';
import { DecisionContext } from '../intelligence/recommendation-decision.types';
import {
  ShadowConsent,
  ShadowRuntimeConfig,
  ShadowRuntimeResult,
  ShadowScoringInputs,
} from './recommendation-shadow-runtime.types';
import { resolveShadowRuntimeConfig, runRecommendationShadowRuntime } from './recommendation-shadow-runtime-gate';

/** Optional provider that supplies read-only scoring inputs + consent for a user (A7 wires a real one). */
export interface ShadowScoringInputProvider {
  getScoringInputs(userId: string): Promise<{ inputs: ShadowScoringInputs | null; consent?: ShadowConsent; context?: DecisionContext } | null>;
}

export interface ShadowObserveContext {
  userId: string;
  /** live ranking as recipeIds, already produced by the pipeline (a fresh copy — never the live array). */
  liveCandidateIds: string[];
  topK?: number;
  /** test/observability overrides (never used by the live path). */
  configOverride?: ShadowRuntimeConfig;
  now?: Date;
  env?: NodeJS.ProcessEnv;
}

@Injectable()
export class RecommendationShadowRuntimeService {
  constructor(@Optional() private readonly provider?: ShadowScoringInputProvider) {}

  /** Current resolved config (env-driven). */
  getConfig(env: NodeJS.ProcessEnv = process.env): ShadowRuntimeConfig {
    return resolveShadowRuntimeConfig(env);
  }

  /**
   * Observe one request beside the live pipeline. Returns a redacted ShadowRuntimeResult (the caller
   * discards it). NEVER throws, NEVER mutates the live response/ranking, no DB write, no network.
   */
  async observe(ctx: ShadowObserveContext): Promise<ShadowRuntimeResult> {
    const config = ctx.configOverride ?? this.getConfig(ctx.env);
    // defensive copy of the live ids so nothing downstream can mutate the caller's array
    const liveCandidateIds = Array.isArray(ctx.liveCandidateIds) ? [...ctx.liveCandidateIds] : [];

    // off: zero-overhead — never touch the provider, never score.
    if (config.mode !== 'shadow') {
      return runRecommendationShadowRuntime({ config, userId: ctx.userId, liveCandidateIds });
    }

    // shadow: optionally fetch read-only scoring inputs (A6 default: no provider → null → no DB reads).
    let scoringInputs: ShadowScoringInputs | null = null;
    let consent: ShadowConsent | undefined;
    let context: DecisionContext | undefined;
    if (this.provider) {
      try {
        const fetched = await this.provider.getScoringInputs(ctx.userId);
        if (fetched) {
          scoringInputs = fetched.inputs ?? null;
          consent = fetched.consent;
          context = fetched.context;
        }
      } catch {
        // a provider fault must never break the live request — fall back to no inputs.
        scoringInputs = null;
      }
    }

    try {
      return runRecommendationShadowRuntime({
        config,
        userId: ctx.userId,
        liveCandidateIds,
        scoringInputs,
        consent,
        context,
        now: ctx.now,
        topK: ctx.topK,
      });
    } catch {
      // backstop: gate is already try/catch-internal, but never let anything escape into the request.
      return runRecommendationShadowRuntime({ config: { mode: 'off', sampleRate: 0 }, userId: ctx.userId, liveCandidateIds });
    }
  }
}
