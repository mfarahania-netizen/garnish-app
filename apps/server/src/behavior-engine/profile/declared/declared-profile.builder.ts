/**
 * Declared Profile builder + privacy helpers (GARNISH-PROFILE-L4-05).
 *
 * PURE & deterministic. Builds a DeclaredProfile from declared answers + consent state with the same
 * confidence/recency machinery as the observed graph:
 *  - consent-gated: a dimension whose required consentPurpose is NOT granted is `consent_withheld`
 *    (value null, never exposed) — the engine never builds what consent forbids.
 *  - banded: sensitive numeric-ish dims must carry an allowed BAND value (raw precise values rejected).
 *  - privacy-classed: sensitive dims are P2; the profile's highest class wins.
 *  - recency-aware: declared facts decay by the dimension's half-life (job/household go stale).
 *  - NO medical assessment: health goals are user-declared, framed as guidance only.
 *
 * Plus privacy egress helpers: a PII-safe metadata projection (assertNoPIIInMetadata-clean) and an
 * owner-only read view (sensitive dims omitted for non-owners).
 */
import { assertNoPIIInMetadata } from '../../../analytics/event-envelope.schema';
import { DECLARED_DIMENSIONS, getDeclaredDef } from './declared-dimension-registry';
import {
  DeclaredAnswer,
  DeclaredConsentState,
  DeclaredDimension,
  DeclaredDimensionDef,
  DeclaredGroup,
  DeclaredProfile,
  DeclaredPrivacyClass,
  DECLARED_GROUPS,
} from './declared-profile.types';

const BASE_DECLARED_CONFIDENCE = 0.85;
const STALE_THRESHOLD = 0.4;

function recencyScore(declaredAt: string, halfLifeDays: number, now: Date): number {
  const t = Date.parse(declaredAt);
  if (!Number.isFinite(t)) return 0;
  const ageDays = Math.max(0, (now.getTime() - t) / 86_400_000);
  const score = Math.pow(0.5, ageDays / Math.max(1, halfLifeDays));
  return Math.min(1, Math.max(0, score));
}

/** Validate a single declared answer against its def. Returns the (possibly normalized) value or rejects. */
export function validateDeclaredAnswer(def: DeclaredDimensionDef, value: unknown): { ok: boolean; reason?: string; value?: unknown } {
  if (value == null) return { ok: false, reason: 'empty value' };
  // band / precise-value guard: storeAsBand dims must be an allowed band token, never a raw number
  if (def.storeAsBand) {
    if (typeof value === 'number') return { ok: false, reason: 'precise numeric not allowed; use a band token' };
    if (def.options && !def.options.includes(String(value))) return { ok: false, reason: 'value not an allowed band' };
    return { ok: true, value: String(value) };
  }
  if (def.valueType === 'single_select' || def.valueType === 'scale') {
    if (def.options && !def.options.includes(String(value))) return { ok: false, reason: 'value not in allowed options' };
    return { ok: true, value: String(value) };
  }
  if (def.valueType === 'multi_select') {
    const arr = Array.isArray(value) ? value.map(String) : [String(value)];
    if (def.options) {
      const bad = arr.filter((v) => !def.options!.includes(v));
      if (bad.length) return { ok: false, reason: `values not allowed: ${bad.join(',')}` };
    }
    return { ok: true, value: arr };
  }
  if (def.valueType === 'boolean') {
    if (typeof value !== 'boolean') return { ok: false, reason: 'expected boolean' };
    return { ok: true, value };
  }
  return { ok: true, value };
}

export interface BuildDeclaredOpts {
  now?: Date;
}

