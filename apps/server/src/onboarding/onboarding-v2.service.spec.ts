import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConflictException } from '@nestjs/common';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
  TERMS_LAWFUL_BASIS,
} from '../consent/consent.constants';
import { ENABLED_ONBOARDING_ALLERGEN_TOKENS } from '../recipes/intelligence/recipe-integrity';
import { CompleteOnboardingV2Dto, SaveOnboardingDraftDto } from './dto/onboarding-v2.dto';
import { SUPPORTED_ONBOARDING_ALLERGEN_IDS } from './onboarding-v2.contract';
import { onboardingV2Features } from './onboarding-v2.features';
import { OnboardingV2Service } from './onboarding-v2.service';

const UUID_A = '9e7f7af7-0ad1-4cdd-b31f-38a2e9ec48f1';
const UUID_B = '4c09c9dc-52d7-45a1-8879-f8fb59fc3e02';
const NOW = new Date('2026-07-14T09:00:00.000Z');
const previousPersonalizationRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

beforeAll(() => {
  process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
});

afterAll(() => {
  if (previousPersonalizationRuntime === undefined) {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  } else {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousPersonalizationRuntime;
  }
});

const completionConsent = (personalization: boolean) => ({
  personalization,
  termsAccepted: true as const,
  termsPolicyVersion: CURRENT_TERMS_POLICY_VERSION,
  privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
});
const completionTaste = {
  likedRecipeIds: ['r-like'],
  dislikedRecipeIds: ['r-dislike'],
};

const safetyDto = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  idempotencyKey: UUID_A,
  expectedRevision: 0,
  step: 'safety',
  terms: {
    accepted: true,
    policyVersion: CURRENT_TERMS_POLICY_VERSION,
  },
  safety: {
    status: 'declared',
    allergyIds: ['egg'],
    intoleranceIds: ['dairy'],
    dietaryRules: ['no_pork'],
  },
  ...over,
}) as SaveOnboardingDraftDto;

