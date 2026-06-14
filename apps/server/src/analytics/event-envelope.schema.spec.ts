import {
  validateEventEnvelope,
  assertNoPIIInMetadata,
  PIIDetectedError,
  CanonicalEventEnvelopeSchema,
  ActorTypeEnum,
  SourceEnum,
  EventSourceEnum,
  VisibilityEnum,
  ConsentPurposeEnum,
  PrivacyClassEnum,
  RetentionPolicyEnum,
  CanonicalEventEnvelope,
  normalizeLegacyEventEnvelope,
  redactEventEnvelopeForArtifact,
} from './event-envelope.schema';

const TIMES = {
  occurredAt: '2026-06-13T10:00:00.000Z',
  receivedAt: '2026-06-13T10:00:01.000Z',
};

/** Eight canonical examples (ADR-0001 §10), completed with all required fields. */
const EXAMPLES: Record<string, Record<string, unknown>> = {
  // 1. recipe_viewed — web user, analytics consent
  recipe_viewed: {
    eventId: '0190a000-0000-7000-8000-000000000001',
    eventType: 'recipe_viewed',
    actorType: ActorTypeEnum.user,
    actorId: 'user_123',
    subjectType: 'user',
    subjectId: 'user_123',
    objectType: 'recipe',
    objectId: 'recipe_42',
    source: SourceEnum.webPwa,
    surface: 'home',
    consentPurpose: ConsentPurposeEnum.analytics,
    schemaVersion: 2,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    ...TIMES,
  },
  // 2. cook_complete — core consent, cook_mode surface
  cook_complete: {
    eventId: '0190a000-0000-7000-8000-000000000002',
    eventType: 'cook_complete',
    actorType: ActorTypeEnum.user,
    actorId: 'user_123',
    objectType: 'recipe',
    objectId: 'recipe_42',
    source: SourceEnum.webPwa,
    surface: 'cook_mode',
    consentPurpose: ConsentPurposeEnum.core,
    schemaVersion: 2,
    ...TIMES,
  },
  // 3. ai_answer_feedback — personalization, PII-free metadata
  ai_answer_feedback: {
    eventId: '0190a000-0000-7000-8000-000000000003',
    eventType: 'ai_answer_feedback',
    actorType: ActorTypeEnum.user,
    actorId: 'user_123',
    objectType: 'ai_message',
    objectId: 'msg_777',
    source: SourceEnum.webPwa,
    surface: 'chat',
    consentPurpose: ConsentPurposeEnum.personalization,
    schemaVersion: 2,
    metadata: { snapshotHash: 'a1b2c3d4', rating: 1 },
    ...TIMES,
  },
  // 4. notif_suppressed — system actor, cron source (no surface needed)
  notif_suppressed: {
    eventId: '0190a000-0000-7000-8000-000000000004',
    eventType: 'notif_suppressed',
    actorType: ActorTypeEnum.system,
    actorId: 'notification-service',
    objectType: 'notif',
    objectId: 'notif_9',
    source: SourceEnum.cron,
    consentPurpose: ConsentPurposeEnum.core,
    schemaVersion: 2,
    metadata: { reason: 'fatigue' },
    ...TIMES,
  },
  // 5. cooked_share — visibility private, community consent
  cooked_share: {
    eventId: '0190a000-0000-7000-8000-000000000005',
    eventType: 'cooked_share',
    actorType: ActorTypeEnum.user,
    actorId: 'user_123',
    objectType: 'post',
    objectId: 'post_1',
    source: SourceEnum.webPwa,
    surface: 'profile',
    visibility: VisibilityEnum.private,
    consentPurpose: ConsentPurposeEnum.community,
    schemaVersion: 2,
    ...TIMES,
  },
  // 6. workflow_run — agent actor, ops-workflow source
  workflow_run: {
    eventId: '0190a000-0000-7000-8000-000000000006',
    eventType: 'workflow_run',
    actorType: ActorTypeEnum.agent,
    actorId: 'ops:meal-suggest',
    source: SourceEnum.opsWorkflow,
    consentPurpose: ConsentPurposeEnum.core,
    schemaVersion: 2,
    metadata: { runId: 'run_1', stepId: 'step_2' },
    ...TIMES,
  },
};