export function buildDeclaredProfile(
  userId: string,
  answers: DeclaredAnswer[],
  consent: DeclaredConsentState,
  opts: BuildDeclaredOpts = {},
): DeclaredProfile {
  const now = opts.now ?? new Date();
  const granted = new Set(consent.granted);
  const answerByKey = new Map(answers.map((a) => [a.key, a]));
  const dimensions: Record<string, DeclaredDimension> = {};
  const limitations: string[] = [];

  let anyP2 = false;
  const consentPurposesUsed = new Set<string>();
  const byGroup: Record<DeclaredGroup, number> = { context: 0, dietary: 0, goals: 0, history: 0, constraints: 0 };
  let declaredCount = 0;
  let consentEligibleCount = 0;

  for (const d of DECLARED_DIMENSIONS) {
    const consentGranted = granted.has(d.consentPurpose);
    if (consentGranted) consentEligibleCount += 1;
    const ans = answerByKey.get(d.key);

    let status: DeclaredDimension['status'] = 'unknown';
    let value: unknown | null = null;
    let confidence = 0;
    let rec = 0;
    let declaredAt: string | null = null;

    if (!consentGranted) {
      status = 'consent_withheld';
    } else if (ans) {
      const v = validateDeclaredAnswer(d, ans.value);
      if (v.ok) {
        value = v.value ?? null;
        declaredAt = ans.declaredAt;
        rec = recencyScore(ans.declaredAt, d.recencyHalfLifeDays, now);
        confidence = Math.min(1, BASE_DECLARED_CONFIDENCE * rec + 0.1 * (rec > 0 ? 1 : 0));
        status = rec < STALE_THRESHOLD ? 'stale' : 'declared';
        declaredCount += 1;
        byGroup[d.group] += 1;
        consentPurposesUsed.add(d.consentPurpose);
        if (d.privacyClass === 'P2-sensitive') anyP2 = true;
      } else {
        limitations.push(`rejected answer for ${d.key}: ${v.reason}`);
      }
    }

    dimensions[d.key] = {
      key: d.key,
      group: d.group,
      status,
      value,
      confidence: Number(confidence.toFixed(3)),
      recencyScore: Number(rec.toFixed(3)),
      privacyClass: d.privacyClass,
      consentPurpose: d.consentPurpose,
      consentGranted,
      sensitive: d.sensitive,
      declaredAt,
      // explanation only when actually declared (never leak a template for unknown/withheld)
      safeExplanation: status === 'declared' || status === 'stale' ? d.safeExplanationTemplate : '',
      limitations: status === 'consent_withheld' ? ['not built — consent for this purpose was not granted'] : status === 'unknown' ? ['not yet declared'] : status === 'stale' ? ['declared a while ago — may be outdated'] : [],
    };
  }

  const coverageScore = consentEligibleCount > 0 ? declaredCount / consentEligibleCount : 0;

  return {
    userId,
    version: 1,
    generatedAt: now.toISOString(),
    dimensions,
    coverage: {
      declaredCount,
      totalCount: DECLARED_DIMENSIONS.length,
      coverageScore: Number(coverageScore.toFixed(3)),
      byGroup,
    },
    privacy: {
      highestPrivacyClass: anyP2 ? 'P2-sensitive' : 'P1-pseudonymous',
      consentPurposesUsed: [...consentPurposesUsed].sort(),
      containsSensitive: anyP2,
    },
    limitations,
  };
}

/* ───────────────────────── Privacy egress helpers ───────────────────────── */

/**
 * PII-SAFE metadata projection: ONLY non-sensitive dimension keys + their banded/category values, with
 * raw values never included for sensitive dims. The result is asserted against assertNoPIIInMetadata
 * (throws on any detected PII) so a declared profile can never leak into event metadata.
 */
export function projectDeclaredForMetadata(profile: DeclaredProfile): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const dim of Object.values(profile.dimensions)) {
    if (dim.sensitive) continue; // sensitive values NEVER go to metadata
    if (dim.status !== 'declared' && dim.status !== 'stale') continue;
    safe[dim.key] = dim.value;
  }
  const metadata = { declaredCoverage: profile.coverage.coverageScore, dims: safe };
  assertNoPIIInMetadata(metadata); // throws PIIDetectedError on any leak
  return metadata;
}

/**
 * Owner-only read view. For the owner: full profile. For a non-owner (must never happen in practice —
 * defense in depth): sensitive dimensions are omitted entirely (value + explanation stripped).
 */
export function ownerReadView(profile: DeclaredProfile, isOwner: boolean): DeclaredProfile {
  if (isOwner) return profile;
  const dimensions: Record<string, DeclaredDimension> = {};
  for (const [k, dim] of Object.entries(profile.dimensions)) {
    if (dim.sensitive) {
      dimensions[k] = { ...dim, value: null, safeExplanation: '', limitations: ['omitted: sensitive, non-owner read'] };
    } else {
      dimensions[k] = dim;
    }
  }
  return { ...profile, dimensions, privacy: { ...profile.privacy, containsSensitive: false } };
}
