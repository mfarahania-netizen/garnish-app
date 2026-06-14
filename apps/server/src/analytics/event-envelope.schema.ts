/**
 * Canonical Event Envelope — code contract (E43-W6).
 *
 * Implements the design of record in `docs/adr/ADR-0001-canonical-event-envelope.md`
 * (Constitution Part 4 + Amendment A1.4). This is the typed, testable shape every layer
 * (BIP, AI logs, recommendation, notification, WAT, GDPR export/erasure, analytics ingest)
 * reads/writes going forward.
 *
 * Design notes:
 * - Zero external dependency (no zod/joi). Dependency choices are an EL/Founder call; this
 *   mirrors the zero-dep approach already used for `config/env.validation.ts`.
 * - ADDITIVE & backward-tolerant (ADR §14): unknown input fields are ignored; missing
 *   optional fields with a documented default are filled in. It does NOT change the database
 *   or ingestion — adopting it requires a separate additive, nullable migration (ADR §9).
 * - `schemaVersion` for this contract is 2 (ADR §3).
 */

import { randomUUID } from 'node:crypto';

/* ────────────────────────────── Enums ────────────────────────────── */
// Exported as frozen `as const` maps (idiomatic, hyphen-safe values) + derived union types.

export const ActorTypeEnum = {
  user: 'user',
  system: 'system',
  agent: 'agent',
  admin: 'admin',
} as const;
export type ActorType = (typeof ActorTypeEnum)[keyof typeof ActorTypeEnum];

export const SourceEnum = {
  webPwa: 'web-pwa',
  server: 'server',
  cron: 'cron',
  opsWorkflow: 'ops-workflow',
} as const;
export type Source = (typeof SourceEnum)[keyof typeof SourceEnum];

/**
 * E43-A1 alias: the ADR/contract names this concept `EventSource`. Kept as an alias of `SourceEnum`
 * (not a rename) so existing imports of `SourceEnum` keep working — additive, backward-compatible.
 */
export const EventSourceEnum = SourceEnum;
export type EventSource = Source;

export const VisibilityEnum = {
  private: 'private',
  circle: 'circle',
  public: 'public',
} as const;
export type Visibility = (typeof VisibilityEnum)[keyof typeof VisibilityEnum];

export const ConsentPurposeEnum = {
  core: 'core',
  analytics: 'analytics',
  personalization: 'personalization',
  b2bAggregate: 'b2b_aggregate',
  community: 'community',
} as const;
export type ConsentPurpose = (typeof ConsentPurposeEnum)[keyof typeof ConsentPurposeEnum];

export const PrivacyClassEnum = {
  p0Public: 'P0-public',
  p1Pseudonymous: 'P1-pseudonymous',
  p2Sensitive: 'P2-sensitive',
} as const;
export type PrivacyClass = (typeof PrivacyClassEnum)[keyof typeof PrivacyClassEnum];

export const RetentionPolicyEnum = {
  standard365d: 'standard-365d',
  auditLong: 'audit-long',
  ephemeral30d: 'ephemeral-30d',
} as const;
export type RetentionPolicy = (typeof RetentionPolicyEnum)[keyof typeof RetentionPolicyEnum];

const valuesOf = <T extends Record<string, string>>(e: T): string[] => Object.values(e);

/* ───────────────────────── Canonical type ───────────────────────── */

export interface CanonicalEventEnvelope {
  /** UUIDv7 preferred; time-ordered idempotency key. Required, non-empty. */
  eventId: string;
  /** snake_case taxonomy type (event-taxonomy.ts stays the source of truth). Required. */
  eventType: string;
  actorType: ActorType;
  /** for agent = `ops:<workflowId>`, for system = service name. Required. */
  actorId: string;
  /** "about whom" — basis of GDPR erasure. Optional, but paired with subjectId when present. */
  subjectType?: string;
  subjectId?: string;
  /** target object: recipe/plan/list/notif/post/submission… Optional, paired with objectId. */
  objectType?: string;
  objectId?: string;
  /** small structured slot: { meal?, slot?, circleId?, experimentArm? }. */
  context?: Record<string, unknown>;
  source: Source;
  /** product surface (home/chat/cook_mode/…). Required when source is `web-pwa`. */
  surface?: string;
  /** default `private`; `circle`/`public` are C1+ only. */
  visibility: Visibility;
  /** must be a subset of the user's active consents at ingest (enforced downstream). Required. */
  consentPurpose: ConsentPurpose;
  /** positive integer; this contract = 2. Required. */
  schemaVersion: number;
  /** client time (ISO 8601). Required. */
  occurredAt: string;
  /** server time (ISO 8601). Required. */
  receivedAt: string;
  /** free, but MUST be PII-free (see assertNoPIIInMetadata). */
  metadata?: Record<string, unknown>;
  /** default `P1-pseudonymous`. */
  privacyClass: PrivacyClass;
  /** default `standard-365d`. */
  retentionPolicy: RetentionPolicy;
}

