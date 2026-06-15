import { ProfileReadService } from './profile-read.service';
import { QuestionSelectionService } from '../onboarding/question-selection.service';

const NOW = new Date('2026-06-15T12:00:00.000Z');

function makeDeps(opts: {
  consentRows?: any[];
  facts?: any[];
  pref?: any;
  allergies?: any[];
} = {}) {
  const prisma: any = {
    consentLog: { findMany: jest.fn().mockResolvedValue(opts.consentRows ?? []) },
    userPreference: { findUnique: jest.fn().mockResolvedValue(opts.pref ?? null), upsert: jest.fn().mockResolvedValue({}) },
    userAllergy: { findMany: jest.fn().mockResolvedValue(opts.allergies ?? []) },
  };
  const userFacts: any = {
    listByUser: jest.fn().mockResolvedValue(opts.facts ?? []),
    upsert: jest.fn().mockResolvedValue({ id: 'f1' }),
    isSensitiveKey: (k: string) => /allerg|health|medical/i.test(k),
  };
  const svc = new ProfileReadService(prisma, userFacts, new QuestionSelectionService());
  return { svc, prisma, userFacts };
}

const personalizationConsent = [{ purpose: 'personalization', granted: true }, { purpose: 'analytics', granted: true }];

describe('ProfileReadService — consent state', () => {
  it('always includes core; adds granted purposes; defaults to core-only on error', async () => {
    const { svc } = makeDeps({ consentRows: personalizationConsent });
    expect((await svc.getConsentState('u1')).granted.sort()).toEqual(['analytics', 'core', 'personalization']);
    const bad = makeDeps();
    bad.prisma.consentLog.findMany.mockRejectedValueOnce(new Error('db'));
    expect((await bad.svc.getConsentState('u1')).granted).toEqual(['core']);
  });
});

describe('ProfileReadService — living profile (owner-only, merged)', () => {
  it('builds a living profile from persisted facts + preference + allergies with a maturity score', async () => {
    const { svc } = makeDeps({
      consentRows: personalizationConsent,
      facts: [{ key: 'declared.context.age_range', value: { v: '25_34' }, updatedAt: NOW }],
      pref: { diet: 'vegetarian', skillLevel: 'beginner', budget: 'tight', updatedAt: NOW },
      allergies: [{ allergy: { name: 'peanut' } }],
    });
    const profile = await svc.getLivingProfile('u1', NOW);
    expect(profile.declared.dimensions['dietary.pattern'].value).toBe('vegetarian');
    expect(profile.declared.dimensions['constraints.cooking_skill'].value).toBe('beginner');
    // owner sees the sensitive age band
    expect(profile.declared.dimensions['context.age_range'].value).toBe('25_34');
    expect(profile.maturity.overallScore).toBeGreaterThan(0);
    expect(['empty', 'forming', 'developing', 'mature']).toContain(profile.maturity.band);
    expect(profile.privacy.ownerOnly).toBe(true);
  });
});

describe('ProfileReadService — submitAnswer (consent + persistence routing)', () => {
  it('requires consent before persisting a personalization-gated dimension', async () => {
    const { svc, userFacts } = makeDeps({ consentRows: [] }); // only core
    const r = await svc.submitAnswer('u1', 'context.age_range', '25_34');
    expect(r.status).toBe('consent_required');
    expect(userFacts.upsert).not.toHaveBeenCalled();
  });

  it('rejects an unknown dimension and an out-of-band value', async () => {
    const { svc } = makeDeps({ consentRows: personalizationConsent });
    expect((await svc.submitAnswer('u1', 'nope.key', 'x')).status).toBe('rejected');
    expect((await svc.submitAnswer('u1', 'context.age_range', 99)).status).toBe('rejected'); // precise numeric
  });

  it('persists a non-sensitive declared fact via UserFact', async () => {
    const { svc, userFacts } = makeDeps({ consentRows: personalizationConsent });
    const r = await svc.submitAnswer('u1', 'dietary.hard_dislikes', ['cilantro']);
    expect(r.status).toBe('persisted');
    expect(userFacts.upsert).toHaveBeenCalledWith(expect.objectContaining({ key: 'declared.dietary.hard_dislikes', source: 'declared' }));
  });

  it('routes dietary pattern to UserPreference', async () => {
    const { svc, prisma } = makeDeps({ consentRows: personalizationConsent });
    const r = await svc.submitAnswer('u1', 'dietary.pattern', 'vegan');
    expect(r.status).toBe('persisted');
    expect(prisma.userPreference.upsert).toHaveBeenCalled();
  });

  it('routes allergies to the dedicated allergy flow (never the safe-fact store)', async () => {
    const { svc, userFacts } = makeDeps({ consentRows: personalizationConsent });
    const r = await svc.submitAnswer('u1', 'dietary.allergies_intolerances', ['peanut']);
    expect(r.status).toBe('use_allergy_flow');
    expect(userFacts.upsert).not.toHaveBeenCalled();
  });
});
