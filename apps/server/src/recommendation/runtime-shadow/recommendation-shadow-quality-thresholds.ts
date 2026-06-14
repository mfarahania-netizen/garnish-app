/**
 * Shadow recommendation quality thresholds (E18/E43-A9).
 *
 * Evaluates a dev-traffic simulation against safety/quality thresholds and produces a promotion-readiness
 * decision. `promotionDecision.allowed` is ALWAYS false in A9 (this is dev-experiment-design readiness,
 * never a production go). Pure; never throws.
 */

import {
  ShadowExperimentSimulation,
  ShadowQualityThresholds,
  ShadowQualityEvaluation,
} from './recommendation-shadow-dev-traffic.types';

export const DEFAULT_SHADOW_QUALITY_THRESHOLDS: ShadowQualityThresholds = {
  minimumAllowedShadowRuns: 80,
  maximumUnsafeExplanationRate: 0,
  maximumResponseMutationCount: 0,
  maximumLiveRankingMutationCount: 0,
  minimumAverageInputReadinessConfidence: 0.45,
  maximumMajorDivergenceRateForPromotion: 0.65,
  minimumTraceRedactionPassRate: 1.0,
  maximumConsentBypassCount: 0,
  maximumRawLeakCount: 0,
  maximumShadowFailureEscapeCount: 0,
  maximumDefaultOffDbIoCount: 0,
};

export function evaluateShadowRecommendationQuality(
  simulation: ShadowExperimentSimulation,
  thresholds: ShadowQualityThresholds = DEFAULT_SHADOW_QUALITY_THRESHOLDS,
): ShadowQualityEvaluation {
  const passed: string[] = [];
  const failed: string[] = [];
  const warnings: string[] = [];
  const s = simulation?.summary;

  try {
    const check = (name: string, ok: boolean) => (ok ? passed.push(name) : failed.push(name));
    // hard safety thresholds (must all pass)
    check('minimumAllowedShadowRuns', (s?.allowedShadowRuns ?? 0) >= thresholds.minimumAllowedShadowRuns);
    check('maximumUnsafeExplanationRate', (s?.unsafeExplanationRate ?? 1) <= thresholds.maximumUnsafeExplanationRate);
    check('maximumResponseMutationCount', (s?.responseMutationCount ?? 1) <= thresholds.maximumResponseMutationCount);
    check('maximumLiveRankingMutationCount', (s?.liveRankingMutationCount ?? 1) <= thresholds.maximumLiveRankingMutationCount);
    check('minimumAverageInputReadinessConfidence', (s?.averageInputReadinessConfidence ?? 0) >= thresholds.minimumAverageInputReadinessConfidence);
    check('maximumMajorDivergenceRateForPromotion', (s?.majorDivergenceRate ?? 1) <= thresholds.maximumMajorDivergenceRateForPromotion);
    check('minimumTraceRedactionPassRate', (s?.traceRedactionPassRate ?? 0) >= thresholds.minimumTraceRedactionPassRate);
    check('maximumConsentBypassCount', (s?.consentBypassCount ?? 1) <= thresholds.maximumConsentBypassCount);
    check('maximumRawLeakCount', (s?.rawLeakCount ?? 1) <= thresholds.maximumRawLeakCount);
    check('maximumShadowFailureEscapeCount', (s?.shadowFailureEscapeCount ?? 1) <= thresholds.maximumShadowFailureEscapeCount);
    check('maximumDefaultOffDbIoCount', (s?.defaultOffDbIoCount ?? 1) <= thresholds.maximumDefaultOffDbIoCount);

    if ((s?.majorDivergenceRate ?? 0) > 0.4) warnings.push('major divergence rate is elevated — shadow ranking differs substantially from live (expected for an untuned shadow engine).');
    if ((s?.averageInputReadinessConfidence ?? 0) < 0.6) warnings.push('average input readiness confidence is modest (cold-start/rebuild approximations).');

    // safety-critical failures → blocked; otherwise gradient toward dev-experiment-design readiness.
    const safetyCritical = ['maximumUnsafeExplanationRate', 'maximumResponseMutationCount', 'maximumLiveRankingMutationCount', 'maximumConsentBypassCount', 'maximumRawLeakCount', 'maximumShadowFailureEscapeCount', 'maximumDefaultOffDbIoCount'];
    const anySafetyFail = failed.some((f) => safetyCritical.includes(f));

    let status: ShadowQualityEvaluation['status'];
    if (anySafetyFail) status = 'blocked';
    else if (failed.length > 0) status = 'not_ready';
    else if (warnings.length > 0) status = 'shadow_quality_observable';
    else status = 'ready_for_limited_dev_experiment_design';

    return {
      status,
      passedThresholds: passed,
      failedThresholds: failed,
      warnings,
      promotionDecision: {
        allowed: false, // ALWAYS false in A9 — never a production promotion
        reason:
          status === 'ready_for_limited_dev_experiment_design'
            ? 'All safety/quality thresholds met in offline dev simulation; ready only for a FUTURE gated dev-experiment DESIGN (not production).'
            : `Not eligible for experiment design: status=${status}; failed=[${failed.join(', ')}].`,
        nextRequiredGate: 'A10: Founder-approved, consent-gated, safety-reviewed limited dev experiment (still no live ranking change).',
      },
    };
  } catch {
    return {
      status: 'blocked',
      passedThresholds: passed,
      failedThresholds: [...failed, 'internal_error'],
      warnings,
      promotionDecision: { allowed: false, reason: 'evaluation error (handled; fail-closed).', nextRequiredGate: 'A10' },
    };
  }
}