/* ──────────────────────── Schema descriptor ─────────────────────── */
/**
 * Machine-readable description of the contract (for docs/introspection and used by the
 * validator). Defaults here are applied to missing optional fields (ADR §14).
 */
export const CanonicalEventEnvelopeSchema = {
  schemaVersion: 2,
  backwardTolerant: true, // unknown input fields are ignored
  fields: {
    eventId: { required: true, type: 'string' },
    eventType: { required: true, type: 'string' },
    actorType: { required: true, enum: valuesOf(ActorTypeEnum) },
    actorId: { required: true, type: 'string' },
    subjectType: { required: false, type: 'string', pairedWith: 'subjectId' },
    subjectId: { required: false, type: 'string', pairedWith: 'subjectType' },
    objectType: { required: false, type: 'string', pairedWith: 'objectId' },
    objectId: { required: false, type: 'string', pairedWith: 'objectType' },
    context: { required: false, type: 'object' },
    source: { required: true, enum: valuesOf(SourceEnum) },
    surface: { required: false, type: 'string', requiredWhenSource: [SourceEnum.webPwa] },
    visibility: { required: false, enum: valuesOf(VisibilityEnum), default: VisibilityEnum.private },
    consentPurpose: { required: true, enum: valuesOf(ConsentPurposeEnum) },
    schemaVersion: { required: true, type: 'positiveInteger' },
    occurredAt: { required: true, type: 'isoTimestamp' },
    receivedAt: { required: true, type: 'isoTimestamp' },
    metadata: { required: false, type: 'object', piiFree: true },
    privacyClass: { required: false, enum: valuesOf(PrivacyClassEnum), default: PrivacyClassEnum.p1Pseudonymous },
    retentionPolicy: { required: false, enum: valuesOf(RetentionPolicyEnum), default: RetentionPolicyEnum.standard365d },
  },
} as const;

/* ─────────────────────────── Validation ─────────────────────────── */

export interface EnvelopeValidationIssue {
  path: string;
  message: string;
}

export interface EnvelopeValidationResult {
  /**
   * E43-A1 canonical result flag. `ok === valid`; both are emitted so the contract matches the
   * documented `{ ok, value, errors, warnings }` shape while `valid` stays for existing callers.
   */
  ok: boolean;
  /** backward-compatible alias of `ok` (E43-W6 callers/tests use this). */
  valid: boolean;
  /** normalized envelope (defaults applied, known fields only) when ok; otherwise null. */
  value: CanonicalEventEnvelope | null;
  errors: EnvelopeValidationIssue[];
  /** non-fatal advisories (e.g. schemaVersion drift, inferred legacy fields). Empty on a clean v2. */
  warnings: EnvelopeValidationIssue[];
}

