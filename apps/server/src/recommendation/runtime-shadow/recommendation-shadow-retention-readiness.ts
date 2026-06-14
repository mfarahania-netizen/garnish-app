/**
 * Recommendation shadow trace retention readiness (E18/E43-A8).
 *
 * DRY-RUN ONLY. Computes how many redacted traces WOULD be eligible for deletion under a retention
 * window, without deleting anything. No delete/prune/destructive operation, no automated execution —
 * any future deletion requires explicit Founder approval. Pure given its optional port; never throws.
 */

import { RetentionOptions, RetentionPlan, ShadowTraceRetentionPort } from './recommendation-shadow-profile-feed.types';

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_SAMPLE_LIMIT = 10;

export async function planRecommendationShadowTraceRetention(options: RetentionOptions): Promise<RetentionPlan> {
  const mode = options?.mode === 'dry_run' ? 'dry_run' : 'off';
  const retentionDays = Number.isFinite(Number(options?.retentionDays)) && Number(options?.retentionDays) > 0 ? Number(options!.retentionDays) : DEFAULT_RETENTION_DAYS;
  const now = options?.now ?? new Date();
  const sampleLimit = Number.isFinite(Number(options?.sampleLimit)) && Number(options?.sampleLimit) >= 0 ? Number(options!.sampleLimit) : DEFAULT_SAMPLE_LIMIT;

  const base: RetentionPlan = {
    mode,
    retentionDays,
    eligibleForDeletionCount: 0,
    destructiveOperationUsed: false,
    wouldDeleteIdsSample: [],
    requiresFounderApproval: true,
    nextStep: 'Founder approval required before any deletion; this is a non-destructive dry-run readiness check only.',
  };

  try {
    if (mode === 'off' || !options.port) {
      return { ...base, nextStep: mode === 'off' ? 'Retention mode is off — no dry-run performed.' : base.nextStep };
    }
    const before = new Date(now.getTime() - retentionDays * 86_400_000);
    let count = 0;
    try { count = await options.port.countEligible(before); } catch { count = 0; }
    let sample: string[] = [];
    if (sampleLimit > 0) {
      try { sample = (await options.port.sampleEligibleIds(before, sampleLimit)) ?? []; } catch { sample = []; }
    }
    return {
      ...base,
      eligibleForDeletionCount: Number.isFinite(count) ? count : 0,
      // sample IDs are opaque uuids (not sensitive), capped; still never deleted here.
      wouldDeleteIdsSample: sample.slice(0, sampleLimit).map((id) => String(id)),
    };
  } catch {
    return base;
  }
}