describe('CanonicalEventEnvelopeSchema', () => {
  it('declares schemaVersion 2 and is backward-tolerant', () => {
    expect(CanonicalEventEnvelopeSchema.schemaVersion).toBe(2);
    expect(CanonicalEventEnvelopeSchema.backwardTolerant).toBe(true);
  });
});

describe('validateEventEnvelope — accepts the 6 valid canonical examples', () => {
  for (const [name, ex] of Object.entries(EXAMPLES)) {
    it(`accepts ${name}`, () => {
      const r = validateEventEnvelope(ex);
      expect(r.errors).toEqual([]);
      expect(r.valid).toBe(true);
      expect(r.value).not.toBeNull();
    });
  }

  it('applies documented defaults for missing visibility/privacyClass/retentionPolicy', () => {
    const r = validateEventEnvelope(EXAMPLES.cook_complete);
    expect(r.valid).toBe(true);
    const v = r.value as CanonicalEventEnvelope;
    expect(v.visibility).toBe(VisibilityEnum.private);
    expect(v.privacyClass).toBe(PrivacyClassEnum.p1Pseudonymous);
    expect(v.retentionPolicy).toBe(RetentionPolicyEnum.standard365d);
  });

  it('preserves provided enum values and paired ids', () => {
    const r = validateEventEnvelope(EXAMPLES.recipe_viewed);
    const v = r.value as CanonicalEventEnvelope;
    expect(v.consentPurpose).toBe('analytics');
    expect(v.subjectId).toBe('user_123');
    expect(v.objectType).toBe('recipe');
  });
});

describe('validateEventEnvelope — rejects malformed events (without breaking valid ones)', () => {
  // 7. invalid: missing consentPurpose (no default → required)
  it('rejects an event missing consentPurpose', () => {
    const bad = { ...EXAMPLES.recipe_viewed };
    delete bad.consentPurpose;
    const r = validateEventEnvelope(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'consentPurpose')).toBe(true);
  });

  it('rejects missing required identity fields', () => {
    for (const field of ['eventId', 'eventType', 'actorId']) {
      const bad = { ...EXAMPLES.recipe_viewed };
      delete bad[field];
      const r = validateEventEnvelope(bad);
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === field)).toBe(true);
    }
  });

  it('rejects an invalid actorType enum value', () => {
    const r = validateEventEnvelope({ ...EXAMPLES.recipe_viewed, actorType: 'robot' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'actorType')).toBe(true);
  });

  it('rejects an invalid source enum value', () => {
    const r = validateEventEnvelope({ ...EXAMPLES.recipe_viewed, source: 'sms' });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'source')).toBe(true);
  });

  it('requires surface when source is web-pwa', () => {
    const bad = { ...EXAMPLES.recipe_viewed };
    delete bad.surface;
    const r = validateEventEnvelope(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'surface')).toBe(true);
  });

  it('does NOT require surface when source is cron/ops-workflow', () => {
    expect(validateEventEnvelope(EXAMPLES.notif_suppressed).valid).toBe(true);
    expect(validateEventEnvelope(EXAMPLES.workflow_run).valid).toBe(true);
  });

  it('rejects non-positive / non-integer schemaVersion', () => {
    for (const sv of [0, -1, 2.5, '2', null]) {
      const r = validateEventEnvelope({ ...EXAMPLES.recipe_viewed, schemaVersion: sv });
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'schemaVersion')).toBe(true);
    }
  });

  it('rejects malformed timestamps', () => {
    expect(validateEventEnvelope({ ...EXAMPLES.recipe_viewed, occurredAt: 'yesterday' }).valid).toBe(false);
    expect(validateEventEnvelope({ ...EXAMPLES.recipe_viewed, receivedAt: 12345 }).valid).toBe(false);
  });

  it('rejects an unpaired subjectType (subjectId missing)', () => {
    const bad = { ...EXAMPLES.recipe_viewed };
    delete bad.subjectId;
    const r = validateEventEnvelope(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path === 'subjectType/subjectId')).toBe(true);
  });

  it('rejects invalid visibility / privacyClass / retentionPolicy values', () => {
    expect(validateEventEnvelope({ ...EXAMPLES.recipe_viewed, visibility: 'world' }).valid).toBe(false);
    expect(validateEventEnvelope({ ...EXAMPLES.recipe_viewed, privacyClass: 'P9' }).valid).toBe(false);
    expect(validateEventEnvelope({ ...EXAMPLES.recipe_viewed, retentionPolicy: 'forever' }).valid).toBe(false);
  });

  it('rejects a non-object root and non-object metadata/context', () => {
    expect(validateEventEnvelope(null).valid).toBe(false);
    expect(validateEventEnvelope('nope').valid).toBe(false);
    expect(validateEventEnvelope({ ...EXAMPLES.recipe_viewed, metadata: 'x' }).valid).toBe(false);
    expect(validateEventEnvelope({ ...EXAMPLES.recipe_viewed, context: [1, 2] }).valid).toBe(false);
  });

  // 8. invalid: PII in metadata
  it('rejects an event with PII in metadata', () => {
    const r = validateEventEnvelope({
      ...EXAMPLES.ai_answer_feedback,
      metadata: { email: 'user@example.com' },
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.path.startsWith('metadata'))).toBe(true);
  });
});

