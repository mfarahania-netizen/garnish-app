import { ProfileReadService } from './profile-read.service';
import { QuestionSelectionService } from '../onboarding/question-selection.service';

const NOW = new Date('2026-06-15T12:00:00.000Z');

function makeDeps(opts: {
  consentRows?: any[];
  facts?: any[];
  pref?: any;
  allergies?: any[];
  observations?: any[];
  userConsentRows?: any[];
} = {}) {
  const prisma: any = {
    consentLog: { findMany: jest.fn().mockResolvedValue(opts.consentRows ?? []) },
    userPreference: { findUnique: jest.fn().mockResolvedValue(opts.pref ?? null), upsert: jest.fn().mockResolvedValue({}) },
    userAllergy: { findMany: jest.fn().mockResolvedValue(opts.allergies ?? []) },
    signalObservation: { findMany: jest.fn().mockResolvedValue(opts.observations ?? []) },
    userConsent: { findMany: jest.fn().mockResolvedValue(opts.userConsentRows ?? []) },
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

  it('honors the opt-in UserConsent ledger (latest decision per purpose) — this is what flips hydration on', async () => {
    const { svc } = makeDeps({ userConsentRows: [
      { purpose: 'personalization', status: 'granted' },
      { purpose: 'analytics', status: 'granted' },
      { purpose: 'analytics', status: 'withdrawn' }, // newer → analytics excluded
    ] });
    expect((await svc.getConsentState('u1')).granted.sort()).toEqual(['core', 'personalization']);
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

// L0/C3 — the additive consent-gated observed-hydration must NOT alter the two hard invariants:
// (1) the allergy reconciled set is ALWAYS the declared set; (2) cold-start output stays byte-identical.
describe('ProfileReadService — L0 hydration invariants', () => {
  const allergyRow = [{ allergy: { name: 'peanut' } }];
  const cuisineObs = [
    { signalName: 'taste.cuisine_affinity', weight: 1, observedAt: NOW },
    { signalName: 'taste.cuisine_affinity', weight: 1, observedAt: NOW },
    { signalName: 'taste.cuisine_affinity', weight: 0.8, observedAt: NOW },
  ];

  it('cold-start (no consent, no data) stays byte-identical and NEVER hydrates', async () => {
    const { svc, prisma } = makeDeps(); // core-only consent, empty everything
    const p = await svc.getLivingUserProfile('u1', NOW);
    expect(p.observed.status).toBe('cold_start');
    expect(p.reconciled.dimensions.allergies.reconciledValue).toEqual([]);
    expect(p.maturity.band).toBe('empty');
    // without 'personalization' consent the hydration path must never even query observations
    expect(prisma.signalObservation.findMany).not.toHaveBeenCalled();
  });

  it('declared allergy + personalization consent but ZERO observations → allergy set = declared, still cold-start', async () => {
    const { svc, prisma } = makeDeps({ consentRows: personalizationConsent, allergies: allergyRow, observations: [] });
    const p = await svc.getLivingUserProfile('u1', NOW);
    expect(prisma.signalObservation.findMany).toHaveBeenCalled(); // consent → path runs
    expect(p.reconciled.dimensions.allergies.reconciledValue).toEqual(['peanut']); // declared, untouched
    expect(p.observed.status).toBe('cold_start'); // no observations → exact cold-start
  });

  it('WITH observations + consent → observed axis hydrates, but the allergy set is STILL the declared set', async () => {
    const cold = await makeDeps({ consentRows: personalizationConsent, allergies: allergyRow, observations: [] }).svc.getLivingUserProfile('u1', NOW);
    const hot = await makeDeps({ consentRows: personalizationConsent, allergies: allergyRow, observations: cuisineObs }).svc.getLivingUserProfile('u1', NOW);
    // the observed axis is genuinely different once real signals flow in (the L0 unlock)
    expect(JSON.stringify(hot.observed)).not.toEqual(JSON.stringify(cold.observed));
    // …yet the safety-critical allergy set is byte-identical to the declared one in BOTH
    expect(hot.reconciled.dimensions.allergies.reconciledValue).toEqual(['peanut']);
    expect(cold.reconciled.dimensions.allergies.reconciledValue).toEqual(['peanut']);
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
