/**
 * Recommendation shadow trace redaction (E18/E43-A7).
 *
 * Projects an A6 ShadowRuntimeResult into the ONLY shape ever persisted: a minimized trace of fingerprints
 * + overlap metrics + divergence reason codes + counts + readiness/safety status. Strips everything else.
 * Pure; never throws. A defensive scrubber guarantees no PII/secret/medical-protected string survives.
 */

import { ShadowRuntimeResult } from './recommendation-shadow-runtime.types';
import { RedactedRecommendationShadowTrace } from './recommendation-shadow-input-provider.types';

const UNSAFE_VALUE_PATTERNS: readonly RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, // email
  /\b(?:\+?98|0)9\d{9}\b/, // phone
  /\beyJ[A-Za-z0-9._-]{10,}/, // JWT
  /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
  /\bAIza[A-Za-z0-9_-]{8,}/,
  /\bsk-[A-Za-z0-9_-]{8,}/,
  /BEGIN (?:RSA |EC )?PRIVATE KEY/,
  /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\//i,
  /\b(diagnosis|diagnose[ds]?|diagnosing|pregnan\w+|eating disorder|mental health|medical condition|ethnicity|sexual\w*)\b/i,
];

/** True if a string is free of PII/secret/medical-protected content. */
export function isCleanTraceValue(s: unknown): boolean {
  if (typeof s !== 'string') return true;
  return !UNSAFE_VALUE_PATTERNS.some((re) => re.test(s));
}

/** Drop a string field that would carry unsafe content (returns undefined instead of leaking). */
function safeStr(s: string | undefined): string | undefined {
  if (typeof s !== 'string' || s.length === 0) return undefined;
  return isCleanTraceValue(s) ? s : undefined;
}

export interface RedactTraceMeta {
  userId?: string;
  requestId?: string;
  experimentKey?: string;
  decisionId?: string;
  readinessStatus?: string;
  generatedAt: string;
}

export function redactRecommendationShadowTrace(
  result: ShadowRuntimeResult,
  meta: RedactTraceMeta,
): RedactedRecommendationShadowTrace {
  const div = result?.divergence ?? { topKOverlap: 0, rankShiftCount: 0, majorDivergence: false, reasons: [] };
  const diag = result?.diagnostics ?? { decisionTraceAvailable: false, explanationCount: 0, unsafeExplanationCount: 0, weakConfidenceCount: 0 };
  const readinessStatus = meta.readinessStatus || result?.readiness?.status || 'unknown';

  const trace: RedactedRecommendationShadowTrace = {
    decisionId: safeStr(meta.decisionId),
    userId: safeStr(meta.userId),
    requestId: safeStr(meta.requestId),
    experimentKey: safeStr(meta.experimentKey),
    liveFingerprint: safeStr(result?.liveRankingFingerprint) ?? '',
    shadowFingerprint: safeStr(result?.shadowRankingFingerprint) ?? '',
    topKOverlap: Number.isFinite(div.topKOverlap) ? div.topKOverlap : null,
    rankShiftCount: Number.isFinite(div.rankShiftCount) ? div.rankShiftCount : null,
    majorDivergence: !!div.majorDivergence,
    // reason codes are a closed enum — safe by construction; filtered defensively anyway.
    reasonCodes: (div.reasons ?? []).filter((r) => typeof r === 'string' && isCleanTraceValue(r)),
    summary: {
      liveCandidateCount: result?.liveCandidateCount ?? 0,
      shadowCandidateCount: result?.shadowCandidateCount ?? 0,
      weakConfidenceCount: diag.weakConfidenceCount ?? 0,
      unsafeExplanationCount: diag.unsafeExplanationCount ?? 0,
      readinessStatus,
      safetyAllowed: !!result?.safety?.allowed,
    },
    readinessStatus,
    safetyAllowed: !!result?.safety?.allowed,
    generatedAt: meta.generatedAt,
    productUseEnabled: false,
    version: 1,
  };
  return trace;
}

/** Final guard: true if the entire redacted trace serializes with no unsafe value. */
export function isRedactedTraceClean(trace: RedactedRecommendationShadowTrace): boolean {
  let json = '';
  try { json = JSON.stringify(trace); } catch { return false; }
  return isCleanTraceValue(json);
}
