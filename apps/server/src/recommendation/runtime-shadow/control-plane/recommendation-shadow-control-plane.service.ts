/**
 * RecommendationShadowControlPlaneService (E18/E43-A10).
 *
 * INTERNAL/DEV read-only control plane: composes A8 online analysis (redacted traces) + A8 retention
 * dry-run + the A9 dev-traffic simulation (quality thresholds, failure buckets, performance) + a safe
 * A9-artifact reader into a single redacted summary, and computes a promotion gate (allowed ALWAYS false).
 *
 * NEVER changes live ranking/response, NEVER exposes a public endpoint, NEVER returns raw trace/user/
 * recipe data. Never throws.
 */

import { Injectable, Optional } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { RecommendationShadowA8Service } from '../recommendation-shadow-a8-service';
import { generateShadowDevTraffic } from '../recommendation-shadow-dev-traffic-simulator';
import { evaluateShadowRecommendationQuality } from '../recommendation-shadow-quality-thresholds';
import { classifyShadowFailureBuckets } from '../recommendation-shadow-failure-buckets';
import { summarizeShadowSimulationPerformance } from '../recommendation-shadow-performance-guard';
import { evaluateRecommendationShadowPromotionGate } from './recommendation-shadow-control-plane-readiness';
import { resolveControlPlaneConfig } from './recommendation-shadow-control-plane-config';
import {
  ControlPlaneQuery,
  ControlPlaneContext,
  ControlPlaneSummary,
  ControlPlaneSimulationArtifactSummary,
} from './recommendation-shadow-control-plane.types';

const A9_ARTIFACT_REL = '../../../../../../docs/qa/recommendation/e18_e43_a9_dev_traffic_shadow_experiment_results.json';

@Injectable()
export class RecommendationShadowControlPlaneService {
  constructor(@Optional() private readonly a8?: RecommendationShadowA8Service) {}

  /**
   * Build the read-only control-plane summary. Pure-ish (the only IO is the optional A8 read-only ports
   * + an optional A9-artifact file read). Never throws; never returns raw data.
   */
  async getRecommendationShadowControlPlaneSummary(
    query: ControlPlaneQuery = {},
    context?: ControlPlaneContext,
    nowIso = '1970-01-01T00:00:00.000Z',
  ): Promise<ControlPlaneSummary> {
    const config = context?.config ?? resolveControlPlaneConfig();
    const mode = config.mode;
    const requiresAdmin = config.requireAdmin !== false;
    const limitations: string[] = [];

    // ── A9 dev simulation → quality / failure buckets / performance (deterministic) ──
    let qualitySummary, failureBuckets, perf, simSummary;
    try {
      const sim = await generateShadowDevTraffic({ observedRecipeTotal: 350 });
      simSummary = sim.summary;
      const q = evaluateShadowRecommendationQuality(sim);
      qualitySummary = { status: q.status, passedThresholds: q.passedThresholds, failedThresholds: q.failedThresholds, warnings: q.warnings };
      failureBuckets = classifyShadowFailureBuckets(sim.runs).map((b) => ({ code: b.bucket, count: b.count, severity: b.severity, nextAction: b.nextAction }));
      perf = summarizeShadowSimulationPerformance(sim.runs);
    } catch {
      limitations.push('simulation evaluation unavailable (handled).');
      qualitySummary = { status: 'not_ready' as const, passedThresholds: [], failedThresholds: ['simulation_unavailable'], warnings: [] };
      failureBuckets = [];
      perf = { runCount: 0, averageSimulatedRuntimeMs: 0, p95SimulatedRuntimeMs: 0, maxSimulatedRuntimeMs: 0, estimatedDbReads: 0, estimatedDbWrites: 0, networkCalls: 0, defaultOffDbIoCount: 0, traceWritesAttempted: 0, traceWritesAllowed: 0, traceWritesBlocked: 0 } as any;
      simSummary = undefined;
    }

    // ── A8 online analysis over redacted traces (read-only, bounded) ──
    const from = query.from ?? new Date(0);
    const to = query.to ?? new Date(8640000000000000);
    let traceSummary = { traceCount: 0, averageTopKOverlap: null as number | null, majorDivergenceRate: null as number | null, mostCommonReasonCodes: [] as Array<{ code: string; count: number }>, weakInputRate: null as number | null, sampleSizeWarning: true };
    if (this.a8) {
      try {
        const a = await this.a8.analyze({ from, to, experimentKey: query.experimentKey, limit: Math.min(query.limit ?? config.maxTraceRead, config.maxTraceRead) }, { RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE: 'read_only' } as any);
        traceSummary = {
          traceCount: a.traceCount,
          averageTopKOverlap: a.traceCount ? a.averageTopKOverlap : null,
          majorDivergenceRate: a.traceCount ? a.majorDivergenceRate : null,
          mostCommonReasonCodes: a.mostCommonReasonCodes,
          weakInputRate: a.traceCount ? a.weakInputRate : null,
          sampleSizeWarning: a.sampleSizeWarning,
        };
      } catch { limitations.push('trace analysis unavailable (handled).'); }
    } else {
      limitations.push('no A8 service wired — trace analysis empty (service-only/offline).');
    }

    // ── A8 retention dry-run ──
    let retentionSummary = { mode: 'off' as 'off' | 'dry_run', eligibleForDeletionCount: 0, destructiveOperationUsed: false as const, requiresFounderApproval: true as const };
    if (this.a8) {
      try {
        const r = await this.a8.planRetention({ retentionDays: 90 }, { RECOMMENDATION_SHADOW_RETENTION_MODE: 'dry_run' } as any);
        retentionSummary = { mode: r.mode, eligibleForDeletionCount: r.eligibleForDeletionCount, destructiveOperationUsed: false, requiresFounderApproval: true };
      } catch { limitations.push('retention plan unavailable (handled).'); }
    }

    // ── A9 simulation artifact reader (optional, re-checked, never trusted blindly) ──
    const simulationArtifactSummary = query.includeSimulationArtifact === false ? skippedArtifact() : this.readSimulationArtifact();

    const performanceSummary = {
      avgMs: perf.runCount ? perf.averageSimulatedRuntimeMs : null,
      p95Ms: perf.runCount ? perf.p95SimulatedRuntimeMs : null,
      networkCalls: 0 as const,
      defaultOffDbIoCount: 0 as const,
      estimatedDbReads: perf.estimatedDbReads,
      estimatedDbWrites: perf.estimatedDbWrites,
    };

    // ── promotion gate ──
    const promotionGate = evaluateRecommendationShadowPromotionGate({
      traceSummary, qualitySummary, performanceSummary, retentionSummary, simulationArtifactSummary,
      unsafeExplanationCount: simSummary?.unsafeExplanationRate ? 1 : 0,
      rawLeakCount: simSummary?.rawLeakCount ?? 0,
      consentBypassCount: simSummary?.consentBypassCount ?? 0,
      responseMutationCount: simSummary?.responseMutationCount ?? 0,
      liveRankingMutationCount: simSummary?.liveRankingMutationCount ?? 0,
      traceRedactionPassRate: simSummary?.traceRedactionPassRate ?? 1,
    });

    limitations.push('Internal/dev read-only control plane — no public endpoint, no user-facing output, no live ranking change.');

    return {
      mode,
      generatedAt: nowIso,
      experimentKey: query.experimentKey ?? null,
      traceSummary,
      qualitySummary,
      failureBucketSummary: failureBuckets,
      performanceSummary,
      retentionSummary,
      simulationArtifactSummary,
      promotionGate,
      safety: { publicEndpointExposed: false, requiresAdmin, userVisible: false, productUseEnabled: false, liveRankingChangedForUser: false },
      limitations,
      version: 1,
    };
  }

