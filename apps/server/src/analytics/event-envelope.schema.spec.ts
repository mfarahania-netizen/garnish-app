import {
  validateEventEnvelope,
  assertNoPIIInMetadata,
  PIIDetectedError,
  CanonicalEventEnvelopeSchema,
  ActorTypeEnum,
  SourceEnum,
  VisibilityEnum,
  ConsentPurposeEnum,
  PrivacyClassEnum,
  RetentionPolicyEnum,
  CanonicalEventEnvelope,
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
