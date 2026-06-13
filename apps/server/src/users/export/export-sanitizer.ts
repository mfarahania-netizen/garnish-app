/**
 * Reusable export sanitizer (E39-1D).
 *
 * Defence-in-depth for the GDPR data export. Even though the only secret column in the current schema
 * is `User.password` (handled separately by the allow-list `sanitizeUser`), every section row is passed
 * through here so that:
 *   - any secret-ish key (password/hash/token/secret/apiKey/refresh/reset/verification/otp/credential)
 *     is DROPPED — protects against future schema fields and accidental selects;
 *   - oversized strings / JSON blobs are capped so the export can't balloon unboundedly.
 *
 * This is a key-name denylist, intentionally conservative: when in doubt, a field is dropped, not kept.
 */

/** Key-name patterns that must never appear in an export, matched case-insensitively. */
const SECRET_KEY_PATTERNS: RegExp[] = [
  /pass(word|wd)?/i,
  /\bhash\b/i,
  /hashed/i,
  /token(?!s)/i, // secret tokens (token, accessToken, refreshToken) but NOT count fields (estimatedInputTokens)
  /secret/i,
  /api[-_]?key/i,
  /refresh/i,
  /\bjwt\b/i,
  /reset/i,
  /verification/i,
  /\botp\b/i,
  /credential/i,
  /private[-_]?key/i,
  /\bsalt\b/i,
  /signature/i,
];

const MAX_STRING_LEN = 10_000;
const MAX_JSON_LEN = 20_000;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERNS.some((re) => re.test(key));
}

/** Size-cap a (already-sanitized) value: huge serialized objects/arrays are replaced with a preview. */
function capJson(value: unknown): unknown {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return { _unserializable: true };
  }
  if (serialized && serialized.length > MAX_JSON_LEN) {
    return { _truncated: true, _originalLength: serialized.length, preview: serialized.slice(0, MAX_JSON_LEN) };
  }
  return value;
}

/**
 * Recursively sanitize any value: drops secret-ish keys at EVERY nesting depth (so nested rows from
 * Prisma `include` — meal slots, shopping items, ticket replies, recipe ingredients, JSON blobs — are
 * checked too, not just the top-level row), truncates oversized strings, and size-caps large structures.
 * Dates are preserved as-is (not treated as plain objects).
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LEN ? `${value.slice(0, MAX_STRING_LEN)}…[truncated ${value.length - MAX_STRING_LEN} chars]` : value;
  }
  if (Array.isArray(value)) return capJson(value.map((v) => sanitizeValue(v)));
  if (typeof value === 'object') return capJson(sanitizeRecord(value as Record<string, unknown>));
  return value; // number | boolean | bigint
}

/** Sanitize one row: drop secret-ish keys (recursively), cap oversized values. Returns a new object. */
export function sanitizeRecord<T extends Record<string, unknown>>(row: T | null | undefined): Record<string, unknown> | null {
  if (row === null || row === undefined) return null;
  if (typeof row !== 'object' || row instanceof Date || Array.isArray(row)) return row as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (isSecretKey(key)) continue; // dropped — never exported, at any depth
    out[key] = sanitizeValue(value);
  }
  return out;
}

/** Sanitize an array of rows (drops nulls). */
export function sanitizeRecords(rows: Array<Record<string, unknown>> | null | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => sanitizeRecord(r))
    .filter((r): r is Record<string, unknown> => r !== null);
}
