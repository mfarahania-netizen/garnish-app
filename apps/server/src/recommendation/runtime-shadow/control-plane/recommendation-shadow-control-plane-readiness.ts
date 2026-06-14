/**
 * A10 promotion-gate readiness (E18/E43-A10).
 *
 * Evaluates whether the shadow system is ready for a FUTURE Founder-approved limited dev experiment.
 * `allowed` is ALWAYS false in A10 — this only distinguishes blocked / not_ready / dev_experiment_design_
 * ready and lists blockers. Does NOT close R3/R4. Pure; never throws.
 */

import { PromotionGateInput, ControlPlanePromotionGate } from './recommendation-shadow-control-plane.types';

export const NEXT_REQUIRED_GATE = 'A11_FOUNDER_APPROVED_LIMITED_DEV_EXPERIMENT';

export function evaluateRecommendationShadowPromotionGate(input: PromotionGateInput): ControlPlanePromotionGate {
  const blockers: string[] = [];
  const warnings: string[] = [];
  try {
    const q = input?.qualitySummary;
    const perf = input?.performanceSummary;
    const ret = input?.retentionSummary;
    const art = input?.simulationArtifactSummary;

    // hard safety blockers
    if ((input?.unsafeExplanationCount ?? 0) > 0) blockers.push('unsafe_explanation_present');
    if ((input?.rawLeakCount ?? 0) > 0) blockers.push('raw_leak_present');
    if ((input?.consentBypassCount ?? 0) > 0) blockers.push('consent_bypass_present');
    if ((input?.responseMutationCount ?? 0) > 0) blockers.push('live_response_mutation');
    if ((input?.liveRankingMutationCount ?? 0) > 0) blockers.push('live_ranking_mutation');
    if ((input?.traceRedactionPassRate ?? 1) < 1) blockers.push('trace_redaction_incomplete');
    if ((perf?.defaultOffDbIoCount ?? 0) !== 0) blockers.push('default_off_db_io');
    if ((perf?.networkCalls ?? 0) !== 0) blockers.push('network_call_present');

    // quality status
    if (q?.status === 'blocked') blockers.push('quality_status_blocked');
    if ((q?.failedThresholds?.length ?? 0) > 0) blockers.push('quality_thresholds_failed');

    // retention must be non-destructive + founder-gated
    if (ret && ret.destructiveOperationUsed !== false) blockers.push('destructive_retention');
    if (ret && ret.requiresFounderApproval !== true) blockers.push('retention_not_founder_gated');

    // online analysis availability / sample size
    if (!input?.traceSummary || input.traceSummary.sampleSizeWarning) warnings.push('trace_sample_size_small');

    // simulation artifact re-checks
    if (art && art.present) {
      if (!art.reChecksPassed) blockers.push('simulation_artifact_recheck_failed');
      if (art.promotionAllowed === true) blockers.push('simulation_artifact_claims_promotion');
    } else {
      warnings.push('simulation_artifact_missing');
    }

    // R3/R4 are NOT closed by A10 — always a standing gate before any live change.
    warnings.push('R3_R4_remain_mitigating_not_closed');

    let status: ControlPlanePromotionGate['status'];
    if (blockers.length > 0) status = 'blocked';
    else if (q?.status === 'not_ready' || (q?.warnings?.length ?? 0) > 0) status = 'not_ready';
    else status = 'dev_experiment_design_ready';

    // even at best, status maxes at design-ready (and allowed stays false).
    return { allowed: false, status, blockers, warnings, nextRequiredGate: NEXT_REQUIRED_GATE };
  } catch {
    return { allowed: false, status: 'blocked', blockers: [...blockers, 'internal_error'], warnings, nextRequiredGate: NEXT_REQUIRED_GATE };
  }
}
