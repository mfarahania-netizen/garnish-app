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
  valid: boolean;
  /** normalized envelope (defaults applied, known fields only) when valid; otherwise null. */
  value: CanonicalEventEnvelope | null;
  errors: EnvelopeValidationIssue[];
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
  const add = (path: string, message: string) => errors.push({ path, message });

  if (!isPlainObject(input)) {
    return { valid: false, value: null, errors: [{ path: '(root)', message: 'envelope must be a JSON object' }] };
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
  if (!isPositiveInteger(e.schemaVersion)) add('schemaVersion', 'required positive integer');

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

  if (errors.length > 0) return { valid: false, value: null, errors };

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

  return { valid: true, value, errors: [] };
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
// Phone-like: a string made only of phone glyphs that contains 8–15 digits.
const PHONE_GLYPHS_RE = /^[\d\s+().-]+$/;
const looksLikePhone = (v: string): boolean => {
  const t = v.trim();
  if (!PHONE_GLYPHS_RE.test(t)) return false;
  const digits = (t.match(/\d/g) || []).length;
  return digits >= 8 && digits <= 15;
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
    if (typeof value === 'string') {
      if (EMAIL_RE.test(value)) issues.push({ path, message: 'value looks like an email address (PII)' });
      else if (looksLikePhone(value)) issues.push({ path, message: 'value looks like a phone number (PII)' });
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