describe('validateEventEnvelope — backward tolerance (ADR §14)', () => {
  it('ignores unknown extra fields but still validates the known contract', () => {
    const r = validateEventEnvelope({ ...EXAMPLES.recipe_viewed, futureField: 'ignored', extra: { a: 1 } });
    expect(r.valid).toBe(true);
    expect(r.value as any).not.toHaveProperty('futureField');
  });

  it('does NOT let an unknown field rescue a missing required field', () => {
    const bad: Record<string, unknown> = { ...EXAMPLES.recipe_viewed, futureField: 'x' };
    delete bad.eventId;
    expect(validateEventEnvelope(bad).valid).toBe(false);
  });
});

describe('assertNoPIIInMetadata', () => {
  it('passes clean, structured metadata', () => {
    expect(() => assertNoPIIInMetadata({ reason: 'fatigue', count: 3, snapshotHash: 'a1b2c3' })).not.toThrow();
    expect(() => assertNoPIIInMetadata(undefined)).not.toThrow();
    expect(() => assertNoPIIInMetadata(null)).not.toThrow();
  });

  it('catches denylisted keys (email/phone/name/address/messageText/rawText)', () => {
    for (const key of ['email', 'phone', 'phoneNumber', 'name', 'fullName', 'address', 'messageText', 'rawText']) {
      expect(() => assertNoPIIInMetadata({ [key]: 'whatever' })).toThrow(PIIDetectedError);
    }
  });

  it('catches email-looking VALUES regardless of key', () => {
    expect(() => assertNoPIIInMetadata({ contactField: 'reach me at jane.doe@example.com please' })).toThrow(PIIDetectedError);
  });

  it('catches phone-looking VALUES regardless of key', () => {
    expect(() => assertNoPIIInMetadata({ ref: '+98 912 345 6789' })).toThrow(PIIDetectedError);
    expect(() => assertNoPIIInMetadata({ ref: '09123456789' })).toThrow(PIIDetectedError);
  });

  it('catches raw free-text fields', () => {
    expect(() => assertNoPIIInMetadata({ note: 'anything a user typed' })).toThrow(PIIDetectedError);
    expect(() => assertNoPIIInMetadata({ comment: 'free text' })).toThrow(PIIDetectedError);
  });

  it('catches PII nested in objects/arrays', () => {
    expect(() => assertNoPIIInMetadata({ outer: { inner: { email: 'a@b.co' } } })).toThrow(PIIDetectedError);
    expect(() => assertNoPIIInMetadata({ list: [{ phone: '021-12345678' }] })).toThrow(PIIDetectedError);
  });

  it('does NOT false-positive on ids, hashes, or long numeric strings', () => {
    expect(() => assertNoPIIInMetadata({ recipeId: 'recipe_42', snapshotHash: 'deadbeef' })).not.toThrow();
    expect(() => assertNoPIIInMetadata({ bigNumberId: '1234567890123456789' })).not.toThrow(); // >15 digits
    expect(() => assertNoPIIInMetadata({ uuid: '0190a000-0000-7000-8000-000000000001' })).not.toThrow();
  });

  it('honors an explicit allowlist for a denylisted key', () => {
    expect(() => assertNoPIIInMetadata({ name: 'Margherita' })).toThrow(PIIDetectedError);
    expect(() => assertNoPIIInMetadata({ name: 'Margherita' }, { allowlist: ['name'] })).not.toThrow();
  });

  it('exposes offending paths on the thrown error', () => {
    try {
      assertNoPIIInMetadata({ a: { email: 'x@y.zz' } });
      fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PIIDetectedError);
      expect((e as PIIDetectedError).issues[0].path).toBe('metadata.a.email');
    }
  });
});