export interface ValidateOptions {
  /** metadata keys to exempt from the PII key-denylist (normalized, case-insensitive). */
  metadataAllowlist?: string[];
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isPositiveInteger = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;
// ISO-8601-ish: must look like a date-time string AND parse to a real instant.
const ISO_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;
const isIsoTimestamp = (v: unknown): v is string =>
  typeof v === 'string' && ISO_RE.test(v.trim()) && !Number.isNaN(Date.parse(v));

/**
 * Validate an unknown input against the canonical envelope contract.
 * Backward-tolerant: ignores unknown fields, fills documented defaults. Never throws —
 * returns a result with collected errors. Does NOT make invalid new events pass.
 */
export function validateEventEnvelope(
  input: unknown,
  options: ValidateOptions = {},
): EnvelopeValidationResult {
  const errors: EnvelopeValidationIssue[] = [];
  const warnings: EnvelopeValidationIssue[] = [];
  const add = (path: string, message: string) => errors.push({ path, message });
  const warn = (path: string, message: string) => warnings.push({ path, message });

  if (!isPlainObject(input)) {
    return {
      ok: false,
      valid: false,
      value: null,
      errors: [{ path: '(root)', message: 'envelope must be a JSON object' }],
      warnings: [],
    };
  }
  const e = input as Record<string, unknown>;

  // ── Required string identity fields ──
  if (!isNonEmptyString(e.eventId)) add('eventId', 'required non-empty string');
  if (!isNonEmptyString(e.eventType)) add('eventType', 'required non-empty string (taxonomy snake_case)');
  if (!isNonEmptyString(e.actorId)) add('actorId', 'required non-empty string');

  // ── Required enums ──
  if (!valuesOf(ActorTypeEnum).includes(e.actorType as string)) {
    add('actorType', `must be one of ${valuesOf(ActorTypeEnum).join(' | ')}`);
  }
  if (!valuesOf(SourceEnum).includes(e.source as string)) {
    add('source', `must be one of ${valuesOf(SourceEnum).join(' | ')}`);
  }
  if (!valuesOf(ConsentPurposeEnum).includes(e.consentPurpose as string)) {
    // consentPurpose has NO default — missing/invalid is an error.
    add('consentPurpose', `required; must be one of ${valuesOf(ConsentPurposeEnum).join(' | ')}`);
  }

  // ── schemaVersion ──
  if (!isPositiveInteger(e.schemaVersion)) {
    add('schemaVersion', 'required positive integer');
  } else if (e.schemaVersion !== CanonicalEventEnvelopeSchema.schemaVersion) {
    // Backward-tolerant (ADR §14): a different positive version is accepted but flagged.
    warn('schemaVersion', `schemaVersion ${e.schemaVersion} differs from current ${CanonicalEventEnvelopeSchema.schemaVersion} (backward-tolerant)`);
  }

  // ── Timestamps ──
  if (!isIsoTimestamp(e.occurredAt)) add('occurredAt', 'required ISO-8601 timestamp');
  if (!isIsoTimestamp(e.receivedAt)) add('receivedAt', 'required ISO-8601 timestamp');

  // ── Paired optional pairs (subject / object): both or neither ──
  const pairCheck = (a: string, b: string) => {
    const hasA = e[a] !== undefined && e[a] !== null;
    const hasB = e[b] !== undefined && e[b] !== null;
    if (hasA && !isNonEmptyString(e[a])) add(a, 'must be a non-empty string when present');
    if (hasB && !isNonEmptyString(e[b])) add(b, 'must be a non-empty string when present');
    if (hasA !== hasB) add(`${a}/${b}`, `${a} and ${b} must be provided together`);
  };
  pairCheck('subjectType', 'subjectId');
  pairCheck('objectType', 'objectId');

  // ── surface: required when source is web-pwa, else optional ──
  if (e.source === SourceEnum.webPwa) {
    if (!isNonEmptyString(e.surface)) add('surface', `required when source is "${SourceEnum.webPwa}"`);
  } else if (e.surface !== undefined && e.surface !== null && !isNonEmptyString(e.surface)) {
    add('surface', 'must be a non-empty string when present');
  }

  // ── context: structured JSON object when present ──
  if (e.context !== undefined && e.context !== null && !isPlainObject(e.context)) {
    add('context', 'must be a structured JSON object when present');
  }

  // ── Defaulted enums (validate value when present, else default later) ──
  if (e.visibility !== undefined && e.visibility !== null && !valuesOf(VisibilityEnum).includes(e.visibility as string)) {
    add('visibility', `must be one of ${valuesOf(VisibilityEnum).join(' | ')}`);
  }
  if (e.privacyClass !== undefined && e.privacyClass !== null && !valuesOf(PrivacyClassEnum).includes(e.privacyClass as string)) {
    add('privacyClass', `must be one of ${valuesOf(PrivacyClassEnum).join(' | ')}`);
  }
  if (e.retentionPolicy !== undefined && e.retentionPolicy !== null && !valuesOf(RetentionPolicyEnum).includes(e.retentionPolicy as string)) {
    add('retentionPolicy', `must be one of ${valuesOf(RetentionPolicyEnum).join(' | ')}`);
  }

  // ── metadata: structured JSON + PII-free ──
  if (e.metadata !== undefined && e.metadata !== null) {
    if (!isPlainObject(e.metadata)) {
      add('metadata', 'must be a JSON object when present');
    } else {
      try {
        assertNoPIIInMetadata(e.metadata, { allowlist: options.metadataAllowlist });
      } catch (err) {
        if (err instanceof PIIDetectedError) {
          for (const issue of err.issues) add(issue.path, issue.message);
        } else {
          add('metadata', 'PII check failed');
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, valid: false, value: null, errors, warnings };

  // ── Build normalized value (defaults applied, known fields only) ──
  const value: CanonicalEventEnvelope = {
    eventId: e.eventId as string,
    eventType: e.eventType as string,
    actorType: e.actorType as ActorType,
    actorId: e.actorId as string,
    source: e.source as Source,
    consentPurpose: e.consentPurpose as ConsentPurpose,
    schemaVersion: e.schemaVersion as number,
    occurredAt: e.occurredAt as string,
    receivedAt: e.receivedAt as string,
    visibility: (e.visibility as Visibility) ?? VisibilityEnum.private,
    privacyClass: (e.privacyClass as PrivacyClass) ?? PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: (e.retentionPolicy as RetentionPolicy) ?? RetentionPolicyEnum.standard365d,
  };
  if (isNonEmptyString(e.subjectType)) value.subjectType = e.subjectType;
  if (isNonEmptyString(e.subjectId)) value.subjectId = e.subjectId;
  if (isNonEmptyString(e.objectType)) value.objectType = e.objectType;
  if (isNonEmptyString(e.objectId)) value.objectId = e.objectId;
  if (isNonEmptyString(e.surface)) value.surface = e.surface;
  if (isPlainObject(e.context)) value.context = e.context;
  if (isPlainObject(e.metadata)) value.metadata = e.metadata;

  return { ok: true, valid: true, value, errors: [], warnings };
}

/* ─────────────────────────── PII guard ──────────────────────────── */

export class PIIDetectedError extends Error {
  readonly issues: EnvelopeValidationIssue[];
  constructor(issues: EnvelopeValidationIssue[]) {
    super(`metadata contains PII-like data: ${issues.map((i) => i.path).join(', ')}`);
    this.name = 'PIIDetectedError';
    this.issues = issues;
  }
}

/**
 * Deterministic PII denylist of metadata KEYS (normalized: lowercased, separators stripped).
 * Covers contact info, identity, free-text fields likely to hold personal data, and a few
 * high-risk secrets. No NLP — deterministic guardrails only (ADR §6).
 */
const PII_KEY_DENYLIST: ReadonlySet<string> = new Set([
  // contact
  'email', 'emails', 'mail', 'phone', 'phones', 'phonenumber', 'mobile', 'mobilenumber',
  'tel', 'telephone', 'fax', 'whatsapp',
  // address / location
  'address', 'streetaddress', 'homeaddress', 'fulladdress', 'postalcode', 'zipcode', 'zip',
  'location', 'geo', 'gps', 'coordinates', 'latitude', 'longitude', 'lat', 'lng',
  // identity
  'name', 'fullname', 'firstname', 'lastname', 'surname', 'givenname', 'familyname',
  'displayname', 'username', 'nickname',
  // free user text (high PII risk)
  'messagetext', 'message', 'messagebody', 'rawtext', 'raw', 'freetext', 'text', 'note',
  'notes', 'comment', 'comments', 'content', 'body', 'description', 'bio',
  // sensitive identifiers / secrets
  'dob', 'dateofbirth', 'birthdate', 'birthday', 'ssn', 'socialsecurity', 'nationalid',
  'passport', 'creditcard', 'cardnumber', 'cvv', 'iban', 'ip', 'ipaddress', 'ipaddr',
  'password', 'secret', 'apikey', 'token', 'accesstoken', 'refreshtoken',
]);

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// Phone-like: a string made only of phone glyphs, containing 8–15 digits, AND carrying at least one
// phone-FORMATTING glyph (space / + / ( ) / - / .). The separator requirement is deliberate: a bare
// run of digits with no formatting (e.g. an 8–15 digit order id, token count, or epoch-ms timestamp)
// is an opaque identifier, NOT a phone — flagging those was a false-positive class. Bare unformatted
// mobiles are still caught by the country-specific IRAN_PHONE_EMBEDDED_RE below.
const PHONE_GLYPHS_RE = /^[\d\s+().-]+$/;
const PHONE_SEPARATOR_RE = /[\s+().-]/;
const looksLikePhone = (v: string): boolean => {
  const t = v.trim();
  if (!PHONE_GLYPHS_RE.test(t)) return false;
  if (!PHONE_SEPARATOR_RE.test(t)) return false; // bare digit-runs are ids, not phones
  const digits = (t.match(/\d/g) || []).length;
  return digits >= 8 && digits <= 15;
};

/**
 * E43-A1 — secret/credential VALUE detectors (deterministic, no NLP). These catch credentials and
 * tokens that must never live in event metadata, even under an innocuous key. Mirrors the redaction
 * patterns already used in `ai/logging/ai-call-log.service.ts` and `ai/providers/gemini-model.provider.ts`
 * so the project has one consistent denylist. Each entry: [regex, human reason].
 */
const SECRET_VALUE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{4,}/, 'value looks like a JWT (token)'],
  [/\bBearer\s+[A-Za-z0-9._-]{8,}/i, 'value contains a Bearer token'],
  [/\b(?:sk|pk|AIza|ghp|gho|glpat|xox[baprs])[A-Za-z0-9_-]{8,}\b/, 'value looks like an API key/secret'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'value contains a private-key block'],
  [/\b(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|rediss|mssql|sqlserver):\/\/\S+/i, 'value looks like a database connection string'],
];

// Embedded Iranian mobile (09xxxxxxxxx / +989xxxxxxxxx / 00989xxxxxxxxx) even inside longer text.
// Anchored on a leading 0/+98/0098 so 16+ digit ids and UUID fragments do not match.
const IRAN_PHONE_EMBEDDED_RE = /(?:\+98|0098|0)9\d{9}/;

// Free-form prose heuristic: long AND many whitespace-separated words. Conservative thresholds keep
// structured values (ids, hashes, short labels, slugs) clean while catching dumped user text.
const looksLikeFreeText = (v: string): boolean => {
  const t = v.trim();
  return t.length > 160 && t.split(/\s+/).length >= 16;
};

export interface AssertPIIOptions {
  /** keys (normalized) explicitly permitted even if they collide with the denylist. */
  allowlist?: string[];
}

/**
 * Assert that `metadata` contains no obvious PII. THROWS `PIIDetectedError` (with issue paths)
 * on violation; returns void when clean. Deterministic: a denylisted key, or a value that
 * matches an email / phone pattern, is rejected. null/undefined metadata is a no-op.
 */
export function assertNoPIIInMetadata(metadata: unknown, options: AssertPIIOptions = {}): void {
  const allow = new Set((options.allowlist || []).map(normalizeKey));
  const issues: EnvelopeValidationIssue[] = [];

  const checkValue = (path: string, value: unknown): void => {
    if (typeof value !== 'string') return;
    // Highest-signal first: credentials/secrets must never appear in metadata.
    for (const [re, reason] of SECRET_VALUE_PATTERNS) {
      if (re.test(value)) {
        issues.push({ path, message: reason });
        return;
      }
    }
    if (EMAIL_RE.test(value)) {
      issues.push({ path, message: 'value looks like an email address (PII)' });
    } else if (looksLikePhone(value) || IRAN_PHONE_EMBEDDED_RE.test(value)) {
      issues.push({ path, message: 'value looks like a phone number (PII)' });
    } else if (looksLikeFreeText(value)) {
      issues.push({ path, message: 'value looks like free-form user text (PII risk)' });
    }
  };

  const walk = (node: unknown, path: string): void => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (isPlainObject(node)) {
      for (const [key, val] of Object.entries(node)) {
        const childPath = path ? `${path}.${key}` : key;
        const norm = normalizeKey(key);
        if (PII_KEY_DENYLIST.has(norm) && !allow.has(norm)) {
          issues.push({ path: childPath, message: `key "${key}" is a PII-like field; not allowed in metadata` });
        }
        walk(val, childPath);
      }
      return;
    }
    checkValue(path, node);
  };

  if (metadata === null || metadata === undefined) return;
  walk(metadata, 'metadata');

  if (issues.length > 0) throw new PIIDetectedError(issues);
}

/* ───────────────── Backward-tolerant legacy normalization ───────────────── */

export interface NormalizeLegacyOptions {
  /** receivedAt/occurredAt fallback (ISO 8601) when the legacy row has no timestamp. */
  now?: string;
  /** eventId to use when the legacy row has neither `eventId` nor `id` (else a UUID is generated). */
  eventId?: string;
  /**
   * consentPurpose the caller asserts for this legacy event. The library NEVER fabricates consent
   * silently — if the legacy row has no consentPurpose and none is supplied here, normalization
   * fails with a consentPurpose error (privacy-safe).
   */
  defaultConsentPurpose?: ConsentPurpose;
  /** actorType to assume when absent (default `user`). */
  defaultActorType?: ActorType;
  /** metadata keys to exempt from the PII key-denylist. */
  metadataAllowlist?: string[];
}

export interface LegacyNormalizationResult extends EnvelopeValidationResult {
  /** `canonical` if the input already validated as v2; `legacy` if it was mapped from a legacy shape. */
  normalizedFrom: 'canonical' | 'legacy';
}

const firstString = (...vals: unknown[]): string | undefined => {
  for (const v of vals) if (isNonEmptyString(v)) return v;
  return undefined;
};

/**
 * Map a legacy/loose event shape (e.g. the current `UserEvent` row: `{ type, userId, page,
 * sessionId, timestamp, payload }`) onto a canonical v2 envelope, BEST-EFFORT and backward-tolerant
 * (ADR §9/§14). Every inferred or defaulted field is recorded as a warning. Untrusted legacy
 * `payload` is intentionally NOT copied into `metadata` (it is free-form and likely PII) — it is
 * dropped with a warning; callers map specific structured fields explicitly. Never throws.
 *
 * If the input already validates as canonical v2, it is returned unchanged with `normalizedFrom:
 * 'canonical'` and no warnings.
 */
export function normalizeLegacyEventEnvelope(
  input: unknown,
  options: NormalizeLegacyOptions = {},
): LegacyNormalizationResult {
  // Fast path: already canonical.
  const direct = validateEventEnvelope(input, { metadataAllowlist: options.metadataAllowlist });
  if (direct.ok) return { ...direct, normalizedFrom: 'canonical' };

  if (!isPlainObject(input)) {
    return {
      ok: false,
      valid: false,
      value: null,
      errors: [{ path: '(root)', message: 'legacy event must be a JSON object' }],
      warnings: [],
      normalizedFrom: 'legacy',
    };
  }
  const e = input as Record<string, unknown>;
  const warnings: EnvelopeValidationIssue[] = [];
  const warn = (path: string, message: string) => warnings.push({ path, message });

  const candidate: Record<string, unknown> = {};

  // identity
  candidate.eventId = firstString(e.eventId, e.id);
  if (!candidate.eventId) {
    candidate.eventId = options.eventId ?? randomUUID();
    warn('eventId', 'eventId missing in legacy event — generated');
  }
  candidate.eventType = firstString(e.eventType, e.type);

  // actor
  const actorType = firstString(e.actorType) ?? options.defaultActorType ?? ActorTypeEnum.user;
  if (!isNonEmptyString(e.actorType)) warn('actorType', `actorType inferred as "${actorType}"`);
  candidate.actorType = actorType;
  candidate.actorId = firstString(e.actorId, e.userId);

  // subject defaults to the acting user (basis of erasure) when we have a user id
  if (firstString(e.subjectType, e.subjectId)) {
    candidate.subjectType = e.subjectType;
    candidate.subjectId = e.subjectId;
  } else if (isNonEmptyString(e.userId)) {
    candidate.subjectType = 'user';
    candidate.subjectId = e.userId;
    warn('subjectId', 'subject inferred as the acting user');
  }

  // object passthrough
  if (firstString(e.objectType, e.objectId)) {
    candidate.objectType = e.objectType;
    candidate.objectId = e.objectId;
  }

  // source + surface (page → surface; presence of page implies a web client)
  const source = firstString(e.source) ?? (isNonEmptyString(e.page) ? SourceEnum.webPwa : SourceEnum.server);
  if (!isNonEmptyString(e.source)) warn('source', `source inferred as "${source}"`);
  candidate.source = source;
  const surface = firstString(e.surface, e.page);
  if (surface) candidate.surface = surface;

  // consent — never fabricated silently
  const consent = firstString(e.consentPurpose) ?? options.defaultConsentPurpose;
  if (consent) {
    candidate.consentPurpose = consent;
    if (!isNonEmptyString(e.consentPurpose)) warn('consentPurpose', `consentPurpose defaulted to "${consent}" by caller`);
  } // else: left absent → validation will flag it (privacy-safe; no silent consent)

  // schemaVersion
  if (isPositiveInteger(e.schemaVersion)) {
    candidate.schemaVersion = e.schemaVersion;
  } else {
    candidate.schemaVersion = CanonicalEventEnvelopeSchema.schemaVersion;
    warn('schemaVersion', `schemaVersion defaulted to ${CanonicalEventEnvelopeSchema.schemaVersion}`);
  }

  // timestamps
  const occurred = firstString(e.occurredAt, e.timestamp);
  candidate.occurredAt = occurred ?? options.now;
  if (!isNonEmptyString(e.occurredAt)) warn('occurredAt', 'occurredAt inferred from legacy timestamp/now');
  candidate.receivedAt = firstString(e.receivedAt) ?? options.now ?? (candidate.occurredAt as string | undefined);
  if (!isNonEmptyString(e.receivedAt)) warn('receivedAt', 'receivedAt inferred (server time/now)');

  // structured context passthrough
  if (isPlainObject(e.context)) candidate.context = e.context;
  // metadata: only a structured object is carried; legacy free-form `payload` is dropped (PII risk).
  if (isPlainObject(e.metadata)) candidate.metadata = e.metadata;
  if (e.payload !== undefined && e.payload !== null && candidate.metadata === undefined) {
    warn('payload', 'legacy payload dropped from envelope metadata (untrusted/possible PII) — map explicit fields instead');
  }

  const result = validateEventEnvelope(candidate, { metadataAllowlist: options.metadataAllowlist });
  return {
    ok: result.ok,
    valid: result.ok,
    value: result.value,
    errors: result.errors,
    warnings: [...warnings, ...result.warnings],
    normalizedFrom: 'legacy',
  };
}

/* ─────────────────── Deterministic redaction for artifacts ─────────────────── */

/** Replace any secret/PII substring inside a single string with a stable marker; truncate long text. */
function scrubSecretsFromString(s: string): string {
  let out = s
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[redacted-email]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{4,}(?:\.[A-Za-z0-9_-]+)?/g, '[redacted-jwt]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk|pk|AIza|ghp|gho|glpat|xox[baprs])[A-Za-z0-9_-]{8,}\b/g, '[redacted-key]')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted-private-key]')
    .replace(/\b(?:postgres|postgresql|mysql|mongodb|mongodb\+srv|redis|rediss|mssql|sqlserver):\/\/\S+/gi, '[redacted-conn-string]')
    .replace(/(?:\+98|0098|0)9\d{9}/g, '[redacted-phone]');
  if (out.length > 200) out = `${out.slice(0, 200)}…`;
  return out;
}

