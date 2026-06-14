import { guardEventForRuntime, resolveRuntimeGuardMode } from './event-envelope-runtime-guard';
import {
  ActorTypeEnum,
  EventSourceEnum,
  ConsentPurposeEnum,
  VisibilityEnum,
  PrivacyClassEnum,
  RetentionPolicyEnum,
} from './event-envelope.schema';

const TIMES = { occurredAt: '2026-06-14T10:00:00.000Z', receivedAt: '2026-06-14T10:00:01.000Z' };

const VALID_CANONICAL = {
  eventId: '0190a000-0000-7000-8000-0000000bb001',
  eventType: 'recipe_view',
  actorType: ActorTypeEnum.user,
  actorId: 'user_1',
  source: EventSourceEnum.webPwa,
  surface: 'home',
  consentPurpose: ConsentPurposeEnum.analytics,
  schemaVersion: 2,
  visibility: VisibilityEnum.private,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
  ...TIMES,
};

const LEGACY = { type: 'recipe_view', userId: 'user_9', page: 'home', timestamp: '2026-06-14T08:00:00.000Z' };

const OPTS = { source: 'spec', producerId: 'prod-test' };

describe('E43-A2 event envelope runtime guard', () => {
  it('off mode skips safely (allowed, status skipped, no validation)', () => {
    const r = guardEventForRuntime({ garbage: true }, { mode: 'off', ...OPTS });
    expect(r.allowed).toBe(true);
    expect(r.status).toBe('skipped');
    expect(r.errors).toEqual([]);
    expect(r.mode).toBe('off');
  });

  it('shadow accepts a valid canonical event', () => {
    const r = guardEventForRuntime(VALID_CANONICAL, { mode: 'shadow', ...OPTS });
    expect(r.allowed).toBe(true);
    expect(r.status).toBe('accepted');
    expect(r.canonicalEvent).toBeDefined();
    expect(r.errors).toEqual([]);
  });

  it('shadow normalizes a valid legacy event WITH caller consent (warnings, never blocks)', () => {
    const r = guardEventForRuntime(LEGACY, {
      mode: 'shadow',
      ...OPTS,
      defaultConsentPurpose: ConsentPurposeEnum.analytics,
      now: '2026-06-14T08:00:00.000Z',
    });
    expect(r.allowed).toBe(true);
    expect(r.status).toBe('accepted_with_warnings');
    expect(r.canonicalEvent?.eventType).toBe('recipe_view');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('shadow does NOT block an invalid/PII event but redacts it', () => {
    const r = guardEventForRuntime(
      { eventType: 'recipe_view', metadata: { email: 'jane.doe@example.com' } },
      { mode: 'shadow', ...OPTS, redactForLogs: true },
    );
    expect(r.allowed).toBe(true); // shadow never blocks
    expect(r.status).toBe('accepted_with_warnings');
    const red = JSON.stringify(r.redactedEvent);
    expect(red).not.toMatch(/jane\.doe@example\.com/);
  });

  it('shadow allows an unknown eventType but records a not-production-ready warning', () => {
    const r = guardEventForRuntime(
      { ...VALID_CANONICAL, eventType: 'totally_made_up_event' },
      { mode: 'shadow', ...OPTS },
    );
    expect(r.allowed).toBe(true);
    expect(r.warnings.some((w) => w.toLowerCase().includes('not production-ready'))).toBe(true);
  });

  it('strict accepts a valid canonical event', () => {
    const r = guardEventForRuntime(VALID_CANONICAL, { mode: 'strict', ...OPTS });
    expect(r.allowed).toBe(true);
    expect(['accepted', 'accepted_with_warnings']).toContain(r.status);
    expect(r.canonicalEvent).toBeDefined();
  });

  it('strict rejects an invalid event (missing required field)', () => {
    const bad: any = { ...VALID_CANONICAL };
    delete bad.actorId;
    const r = guardEventForRuntime(bad, { mode: 'strict', ...OPTS });
    expect(r.allowed).toBe(false);
    expect(r.status).toBe('rejected');
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('strict rejects a legacy event without consent (no silent consent)', () => {
    const r = guardEventForRuntime(LEGACY, { mode: 'strict', ...OPTS });
    expect(r.allowed).toBe(false);
    expect(r.status).toBe('rejected');
    expect(r.errors.some((e) => e.includes('consentPurpose'))).toBe(true);
  });

  it('strict rejects PII in metadata', () => {
    const r = guardEventForRuntime(
      { ...VALID_CANONICAL, metadata: { phone: '09123456789' } },
      { mode: 'strict', ...OPTS },
    );
    expect(r.allowed).toBe(false);
    expect(r.status).toBe('rejected');
  });

  it('strict rejects an unknown eventType', () => {
    const r = guardEventForRuntime(
      { ...VALID_CANONICAL, eventType: 'totally_made_up_event' },
      { mode: 'strict', ...OPTS },
    );
    expect(r.allowed).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes('unknown eventtype'))).toBe(true);
  });

  it('never throws on garbage input in any mode', () => {
    for (const mode of ['off', 'shadow', 'strict'] as const) {
      expect(() => guardEventForRuntime(null, { mode, ...OPTS })).not.toThrow();
      expect(() => guardEventForRuntime(42, { mode, ...OPTS })).not.toThrow();
      expect(() => guardEventForRuntime('x', { mode, ...OPTS })).not.toThrow();
    }
  });

  it('returns a stable shape with producerId + source echoed', () => {
    const r = guardEventForRuntime(VALID_CANONICAL, { mode: 'shadow', source: 'svc', producerId: 'p1' });
    expect(Object.keys(r).sort()).toEqual(
      ['allowed', 'canonicalEvent', 'errors', 'mode', 'producerId', 'redactedEvent', 'source', 'status', 'warnings'].sort(),
    );
    expect(r.producerId).toBe('p1');
    expect(r.source).toBe('svc');
  });

  describe('resolveRuntimeGuardMode', () => {
    it('defaults to shadow when env unset/invalid', () => {
      expect(resolveRuntimeGuardMode({} as any)).toBe('shadow');
      expect(resolveRuntimeGuardMode({ EVENT_ENVELOPE_RUNTIME_GUARD_MODE: 'bogus' } as any)).toBe('shadow');
    });
    it('honors off/shadow/strict', () => {
      expect(resolveRuntimeGuardMode({ EVENT_ENVELOPE_RUNTIME_GUARD_MODE: 'off' } as any)).toBe('off');
      expect(resolveRuntimeGuardMode({ EVENT_ENVELOPE_RUNTIME_GUARD_MODE: 'strict' } as any)).toBe('strict');
      expect(resolveRuntimeGuardMode({ EVENT_ENVELOPE_RUNTIME_GUARD_MODE: 'SHADOW' } as any)).toBe('shadow');
    });
  });
});
