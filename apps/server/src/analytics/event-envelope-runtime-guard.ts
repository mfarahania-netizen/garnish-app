/**
 * Event Envelope Runtime Guard (E43-A2).
 *
 * A SAFE SHADOW LAYER that runtime producer code can call to validate/normalize an event against the
 * Canonical Event Envelope contract WITHOUT breaking the current flow. It is pure and side-effect-free:
 *   - no DB write, no network, never throws on normal invalid input;
 *   - it returns a structured verdict + a redacted, log-safe copy of the input.
 *
 * Modes:
 *   off    — returns allowed:true, status 'skipped'; no deep validation (zero overhead path).
 *   shadow — validates / attempts legacy normalization; reports warnings+errors; NEVER blocks the
 *            current flow (allowed stays true). Logs/artifacts must use `redactedEvent`. This is the
 *            observation mode for staged producer migration.
 *   strict — validates canonical v2; rejects invalid / PII-bearing / unknown-eventType / no-consent
 *            events (allowed:false). Still never throws for normal invalid input.
 *
 * The "do not block unless a catastrophic secret/PII leak would be newly introduced" rule is honored
 * conservatively: shadow ALWAYS returns a redacted copy and never surfaces raw input, so there is no
 * leak path that requires blocking — shadow therefore never blocks.
 */

import {
  CanonicalEventEnvelope,
  EnvelopeValidationIssue,
  validateEventEnvelope,
  normalizeLegacyEventEnvelope,
  redactEventEnvelopeForArtifact,
  ConsentPurpose,
  ActorType,
} from './event-envelope.schema';
import { validateEventType } from './event-taxonomy.contract';

export type RuntimeGuardMode = 'off' | 'shadow' | 'strict';

export interface RuntimeGuardOptions {
  mode: RuntimeGuardMode;
  source: string;
  producerId: string;
  redactForLogs?: boolean;
  /** consent the CALLER asserts for legacy normalization; never fabricated by the guard. */
  defaultConsentPurpose?: ConsentPurpose;
  defaultActorType?: ActorType;
  /** deterministic-friendly fallbacks for normalization (tests pass these). */
  now?: string;
  eventId?: string;
  metadataAllowlist?: string[];
}

export interface RuntimeGuardResult {
  allowed: boolean;
  mode: RuntimeGuardMode;
  status: 'accepted' | 'accepted_with_warnings' | 'rejected' | 'skipped';
  canonicalEvent?: CanonicalEventEnvelope;
  redactedEvent?: unknown;
  errors: string[];
  warnings: string[];
  producerId: string;
  source: string;
}

const fmt = (issues: EnvelopeValidationIssue[]): string[] => issues.map((i) => `${i.path}: ${i.message}`);

/** Resolve the runtime guard mode from env (default: shadow). Used by integration call sites. */
export function resolveRuntimeGuardMode(env: NodeJS.ProcessEnv = process.env): RuntimeGuardMode {
  const raw = (env.EVENT_ENVELOPE_RUNTIME_GUARD_MODE || '').toLowerCase().trim();
  if (raw === 'off' || raw === 'shadow' || raw === 'strict') return raw;
  return 'shadow';
}

/**
 * Validate/normalize an event for a runtime producer path. Pure; never throws for normal bad input.
 */
export function guardEventForRuntime(input: unknown, options: RuntimeGuardOptions): RuntimeGuardResult {
  const { mode, source, producerId } = options;
  const redactForLogs = options.redactForLogs !== false; // default true
  const base = { mode, producerId, source };

  // ── off: zero-overhead skip ──
  if (mode === 'off') {
    return { allowed: true, status: 'skipped', errors: [], warnings: [], ...base };
  }

  // Defensive: the guard must NEVER throw and break a producer. Wrap everything.
  try {
    const redactedEvent = redactForLogs ? redactEventEnvelopeForArtifact(input) : undefined;
    const eventType = typeof (input as any)?.eventType === 'string' ? (input as any).eventType : '';

    // eventType taxonomy check (mode-aware).
    const etResult = validateEventType(eventType, { mode: mode === 'strict' ? 'strict' : 'shadow' });
    const warnings: string[] = etResult.warnings.map((w) => `eventType: ${w}`);
    const errors: string[] = etResult.errors.map((e) => `eventType: ${e}`);

    const canonical = validateEventEnvelope(input, { metadataAllowlist: options.metadataAllowlist });

    if (mode === 'strict') {
      if (canonical.ok && etResult.ok) {
        warnings.push(...fmt(canonical.warnings));
        return {
          allowed: true,
          status: warnings.length ? 'accepted_with_warnings' : 'accepted',
          canonicalEvent: canonical.value!,
          redactedEvent,
          errors,
          warnings,
          ...base,
        };
      }
      // strict rejects: surface canonical + taxonomy errors (no silent consent — handled by validate).
      errors.push(...fmt(canonical.errors));
      warnings.push(...fmt(canonical.warnings));
      return { allowed: false, status: 'rejected', redactedEvent, errors, warnings, ...base };
    }

    // ── shadow: observe, never block ──
    if (canonical.ok) {
      warnings.push(...fmt(canonical.warnings));
      return {
        allowed: true,
        status: warnings.length ? 'accepted_with_warnings' : 'accepted',
        canonicalEvent: canonical.value!,
        redactedEvent,
        errors,
        warnings,
        ...base,
      };
    }
    // try backward-tolerant legacy normalization (caller may supply a consent default; never fabricated)
    const normalized = normalizeLegacyEventEnvelope(input, {
      defaultConsentPurpose: options.defaultConsentPurpose,
      defaultActorType: options.defaultActorType,
      now: options.now,
      eventId: options.eventId,
      metadataAllowlist: options.metadataAllowlist,
    });
    if (normalized.ok) {
      warnings.push(...fmt(normalized.warnings));
      return {
        allowed: true,
        status: 'accepted_with_warnings',
        canonicalEvent: normalized.value!,
        redactedEvent,
        errors,
        warnings,
        ...base,
      };
    }
    // could not validate or normalize — shadow STILL does not block; record what strict would reject.
    errors.push(...fmt(normalized.errors.length ? normalized.errors : canonical.errors));
    warnings.push(...fmt(normalized.warnings));
    return { allowed: true, status: 'accepted_with_warnings', redactedEvent, errors, warnings, ...base };
  } catch {
    // A guard fault must never break the producer flow. In shadow allow; in strict, fail-closed-safe
    // by rejecting WITHOUT throwing (the caller decides whether to act on `allowed`).
    return {
      allowed: mode !== 'strict',
      status: mode === 'strict' ? 'rejected' : 'accepted_with_warnings',
      redactedEvent: undefined,
      errors: ['runtime guard internal error (handled; no throw)'],
      warnings: [],
      ...base,
    };
  }
}
