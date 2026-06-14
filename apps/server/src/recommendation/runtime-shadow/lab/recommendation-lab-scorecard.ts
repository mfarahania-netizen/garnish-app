/**
 * A11 quality scorecard (E18/E43-A11). Computes a multi-dimensional quality scorecard from an experiment's
 * safety counts + metrics + execution. Safety violations DOMINATE (consent bypass / raw leak / live
 * mutation → zero safety → zero overall). Pure; never throws.
 */

import { RecommendationLabExperiment, RecommendationExperimentQualityScorecard } from './recommendation-lab.types';

const clamp01 = (x: number): number => (Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0);
const round4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : 0);

export function computeRecommendationLabScorecard(experiment: RecommendationLabExperiment): RecommendationExperimentQualityScorecard {
  const failedCriticalChecks: string[] = [];
  const warnings: string[] = [];
  try {
    if (!experiment || typeof experiment !== 'object') {
      return { overallScore: 0, readinessScore: 0, safetyScore: 0, traceQualityScore: 0, rankingStabilityScore: 0, consentComplianceScore: 0, performanceScore: 0, dataCoverageScore: 0, failedCriticalChecks: ['missing_experiment'], warnings: [] };
    }
    const s = experiment?.safety;
    const m = experiment?.metrics;
    const exec = experiment?.executionSummary;

    // ── hard safety violations dominate ──
    let safetyViolation = false;
    if ((s?.consentBypassCount ?? 0) > 0) { failedCriticalChecks.push('consent_bypass'); safetyViolation = true; }
    if ((s?.rawLeakCount ?? 0) > 0) { failedCriticalChecks.push('raw_leak'); safetyViolation = true; }
    if ((s?.unsafeExplanationCount ?? 0) > 0) { failedCriticalChecks.push('unsafe_explanation'); safetyViolation = true; }
    if ((s?.responseMutationCount ?? 0) > 0) { failedCriticalChecks.push('user_response_mutation'); safetyViolation = true; }
    if ((s?.liveRankingMutationCount ?? 0) > 0) { failedCriticalChecks.push('live_ranking_mutation'); safetyViolation = true; }
    if ((exec?.failuresEscaped ?? 0) > 0) { failedCriticalChecks.push('failures_escaped'); safetyViolation = true; }
    if ((s?.defaultOffDbIoCount ?? 0) > 0) { failedCriticalChecks.push('default_off_db_io'); safetyViolation = true; }

    const redaction = clamp01(s?.traceRedactionPassRate ?? 1);
    const consentComplianceScore = (s?.consentBypassCount ?? 0) > 0 ? 0 : 1;
    const safetyScore = safetyViolation ? 0 : (redaction < 1 ? 0.5 : 1);
    const traceQualityScore = (s?.rawLeakCount ?? 0) > 0 ? 0 : redaction;
    const rankingStabilityScore = (s?.liveRankingMutationCount ?? 0) > 0 ? 0 : 1;

    const coverage = m?.coverageRatio == null ? 0 : clamp01(m.coverageRatio);
    const dataCoverageScore = coverage;
    if (coverage < 1) warnings.push('recipe coverage below full universe');

    const divergence = clamp01(m?.majorDivergenceRate ?? 0);
    const avgConf = clamp01(m?.averageInputReadinessConfidence ?? 0);
    const tracesAnalyzed = exec?.tracesAnalyzed ?? 0;
    const readinessScore = round4(clamp01(0.5 * avgConf + 0.3 * (1 - divergence) + 0.2 * (tracesAnalyzed > 0 ? 1 : 0)));
    if (divergence > 0.5) warnings.push('high major-divergence rate (expected for an untuned shadow engine)');
    if (avgConf < 0.5) warnings.push('modest average input-readiness confidence');

    const p95 = m?.p95SimulatedRuntimeMs ?? 0;
    const performanceScore = p95 <= 25 ? 1 : p95 <= 60 ? 0.7 : 0.4;

    const overallScore = safetyViolation
      ? 0
      : round4(clamp01(0.35 * safetyScore + 0.15 * consentComplianceScore + 0.15 * traceQualityScore + 0.1 * rankingStabilityScore + 0.1 * readinessScore + 0.075 * performanceScore + 0.075 * dataCoverageScore));

    return {
      overallScore, readinessScore, safetyScore: round4(safetyScore), traceQualityScore: round4(traceQualityScore),
      rankingStabilityScore: round4(rankingStabilityScore), consentComplianceScore: round4(consentComplianceScore),
      performanceScore: round4(performanceScore), dataCoverageScore: round4(dataCoverageScore),
      failedCriticalChecks, warnings,
    };
  } catch {
    return { overallScore: 0, readinessScore: 0, safetyScore: 0, traceQualityScore: 0, rankingStabilityScore: 0, consentComplianceScore: 0, performanceScore: 0, dataCoverageScore: 0, failedCriticalChecks: ['scorecard_internal_error'], warnings };
  }
}
