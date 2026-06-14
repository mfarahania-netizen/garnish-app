/**
 * Recommendation shadow safety gate (E18/E43-A6).
 *
 * A PURE, deterministic gate that decides whether shadow collection is allowed for a request, and what
 * must be redacted. It blocks (disables shadow collection) — it NEVER blocks or alters the live request.
 * When it blocks, the live ranking proceeds normally and the shadow result simply reports `blocked`.
 *
 * Blocks on: missing/incompatible consent, raw recipe body / raw user text / raw AI prompt-or-output /
 * PII / medical-or-protected label in candidate payloads, unsafe why explanations, invalid sample rate /
 * mode, or any sensitive value that would land in a trace.
 */

import { isSafeWhy } from '../intelligence/recommendation-why-engine';
import {
  ShadowSafetyInput,
  ShadowSafetyResult,
  ShadowSafetyBlockCode,
} from './recommendation-shadow-runtime.types';

/** Length beyond which a candidate text field is classified as a raw recipe body / free-text leak. */
const RAW_BODY_LEN = 280;

/** Deterministic PII / secret value detectors (no raw value is ever surfaced; we only flag presence). */
const PII_SECRET_PATTERNS: readonly RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // email
  /\b(?:\+?98|0)9\d{9}\b/, // Iranian mobile
  /\beyJ[A-Za-z0-9._-]{10,}/, // JWT
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i, // bearer token
  /\bAIza[A-Za-z0-9_-]{8,}/, // Google API key
  /\bsk-[A-Za-z0-9_-]{8,}/, // OpenAI-style key
  /BEGIN (?:RSA |EC )?PRIVATE KEY/, // private key
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\//i, // db connection string
];

/** Medical / protected-attribute inference terms that must never label a user. */
const MEDICAL_PROTECTED_PATTERNS: readonly RegExp[] = [
  /\b(diagnosis|diagnose[ds]?|diagnosing|treatment|disease|pregnan\w+|eating disorder|mental health|medical condition)\b/i,
  /\b(religion|ethnicity|race|political|sexual\w*|criminal)\b/i,
  /تشخیص|درمان|بارداری|اختلال خوردن|مذهب|قومیت|سیاسی|سلامت روان/,
];

/** Free-text fields on a candidate that callers MUST NOT populate with raw bodies / user text. */
const FREE_TEXT_KEYS = ['rawBody', 'body', 'instructions', 'description', 'userText', 'notes', 'prompt', 'aiOutput', 'aiPrompt'];

function hasPiiOrSecret(s: string): boolean {
  return PII_SECRET_PATTERNS.some((re) => re.test(s));
}
function hasMedicalProtected(s: string): boolean {
  return MEDICAL_PROTECTED_PATTERNS.some((re) => re.test(s));
}

/** Scan a candidate object for unsafe content; pushes block codes (deterministic order). */
function scanCandidates(candidates: ShadowSafetyInput['candidates'], add: (c: ShadowSafetyBlockCode) => void): void {
  if (!Array.isArray(candidates)) return;
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const obj = c as unknown as Record<string, unknown>;

    // explicit free-text / raw-body / prompt fields must not be present at all
    for (const key of FREE_TEXT_KEYS) {
      const v = obj[key];
      if (typeof v === 'string' && v.length > 0) {
        if (key === 'prompt' || key === 'aiOutput' || key === 'aiPrompt') add('raw_ai_prompt_or_output');
        else if (key === 'userText' || key === 'notes') add('raw_user_text');
        else add('raw_recipe_body');
      }
    }

    // any string field: long text → raw body; PII/secret → pii; medical/protected → protected label
    for (const v of Object.values(obj)) {
      if (typeof v !== 'string') continue;
      if (v.length > RAW_BODY_LEN) add('raw_recipe_body');
      if (hasPiiOrSecret(v)) add('pii_detected');
      if (hasMedicalProtected(v)) add('medical_or_protected_label');
    }
    // tag arrays
    for (const arr of [c.cuisineTags, c.ingredientTags, c.noveltyTags, c.safetyFlags]) {
      if (!Array.isArray(arr)) continue;
      for (const t of arr) {
        if (typeof t !== 'string') continue;
        if (hasPiiOrSecret(t)) add('pii_detected');
        if (hasMedicalProtected(t)) add('medical_or_protected_label');
        if (t.length > RAW_BODY_LEN) add('raw_recipe_body');
      }
    }
  }
}

/**
 * Evaluate whether shadow collection is allowed. Pure; never throws.
 */
export function evaluateRecommendationShadowSafety(input: ShadowSafetyInput): ShadowSafetyResult {
  const blocked = new Set<ShadowSafetyBlockCode>();
  const add = (c: ShadowSafetyBlockCode) => blocked.add(c);

  try {
    const { config, consent } = input;

    // mode / sample-rate validity
    if (config?.mode !== 'off' && config?.mode !== 'shadow') add('invalid_mode');
    const sr = config?.sampleRate;
    if (typeof sr !== 'number' || !Number.isFinite(sr) || sr < 0 || sr > 1) add('invalid_sample_rate');

    // consent: behavioral analytics consent is REQUIRED for any shadow collection
    if (!consent || consent.behavioralAnalytics !== true) add('consent_missing');
    // incompatible: caller explicitly forbids personalization AND we somehow were asked to product-use
    // (defense-in-depth — A6 never personalizes, but a false personalization flag is incompatible intent)
    if (consent && consent.personalization === false && (input as { requireProductUse?: boolean }).requireProductUse === true) {
      add('consent_incompatible');
    }

    // candidate payload scan
    scanCandidates(input.candidates, add);

    // trace scan: unsafe why + sensitive values
    const trace = input.trace;
    if (trace) {
      for (const cand of trace.candidates ?? []) {
        const why = cand.why;
        if (!why) continue;
        if (!isSafeWhy(why.primaryReason || '')) add('unsafe_why_explanation');
        if ((why.supportingReasons || []).some((s) => !isSafeWhy(s))) add('unsafe_why_explanation');
        if ((why.limitations || []).some((l) => !isSafeWhy(l))) add('unsafe_why_explanation');
      }
      const serialized = safeStringify(trace);
      if (hasPiiOrSecret(serialized)) add('sensitive_value_in_trace');
      if (hasMedicalProtected(serialized)) add('medical_or_protected_label');
    }
  } catch {
    // a safety-gate fault must fail CLOSED (disable shadow), never throw into the live request.
    blocked.add('invalid_mode');
  }

  const blockedReasonCodes = [...blocked].sort();
  return {
    allowed: blockedReasonCodes.length === 0,
    blockedReasonCodes,
    redactionApplied: true,
    productUseEnabled: false,
  };
}

/** JSON.stringify that tolerates circular refs (returns what it can). */
function safeStringify(value: unknown): string {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (_k, v) => {
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
      }
      return v;
    }) ?? '';
  } catch {
    return '';
  }
}
