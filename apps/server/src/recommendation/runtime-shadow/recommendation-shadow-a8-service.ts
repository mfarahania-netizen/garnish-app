/**
 * RecommendationShadowA8Service (E18/E43-A8) — the consent-aware shadow orchestrator + offline analysis.
 *
 * Request path (observe): A6 config gate → default-OFF experiment → A8 consent resolver → A8 persisted
 * profile feed → A7 input provider → A6 shadow gate → A7 redacted trace store (consent + mode gated) →
 * A8 metrics → DISCARD. Offline ops: analyze() (read-only trace analysis) + planRetention() (dry-run).
 *
 * NEVER changes live ranking or the user-visible response; NEVER throws; default-off → no DB IO. The
 * shadow result is returned for diagnostics/QA only and is discarded by the caller.
 */

import { Injectable, Optional, Inject } from '@nestjs/common';
import { resolveShadowRuntimeConfig, runRecommendationShadowRuntime } from './recommendation-shadow-runtime-gate';
import { resolveShadowA7Config, assignRecommendationShadowExperiment } from './recommendation-shadow-experiment';
import { buildRecommendationShadowInputs } from './recommendation-shadow-input-provider';
import { redactRecommendationShadowTrace } from './recommendation-shadow-trace-redaction';
import { resolveShadowA8Config, resolveRecommendationShadowConsent } from './recommendation-shadow-consent-plumbing';
import { loadRecommendationShadowProfileFeed } from './recommendation-shadow-profile-feed';
import { analyzeRecommendationShadowTraces } from './recommendation-shadow-online-analysis';
import { planRecommendationShadowTraceRetention } from './recommendation-shadow-retention-readiness';
import { ShadowRuntimeConfig, ShadowRuntimeResult } from './recommendation-shadow-runtime.types';
import { UserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.types';
import { ShadowDataPort, RecommendationShadowTraceStore } from './recommendation-shadow-input-provider.types';
import {
  ShadowA8ObserveContext,
  ShadowProfileFeedPort,
  ShadowConsentPort,
  ShadowTraceReadPort,
  ShadowTraceRetentionPort,
  ShadowAnalysisQuery,
  ShadowAnalysisResult,
  RetentionPlan,
  ShadowA8Metrics,
  ShadowA8Config,
} from './recommendation-shadow-profile-feed.types';
import { SHADOW_DATA_PORT, SHADOW_TRACE_STORE } from './recommendation-shadow-runtime.service';

export const SHADOW_CONSENT_PORT = 'SHADOW_CONSENT_PORT';
export const SHADOW_PROFILE_FEED_PORT = 'SHADOW_PROFILE_FEED_PORT';
export const SHADOW_TRACE_READ_PORT = 'SHADOW_TRACE_READ_PORT';
export const SHADOW_RETENTION_PORT = 'SHADOW_RETENTION_PORT';

const METRICS_CAP = 2000;

@Injectable()
export class RecommendationShadowA8Service {
  private readonly events: Array<{ profileSource?: string; consentSource?: string; consentBlockReason?: string; traceWriteEligible?: boolean; onlineSample?: number; retentionEligible?: number; skip?: 'consent' | 'profile' | 'unsafe_trace'; onlineAnalysisSampleSize?: number; retentionDryRunEligibleCount?: number }> = [];

  constructor(
    @Optional() @Inject(SHADOW_DATA_PORT) private readonly dataPort?: ShadowDataPort,
    @Optional() @Inject(SHADOW_TRACE_STORE) private readonly traceStore?: RecommendationShadowTraceStore,
    @Optional() @Inject(SHADOW_CONSENT_PORT) private readonly consentPort?: ShadowConsentPort,
    @Optional() @Inject(SHADOW_PROFILE_FEED_PORT) private readonly profileFeedPort?: ShadowProfileFeedPort,
    @Optional() @Inject(SHADOW_TRACE_READ_PORT) private readonly traceReadPort?: ShadowTraceReadPort,
    @Optional() @Inject(SHADOW_RETENTION_PORT) private readonly retentionPort?: ShadowTraceRetentionPort,
  ) {}

  getConfig(env: NodeJS.ProcessEnv = process.env): ShadowRuntimeConfig { return resolveShadowRuntimeConfig(env); }
  getA8Config(env: NodeJS.ProcessEnv = process.env): ShadowA8Config { return resolveShadowA8Config(env); }

  private record(e: (typeof this.events)[number]): void {
    this.events.push(e);
    if (this.events.length > METRICS_CAP) this.events.splice(0, this.events.length - METRICS_CAP);
  }

  getA8Metrics(): ShadowA8Metrics {
    const m: ShadowA8Metrics = { profileFeedSourceDistribution: {}, consentSourceDistribution: {}, consentBlockReasons: {}, traceWriteEligible: 0, onlineAnalysisSampleSize: 0, retentionDryRunEligibleCount: 0, skippedMissingConsent: 0, skippedMissingProfile: 0, skippedUnsafeTrace: 0 };
    for (const e of this.events) {
      if (e.profileSource) m.profileFeedSourceDistribution[e.profileSource] = (m.profileFeedSourceDistribution[e.profileSource] || 0) + 1;
      if (e.consentSource) m.consentSourceDistribution[e.consentSource] = (m.consentSourceDistribution[e.consentSource] || 0) + 1;
      if (e.consentBlockReason) m.consentBlockReasons[e.consentBlockReason] = (m.consentBlockReasons[e.consentBlockReason] || 0) + 1;
      if (e.traceWriteEligible) m.traceWriteEligible++;
      if (e.skip === 'consent') m.skippedMissingConsent++;
      if (e.skip === 'profile') m.skippedMissingProfile++;
      if (e.skip === 'unsafe_trace') m.skippedUnsafeTrace++;
    }
    return m;
  }

  /** Consent-aware shadow observation. Returns the (discarded) result; never throws/mutates live data. */
  async observe(ctx: ShadowA8ObserveContext): Promise<ShadowRuntimeResult> {
    const config = ctx.configOverride ?? this.getConfig(ctx.env);
    const liveCandidateIds = Array.isArray(ctx.liveCandidateIds) ? [...ctx.liveCandidateIds] : [];

    if (config.mode !== 'shadow') {
      return runRecommendationShadowRuntime({ config, userId: ctx.userId, liveCandidateIds });
    }

    try {
      const a7 = resolveShadowA7Config(ctx.env);
      const a8 = ctx.a8ConfigOverride ?? this.getA8Config(ctx.env);

      // ── default-OFF experiment gate ──
      if (a7.experimentMode === 'shadow_only') {
        const a = assignRecommendationShadowExperiment(ctx.userId, { mode: a7.experimentMode, experimentKey: a7.experimentKey, sampleRate: config.sampleRate });
        if (!a.assigned) { this.record({ consentBlockReason: 'experiment_not_assigned' }); return disabled(config, ctx.userId, liveCandidateIds); }
      }

      // ── consent (fail-closed; never fabricated) ──
      const consent = await resolveRecommendationShadowConsent(
        { consentPurposes: ctx.requestConsentPurposes, devFixtureConsentPurposes: ctx.devFixtureConsentPurposes },
        ctx.userId,
        // devEnv is fail-closed: NODE_ENV must be EXPLICITLY set and non-production for dev-fixture consent
        // to even be considered (and only then in request_or_dev_fixture mode). Missing/undefined NODE_ENV
        // → false (never honor dev fixtures). In production this is always false.
        { mode: a8.consentMode, port: this.consentPort, devEnv: isDevEnv(ctx.env) },
      );
      if (!consent.canRunShadow) {
        this.record({ skip: 'consent', consentBlockReason: consent.reason.slice(0, 40) });
        return disabled(config, ctx.userId, liveCandidateIds);
      }

      // ── persisted profile feed (consent-gated) ──
      let profileGraph: UserFoodIdentityGraph | null = null;
      let profileSource = 'none';
      if (this.profileFeedPort && a8.profileFeedMode !== 'off' && consent.canReadProfile) {
        const feed = await loadRecommendationShadowProfileFeed(ctx.userId, ctx.context, { mode: a8.profileFeedMode, port: this.profileFeedPort, now: ctx.now });
        profileGraph = feed.graph;
        profileSource = feed.source;
      }

      // ── assemble inputs (A7 provider) + inject the persisted graph when available ──
      const bundle = await buildRecommendationShadowInputs(
        { userId: ctx.userId, surface: ctx.surface, context: ctx.context, consent: { behavioralAnalytics: true } },
        liveCandidateIds.map((recipeId) => ({ recipeId })),
        { dataPort: this.dataPort, now: ctx.now },
      );
      const scoringInputs = bundle.inputs;
      if (scoringInputs && profileGraph) scoringInputs.graph = profileGraph;

      // ── A6 shadow gate ──
      const result = runRecommendationShadowRuntime({
        config, userId: ctx.userId, liveCandidateIds, scoringInputs, consent: { behavioralAnalytics: true }, context: ctx.context, now: ctx.now, topK: ctx.topK,
      });

      // ── redacted trace persistence (consent + mode gated) ──
      let traceWriteEligible = false;
      if (a7.traceWriteMode === 'redacted' && consent.canWriteTrace && this.traceStore && result.enabled && bundle.readiness.canPersistTrace) {
        traceWriteEligible = true;
        try {
          const redacted = redactRecommendationShadowTrace(result, {
            userId: ctx.userId, surface: ctx.surface, experimentKey: a7.experimentKey,
            decisionId: `${ctx.userId}:${ctx.surface || 'home'}`, readinessStatus: bundle.readiness.status,
            generatedAt: (ctx.now ?? new Date()).toISOString(),
          } as any);
          await this.traceStore.writeTrace(redacted, a7.traceWriteMode);
        } catch { this.record({ skip: 'unsafe_trace' }); }
      }

      this.record({ profileSource, consentSource: consent.source, traceWriteEligible });
      return result;
    } catch {
      return disabled({ mode: 'off', sampleRate: 0 }, ctx.userId, liveCandidateIds);
    }
  }

  /** Offline read-only analysis of persisted redacted traces. */
  async analyze(query: ShadowAnalysisQuery, env: NodeJS.ProcessEnv = process.env): Promise<ShadowAnalysisResult> {
    const a8 = this.getA8Config(env);
    const result = await analyzeRecommendationShadowTraces(query, { mode: a8.onlineAnalysisMode, port: this.traceReadPort });
    this.record({ onlineSample: result.traceCount, onlineAnalysisSampleSize: result.traceCount });
    return result;
  }

  /** Offline retention DRY-RUN readiness (never deletes). */
  async planRetention(opts: { retentionDays?: number; now?: Date; sampleLimit?: number } = {}, env: NodeJS.ProcessEnv = process.env): Promise<RetentionPlan> {
    const a8 = this.getA8Config(env);
    const plan = await planRecommendationShadowTraceRetention({ mode: a8.retentionMode, port: this.retentionPort, ...opts });
    this.record({ retentionEligible: plan.eligibleForDeletionCount, retentionDryRunEligibleCount: plan.eligibleForDeletionCount });
    return plan;
  }
}

/** Fail-closed dev-env check: NODE_ENV must be explicitly set AND non-production. Undefined → false. */
function isDevEnv(env?: NodeJS.ProcessEnv): boolean {
  const e = env ?? process.env;
  const nodeEnv = e?.NODE_ENV;
  return typeof nodeEnv === 'string' && nodeEnv.length > 0 && nodeEnv !== 'production';
}

function disabled(config: ShadowRuntimeConfig, userId: string, liveCandidateIds: string[]): ShadowRuntimeResult {
  // route through the gate so the shape/invariants are identical (never enabled, never affects ranking).
  return runRecommendationShadowRuntime({ config: { mode: 'shadow', sampleRate: 0 }, userId, liveCandidateIds });
}
