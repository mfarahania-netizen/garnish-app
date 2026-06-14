/**
 * Signal confidence model (E43-A3) — TRANSPARENT, deterministic, testable.
 *
 * confidence = evidenceSufficiency × recency × weightedQuality, capped.
 *   - evidenceSufficiency: saturates at the policy's minEvidenceCount (more evidence ⇒ surer).
 *   - recency: exponential half-life decay (older evidence ⇒ less sure).
 *   - weightedQuality: policy-weighted blend of consistency, frequency, explicit feedback.
 *   - cap: 0.95 in v1 UNLESS there is explicit feedback AND repeated evidence (then up to 0.99).
 *
 * No black box: every term is a named, unit-tested function.
 */

import { ConfidencePolicy } from './signal-types';

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const round4 = (x: number): number => Math.round(x * 10000) / 10000;

/** Exponential recency decay: 0.5 at one half-life, → 0 as evidence ages. */
export function computeRecencyScore(lastEvidenceAt: Date, now: Date, halfLifeDays: number): number {
  const ageMs = now.getTime() - lastEvidenceAt.getTime();
  const ageDays = Math.max(0, ageMs / 86_400_000);
  if (halfLifeDays <= 0) return 1;
  return round4(clamp01(Math.pow(0.5, ageDays / halfLifeDays)));
}

/**
 * Consistency = directional agreement of the evidence. All-supporting → 1; perfectly split → 0;
 * no evidence → 0. Contradictory evidence therefore lowers confidence.
 */
export function computeConsistencyScore(supporting: number, contradicting: number): number {
  const total = supporting + contradicting;
  if (total <= 0) return 0;
  return round4(clamp01(Math.abs(supporting - contradicting) / total));
}

/** Frequency = volume of evidence, saturating at `target` (default 2× minEvidenceCount). */
export function computeFrequencyScore(evidenceCount: number, target: number): number {
  if (target <= 0) return evidenceCount > 0 ? 1 : 0;
  return round4(clamp01(evidenceCount / target));
}

export interface ConfidenceInputs {
  evidenceCount: number;
  recencyScore: number; // 0..1
  consistencyScore: number; // 0..1
  frequencyScore: number; // 0..1
  explicitFeedbackCount: number;
  policy: ConfidencePolicy;
}

/** Explicit-feedback contribution: saturates at 2 explicit feedback events. */
export function computeExplicitFeedbackScore(explicitFeedbackCount: number): number {
  return clamp01(explicitFeedbackCount / 2);
}

/**
 * Combine the transparent terms into a final confidence in [0,1].
 * Returns 0 for empty evidence. Capped at 0.95 unless (explicit feedback ≥1 AND evidence ≥
 * minEvidenceCount), in which case the cap rises to 0.99.
 */
export function computeConfidence(inputs: ConfidenceInputs): number {
  const { evidenceCount, recencyScore, consistencyScore, frequencyScore, explicitFeedbackCount, policy } = inputs;
  if (evidenceCount <= 0) return 0;

  const evidenceSufficiency = clamp01(evidenceCount / Math.max(1, policy.minEvidenceCount));
  const efScore = computeExplicitFeedbackScore(explicitFeedbackCount);

  const wSum = policy.consistencyWeight + policy.frequencyWeight + policy.explicitFeedbackWeight;
  const weightedQuality =
    wSum <= 0
      ? 0
      : (policy.consistencyWeight * clamp01(consistencyScore) +
          policy.frequencyWeight * clamp01(frequencyScore) +
          policy.explicitFeedbackWeight * efScore) /
        wSum;

  const raw = evidenceSufficiency * clamp01(recencyScore) * weightedQuality;

  const hasStrongBasis = explicitFeedbackCount >= 1 && evidenceCount >= policy.minEvidenceCount;
  const cap = hasStrongBasis ? 0.99 : 0.95;

  return round4(Math.min(cap, clamp01(raw)));
}