/* ───────────────────────────── E43-A1 additions ───────────────────────────── */

describe('E43-A1 — validateEventEnvelope returns the canonical { ok, value, errors, warnings } shape', () => {
  const valid = {
    eventId: '0190a000-0000-7000-8000-00000000ee01',
    eventType: 'recipe_viewed',
    actorType: ActorTypeEnum.user,
    actorId: 'user_123',
    source: SourceEnum.webPwa,
    surface: 'home',
    consentPurpose: ConsentPurposeEnum.analytics,
    schemaVersion: 2,
    ...TIMES,
  };

  it('valid → { ok:true, value, errors:[], warnings:[] } (and ok === valid)', () => {
    const r = validateEventEnvelope(valid);
    expect(r.ok).toBe(true);
    expect(r.ok).toBe(r.valid);
    expect(r.value).not.toBeNull();
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('invalid → { ok:false, value:null, errors:[...], warnings:[] }', () => {
    const r = validateEventEnvelope({ ...valid, actorType: 'robot' });
    expect(r.ok).toBe(false);
    expect(r.ok).toBe(r.valid);
    expect(r.value).toBeNull();
    expect(r.errors.length).toBeGreaterThan(0);
    expect(Array.isArray(r.warnings)).toBe(true);
  });

  it('non-object root → ok:false with a (root) error and empty warnings', () => {
    const r = validateEventEnvelope(42);
    expect(r.ok).toBe(false);
    expect(r.errors[0].path).toBe('(root)');
    expect(r.warnings).toEqual([]);
  });

  it('emits a NON-FATAL warning (not error) for a backward-tolerant schemaVersion drift', () => {
    const r = validateEventEnvelope({ ...valid, schemaVersion: 1 });
    expect(r.ok).toBe(true); // still valid — backward tolerant
    expect(r.warnings.some((w) => w.path === 'schemaVersion')).toBe(true);
  });

  it('EventSourceEnum is an alias of SourceEnum', () => {
    expect(EventSourceEnum).toBe(SourceEnum);
    expect(EventSourceEnum.webPwa).toBe('web-pwa');
  });
});

describe('E43-A1 — assertNoPIIInMetadata catches credentials/tokens/conn-strings/embedded-phone/free-text', () => {
  it('rejects a JWT value under any key', () => {
    expect(() =>
      assertNoPIIInMetadata({ ref: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123' }),
    ).toThrow(PIIDetectedError);
  });
  it('rejects a Bearer token value', () => {
    expect(() => assertNoPIIInMetadata({ auth: 'Bearer abcdef0123456789' })).toThrow(PIIDetectedError);
  });
  it('rejects API-key-like values (sk-/AIza/ghp/xoxb)', () => {
    for (const v of ['sk-ABCDEF0123456789', 'AIzaSyABCDEFGHIJ0123456', 'ghp_ABCDEF0123456789', 'xoxb-ABCDEF012345']) {
      expect(() => assertNoPIIInMetadata({ k: v })).toThrow(PIIDetectedError);
    }
  });
  it('rejects a private-key block', () => {
    expect(() => assertNoPIIInMetadata({ k: '-----BEGIN RSA PRIVATE KEY-----' })).toThrow(PIIDetectedError);
  });
  it('rejects DB connection strings', () => {
    for (const v of ['postgres://u:p@host:5432/db', 'mysql://root:secret@localhost/app', 'mongodb+srv://a:b@cluster/db']) {
      expect(() => assertNoPIIInMetadata({ db: v })).toThrow(PIIDetectedError);
    }
  });
  it('rejects an embedded Iranian mobile inside longer text', () => {
    expect(() => assertNoPIIInMetadata({ ref: 'order ref 09123456789 thanks' })).toThrow(PIIDetectedError);
    expect(() => assertNoPIIInMetadata({ ref: 'contact +989123456789' })).toThrow(PIIDetectedError);
  });
  it('rejects long free-form user text', () => {
    const prose =
      'so basically the user typed a very long message about their day and what they cooked and how ' +
      'they felt about it and then kept going on and on with lots of personal detail well beyond a label';
    expect(() => assertNoPIIInMetadata({ blob: prose })).toThrow(PIIDetectedError);
  });
  it('still accepts the allowed structured metadata shapes (no false positives)', () => {
    expect(() => assertNoPIIInMetadata({ runId: 'ops:weekly-kpi-draft', stepId: 'draft-summary' })).not.toThrow();
    expect(() => assertNoPIIInMetadata({ snapshotHash: 'sha256:deadbeefcafe' })).not.toThrow();
    expect(() => assertNoPIIInMetadata({ experimentArm: 'briefing-copy-a' })).not.toThrow();
    expect(() => assertNoPIIInMetadata({ suppressedReason: 'fatigue_cap' })).not.toThrow();
    expect(() => assertNoPIIInMetadata({ position: 3, mergedCount: 2, blockedBeforeProvider: true })).not.toThrow();
  });

  it('does NOT flag bare 8–15 digit numeric IDs/counts/timestamps as phones (separator required)', () => {
    // adversarial-review fix: bare digit-runs are opaque ids, not phones.
    for (const v of ['12345678', '1234567890', '1718385600000', '999999999999999']) {
      expect(() => assertNoPIIInMetadata({ tokenCount: v })).not.toThrow();
      expect(() => assertNoPIIInMetadata({ stringified: v })).not.toThrow();
    }
  });

  it('STILL flags formatted phones and bare Iranian mobiles', () => {
    expect(() => assertNoPIIInMetadata({ ref: '+98 912 345 6789' })).toThrow(PIIDetectedError); // formatted
    expect(() => assertNoPIIInMetadata({ ref: '021-12345678' })).toThrow(PIIDetectedError); // separator
    expect(() => assertNoPIIInMetadata({ ref: '09123456789' })).toThrow(PIIDetectedError); // bare Iranian (embedded RE)
    expect(() => assertNoPIIInMetadata({ ref: 'call 09123456789 now' })).toThrow(PIIDetectedError); // embedded Iranian
  });
});

describe('E43-A1 — normalizeLegacyEventEnvelope (backward tolerance, ADR §9/§14)', () => {
  const NOW = '2026-06-14T08:00:00.000Z';

  it('passes a canonical v2 input straight through with normalizedFrom:canonical, no warnings', () => {
    const canonical = {
      eventId: '0190a000-0000-7000-8000-00000000ce01',
      eventType: 'recipe_viewed',
      actorType: ActorTypeEnum.user,
      actorId: 'user_1',
      source: SourceEnum.cron,
      consentPurpose: ConsentPurposeEnum.core,
      schemaVersion: 2,
      ...TIMES,
    };
    const r = normalizeLegacyEventEnvelope(canonical);
    expect(r.ok).toBe(true);
    expect(r.normalizedFrom).toBe('canonical');
    expect(r.warnings).toEqual([]);
  });

  it('normalizes a legacy UserEvent shape (type/userId/page/timestamp) WITH a caller consent default', () => {
    const legacy = { type: 'recipe_view', userId: 'user_900', page: 'home', timestamp: NOW };
    const r = normalizeLegacyEventEnvelope(legacy, { defaultConsentPurpose: ConsentPurposeEnum.analytics });
    expect(r.ok).toBe(true);
    expect(r.normalizedFrom).toBe('legacy');
    const v = r.value as CanonicalEventEnvelope;
    expect(v.eventType).toBe('recipe_view');
    expect(v.actorId).toBe('user_900');
    expect(v.source).toBe(SourceEnum.webPwa); // inferred from page
    expect(v.surface).toBe('home'); // page → surface
    expect(v.subjectId).toBe('user_900'); // subject inferred as actor
    expect(v.consentPurpose).toBe(ConsentPurposeEnum.analytics);
    expect(r.warnings.length).toBeGreaterThan(0); // inferences recorded
  });

  it('does NOT silently fabricate consent — legacy without consent + no default → rejected', () => {
    const legacy = { type: 'recipe_view', userId: 'user_900', page: 'home', timestamp: NOW };
    const r = normalizeLegacyEventEnvelope(legacy); // no defaultConsentPurpose
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'consentPurpose')).toBe(true);
  });

  it('infers source=server (no surface required) for a legacy cron event', () => {
    const legacy = { type: 'cron_behavior_engine_run', userId: 'system', timestamp: NOW };
    const r = normalizeLegacyEventEnvelope(legacy, { defaultConsentPurpose: ConsentPurposeEnum.core });
    expect(r.ok).toBe(true);
    expect((r.value as CanonicalEventEnvelope).source).toBe(SourceEnum.server);
  });

  it('drops untrusted legacy payload (does not copy into metadata) and warns', () => {
    const legacy = { type: 'x', userId: 'u1', page: 'home', timestamp: NOW, payload: { freeText: 'whatever a user typed' } };
    const r = normalizeLegacyEventEnvelope(legacy, { defaultConsentPurpose: ConsentPurposeEnum.core });
    expect(r.ok).toBe(true);
    expect((r.value as CanonicalEventEnvelope).metadata).toBeUndefined();
    expect(r.warnings.some((w) => w.path === 'payload')).toBe(true);
  });

  it('generates a deterministic eventId when provided via options', () => {
    const legacy = { type: 'x', userId: 'u1', page: 'home', timestamp: NOW };
    const r = normalizeLegacyEventEnvelope(legacy, {
      defaultConsentPurpose: ConsentPurposeEnum.core,
      eventId: 'fixed-event-id-1',
    });
    expect((r.value as CanonicalEventEnvelope).eventId).toBe('fixed-event-id-1');
  });
});

describe('E43-A1 — redactEventEnvelopeForArtifact (deterministic, log-safe)', () => {
  it('replaces PII-keyed values and scrubs secret substrings, preserving structure', () => {
    const dirty = {
      eventType: 'x',
      actorId: 'user_1',
      email: 'jane.doe@example.com',
      metadata: {
        note: 'free text',
        token: 'Bearer abcdef0123456789',
        nested: { phone: '09123456789', apiKey: 'AIzaSyABCDEFGHIJ0123456' },
      },
    };
    const out = redactEventEnvelopeForArtifact(dirty) as any;
    const json = JSON.stringify(out);
    // structure preserved
    expect(out.eventType).toBe('x');
    expect(out.actorId).toBe('user_1');
    expect(out.metadata.nested).toBeDefined();
    // no raw secret/PII survives
    expect(json).not.toMatch(/jane\.doe@example\.com/);
    expect(json).not.toMatch(/AIza[A-Za-z0-9_-]{8,}/);
    expect(json).not.toMatch(/eyJ[A-Za-z0-9._-]{10,}/);
    expect(json).not.toMatch(/\b0?9\d{9}\b/);
    // denylisted keys are marked redacted
    expect(out.email).toBe('[redacted-pii-key]');
  });

  it('scrubs a secret-bearing string value even under an innocuous key', () => {
    const out = redactEventEnvelopeForArtifact({ desc: 'use postgres://u:p@host/db now' }) as any;
    expect(out.desc).not.toMatch(/postgres:\/\//);
    expect(out.desc).toContain('[redacted-conn-string]');
  });

  it('returns null for null/undefined input and never throws', () => {
    expect(redactEventEnvelopeForArtifact(null)).toBeNull();
    expect(redactEventEnvelopeForArtifact(undefined)).toBeNull();
    expect(() => redactEventEnvelopeForArtifact('plain string')).not.toThrow();
  });

  it('E43-A3: survives a circular reference without throwing (depth/cycle guard)', () => {
    const a: any = { eventType: 'x', nested: {} };
    a.nested.back = a; // cycle
    let out: any;
    expect(() => {
      out = redactEventEnvelopeForArtifact(a);
    }).not.toThrow();
    const json = JSON.stringify(out); // must be serializable (no cycle survives)
    expect(json).toContain('[redacted-circular]');
    expect(out.eventType).toBe('x');
  });

  it('E43-A3: caps pathological nesting depth without stack overflow', () => {
    let deep: any = { v: 1 };
    for (let i = 0; i < 5000; i++) deep = { child: deep };
    expect(() => redactEventEnvelopeForArtifact(deep)).not.toThrow();
    expect(JSON.stringify(redactEventEnvelopeForArtifact(deep))).toContain('[redacted-depth]');
  });
});
