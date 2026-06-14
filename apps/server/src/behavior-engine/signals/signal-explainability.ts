/**
 * Signal explainability (E43-A3).
 *
 * Builds short, safe, EVIDENCE-BASED explanations for observations. Explanations are:
 *  - non-creepy (no "we know you are the kind of person who…"),
 *  - non-medical / non-identity (no diagnosis/condition/protected-attribute language),
 *  - non-PII (no raw user/AI text),
 *  - reusable later by recommendations/AI.
 *
 * `assertSafeExplanation` is the guard: it rejects creepy/medical/identity phrasing so an unsafe
 * template can never ship.
 */

import { SignalRegistryEntry } from './signal-types';
import { FORBIDDEN_INFERENCE_TERMS } from './signal-registry';

/** Creepy / identity-claim / medical phrasings that must never appear in a user-facing explanation. */
export const FORBIDDEN_EXPLANATION_PATTERNS: readonly RegExp[] = [
  /\bwe know (you|that you)\b/i,
  /\byou\s+(?:are|seem|appear|look)\s+(?:like\s+)?the\s+(kind|type)\s+of\s+person\b/i,
  /\byou (have|suffer from|are diagnosed)\b.*\b(condition|disorder|disease|illness)\b/i,
  /\byour (medical|health) (condition|status|diagnosis)\b/i,
  /\b(diagnos|treatment|pregnan|eating disorder|mental health|religion|ethnicity|political|sexuality)\b/i,
  /\bwe think you('| a)re\b/i,
];

export interface ExplanationContext {
  evidenceCount: number;
  sourceEventTypes: string[];
  confidence: number;
}

/** True if the text is safe to show (no creepy/medical/identity phrasing, no forbidden terms). */
export function isSafeExplanation(text: string): boolean {
  if (!text || !text.trim()) return false;
  if (FORBIDDEN_EXPLANATION_PATTERNS.some((re) => re.test(text))) return false;
  const lower = text.toLowerCase();
  if (FORBIDDEN_INFERENCE_TERMS.some((t) => lower.includes(t))) return false;
  return true;
}

/** Throws on an unsafe explanation (programmer/template error), so unsafe text can't ship. */
export function assertSafeExplanation(text: string): void {
  if (!isSafeExplanation(text)) {
    throw new Error('unsafe explanation rejected (creepy/medical/identity/forbidden phrasing)');
  }
}

/**
 * Build the observation explanation from the registry template + a short, generic evidence note.
 * Deterministic; never includes raw event content. The result is asserted safe before returning.
 */
export function buildExplanation(entry: SignalRegistryEntry, ctx: ExplanationContext): string {
  const base = entry.explainabilityTemplate.trim();
  const confidenceWord = ctx.confidence >= 0.66 ? 'strong' : ctx.confidence >= 0.33 ? 'moderate' : 'early';
  const evidenceNote =
    ctx.evidenceCount <= 1
      ? 'This is an early, low-confidence read from a single recent action.'
      : `This is a ${confidenceWord} read from ${ctx.evidenceCount} recent actions.`;
  const text = `${base} ${evidenceNote}`;
  assertSafeExplanation(text);
  return text;
}

/**
 * Standard limitations attached to every observation (honesty + non-creepy framing).
 * Deliberately does NOT enumerate raw forbidden-term strings (those live only in the registry guard);
 * the disclaimer stays generic so observations remain scan-clean and safe to surface.
 */
export function buildLimitations(_entry: SignalRegistryEntry): string[] {
  return [
    'Behavioral inference only — not a fact about you, and not health or dietary advice.',
    'Based on in-app actions; may be incomplete or out of date, and it decays over time.',
    'Never used to label you with protected or sensitive attributes.',
  ];
}
