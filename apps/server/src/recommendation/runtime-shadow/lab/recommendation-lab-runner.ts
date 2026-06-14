/**
 * A11 controlled dev experiment runner (E18/E43-A11).
 *
 * Composes: config validation → kill switch → access gate → (shadow_dev) A9 dev-traffic batch → A8 online
 * analysis + retention dry-run → quality scorecard → promotion gate → report. Offline, deterministic,
 * never throws. NEVER mutates live ranking or the user response; never exposes traces; never runs
 * destructive retention. `productUseEnabled` / `liveRankingChangedForUser` / promotion `allowed` false.
 */

import { generateShadowDevTraffic } from '../recommendation-shadow-dev-traffic-simulator';
import { computeRecommendationLabScorecard } from './recommendation-lab-scorecard';
import { evaluateRecommendationLabPromotionGate } from './recommendation-lab-promotion-gate';
import { generateRecommendationLabReport } from './recommendation-lab-report-generator';
import { evaluateRecommendationLabKillSwitch } from './recommendation-lab-kill-switch';
import { evaluateRecommendationLabAccess, validateExperimentConfig } from './recommendation-lab-config';
import {
  ExperimentConfig, LabContext, RunExperimentOptions, RecommendationLabExperiment,
  RecommendationExperimentSafetySummary, ExperimentMetrics, ExperimentStatus,
} from './recommendation-lab.types';

interface MinimalA8 {
  analyze(query: any, env?: any): Promise<any>;
  planRetention(opts: any, env?: any): Promise<any>;
}

const FIXED_GENERATED_AT = '2026-06-14T00:00:00.000Z';

