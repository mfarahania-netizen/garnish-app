/**
 * Recommendation shadow metrics (E18/E43-A7).
 *
 * Pure aggregation of per-request shadow outcomes into a summary for future offline analysis. No network,
 * no external analytics call, no user-facing output, no raw content. Never throws.
 */

import { ShadowMetricsInput, ShadowMetricsSummary } from './recommendation-shadow-input-provider.types';

const round4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : 0);

export function summarizeRecommendationShadowMetrics(results: ShadowMetricsInput[]): ShadowMetricsSummary {
  const rows = Array.isArray(results) ? results.filter(Boolean) : [];
  const blockedByReason: Record<string, number> = {};
  const missingInputFrequencies: Record<string, number> = {};

  let attempted = 0, allowed = 0, tracesWritten = 0, traceWriteFailures = 0;
  let majorDivergenceCount = 0, weakInputCount = 0, unsafeExplanationCount = 0;
  const overlaps: number[] = [];
  const confidences: number[] = [];

  for (const r of rows) {
    if (r.attempted) attempted++;
    if (r.allowed) allowed++;
    else if (r.blockedReason) blockedByReason[r.blockedReason] = (blockedByReason[r.blockedReason] || 0) + 1;
    if (r.traceWritten) tracesWritten++;
    if (r.traceWriteFailed) traceWriteFailures++;
    if (r.majorDivergence) majorDivergenceCount++;
    if (r.weakInput) weakInputCount++;
    if (Number.isFinite(Number(r.unsafeExplanationCount))) unsafeExplanationCount += Number(r.unsafeExplanationCount);
    if (typeof r.topKOverlap === 'number' && Number.isFinite(r.topKOverlap)) overlaps.push(r.topKOverlap);
    if (typeof r.decisionConfidence === 'number' && Number.isFinite(r.decisionConfidence)) confidences.push(r.decisionConfidence);
    for (const m of r.missingInputs ?? []) missingInputFrequencies[m] = (missingInputFrequencies[m] || 0) + 1;
  }

  const avg = (xs: number[]): number | null => (xs.length ? round4(xs.reduce((s, v) => s + v, 0) / xs.length) : null);

  return {
    shadowRunsAttempted: attempted,
    shadowRunsAllowed: allowed,
    blockedByReason,
    tracesWritten,
    traceWriteFailures,
    averageTopKOverlap: avg(overlaps),
    majorDivergenceCount,
    weakInputCount,
    unsafeExplanationCount,
    averageDecisionConfidence: avg(confidences),
    missingInputFrequencies,
  };
}
