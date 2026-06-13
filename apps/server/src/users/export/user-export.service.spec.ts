import { UserExportService } from './user-export.service';
import { UsersController } from '../users.controller';
import { isSecretKey, sanitizeRecord, sanitizeRecords } from './export-sanitizer';

/**
 * E39-1D targeted tests — GDPR user export. Prisma fully mocked; no real DB.
 */

// findMany sections and their expected scoping key.
const MANY_USERID = [
  'preferenceHistory', 'consentLog', 'userSession', 'userEvent', 'userBehaviorSignal', 'signalObservation',
  'userBehaviorTimeline', 'userIdentityDimension', 'userFeature', 'userOutcome', 'recommendationExposure',
  'recommendationAttributionEvent', 'featureContributionLog', 'chatMessage', 'userFact', 'aICallLog',
  'mealPlan', 'shoppingList', 'favoriteRecipe', 'notification', 'supportTicket', 'dataAccessLog',
  'userAuditLog', 'experimentAssignment', 'erasureEvent',
];
const ONE_USERID = ['userPreference', 'userBehaviorProfile', 'userFeatureVector', 'userEngagementSnapshot', 'userHealthSnapshot', 'userIdentitySnapshot', 'userRetentionSnapshot'];

function makeMockPrisma() {
  const p: Record<string, { findMany?: jest.Mock; findUnique?: jest.Mock }> = {};
  for (const m of [...MANY_USERID, 'recipe']) p[m] = { findMany: jest.fn(async () => []) };
  for (const m of ONE_USERID) p[m] = { findUnique: jest.fn(async () => null) };
  p.user = {
    findUnique: jest.fn(async () => ({
      id: 'u1', phone: '+989000000001', name: 'Target', email: 'u1@example.com',
      avatar: null, isAdmin: false, createdAt: new Date('2026-01-01T00:00:00Z'),
      password: 'SUPER_SECRET_HASH', // must never leave the server
      allergies: [{ allergy: { name: 'peanut' } }], cuisines: [{ cuisine: { name: 'persian' } }], healthGoals: [{ healthGoal: { name: 'weight' } }],
    })),
  };
  return p;
}

describe('UserExportService (E39-1D)', () => {
  it('exports the current user data with the stable v1 envelope', async () => {
    const p = makeMockPrisma();
    const out = await new UserExportService(p as never).exportUser('u1');

    expect(out.exportVersion).toBe('v1');
    expect(typeof out.generatedAt).toBe('string');
    expect(out.userId).toBe('u1');
    expect(out.subject).toEqual({
      id: 'u1', phone: '+989000000001', name: 'Target', email: 'u1@example.com', avatar: null, isAdmin: false, createdAt: expect.any(Date),
    });
    expect(out.sections).toHaveProperty('profile');
    expect(out.sections).toHaveProperty('preferences');
    expect(out.sections).toHaveProperty('ai');
    expect(out.sections).toHaveProperty('behavior');
    expect(out.metadata.includedSections.length).toBeGreaterThan(20);
    expect(out.metadata.limitPerSection).toBe(1000);
  });

  it('NEVER exports password/hash or any secret-ish field', async () => {
    const p = makeMockPrisma();
    // inject a row carrying secret-ish keys into a section to prove the sanitizer drops them
    p.consentLog.findMany = jest.fn(async () => [{ id: 'c1', userId: 'u1', type: 'analytics', token: 'TKVAL', refreshToken: 'RT', apiKey: 'AK', passwordHash: 'PH', ip: '203.0.113.1' }]);
    const out = await new UserExportService(p as never).exportUser('u1');

    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('SUPER_SECRET_HASH'); // User.password
    expect(serialized).not.toContain('TKVAL');
    expect(serialized).not.toContain('RT');
    expect(serialized).not.toContain('AK');
    expect(serialized).not.toContain('PH');
    expect(serialized).not.toMatch(/"password"|"passwordHash"|"token"|"refreshToken"|"apiKey"/);
    // the non-secret fields of that row survive
    const consents = (out.sections as { consents: Array<Record<string, unknown>> }).consents;
    expect(consents[0]).toMatchObject({ id: 'c1', type: 'analytics', ip: '203.0.113.1' });
  });

  it('AI call logs use a safe select that excludes errorMessage', async () => {
    const p = makeMockPrisma();
    await new UserExportService(p as never).exportUser('u1');
    const call = (p.aICallLog.findMany as jest.Mock).mock.calls[0][0];
    expect(call.select).toBeDefined();
    expect(call.select.errorMessage).toBeUndefined(); // never selected
    expect(call.select.metadata).toBe(true);
  });

  it('queries ONLY the current userId (no unscoped reads; recipe scoped by authorId)', async () => {
    const p = makeMockPrisma();
    await new UserExportService(p as never).exportUser('u1');

    expect((p.user.findUnique as jest.Mock).mock.calls[0][0].where).toEqual({ id: 'u1' });
    for (const m of MANY_USERID) {
      const calls = (p[m].findMany as jest.Mock).mock.calls;
      for (const [arg] of calls) expect(arg.where).toEqual({ userId: 'u1' });
    }
    for (const [arg] of (p.recipe.findMany as jest.Mock).mock.calls) expect(arg.where).toEqual({ authorId: 'u1' });
    for (const m of ONE_USERID) {
      for (const [arg] of (p[m].findUnique as jest.Mock).mock.calls) expect(arg.where).toEqual({ userId: 'u1' });
    }
  });

  it('includes behavior/snapshot data when seeded', async () => {
    const p = makeMockPrisma();
    p.userBehaviorProfile.findUnique = jest.fn(async () => ({ id: 'bp1', userId: 'u1', cookingSkill: 'beginner' }));
    p.userHealthSnapshot.findUnique = jest.fn(async () => ({ userId: 'u1', goalCompletionRate: 0.5 }));
    p.userBehaviorSignal.findMany = jest.fn(async () => [{ userId: 'u1', signalName: 's', value: 1 }]);
    const out = await new UserExportService(p as never).exportUser('u1');
    const b = (out.sections as { behavior: Record<string, any> }).behavior;
    expect(b.profile).toMatchObject({ id: 'bp1', cookingSkill: 'beginner' });
    expect(b.snapshots.health).toMatchObject({ goalCompletionRate: 0.5 });
    expect(b.signals).toHaveLength(1);
  });

  it('a missing/failing section produces a warning, not a crash', async () => {
    const p = makeMockPrisma();
    p.notification.findMany = jest.fn(async () => { const e = new Error('relation does not exist') as Error & { code?: string }; e.code = 'P2021'; throw e; });
    const out = await new UserExportService(p as never).exportUser('u1');
    expect(out.metadata.omittedSections).toContain('notifications');
    expect(out.metadata.warnings.some((w) => w.startsWith('notifications:'))).toBe(true);
    expect((out.sections as { notifications: unknown[] }).notifications).toEqual([]);
  });

  it('warns when a section is truncated at the limit', async () => {
    const p = makeMockPrisma();
    p.userEvent.findMany = jest.fn(async () => Array.from({ length: 1000 }, (_, i) => ({ id: String(i), userId: 'u1', type: 'x' })));
    const out = await new UserExportService(p as never).exportUser('u1');
    expect(out.metadata.warnings.some((w) => w.includes('events: truncated at 1000'))).toBe(true);
  });

  it('throws NotFound for a missing user (no partial export)', async () => {
    const p = makeMockPrisma();
    p.user.findUnique = jest.fn(async () => null);
    await expect(new UserExportService(p as never).exportUser('ghost')).rejects.toThrow('User not found');
  });
});