export async function runRecommendationLabExperiment(
  config: ExperimentConfig,
  context: LabContext,
  options: RunExperimentOptions = {},
): Promise<RecommendationLabExperiment> {
  const generatedAt = options.now ?? FIXED_GENERATED_AT;
  const observedRecipeTotal = options.observedRecipeTotal === undefined ? 350 : options.observedRecipeTotal;
  const a8 = options.a8Service as MinimalA8 | undefined;
  const experimentKey = config?.experimentKey ?? 'unknown';
  const requestedMode = config?.mode === 'dry_run' ? 'dry_run' : config?.mode === 'shadow_dev' ? 'shadow_dev' : 'off';

  // ── gates: validation → kill switch → access ──
  const configValidation = validateExperimentConfig(config, context.config, context.environment);
  const kill = evaluateRecommendationLabKillSwitch(context);
  const access = evaluateRecommendationLabAccess(context);
  const blocked = !configValidation.ok || kill.blocked || !access.allowed;

  const trafficPlan = {
    usersPlanned: config?.userSampleSize ?? 0,
    contextsPlanned: Array.isArray(config?.contexts) ? config.contexts.length : 0,
    requestsPlanned: config?.requestCount ?? 0,
    shadowRunsPlanned: Math.round((config?.requestCount ?? 0) * 0.6),
  };

  let executionSummary = { requestsExecuted: 0, shadowRunsAllowed: 0, shadowRunsBlocked: 0, tracesWritten: 0, tracesAnalyzed: 0, failuresEscaped: 0 };
  let safety: RecommendationExperimentSafetySummary = {
    consentBypassCount: 0, rawLeakCount: 0, unsafeExplanationCount: 0, responseMutationCount: 0, liveRankingMutationCount: 0,
    traceRedactionPassRate: 1, defaultOffDbIoCount: 0, killSwitchEngaged: kill.killSwitchEngaged,
    publicEndpointExposed: false, productUseEnabled: false, liveRankingChangedForUser: false,
  };
  let metrics: ExperimentMetrics = {
    majorDivergenceRate: 0, averageInputReadinessConfidence: 0, coverageRatio: observedRecipeTotal ? observedRecipeTotal / 350 : null,
    tracesAnalyzed: 0, averageTopKOverlap: null, avgSimulatedRuntimeMs: null, p95SimulatedRuntimeMs: null, maxRequestsBound: context.config.maxRequests,
  };
  let status: ExperimentStatus = 'blocked';

  try {
    if (!blocked) {
      if (requestedMode === 'shadow_dev') {
        status = 'running';
        const sim = await generateShadowDevTraffic({ observedRecipeTotal });
        const ss = sim.summary;
        executionSummary = {
          requestsExecuted: ss.simulatedRequests,
          shadowRunsAllowed: ss.allowedShadowRuns,
          shadowRunsBlocked: ss.blockedConsentOrSafetyRuns,
          tracesWritten: config.allowTraceWrite ? ss.tracesWritten : 0,
          tracesAnalyzed: 0,
          failuresEscaped: ss.shadowFailureEscapeCount,
        };
        safety = {
          consentBypassCount: ss.consentBypassCount, rawLeakCount: ss.rawLeakCount, unsafeExplanationCount: ss.unsafeExplanationRate > 0 ? 1 : 0,
          responseMutationCount: ss.responseMutationCount, liveRankingMutationCount: ss.liveRankingMutationCount,
          traceRedactionPassRate: ss.traceRedactionPassRate, defaultOffDbIoCount: ss.defaultOffDbIoCount,
          killSwitchEngaged: kill.killSwitchEngaged, publicEndpointExposed: false, productUseEnabled: false, liveRankingChangedForUser: false,
        };
        // online trace analysis (A8, read-only) + retention dry-run (A8)
        let analyzed = 0, avgOverlap: number | null = null;
        if (config.includeOnlineTraceAnalysis && a8) {
          try {
            const a = await a8.analyze({ from: new Date(0), to: new Date(8640000000000000), limit: context.config.maxTraceRead }, { RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE: 'read_only' });
            analyzed = a?.traceCount ?? 0; avgOverlap = a?.traceCount ? a.averageTopKOverlap : null;
          } catch { /* analysis best-effort */ }
        }
        if (config.includeRetentionDryRun && a8) {
          try { await a8.planRetention({ retentionDays: 90 }, { RECOMMENDATION_SHADOW_RETENTION_MODE: 'dry_run' }); } catch { /* dry-run best-effort */ }
        }
        executionSummary.tracesAnalyzed = analyzed;
        metrics = {
          majorDivergenceRate: ss.majorDivergenceRate, averageInputReadinessConfidence: ss.averageInputReadinessConfidence,
          coverageRatio: sim.recipeUniverse.coverageRatio, tracesAnalyzed: analyzed, averageTopKOverlap: avgOverlap,
          avgSimulatedRuntimeMs: null, p95SimulatedRuntimeMs: null, maxRequestsBound: context.config.maxRequests,
        };
        // simulated runtime stats from the sim runs
        const times = sim.runs.map((r) => r.simulatedRuntimeMs).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
        if (times.length) { metrics.avgSimulatedRuntimeMs = Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100; metrics.p95SimulatedRuntimeMs = times[Math.floor(0.95 * (times.length - 1))]; }
        status = 'completed';
      } else {
        // dry_run: plan only, no execution
        status = 'completed';
      }
    }
  } catch {
    status = 'blocked';
    executionSummary = { ...executionSummary, failuresEscaped: executionSummary.failuresEscaped + 1 };
  }

  const experiment: RecommendationLabExperiment = {
    experimentId: `${experimentKey}:${requestedMode}`,
    experimentKey,
    mode: requestedMode,
    status,
    generatedAt,
    recipeUniverse: { expectedTotal: 350, observedTotal: observedRecipeTotal, coverageRatio: metrics.coverageRatio },
    trafficPlan,
    executionSummary,
    metrics,
    safety,
    configValidation,
    // placeholders filled below
    qualityScorecard: undefined as any,
    promotionGate: undefined as any,
    report: undefined as any,
    productUseEnabled: false,
    liveRankingChangedForUser: false,
    version: 1,
  };

  experiment.qualityScorecard = computeRecommendationLabScorecard(experiment);
  // a blocked experiment can never be promotion-ready (new object — do not mutate the scorecard in place)
  if (blocked && experiment.qualityScorecard.failedCriticalChecks.length === 0) {
    const note = kill.blocked ? 'execution blocked by kill switch/gate' : 'execution blocked by config/access';
    experiment.qualityScorecard = { ...experiment.qualityScorecard, warnings: [...experiment.qualityScorecard.warnings, note] };
  }
  experiment.promotionGate = evaluateRecommendationLabPromotionGate(experiment.qualityScorecard, experiment);
  experiment.report = generateRecommendationLabReport(experiment, experiment.qualityScorecard, experiment.promotionGate);
  return experiment;
}
