/**
 * A11 promotion gate (E18/E43-A11). Maps a scorecard + experiment to a promotion-readiness decision.
 * `allowed` is ALWAYS false — A11 can only reach `ready_for_founder_review`, never self-promote.
 * `requiredFounderDecision` is always true. Pure; never throws. Does NOT close R3/R4.
 */

import {
  RecommendationLabExperiment, RecommendationExperimentQualityScorecard, RecommendationExperimentPromotionGate,
} from './recommendation-lab.types';

const NEXT_GATE = 'A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT' as const;

export function evaluateRecommendationLabPromotionGate(
  scorecard: RecommendationExperimentQualityScorecard,
  experiment: RecommendationLabExperiment,
): RecommendationExperimentPromotionGate {
  const blockers: string[] = [];
  const warnings: string[] = [];
  try {
    // any critical safety check fails → blocked
    for (const c of scorecard?.failedCriticalChecks ?? []) blockers.push(`critical:${c}`);
    if ((scorecard?.safetyScore ?? 0) < 1) blockers.push('safety_score_below_max');
    if (experiment?.status === 'blocked') blockers.push('experiment_blocked');
    if (experiment?.configValidation && experiment.configValidation.ok === false) blockers.push('config_invalid');
    if (experiment?.safety?.killSwitchEngaged) blockers.push('kill_switch_engaged');
    if (experiment?.executionSummary && (experiment.executionSummary.failuresEscaped ?? 0) > 0) blockers.push('failures_escaped');

    // readiness / coverage are warnings (not safety blockers)
    if ((scorecard?.readinessScore ?? 0) < 0.5) warnings.push('readiness_below_0.5');
    if ((scorecard?.dataCoverageScore ?? 0) < 1) warnings.push('coverage_below_full');
    warnings.push('R3_R4_remain_mitigating_not_closed');

    let status: RecommendationExperimentPromotionGate['status'];
    if (blockers.length > 0) status = 'blocked';
    else if ((scorecard?.overallScore ?? 0) >= 0.7 && (scorecard?.readinessScore ?? 0) >= 0.5) status = 'ready_for_founder_review';
    else status = 'not_ready';

    return { allowed: false, status, blockers, warnings, requiredFounderDecision: true, nextRequiredGate: NEXT_GATE };
  } catch {
    return { allowed: false, status: 'blocked', blockers: [...blockers, 'internal_error'], warnings, requiredFounderDecision: true, nextRequiredGate: NEXT_GATE };
  }
}
