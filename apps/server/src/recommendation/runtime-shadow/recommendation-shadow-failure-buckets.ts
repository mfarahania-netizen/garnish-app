/**
 * Shadow simulation failure-bucket classification (E18/E43-A9).
 *
 * Classifies simulation runs into named failure buckets with counts + severity + next action. Reports
 * counts and example COUNTS only — never raw examples. Pure; never throws.
 */

import {
  ShadowExperimentSimulationRun,
  FailureBucket,
  FailureBucketId,
} from './recommendation-shadow-dev-traffic.types';

const SEVERITY: Record<FailureBucketId, FailureBucket['severity']> = {
  missing_consent: 'low', // expected + correct behavior (fail-closed)
  profile_feed_missing: 'low',
  low_input_readiness: 'medium',
  unsafe_trace: 'blocking',
  trace_write_denied: 'low',
  trace_write_failed: 'high',
  major_divergence: 'medium',
  weak_shadow_confidence: 'medium',
  candidate_metadata_missing: 'medium',
  default_off_skip: 'low',
  safety_gate_block: 'low',
  simulation_fixture_gap: 'medium',
};
const NEXT_ACTION: Record<FailureBucketId, string> = {
  missing_consent: 'Expected fail-closed behavior; ensure consent is plumbed before any experiment.',
  profile_feed_missing: 'Cold-start fallback used; enrich persisted profile feed in A10.',
  low_input_readiness: 'Improve persisted signal coverage; acceptable at shadow stage.',
  unsafe_trace: 'BLOCKING — investigate redaction; must be zero.',
  trace_write_denied: 'Expected when traceStorage consent absent; no action.',
  trace_write_failed: 'Investigate store reliability before persisted experiment.',
  major_divergence: 'Expected for untuned shadow; analyze divergence reasons in A10.',
  weak_shadow_confidence: 'Low-confidence shadow output; gather more evidence.',
  candidate_metadata_missing: 'Enrich candidate metadata feed; acceptable at shadow stage.',
  default_off_skip: 'Default-off skip; no action.',
  safety_gate_block: 'Safety gate correctly suppressed; no action.',
  simulation_fixture_gap: 'Broaden simulation fixtures in a future pass.',
};

export function classifyShadowFailureBuckets(runs: ShadowExperimentSimulationRun[]): FailureBucket[] {
  const counts: Record<FailureBucketId, number> = {
    missing_consent: 0, profile_feed_missing: 0, low_input_readiness: 0, unsafe_trace: 0, trace_write_denied: 0,
    trace_write_failed: 0, major_divergence: 0, weak_shadow_confidence: 0, candidate_metadata_missing: 0,
    default_off_skip: 0, safety_gate_block: 0, simulation_fixture_gap: 0,
  };
  try {
    for (const r of Array.isArray(runs) ? runs : []) {
      if (r.blocked && (r.blockReason || '').includes('consent')) counts.missing_consent++;
      if (r.blocked && (r.blockReason === 'blocked' || (r.blockReason || '').includes('safety'))) counts.safety_gate_block++;
      if (r.profileSource === 'cold_start_fallback' || r.profileSource === 'none') counts.profile_feed_missing++;
      if (r.enabled && r.inputReadinessConfidence < 0.45) counts.low_input_readiness++;
      if (r.unsafeExplanationCount > 0) counts.unsafe_trace++;
      if (r.enabled && r.traceWriteEligible && !r.traceWritten) counts.trace_write_failed++;
      if (r.enabled && !r.traceWriteEligible) counts.trace_write_denied++;
      if (r.enabled && r.majorDivergence) counts.major_divergence++;
      if (r.enabled && r.weakInput) counts.weak_shadow_confidence++;
    }
  } catch { /* return whatever was counted */ }

  return (Object.keys(counts) as FailureBucketId[]).map((bucket) => ({
    bucket,
    count: counts[bucket],
    examplesCount: counts[bucket], // count only — NEVER raw examples
    severity: SEVERITY[bucket],
    nextAction: NEXT_ACTION[bucket],
  }));
}
