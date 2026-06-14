/**
 * Recommendation Why Engine (E18/E43-A5).
 *
 * Builds short, safe, evidence-based "why" explanations + reason codes for a candidate decision.
 * Explanations are non-creepy, non-medical, non-protected-attribute, NON-MANIPULATIVE, and not
 * user-facing until separately approved. A scanner rejects unsafe/manipulative phrasing.
 */

import { isSafeExplanation, FORBIDDEN_EXPLANATION_PATTERNS } from '../../behavior-engine/signals/signal-explainability';
import {
  RecommendationCandidateDecision,
  CandidateWhy,
  ReasonCode,
} from './recommendation-decision.types';

/** Manipulative / pressuring phrasings that must never appear in a recommendation explanation. */
export const MANIPULATIVE_PATTERNS: readonly RegExp[] = [
  /\byou (always|never) (fail|cannot|can't|struggle)\b/i,
  /\byou need this\b/i,
  /\b(don'?t miss|act now|last chance|hurry|limited time)\b/i,
  /\byou (can'?t|cannot) (cook|make|handle)\b/i,
  /\byou should feel\b/i,
  /\bbecause you are\b/i,
];

/** True if a why string is safe to store/surface (no creepy/medical/protected/manipulative phrasing). */
export function isSafeWhy(text: string): boolean {
  if (!isSafeExplanation(text)) return false; // reuses creepy/medical/protected guards from A3
  if (MANIPULATIVE_PATTERNS.some((re) => re.test(text))) return false;
  return true;
}

export function assertSafeWhy(text: string): void {
  if (!isSafeWhy(text)) throw new Error('unsafe/manipulative recommendation explanation rejected');
}

const HIGH = 0.6;
const LOWFB = 0.4;
const PEN = 0.4;

const REASON_TEXT: Record<ReasonCode, string> = {
  taste_match: 'fits flavors and cuisines you have engaged with recently',
  effort_fit: 'matches your usual time/effort level for this context',
  skill_fit: 'is a good match for your current cooking comfort',
  routine_fit: 'fits your typical cooking routine for this time',
  positive_feedback: 'is similar to recipes you have saved or cooked',
  negative_feedback: 'is similar to recipes you have dismissed before',
  novelty_fit: 'adds variety, which fits your appetite for trying new things',
  repeat_success: 'is the kind of recipe you have successfully cooked again',
  recent_overexposure: 'has been shown to you often recently',
  fatigue_risk: 'may be repetitive given recent activity',
  insufficient_evidence: 'has limited evidence so far, so this is an early read',
  safety_boundary: 'was limited by a safety boundary',
  cold_start_fallback: 'is based mainly on your onboarding answers (early profile)',
};

/** Derive reason codes from a candidate decision's score breakdown + decision. */
export function deriveReasonCodes(decision: RecommendationCandidateDecision): ReasonCode[] {
  const b = decision.scoreBreakdown;
  const codes: ReasonCode[] = [];
  if (decision.decision === 'block' || b.safetyPenalty >= PEN) codes.push('safety_boundary');
  if (decision.decision === 'insufficient_evidence' || decision.confidence < 0.25) codes.push('insufficient_evidence');
  if (b.tasteFit >= HIGH) codes.push('taste_match');
  if (b.effortFit >= HIGH) codes.push('effort_fit');
  if (b.skillFit >= HIGH) codes.push('skill_fit');
  if (b.routineFit >= HIGH) codes.push('routine_fit');
  if (b.feedbackFit >= HIGH) codes.push('positive_feedback');
  if (b.feedbackFit <= LOWFB) codes.push('negative_feedback');
  if (b.noveltyFit >= HIGH) codes.push('novelty_fit');
  if (b.fatiguePenalty >= PEN) codes.push('fatigue_risk', 'recent_overexposure');
  if (decision.evidence.signalKeysUsed.length === 0 && decision.evidence.graphDimensionsUsed.includes('onboardingColdStart')) {
    codes.push('cold_start_fallback');
  }
  return [...new Set(codes)];
}

/**
 * Generate a safe `why` (primary + supporting reasons + limitations + reason codes) for a candidate.
 * Pure; the resulting text is asserted safe; unsafe templates can never ship.
 */
export function generateRecommendationWhy(decision: RecommendationCandidateDecision): CandidateWhy {
  const codes = deriveReasonCodes(decision);
  // priority order for the PRIMARY reason
  const order: ReasonCode[] = [
    'safety_boundary',
    'negative_feedback',
    'recent_overexposure',
    'fatigue_risk',
    'positive_feedback',
    'repeat_success',
    'taste_match',
    'effort_fit',
    'skill_fit',
    'routine_fit',
    'novelty_fit',
    'cold_start_fallback',
    'insufficient_evidence',
  ];
  const ordered = order.filter((c) => codes.includes(c));
  const primaryCode = ordered[0] ?? 'insufficient_evidence';
  const primaryReason = `This suggestion ${REASON_TEXT[primaryCode]}.`;
  const supportingReasons = ordered.slice(1, 4).map((c) => `It also ${REASON_TEXT[c]}.`);

  const limitations: string[] = ['Behavioral inference only — not health, dietary, or clinical guidance; shadow output, not shown to users.'];
  if (decision.confidence < 0.4) limitations.push('Low-confidence read; the profile is still forming.');
  if (decision.warnings.length) limitations.push('Some candidate details were missing, lowering confidence.');

  // safety: assert every produced string is safe (no creepy/medical/protected/manipulative phrasing).
  assertSafeWhy(primaryReason);
  for (const s of supportingReasons) assertSafeWhy(s);

  return { primaryReason, supportingReasons, limitations, reasonCodes: codes };
}