function makeDraftPrisma({ currentTerms = true } = {}) {
  let mutation: any = null;
  let latestTerms: any = currentTerms
    ? {
      id: 'terms-current',
      status: 'granted',
      policyVersion: CURRENT_TERMS_POLICY_VERSION,
      createdAt: NOW,
    }
    : null;
  const upsert = jest.fn(async ({ create }: any) => ({
    ...create,
    updatedAt: NOW,
    completedAt: null,
  }));
  const tx: any = {
    $executeRaw: jest.fn(async () => 0),
    $queryRaw: jest.fn(async () => [{ id: 'u1' }]),
    onboardingMutation: {
      findUnique: jest.fn(async () => mutation),
      create: jest.fn(async ({ data }: any) => { mutation = data; return data; }),
      findMany: jest.fn(async () => []),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    onboardingProfile: { findUnique: jest.fn(async () => null), upsert },
    user: { findUnique: jest.fn(async () => ({ onboardingCompletedAt: null })) },
    userAllergy: {
      findMany: jest.fn(async () => [{ allergy: { name: 'peanut' } }]),
    },
    userPreference: { findUnique: jest.fn(async () => ({ diet: 'omnivore', updatedAt: NOW })) },
    userFact: {
      findMany: jest.fn(async () => [{
        key: 'declared.context.cooks_for_count',
        value: { v: '2' },
        updatedAt: NOW,
      }]),
    },
    consentLog: { upsert: jest.fn(async () => ({})) },
    userConsent: {
      findFirst: jest.fn(async () => latestTerms),
      create: jest.fn(async ({ data }: any) => {
        latestTerms = { id: 'terms-created', ...data };
        return latestTerms;
      }),
    },
    recipe: { findMany: jest.fn(async () => []) },
  };
  const prisma: any = {
    onboardingMutation: { findUnique: jest.fn(async () => mutation) },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
  return { prisma, tx, upsert, mutation: () => mutation };
}

function makeCompletePrisma({ projectionFails = false } = {}) {
  const draft: any = {
    userId: 'u1',
    schemaVersion: 2,
    revision: 3,
    safetyStatus: 'declared',
    allergyIds: ['egg'],
    intoleranceIds: ['dairy'],
    dietaryRules: ['no_pork'],
    dietPattern: 'vegetarian',
    weekdayTimeBucket: 'under_15',
    cooksForCount: '2',
    likedRecipeIds: [],
    dislikedRecipeIds: [],
    completedAt: null,
    updatedAt: NOW,
  };
  let completedAt: Date | null = null;
  let mutation: any = null;
  let hard = ['peanut'];
  const allergyIds = new Map<string, string>();
  let eventNumber = 0;
  const tx: any = {
    $executeRaw: jest.fn(async () => 0),
    $queryRaw: jest.fn(async () => [{ id: 'u1' }]),
    onboardingMutation: {
      findUnique: jest.fn(async () => mutation),
      create: jest.fn(async ({ data }: any) => { mutation = data; return data; }),
      findMany: jest.fn(async () => []),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    onboardingProfile: {
      findUnique: jest.fn(async () => draft),
      update: jest.fn(async ({ data }: any) => ({
        ...draft,
        ...data,
        revision: 4,
        completedAt: data.completedAt,
        updatedAt: NOW,
      })),
    },
    user: {
      findUnique: jest.fn(async () => ({ onboardingCompletedAt: completedAt })),
      update: jest.fn(async ({ data }: any) => { completedAt = data.onboardingCompletedAt; return {}; }),
    },
    userAllergy: {
      findMany: jest.fn(async () => hard.map((name) => ({ allergy: { name } }))),
      deleteMany: jest.fn(async () => { hard = []; return { count: 1 }; }),
      createMany: jest.fn(async ({ data }: any) => {
        hard = data.map((r: any) => allergyIds.get(r.allergyId));
        return { count: data.length };
      }),
    },
    allergy: {
      upsert: jest.fn(async ({ where }: any) => {
        allergyIds.set(`id-${where.name}`, where.name);
        return {};
      }),
      findMany: jest.fn(async ({ where }: any) => projectionFails
        ? []
        : where.name.in.map((name: string) => ({ id: `id-${name}`, name }))),
    },
    userPreference: {
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async () => ({})),
    },
    userFact: {
      findMany: jest.fn(async () => []),
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async () => ({})),
    },
    recipe: {
      findMany: jest.fn(async ({ where }: any) => where.id.in.map((id: string) => ({ id }))),
    },
    consentLog: { upsert: jest.fn(async () => ({})) },
    userConsent: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async () => ({})),
    },
    userFeatureVector: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    userFeature: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    userEvent: { create: jest.fn(async () => ({ id: `event-${++eventNumber}` })) },
    eventOutbox: { createMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma: any = {
    onboardingMutation: { findUnique: jest.fn(async () => mutation) },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  };
  return { prisma, tx, hard: () => [...hard] };
}

describe('Onboarding V2 contract', () => {
  it('stays locked to the live-audited allergen policy (deferred tokens are not accepted)', () => {
    expect([...SUPPORTED_ONBOARDING_ALLERGEN_IDS]).toEqual([...ENABLED_ONBOARDING_ALLERGEN_TOKENS]);
    expect(SUPPORTED_ONBOARDING_ALLERGEN_IDS).not.toContain('lupin');
    expect(SUPPORTED_ONBOARDING_ALLERGEN_IDS).not.toContain('sulphites');
  });

  it('accepts partial preference patches but requires optimistic revision on every write', async () => {
    const good = plainToInstance(SaveOnboardingDraftDto, {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 0,
      step: 'preferences',
      preferences: { dietPattern: 'vegan' },
    });
    expect(await validate(good)).toEqual([]);
    const missingRevision = plainToInstance(SaveOnboardingDraftDto, {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      step: 'preferences',
      preferences: { weekdayTimeBucket: 'under_15', cooksForCount: '2' },
    });
    expect(await validate(missingRevision)).not.toEqual([]);

    const prisma = { $transaction: jest.fn(), onboardingMutation: { findUnique: jest.fn() } } as any;
    await expect(new OnboardingV2Service(prisma).saveDraft('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 0,
      step: 'preferences',
      preferences: {},
    } as SaveOnboardingDraftDto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'preferences_empty' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires explicit acceptance of the current Terms version on every safety write', async () => {
    const valid = plainToInstance(SaveOnboardingDraftDto, safetyDto());
    expect(await validate(valid, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);

    const missing = plainToInstance(SaveOnboardingDraftDto, safetyDto({ terms: undefined }));
    expect(await validate(missing, { whitelist: true, forbidNonWhitelisted: true }))
      .not.toEqual([]);

    const stale = plainToInstance(SaveOnboardingDraftDto, safetyDto({
      terms: { accepted: true, policyVersion: 'terms-stale' },
    }));
    expect(await validate(stale, { whitelist: true, forbidNonWhitelisted: true }))
      .not.toEqual([]);

    const prisma = {
      $transaction: jest.fn(),
      onboardingMutation: { findUnique: jest.fn() },
    } as any;
    await expect(new OnboardingV2Service(prisma).saveDraft(
      'u1',
      safetyDto({ terms: undefined }),
    )).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'current_terms_acceptance_required' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('locks taste calibration to at most 3 likes and 2 dislikes', async () => {
    const tooMany = plainToInstance(SaveOnboardingDraftDto, {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 0,
      step: 'taste',
      taste: {
        likedRecipeIds: ['l1', 'l2', 'l3', 'l4'],
        dislikedRecipeIds: ['d1', 'd2', 'd3'],
      },
    });
    expect(await validate(tooMany)).not.toEqual([]);

    const prisma = { $transaction: jest.fn(), onboardingMutation: { findUnique: jest.fn() } } as any;
    await expect(new OnboardingV2Service(prisma).saveDraft('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 0,
      step: 'taste',
      taste: {
        likedRecipeIds: ['l1', 'l2', 'l3', 'l4'],
        dislikedRecipeIds: [],
      },
    } as SaveOnboardingDraftDto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'taste_limit_exceeded' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('treats no-allergy and no-pork as independent declarations', async () => {
    const prisma = { $transaction: jest.fn(), onboardingMutation: { findUnique: jest.fn() } } as any;
    const svc = new OnboardingV2Service(prisma);
    // Rules do not turn an allergy status into "declared" and are valid alongside "none".
    const valid = safetyDto({
      safety: { status: 'none', allergyIds: [], intoleranceIds: [], dietaryRules: ['no_pork'] },
    });
    // Reaching the mocked transaction proves normalization accepted the invariant.
    await expect(svc.saveDraft('u1', valid)).resolves.toBeUndefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    const rejectPrisma = { $transaction: jest.fn(), onboardingMutation: { findUnique: jest.fn() } } as any;
    await expect(new OnboardingV2Service(rejectPrisma).saveDraft('u1', safetyDto({
      safety: { status: 'declared', allergyIds: [], intoleranceIds: [], dietaryRules: ['no_pork'] },
    }))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'safety_declaration_empty' }) });
    expect(rejectPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not reinterpret a legacy no-pork rule as an allergy declaration', async () => {
    const prisma: any = {
      onboardingProfile: { findUnique: jest.fn(async () => null) },
      user: { findUnique: jest.fn(async () => ({ onboardingCompletedAt: null })) },
      userAllergy: { findMany: jest.fn(async () => []) },
      userPreference: { findUnique: jest.fn(async () => null) },
      userFact: { findMany: jest.fn(async () => [{
        key: 'declared.dietary.cultural_constraints',
        value: { v: ['no_pork'] },
        updatedAt: NOW,
      }]) },
    };
    const view = await new OnboardingV2Service(prisma).getProfile('u1');
    expect(view.safety).toEqual({
      status: 'unknown',
      allergyIds: [],
      intoleranceIds: [],
      dietaryRules: ['no_pork'],
    });
  });

  it('accepts the versioned consent object used by the client and rejects the removed flat field', async () => {
    const good = plainToInstance(CompleteOnboardingV2Dto, {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 3,
      consent: completionConsent(true),
      taste: completionTaste,
    });
    expect(await validate(good, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
    const staleClientShape = plainToInstance(CompleteOnboardingV2Dto, {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 3,
      personalizationConsent: true,
    });
    expect(await validate(staleClientShape, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
    const inventedAnalyticsAnswer = plainToInstance(CompleteOnboardingV2Dto, {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 3,
      consent: { ...completionConsent(true), analytics: false },
      taste: completionTaste,
    });
    expect(await validate(inventedAnalyticsAnswer, { whitelist: true, forbidNonWhitelisted: true }))
      .not.toEqual([]);
    const missingTerms = plainToInstance(CompleteOnboardingV2Dto, {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 3,
      consent: { ...completionConsent(true), termsAccepted: false },
      taste: completionTaste,
    });
    expect(await validate(missingTerms, { whitelist: true, forbidNonWhitelisted: true }))
      .not.toEqual([]);
    const stalePrivacy = plainToInstance(CompleteOnboardingV2Dto, {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 3,
      consent: { ...completionConsent(true), privacyPolicyVersion: 'privacy-stale' },
      taste: completionTaste,
    });
    expect(await validate(stalePrivacy, { whitelist: true, forbidNonWhitelisted: true }))
      .not.toEqual([]);
  });

  it('never stores taste in a pre-consent draft', async () => {
    const prisma = { $transaction: jest.fn(), onboardingMutation: { findUnique: jest.fn() } } as any;
    await expect(new OnboardingV2Service(prisma).saveDraft('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_A,
      expectedRevision: 0,
      step: 'taste',
      taste: completionTaste,
    } as SaveOnboardingDraftDto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'taste_requires_atomic_consent' }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unsupported allergens and allergy/intolerance overlap before opening a transaction', async () => {
    const prisma = { $transaction: jest.fn(), onboardingMutation: { findUnique: jest.fn() } } as any;
    const svc = new OnboardingV2Service(prisma);
    await expect(svc.saveDraft('u1', safetyDto({
      safety: { status: 'declared', allergyIds: ['lupin'], intoleranceIds: [], dietaryRules: [] },
    }))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'unsupported_allergen' }) });
    await expect(svc.saveDraft('u1', safetyDto({
      safety: { status: 'declared', allergyIds: ['egg'], intoleranceIds: ['egg'], dietaryRules: [] },
    }))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'allergy_intolerance_conflict' }) });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('replays an identical mutation exactly and rejects key reuse with changed data', async () => {
    const { prisma } = makeDraftPrisma();
    const svc = new OnboardingV2Service(prisma);
    const first = await svc.saveDraft('u1', safetyDto());
    const replay = await svc.saveDraft('u1', safetyDto());
    expect(first).toEqual({ revision: 1, replayed: false });
    expect(replay).toEqual({ revision: 1, replayed: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    await expect(svc.saveDraft('u1', safetyDto({
      safety: { status: 'declared', allergyIds: ['soy'], intoleranceIds: [], dietaryRules: [] },
      }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('records current Terms under the User lock and keeps the draft replay snapshot minimal', async () => {
    const { prisma, tx, upsert, mutation } = makeDraftPrisma({ currentTerms: false });
    const result = await new OnboardingV2Service(prisma).saveDraft('u1', safetyDto());

    expect(result).toEqual({ revision: 1, replayed: false });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userConsent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        purpose: 'terms',
        status: 'granted',
        lawfulBasis: TERMS_LAWFUL_BASIS,
        policyVersion: CURRENT_TERMS_POLICY_VERSION,
        source: 'onboarding',
      }),
    });
    expect(tx.consentLog.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_type: { userId: 'u1', type: 'terms' } },
    }));
    expect(tx.$queryRaw.mock.invocationCallOrder[0])
      .toBeLessThan(tx.userConsent.create.mock.invocationCallOrder[0]);
    expect(tx.userConsent.create.mock.invocationCallOrder[0])
      .toBeLessThan(upsert.mock.invocationCallOrder[0]);
    expect(mutation().response).toEqual({ revision: 1, replayed: false });
    expect(mutation().response).not.toHaveProperty('profile');
  });

  it('caps the per-user replay ledger after each successful mutation', async () => {
    const { prisma, tx } = makeDraftPrisma();
    tx.onboardingMutation.findMany.mockResolvedValueOnce([{ id: 'old-1' }, { id: 'old-2' }]);

    await new OnboardingV2Service(prisma).saveDraft('u1', safetyDto());

    expect(tx.onboardingMutation.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 64,
      select: { id: true },
    });
    expect(tx.onboardingMutation.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', id: { in: ['old-1', 'old-2'] } },
    });
  });

  it('rejects a preferences draft when no current Terms grant exists', async () => {
    const { prisma, tx, upsert } = makeDraftPrisma({ currentTerms: false });
    await expect(new OnboardingV2Service(prisma).saveDraft('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 0,
      step: 'preferences',
      preferences: { dietPattern: 'vegetarian' },
    } as SaveOnboardingDraftDto)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'current_terms_acceptance_required',
        requiredPolicyVersion: CURRENT_TERMS_POLICY_VERSION,
      }),
    });
    expect(tx.userConsent.create).not.toHaveBeenCalled();
    expect(tx.consentLog.upsert).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('rejects a stale draft revision with a conflict before writing', async () => {
    const { prisma, upsert } = makeDraftPrisma();
    await expect(new OnboardingV2Service(prisma).saveDraft('u1', safetyDto({
      expectedRevision: 9,
    }))).rejects.toMatchObject({ response: expect.objectContaining({ code: 'revision_conflict' }) });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('hydrates a first V2 draft from legacy safety/count rather than erasing settings', async () => {
    const { prisma, upsert } = makeDraftPrisma();
    const svc = new OnboardingV2Service(prisma);
    await svc.saveDraft('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 0,
      step: 'preferences',
      preferences: { dietPattern: 'vegetarian', weekdayTimeBucket: '15_30', cooksForCount: '3_4' },
    } as SaveOnboardingDraftDto);
    const create = upsert.mock.calls[0][0].create;
    expect(create.allergyIds).toEqual(['peanut']);
    expect(create.safetyStatus).toBe('declared');
    expect(create.cooksForCount).toBe('3_4');
  });

  it('accepts taste ids only through the published active/public recipe boundary', async () => {
    const { prisma, tx } = makeCompletePrisma();
    tx.recipe.findMany = jest.fn(async () => []);
    const svc = new OnboardingV2Service(prisma);
    await expect(svc.complete('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 3,
      consent: completionConsent(true),
      taste: { likedRecipeIds: ['private-recipe'], dislikedRecipeIds: [] },
    } as CompleteOnboardingV2Dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'taste_recipe_no_longer_available' }),
    });
    expect(tx.recipe.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['private-recipe'] },
        status: 'active',
        isPublic: true,
      }),
    }));
  });

  it('searches draft-safe published candidates and excludes an allergen conflict before completion', async () => {
    const recipe = (id: string, title: string, ingredientName: string, allergens: string[]) => ({
      id,
      title,
      diet: 'omnivore',
      region: 'global',
      imageUrl: null,
      cookingTime: 20,
      categories: [],
      containsPork: false,
      allergens: [],
      ingredients: [{
        name: ingredientName,
        ingredient: { allergens: { us9: allergens, eu14: allergens, other: [], mayContain: [] } },
      }],
      searchTerms: [{ term: 'stew' }],
    });
    const prisma: any = {
      onboardingProfile: { findUnique: jest.fn(async () => ({
        revision: 2,
        safetyStatus: 'declared',
        allergyIds: ['peanut'],
        intoleranceIds: [],
        dietaryRules: [],
        dietPattern: 'omnivore',
        weekdayTimeBucket: '15_30',
        likedRecipeIds: [],
        dislikedRecipeIds: [],
      })) },
      recipe: { findMany: jest.fn(async () => [
        recipe('unsafe', 'Peanut stew', 'peanut', ['peanut']),
        recipe('safe', 'Tomato stew', 'tomato', []),
      ]) },
    };
    const out = await new OnboardingV2Service(prisma).getTasteCandidates('u1', 6, 'stew');
    expect(out.items.map((item) => item.id)).toEqual(['safe']);
    expect(prisma.recipe.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'active', isPublic: true }),
    }));
  });
});

