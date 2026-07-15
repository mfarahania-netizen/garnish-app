import { RetentionService, RETENTION_DESTRUCTIVE_FLAG } from './retention.service';
import { RETENTION_POLICY, prunableRules, excludedByClass, classOf, RetentionClass } from './retention-policy';

const PRUNABLE = [
  'userEvent', 'userSession', 'signalObservation', 'userBehaviorTimeline', 'recommendationExposure',
  'recommendationAttributionEvent', 'featureContributionLog', 'userOutcome', 'recommendationMetrics',
];

function makeMockPrisma(countValue = 2) {
  const p: Record<string, { count: jest.Mock; deleteMany: jest.Mock }> = {};
  for (const m of PRUNABLE) p[m] = { count: jest.fn(async () => countValue), deleteMany: jest.fn() };
  return p;
}

describe('RetentionService (E39-1E) — dry-run', () => {
  const ORIGINAL_ENV = process.env[RETENTION_DESTRUCTIVE_FLAG];
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env[RETENTION_DESTRUCTIVE_FLAG];
    else process.env[RETENTION_DESTRUCTIVE_FLAG] = ORIGINAL_ENV;
  });

  it('returns candidate counts WITHOUT deleting anything', async () => {
    const p = makeMockPrisma(5);
    const out = await new RetentionService(p as never).previewRetention();

    expect(out.mode).toBe('dry-run');
    expect(out.candidates.length).toBe(PRUNABLE.length);
    expect(out.totalCandidates).toBe(5 * PRUNABLE.length);
    // never deletes
    for (const m of PRUNABLE) {
      expect(p[m].count).toHaveBeenCalledTimes(1);
      expect(p[m].deleteMany).not.toHaveBeenCalled();
    }
  });

  it('issues count queries with a `lt: cutoff` filter on the configured time field', async () => {
    const p = makeMockPrisma();
    await new RetentionService(p as never).previewRetention(new Date('2026-06-13T00:00:00.000Z'));
    const arg = p.userEvent.count.mock.calls[0][0];
    expect(arg.where.timestamp.lt).toBeInstanceOf(Date);
  });

  it('EXCLUDES audit_long models from prune candidates', async () => {
    const out = await new RetentionService(makeMockPrisma() as never).previewRetention();
    const candidateModels = out.candidates.map((c) => c.model);
    for (const m of ['consentLog', 'userAuditLog', 'erasureEvent', 'dataAccessLog', 'aICallLog']) {
      expect(candidateModels).not.toContain(m);
      expect(out.excluded.audit_long).toContain(m);
    }
  });

  it('EXCLUDES user_owned_active models (chat/facts/mealPlans/etc.)', async () => {
    const out = await new RetentionService(makeMockPrisma() as never).previewRetention();
    const candidateModels = out.candidates.map((c) => c.model);
    for (const m of ['chatMessage', 'userFact', 'mealPlan', 'shoppingList', 'favorite' + 'Recipe', 'user', 'userPreference', 'recipe', 'preferenceHistory', 'onboardingProfile', 'onboardingMutation']) {
      expect(candidateModels).not.toContain(m);
    }
    expect(out.excluded.user_owned_active).toEqual(expect.arrayContaining(['chatMessage', 'userFact', 'mealPlan', 'user', 'preferenceHistory', 'onboardingProfile', 'onboardingMutation']));
  });

  it('EXCLUDES review_required models (derived snapshots / reference content)', async () => {
    const out = await new RetentionService(makeMockPrisma() as never).previewRetention();
    const candidateModels = out.candidates.map((c) => c.model);
    for (const m of ['userFeatureVector', 'userEngagementSnapshot', 'userHealthSnapshot', 'experimentAssignment', 'ingredient']) {
      expect(candidateModels).not.toContain(m);
      expect(out.excluded.review_required).toContain(m);
    }
  });

  it('computes cutoff dates correctly (now − cutoffDays)', async () => {
    const p = makeMockPrisma();
    const now = new Date('2026-06-13T12:00:00.000Z');
    const out = await new RetentionService(p as never).previewRetention(now);
    for (const c of out.candidates) {
      const expected = new Date(now.getTime() - c.cutoffDays * 24 * 60 * 60 * 1000).toISOString();
      expect(c.cutoffDate).toBe(expected);
      expect(c.cutoffDays).toBe(365);
    }
  });

  it('destructive mode defaults disabled', async () => {
    delete process.env[RETENTION_DESTRUCTIVE_FLAG];
    expect(RetentionService.isDestructiveEnabled()).toBe(false);
    const out = await new RetentionService(makeMockPrisma() as never).previewRetention();
    expect(out.destructiveEnabled).toBe(false);
  });

  it('refuses destructive execution without the flag, and is unimplemented even with it', async () => {
    const svc = new RetentionService(makeMockPrisma() as never);
    delete process.env[RETENTION_DESTRUCTIVE_FLAG];
    await expect(svc.executeRetention()).rejects.toThrow(/REFUSED/);
    process.env[RETENTION_DESTRUCTIVE_FLAG] = 'true';
    await expect(svc.executeRetention()).rejects.toThrow(/NOT implemented/);
  });

  it('produces PII-free output (model names / counts / dates only)', async () => {
    const out = await new RetentionService(makeMockPrisma() as never).previewRetention();
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('@');
    // word-boundary so model names like "recipe" don't false-match "ip"
    expect(serialized).not.toMatch(/\b(ip|email|password|userAgent|token|secret)\b/i);
    for (const c of out.candidates) {
      expect(Object.keys(c).sort()).toEqual(['candidateCount', 'class', 'cutoffDate', 'cutoffDays', 'model', 'timeField']);
    }
  });

  it('a failing count becomes a warning, not a crash', async () => {
    const p = makeMockPrisma();
    p.userEvent.count = jest.fn(async () => { const e = new Error('x') as Error & { code?: string }; e.code = 'P2021'; throw e; });
    const out = await new RetentionService(p as never).previewRetention();
    expect(out.warnings.some((w) => w.startsWith('userEvent:'))).toBe(true);
    expect(out.candidates.map((c) => c.model)).not.toContain('userEvent');
  });
});

describe('retention-policy completeness (E39-1E safety rail)', () => {
  it('classifies all 56 schema models exactly once', () => {
    const models = RETENTION_POLICY.map((r) => r.model);
    expect(new Set(models).size).toBe(models.length); // no duplicates
    expect(models.length).toBe(56); // +4 gamification models +2 onboarding V2 models
  });

  it('only standard_365d / ephemeral_30d are prunable, each with timeField + cutoffDays', () => {
    for (const r of prunableRules()) {
      expect(['standard_365d', 'ephemeral_30d']).toContain(r.class);
      expect(r.timeField).toBeTruthy();
      expect(r.cutoffDays).toBeGreaterThan(0);
    }
    // no prunable rule is also in an excluded class
    const prunableModels = new Set(prunableRules().map((r) => r.model));
    const excluded = excludedByClass();
    for (const list of Object.values(excluded)) for (const m of list) expect(prunableModels.has(m)).toBe(false);
  });

  it('audit_long / user_owned_active / review_required are never prunable', () => {
    const prunable = new Set(prunableRules().map((r) => r.model));
    const excludedClasses: RetentionClass[] = ['audit_long', 'user_owned_active', 'review_required'];
    for (const r of RETENTION_POLICY) {
      if (excludedClasses.includes(r.class)) expect(prunable.has(r.model)).toBe(false);
    }
  });

  it('unknown models default to review_required (excluded)', () => {
    expect(classOf('someFutureModel')).toBe('review_required');
  });
});
