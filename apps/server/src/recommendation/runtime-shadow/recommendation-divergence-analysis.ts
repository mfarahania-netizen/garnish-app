/**
 * Recommendation live-vs-shadow divergence analysis (E18/E43-A6).
 *
 * Maps a shadow decision trace + comparison metrics into a small set of SAFE, deterministic divergence
 * reason codes that explain WHY shadow ranking would differ from live ranking. No protected/medical
 * inference, no raw values. Pure; never throws.
 */

import { RecommendationDecisionTrace, ReasonCode } from '../intelligence/recommendation-decision.types';
import { DivergenceReasonCode } from './recommendation-shadow-runtime.types';

export interface DivergenceInput {
  trace: RecommendationDecisionTrace | null;
  topKOverlap: number;
  rankShiftCount: number;
  suppressedByShadowCount: number;
  boostedByShadowCount: number;
  weakConfidenceCount: number;
  topK: number;
  /** below this top-K overlap the divergence is "major". Default 0.5. */
  majorOverlapThreshold?: number;
  /** rank-shift fraction (rankShiftCount/topK) above this is also "major". Default 0.6. */
  majorShiftFraction?: number;
}

export interface DivergenceResult {
  reasons: DivergenceReasonCode[];
  majorDivergence: boolean;
}

/** A5 reason code → A6 divergence reason code (the "why shadow differs" mapping). */
const REASON_TO_DIVERGENCE: Partial<Record<ReasonCode, DivergenceReasonCode>> = {
  taste_match: 'taste_profile_shift',
  effort_fit: 'effort_context_shift',
  skill_fit: 'skill_mismatch',
  negative_feedback: 'dismiss_history',
  positive_feedback: 'cook_success_boost',
  repeat_success: 'cook_success_boost',
  novelty_fit: 'novelty_boost',
  recent_overexposure: 'recent_overexposure',
  fatigue_risk: 'recent_overexposure',
  safety_boundary: 'safety_soft_suppression',
  insufficient_evidence: 'weak_profile_confidence',
  cold_start_fallback: 'cold_start_fallback',
};

export function analyzeRecommendationDivergence(input: DivergenceInput): DivergenceResult {
  const reasons = new Set<DivergenceReasonCode>();
  try {
    const trace = input.trace;
    const overlapThreshold = input.majorOverlapThreshold ?? 0.5;
    const shiftFraction = input.majorShiftFraction ?? 0.6;

    if (trace) {
      // 1) aggregate per-candidate signals from the trace
      for (const cand of trace.candidates ?? []) {
        for (const rc of cand.why?.reasonCodes ?? []) {
          const mapped = REASON_TO_DIVERGENCE[rc];
          if (mapped) reasons.add(mapped);
        }
        if ((cand.warnings ?? []).length > 0) reasons.add('missing_candidate_metadata');
      }

      // 2) trace-level confidence + history signals
      if ((trace.confidence?.overall ?? 0) < 0.4 || (trace.confidence?.weakReasonCount ?? 0) > 0) {
        reasons.add('weak_profile_confidence');
      }
      const exp = trace.attribution?.exposureInputsUsed ?? 0;
      const out = trace.attribution?.outcomeInputsUsed ?? 0;
      if (exp === 0 && out === 0) reasons.add('insufficient_history');
    }

    // 3) comparison-metric signals
    if (input.suppressedByShadowCount > 0 && !reasons.has('safety_soft_suppression')) {
      // a suppression not explained by an explicit safety boundary is most often overexposure-driven
      reasons.add('recent_overexposure');
    }
    if (input.weakConfidenceCount > 0) reasons.add('weak_profile_confidence');

    const shiftFrac = input.topK > 0 ? input.rankShiftCount / input.topK : 0;
    const majorDivergence = input.topKOverlap < overlapThreshold || shiftFrac > shiftFraction;

    // 4) high alignment marker (only when NOT a major divergence and rankings largely agree)
    if (!majorDivergence && input.topKOverlap >= 0.8) reasons.add('shadow_live_alignment');

    return { reasons: [...reasons].sort(), majorDivergence };
  } catch {
    return { reasons: [...reasons].sort(), majorDivergence: false };
  }
}