describe('Onboarding V2 atomic completion', () => {
  it('rejects a stale completion revision before any projection or completion marker write', async () => {
    const { prisma, tx } = makeCompletePrisma();

    await expect(new OnboardingV2Service(prisma).complete('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 2,
      consent: completionConsent(true),
      taste: completionTaste,
    } as CompleteOnboardingV2Dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'revision_conflict', currentRevision: 3 }),
    });

    expect(tx.userAllergy.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.onboardingMutation.create).not.toHaveBeenCalled();
  });

  it('preserves legacy hard exclusions, separates V2 kinds, stores declared taste, and never creates telemetry or Favorites', async () => {
    const { prisma, tx, hard } = makeCompletePrisma();
    const svc = new OnboardingV2Service(prisma);
    const result = await svc.complete('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 3,
      consent: completionConsent(true),
      taste: completionTaste,
    } as CompleteOnboardingV2Dto);

    expect(hard().sort()).toEqual(['dairy', 'egg', 'peanut']);
    expect(result.profileRevision).toBe(4);
    expect(result.nextPath).toBe('/');
    expect(result.completedAt).toEqual(expect.any(String));
    expect(result).not.toHaveProperty('profile');
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { onboardingCompletedAt: expect.any(Date) },
    }));
    expect(tx.userFeatureVector.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(tx.userFeature.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(tx.onboardingProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining(completionTaste),
    }));
    expect(tx.onboardingMutation.create.mock.calls.at(-1)?.[0].data.response)
      .not.toHaveProperty('profile');
    expect(tx.userFact.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_key: { userId: 'u1', key: 'declared.context.cooks_for_count' } },
      create: expect.objectContaining({ value: { v: '2' } }),
    }));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.consentLog.upsert).toHaveBeenCalledTimes(2);
    expect(tx.consentLog.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_type: { userId: 'u1', type: 'personalization' } },
    }));
    expect(tx.userConsent.create).toHaveBeenCalledTimes(2);
    expect(tx.userConsent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        purpose: 'terms',
        status: 'granted',
        policyVersion: CURRENT_TERMS_POLICY_VERSION,
      }),
    }));
    expect(tx.userConsent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        purpose: 'personalization',
        status: 'granted',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      }),
    }));
    expect(tx.userEvent.create).not.toHaveBeenCalled();
    expect(tx.eventOutbox.createMany).not.toHaveBeenCalled();
    expect(tx.favoriteRecipe).toBeUndefined();
  });

  it('records Terms and personalization while leaving analytics untouched', async () => {
    const { prisma, tx } = makeCompletePrisma();
    const svc = new OnboardingV2Service(prisma);
    await svc.complete('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 3,
      consent: completionConsent(true),
      taste: completionTaste,
    } as CompleteOnboardingV2Dto);
    const latestConsentPurposes = tx.consentLog.upsert.mock.calls.map(
      (call: any) => call[0].where.userId_type.type,
    );
    const ledgerPurposes = tx.userConsent.create.mock.calls.map(
      (call: any) => call[0].data.purpose,
    );
    expect(latestConsentPurposes).toEqual(['terms', 'personalization']);
    expect(ledgerPurposes).toEqual(['terms', 'personalization']);
  });

  it('clears and does not project taste when personalization is declined', async () => {
    const { prisma, tx } = makeCompletePrisma();
    tx.recipe.findMany.mockResolvedValue([]); // a stale/unpublished choice cannot block a refusal
    const result = await new OnboardingV2Service(prisma).complete('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 3,
      consent: completionConsent(false),
      taste: { likedRecipeIds: [], dislikedRecipeIds: [] },
    } as CompleteOnboardingV2Dto);

    expect(result).not.toHaveProperty('profile');
    expect(tx.onboardingProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ likedRecipeIds: [], dislikedRecipeIds: [] }),
    }));
    expect(tx.userEvent.create).not.toHaveBeenCalled();
    expect(tx.eventOutbox.createMany).not.toHaveBeenCalled();
    expect(tx.consentLog.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ granted: false }),
    }));
    expect(tx.userConsent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        purpose: 'personalization',
        status: 'declined',
        policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      }),
    }));
    expect(tx.recipe.findMany).not.toHaveBeenCalled();
  });

  it('rejects taste without consent and any grant while processing is disabled', async () => {
    const { prisma, tx } = makeCompletePrisma();
    const svc = new OnboardingV2Service(prisma);

    await expect(svc.complete('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 3,
      consent: completionConsent(false),
      taste: completionTaste,
    } as CompleteOnboardingV2Dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'taste_requires_personalization_consent' }),
    });

    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    try {
      await expect(svc.complete('u1', {
        schemaVersion: 2,
        idempotencyKey: UUID_A,
        expectedRevision: 3,
        consent: completionConsent(true),
        taste: completionTaste,
      } as CompleteOnboardingV2Dto)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'personalization_processing_disabled' }),
      });
    } finally {
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    }
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userAllergy.deleteMany).not.toHaveBeenCalled();
  });

  it('replays an identical completed transaction without repeating projections', async () => {
    const { prisma, tx } = makeCompletePrisma();
    const request = {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 3,
      consent: completionConsent(true),
      taste: completionTaste,
    } as CompleteOnboardingV2Dto;

    const first = await new OnboardingV2Service(prisma).complete('u1', request);
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    let replay;
    try {
      replay = await new OnboardingV2Service(prisma).complete('u1', request);
    } finally {
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    }

    expect(first.replayed).toBe(false);
    expect(replay.replayed).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('rechecks the personalization runtime after acquiring the user lock', async () => {
    const { prisma, tx } = makeCompletePrisma();
    tx.$queryRaw.mockImplementationOnce(async () => {
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
      return [{ id: 'u1' }];
    });
    try {
      await expect(new OnboardingV2Service(prisma).complete('u1', {
        schemaVersion: 2,
        idempotencyKey: UUID_B,
        expectedRevision: 3,
        consent: completionConsent(true),
        taste: completionTaste,
      } as CompleteOnboardingV2Dto)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'personalization_processing_disabled' }),
      });
    } finally {
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    }
    expect(tx.userAllergy.deleteMany).not.toHaveBeenCalled();
    expect(tx.userConsent.create).not.toHaveBeenCalled();
    expect(tx.userEvent.create).not.toHaveBeenCalled();
  });

  it('maps serializable transaction conflicts to a retryable domain conflict', async () => {
    const prisma = {
      onboardingMutation: { findUnique: jest.fn(async () => null) },
      $transaction: jest.fn(async () => {
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' });
      }),
    } as any;
    await expect(new OnboardingV2Service(prisma).saveDraft('u1', safetyDto()))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: 'serialization_conflict_retry' }) });
    await expect(new OnboardingV2Service(prisma).complete('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 3,
      consent: completionConsent(true),
      taste: completionTaste,
    } as CompleteOnboardingV2Dto))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: 'serialization_conflict_retry' }) });
  });

  it('does not mark completion when the hard-exclusion projection cannot be read back', async () => {
    const { prisma, tx } = makeCompletePrisma({ projectionFails: true });
    const svc = new OnboardingV2Service(prisma);
    await expect(svc.complete('u1', {
      schemaVersion: 2,
      idempotencyKey: UUID_B,
      expectedRevision: 3,
      consent: completionConsent(true),
      taste: completionTaste,
    } as CompleteOnboardingV2Dto)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'safety_projection_failed' }),
    });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.onboardingMutation.create).not.toHaveBeenCalled();
  });
});