describe('export-sanitizer (E39-1D)', () => {
  it('flags secret-ish key names', () => {
    for (const k of ['password', 'passwordHash', 'token', 'refreshToken', 'accessToken', 'apiKey', 'api_key', 'jwt', 'resetToken', 'verificationToken', 'otp', 'credential', 'salt', 'signature']) {
      expect(isSecretKey(k)).toBe(true);
    }
    for (const k of ['id', 'email', 'ip', 'createdAt', 'estimatedInputTokens', 'content']) expect(isSecretKey(k)).toBe(false);
  });

  it('drops secret keys and keeps safe fields', () => {
    const out = sanitizeRecord({ id: 'x', email: 'e@x.com', password: 'p', token: 't', secret: 's' });
    expect(out).toEqual({ id: 'x', email: 'e@x.com' });
  });

  it('caps oversized strings and large nested structures', () => {
    const big = 'a'.repeat(10_050);
    const out = sanitizeRecord({ id: 'x', note: big }) as { note: string };
    expect(out.note.length).toBeLessThan(big.length);
    expect(out.note).toContain('[truncated');
    // a large nested array (many small elements) exceeds the JSON cap → replaced with a truncation marker
    const bigArr = { id: 'y', data: Array.from({ length: 3000 }, (_, i) => ({ k: i })) };
    const out2 = sanitizeRecord(bigArr) as { data: { _truncated?: boolean } };
    expect(out2.data._truncated).toBe(true);
  });

  it('recursively drops secret keys inside nested objects and arrays (include paths)', () => {
    const out = sanitizeRecord({
      id: 'mp1', userId: 'u1',
      slots: [{ id: 's1', mealType: 'lunch', apiKey: 'LEAK1' }],
      nested: { token: 'LEAK2', safe: 'ok' },
    }) as { slots: Array<Record<string, unknown>>; nested: Record<string, unknown> };
    expect(out.slots[0]).toEqual({ id: 's1', mealType: 'lunch' }); // apiKey dropped
    expect(out.nested).toEqual({ safe: 'ok' }); // token dropped
  });

  it('preserves Date values (not flattened to {})', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const out = sanitizeRecord({ id: 'x', createdAt: d }) as { createdAt: Date };
    expect(out.createdAt).toBe(d);
  });

  it('sanitizeRecords drops nulls and sanitizes each', () => {
    const out = sanitizeRecords([{ id: '1', token: 't' }, null as never, { id: '2', password: 'p' }]);
    expect(out).toEqual([{ id: '1' }, { id: '2' }]);
  });
});

describe('UsersController.exportMe delegation (E39-1D wiring)', () => {
  it('exports ONLY req.user.userId — ignores any client-supplied userId in body/params', async () => {
    const usersService = { exportUser: jest.fn(async () => ({ exportVersion: 'v1' })) };
    const controller = new UsersController(usersService as never);
    const req = { user: { userId: 'real-user' }, body: { userId: 'EVIL' }, params: { userId: 'EVIL' }, query: { userId: 'EVIL' } };

    await controller.exportMe(req as never);

    expect(usersService.exportUser).toHaveBeenCalledTimes(1);
    expect(usersService.exportUser).toHaveBeenCalledWith('real-user');
  });

  it('GET /users/me/export route handler is protected by an auth guard', () => {
    const guards = Reflect.getMetadata('__guards__', UsersController.prototype.exportMe) || [];
    expect(guards.length).toBeGreaterThanOrEqual(1);
  });
});