  /** Read + re-check the A9 artifact. Missing → warning, not crash. Never trusts the file blindly. */
  private readSimulationArtifact(): ControlPlaneSimulationArtifactSummary {
    try {
      const p = path.resolve(__dirname, A9_ARTIFACT_REL);
      if (!fs.existsSync(p)) return missingArtifact();
      const a = JSON.parse(fs.readFileSync(p, 'utf8'));
      const promotionAllowed = a.promotionAllowed ?? null;
      const productUseEnabled = a.productUseEnabled ?? null;
      const liveRankingChangedForUser = a.liveRankingChangedForUser ?? null;
      const networkCallsDuringGate = a.networkCallsDuringGate ?? null;
      const redactedFailureDetailsEmpty = Array.isArray(a.redactedFailureDetails) ? a.redactedFailureDetails.length === 0 : null;
      const warnings: string[] = [];
      const schemaOk = a.schemaVersion === 1;
      if (!schemaOk) warnings.push('A9 artifact schemaVersion unexpected — treated as untrusted.');
      // any missing (null) safety field for a present artifact fails the re-check.
      const reChecksPassed =
        schemaOk && promotionAllowed === false && productUseEnabled === false && liveRankingChangedForUser === false &&
        networkCallsDuringGate === 0 && redactedFailureDetailsEmpty === true;
      if (!reChecksPassed) warnings.push('A9 artifact re-check failed (schema/safety field not as expected) — not trusted.');
      return {
        present: true,
        totalChecks: typeof a.totalChecks === 'number' ? a.totalChecks : null,
        failedChecks: typeof a.failedChecks === 'number' ? a.failedChecks : null,
        promotionAllowed, productUseEnabled, liveRankingChangedForUser, networkCallsDuringGate, redactedFailureDetailsEmpty,
        reChecksPassed, warnings,
      };
    } catch {
      return { ...missingArtifact(), warnings: ['A9 artifact unreadable (handled).'] };
    }
  }
}

function missingArtifact(): ControlPlaneSimulationArtifactSummary {
  return { present: false, totalChecks: null, failedChecks: null, promotionAllowed: null, productUseEnabled: null, liveRankingChangedForUser: null, networkCallsDuringGate: null, redactedFailureDetailsEmpty: null, reChecksPassed: false, warnings: ['A9 artifact not present.'] };
}
function skippedArtifact(): ControlPlaneSimulationArtifactSummary {
  return { present: false, totalChecks: null, failedChecks: null, promotionAllowed: null, productUseEnabled: null, liveRankingChangedForUser: null, networkCallsDuringGate: null, redactedFailureDetailsEmpty: null, reChecksPassed: false, warnings: ['artifact read skipped by query.'] };
}
