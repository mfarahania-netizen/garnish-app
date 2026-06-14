/**
 * Recommendation shadow online analysis (E18/E43-A8).
 *
 * READ-ONLY aggregation over persisted REDACTED shadow traces. No raw trace body, no user-facing output,
 * no external analytics call, no network, no product-ranking effect. Empty table → safe empty analysis.
 * Pure given its optional ShadowTraceReadPort; never throws.
 */

import {
  OnlineAnalysisOptions,
  ShadowAnalysisQuery,
  ShadowAnalysisResult,
  RedactedTraceRow,
} from './recommendation-shadow-profile-feed.types';

const round4 = (x: number): number => (Number.isFinite(x) ? Math.round(x * 10000) / 10000 : 0);

function emptyResult(extraLimitation?: string): ShadowAnalysisResult {
  return {
    traceCount: 0, averageTopKOverlap: 0, majorDivergenceRate: 0, mostCommonReasonCodes: [], weakInputRate: 0,
    traceWriteFailureRate: 0, missingInputFrequencies: {}, sampleSizeWarning: true,
    limitations: ['No traces to analyze.', ...(extraLimitation ? [extraLimitation] : [])], productUseEnabled: false,
  };
}

export async function analyzeRecommendationShadowTraces(
  query: ShadowAnalysisQuery,
  options: OnlineAnalysisOptions,
): Promise<ShadowAnalysisResult> {
  const minSample = options?.minSampleSize ?? 30;
  try {
    if (options?.mode !== 'read_only') return emptyResult('Online analysis mode is off.');
    if (!options.port) return emptyResult('No trace read port configured.');

    let rows: RedactedTraceRow[] = [];
    try { rows = (await options.port.readTraces(query)) ?? []; } catch { rows = []; }
    rows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!rows.length) return emptyResult();

    const n = rows.length;
    const overlaps = rows.map((r) => (typeof r.topKOverlap === 'number' && Number.isFinite(r.topKOverlap) ? r.topKOverlap : null)).filter((x): x is number => x !== null);
    const major = rows.filter((r) => r.majorDivergence).length;
    const weak = rows.filter((r) => (r.summary?.weakConfidenceCount ?? 0) > 0).length;

    const reasonCounts: Record<string, number> = {};
    for (const r of rows) for (const c of r.reasonCodes ?? []) if (typeof c === 'string') reasonCounts[c] = (reasonCounts[c] || 0) + 1;
    const mostCommonReasonCodes = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));

    return {
      traceCount: n,
      averageTopKOverlap: overlaps.length ? round4(overlaps.reduce((s, v) => s + v, 0) / overlaps.length) : 0,
      majorDivergenceRate: round4(major / n),
      mostCommonReasonCodes,
      weakInputRate: round4(weak / n),
      traceWriteFailureRate: 0, // write failures are not persisted as rows; surfaced via runtime metrics instead
      missingInputFrequencies: {},
      sampleSizeWarning: n < minSample,
      limitations: [
        'Read-only aggregation of redacted traces; not a causal/online experiment result.',
        ...(n < minSample ? [`Sample size ${n} < ${minSample} — directional only.`] : []),
      ],
      productUseEnabled: false,
    };
  } catch {
    return emptyResult('Analysis error (handled).');
  }
}