/**
 * Produce a deterministic, log/artifact-safe copy of an event (or arbitrary failure input):
 * - values under PII-denylisted keys are replaced with `[redacted-pii-key]`,
 * - every remaining string is scrubbed of secret/credential/PII substrings and truncated,
 * - structure (keys/nesting) is preserved so failure artifacts stay diagnosable.
 * Never throws. Returns `null` for null/undefined input.
 */
export function redactEventEnvelopeForArtifact(input: unknown): unknown {
  // E43-A3 hardening: guard against circular references and pathological nesting so redaction can
  // never stack-overflow / loop. Semantics for normal acyclic, finite inputs are unchanged.
  const seen = new WeakSet<object>();
  const MAX_DEPTH = 12;
  const redact = (node: unknown, depth: number): unknown => {
    if (node === null || node === undefined) return node;
    if (typeof node === 'string') return scrubSecretsFromString(node);
    if (typeof node === 'number' || typeof node === 'boolean') return node;
    if (depth >= MAX_DEPTH) return '[redacted-depth]';
    if (typeof node === 'object') {
      if (seen.has(node as object)) return '[redacted-circular]';
      seen.add(node as object);
    }
    if (Array.isArray(node)) return node.map((v) => redact(v, depth + 1));
    if (isPlainObject(node)) {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(node)) {
        out[key] = PII_KEY_DENYLIST.has(normalizeKey(key)) ? '[redacted-pii-key]' : redact(val, depth + 1);
      }
      return out;
    }
    return '[redacted-unknown]';
  };
  if (input === null || input === undefined) return null;
  return redact(input, 0);
}
