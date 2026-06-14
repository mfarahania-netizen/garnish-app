/**
 * Canonical Event Envelope — ingest gate (E43-A1).
 *
 * A THIN, PURE boundary layer that every future event producer/ingestor can call to turn an unknown
 * input into a trusted `CanonicalEventEnvelope` (or a safe rejection). It is intentionally
 * side-effect-free:
 *   - it performs NO database write,
 *   - it makes NO network call,
 *   - it never throws on normal bad input.
 *
 * Responsibilities:
 *   1. strict validation of canonical v2 envelopes (`validateEventEnvelope`),
 *   2. optional backward-tolerant normalization of legacy event shapes (`normalizeLegacyEventEnvelope`),
 *   3. PII-in-metadata rejection (inherited from the validator),
 *   4. deterministic, log/artifact-safe redaction of the input for failure reporting.
 *
 * ── Integration recommendation (NOT wired in this task) ──
 * Adopting this gate inside a live producer (e.g. `analytics.service.trackEvent`) changes a product
 * ingestion path and is therefore Founder-gated (see the deferred "log-only adoption" step in
 * `docs/execution/E43_EVENT_ENVELOPE_CODE_CONTRACT_REPORT.md`). The recommended rollout is:
 *   Phase 1 (log-only): call `ingestEventEnvelope(input, { strict: false, allowLegacy: true, ... })`,
 *     log `result.warnings`/`result.errors` and `result.redacted` for rejects, but STILL write the
 *     legacy row — observe only, reject nothing.
 *   Phase 2 (additive migration): add nullable envelope columns to `UserEvent`, backfill from
 *     `result.value`.
 *   Phase 3 (enforce): flip `strict: true` once producers emit canonical envelopes.
 * No DB migration is required for E43-A1 itself.
 */

import {
  CanonicalEventEnvelope,
  EnvelopeValidationIssue,
  ActorType,
  ConsentPurpose,
  validateEventEnvelope,
  normalizeLegacyEventEnvelope,
  redactEventEnvelopeForArtifact,
} from './event-envelope.schema';

export type IngestMode = 'canonical' | 'legacy-normalized' | 'rejected';

export interface IngestOptions {
  /** when false, a non-canonical input is NOT rejected outright but routed to legacy normalization. */
  strict?: boolean;
  /** allow backward-tolerant normalization of legacy shapes (default: follows `!strict`). */
  allowLegacy?: boolean;
  /** metadata keys to exempt from the PII key-denylist. */
  metadataAllowlist?: string[];
  /** consentPurpose the caller asserts for a legacy event lacking one (never fabricated silently). */
  defaultConsentPurpose?: ConsentPurpose;
  /** actorType to assume for a legacy event lacking one (default `user`). */
  defaultActorType?: ActorType;
  /** ISO timestamp fallback for legacy events with no timestamp. */
  now?: string;
  /** eventId fallback for legacy events lacking `eventId`/`id`. */
  eventId?: string;
}

export interface IngestResult {
  /** true when a trusted canonical envelope was produced. */
  accepted: boolean;
  mode: IngestMode;
  /** the trusted canonical envelope (defaults applied) when accepted; otherwise null. */
  value: CanonicalEventEnvelope | null;
  /** blocking problems (schema/enum/PII/consent). Empty when accepted. */
  errors: EnvelopeValidationIssue[];
  /** non-fatal advisories (version drift, inferred legacy fields). */
  warnings: EnvelopeValidationIssue[];
  /**
   * deterministic, log/artifact-safe representation of the INPUT — secrets/PII scrubbed. Always
   * populated (so callers can log rejects without leaking). Never contains raw credentials/PII.
   */
  redacted: unknown;
}

/**
 * Run an unknown input through the canonical-envelope ingest boundary.
 *
 * Default behavior is STRICT canonical validation. Pass `{ strict: false }` (or `allowLegacy: true`)
 * to fall back to backward-tolerant legacy normalization. PII in metadata is always rejected.
 */
export function ingestEventEnvelope(input: unknown, options: IngestOptions = {}): IngestResult {
  const strict = options.strict !== false; // default true
  const allowLegacy = options.allowLegacy ?? !strict;
  const redacted = redactEventEnvelopeForArtifact(input);

  // 1) Try strict canonical validation first.
  const v = validateEventEnvelope(input, { metadataAllowlist: options.metadataAllowlist });
  if (v.ok) {
    return {
      accepted: true,
      mode: 'canonical',
      value: v.value,
      errors: [],
      warnings: v.warnings,
      redacted,
    };
  }

  // 2) Optionally fall back to backward-tolerant legacy normalization.
  if (allowLegacy) {
    const n = normalizeLegacyEventEnvelope(input, {
      metadataAllowlist: options.metadataAllowlist,
      defaultConsentPurpose: options.defaultConsentPurpose,
      defaultActorType: options.defaultActorType,
      now: options.now,
      eventId: options.eventId,
    });
    if (n.ok) {
      return {
        accepted: true,
        mode: 'legacy-normalized',
        value: n.value,
        errors: [],
        warnings: n.warnings,
        redacted,
      };
    }
    // legacy path also failed — surface its (richer) errors + warnings.
    return {
      accepted: false,
      mode: 'rejected',
      value: null,
      errors: n.errors,
      warnings: n.warnings,
      redacted,
    };
  }

  // 3) Strict mode, no legacy fallback → reject with the validator's errors.
  return {
    accepted: false,
    mode: 'rejected',
    value: null,
    errors: v.errors,
    warnings: v.warnings,
    redacted,
  };
}