describe('Onboarding V2 live features', () => {
  it('projects declared time/count-independent taste into the first feature vector', () => {
    const features = onboardingV2Features({
      schemaVersion: 2,
      completedAt: NOW,
      weekdayTimeBucket: 'under_15',
      likedRecipeIds: ['quick'],
      dislikedRecipeIds: ['slow'],
    }, true);
    expect(features.signal_quick_meal_lover).toBe(1);
    expect(features.onboarding_like_quick).toBe(1);
    expect(features.onboarding_dislike_slow).toBe(1);
  });

  it('keeps direct time preference but suppresses taste when personalization is not granted', () => {
    const features = onboardingV2Features({
      schemaVersion: 2,
      completedAt: NOW,
      weekdayTimeBucket: 'under_15',
      likedRecipeIds: ['quick'],
      dislikedRecipeIds: ['slow'],
    });
    expect(features.signal_quick_meal_lover).toBe(1);
    expect(features.onboarding_like_quick).toBeUndefined();
    expect(features.onboarding_dislike_slow).toBeUndefined();
  });

  it('keeps the 60-plus time answer as an explicit live feature', () => {
    const features = onboardingV2Features({
      schemaVersion: 2,
      completedAt: NOW,
      weekdayTimeBucket: '60_plus',
      likedRecipeIds: [],
      dislikedRecipeIds: [],
    });
    expect(features.signal_declared_time_60_plus).toBe(1);
  });
});
