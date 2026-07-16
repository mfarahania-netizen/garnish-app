import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOnboardingProfilePreferencesDto } from './dto/onboarding-v2.dto';
import { OnboardingV2Service } from './onboarding-v2.service';

const USER_ID = 'u1';
const UUID = '9e7f7af7-0ad1-4cdd-b31f-38a2e9ec48f1';
const COMPLETED_AT = new Date('2026-07-14T09:00:00.000Z');

const updateDto = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 2,
  idempotencyKey: UUID,
  expectedRevision: 7,
  dietPattern: 'vegetarian',
  weekdayTimeBucket: 'under_15',
  cooksForCount: '3_4',
  dietaryRules: ['no_pork'],
  ...overrides,
}) as UpdateOnboardingProfilePreferencesDto;

function selectFields(value: any, select?: Record<string, boolean>) {
  if (!value || !select) return value;
  return Object.fromEntries(Object.keys(select).map((key) => [key, value[key]]));
}

function makePrisma({
  legacyOnly = false,
  completed = true,
  stalePreferenceRead = false,
} = {}) {
  let profile: any = legacyOnly ? null : {
    userId: USER_ID,
    schemaVersion: 2,
    revision: 7,
    safetyStatus: 'declared',
    allergyIds: ['egg'],
    intoleranceIds: ['dairy'],
    dietaryRules: [],
    dietPattern: 'omnivore',
    weekdayTimeBucket: '15_30',
    cooksForCount: '2',
    likedRecipeIds: ['r-like'],
    dislikedRecipeIds: ['r-dislike'],
    completedAt: completed ? COMPLETED_AT : null,
    createdAt: COMPLETED_AT,
    updatedAt: COMPLETED_AT,
  };
  const legacyCompletedAt = completed || legacyOnly ? COMPLETED_AT : null;
  let preference: any = { diet: 'omnivore', updatedAt: COMPLETED_AT };
  const facts = new Map<string, any>([
    ['declared.dietary.intolerances', ['dairy']],
    ['declared.dietary.cultural_constraints', []],
    ['declared.constraints.cooking_time_workday', '15_30'],
    ['declared.context.cooks_for_count', '2'],
  ]);
  let mutation: any = null;
  const hardAllergies = ['egg', 'dairy'];

  const onboardingProfileFindUnique = jest.fn(async ({ select }: any = {}) =>
    selectFields(profile, select));
  const onboardingProfileUpsert = jest.fn(async ({ create, update }: any) => {
    if (!profile) {
      profile = {
        ...create,
        createdAt: COMPLETED_AT,
        updatedAt: COMPLETED_AT,
      };
    } else {
      profile = {
        ...profile,
        ...update,
        revision: update.revision?.increment
          ? Number(profile.revision) + Number(update.revision.increment)
          : update.revision,
        updatedAt: new Date(COMPLETED_AT.getTime() + 1_000),
      };
    }
    return profile;
  });
  const userPreferenceUpsert = jest.fn(async ({ create, update }: any) => {
    preference = { ...preference, ...(preference ? update : create), updatedAt: COMPLETED_AT };
    return preference;
  });
  const userPreferenceFindUnique = jest.fn(async ({ select }: any = {}) => {
    const visible = stalePreferenceRead ? { ...preference, diet: 'omnivore' } : preference;
    return selectFields(visible, select);
  });
  const userFactUpsert = jest.fn(async ({ create, update }: any) => {
    const data = facts.has(create.key) ? update : create;
    facts.set(create.key, data.value?.v ?? data.value);
    return { ...data, key: create.key };
  });
  const userFactFindMany = jest.fn(async ({ where }: any = {}) => {
    const requested = where?.key?.in ? new Set(where.key.in) : null;
    return [...facts.entries()]
      .filter(([key]) => !requested || requested.has(key))
      .map(([key, value]) => ({ key, value: { v: value }, updatedAt: COMPLETED_AT }));
  });

  const tx: any = {
    $executeRaw: jest.fn(async () => 0),
    $queryRaw: jest.fn(async () => [{ id: USER_ID }]),
    onboardingMutation: {
      findUnique: jest.fn(async () => mutation),
      create: jest.fn(async ({ data }: any) => {
        mutation = { id: 'mutation-1', ...data };
        return mutation;
      }),
      findMany: jest.fn(async () => []),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    onboardingProfile: {
      findUnique: onboardingProfileFindUnique,
      upsert: onboardingProfileUpsert,
    },
    user: {
      findUnique: jest.fn(async () => ({ onboardingCompletedAt: legacyCompletedAt })),
    },
    userAllergy: {
      findMany: jest.fn(async () => hardAllergies.map((name) => ({ allergy: { name } }))),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    userPreference: {
      findUnique: userPreferenceFindUnique,
      upsert: userPreferenceUpsert,
    },
    userFact: {
      findMany: userFactFindMany,
      upsert: userFactUpsert,
    },
    userFeatureVector: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    userFeature: { deleteMany: jest.fn(async () => ({ count: 1 })) },
  };
  const prisma: any = {
    onboardingMutation: { findUnique: jest.fn(async () => mutation) },
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  return {
    prisma,
    tx,
    profile: () => profile,
    preference: () => preference,
    facts,
    mutation: () => mutation,
    onboardingProfileUpsert,
    userPreferenceUpsert,
  };
}

describe('completed onboarding profile preferences DTO', () => {
  it('accepts only the complete audited snapshot and rejects allergy/taste fields', async () => {
    const valid = plainToInstance(UpdateOnboardingProfilePreferencesDto, updateDto());
    expect(await validate(valid, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);

    const missingTime = plainToInstance(UpdateOnboardingProfilePreferencesDto, updateDto({
      weekdayTimeBucket: undefined,
    }));
    expect(await validate(missingTime, { whitelist: true, forbidNonWhitelisted: true }))
      .not.toEqual([]);

    const expanded = plainToInstance(UpdateOnboardingProfilePreferencesDto, updateDto({
      allergyIds: ['egg'],
      likedRecipeIds: ['r-like'],
    }));
    const expandedErrors = await validate(expanded, { whitelist: true, forbidNonWhitelisted: true });
    expect(expandedErrors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['allergyIds', 'likedRecipeIds']),
    );
  });
});

describe('PATCH completed onboarding profile preferences service', () => {
  it('atomically synchronizes the editable projections without touching completion, allergy or taste', async () => {
    const state = makePrisma();
    const beforeCompletedAt = state.profile().completedAt;
    const beforeAllergies = [...state.profile().allergyIds];
    const beforeIntolerances = [...state.profile().intoleranceIds];
    const beforeLikes = [...state.profile().likedRecipeIds];
    const beforeDislikes = [...state.profile().dislikedRecipeIds];

    const result = await new OnboardingV2Service(state.prisma)
      .updateProfilePreferences(USER_ID, updateDto());

    expect(result).toEqual({
      revision: 8,
      completedAt: COMPLETED_AT.toISOString(),
      replayed: false,
    });
    expect(state.profile()).toMatchObject({
      revision: 8,
      completedAt: beforeCompletedAt,
      dietaryRules: ['no_pork'],
      dietPattern: 'vegetarian',
      weekdayTimeBucket: 'under_15',
      cooksForCount: '3_4',
      allergyIds: beforeAllergies,
      intoleranceIds: beforeIntolerances,
      likedRecipeIds: beforeLikes,
      dislikedRecipeIds: beforeDislikes,
    });
    const update = state.onboardingProfileUpsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('allergyIds');
    expect(update).not.toHaveProperty('intoleranceIds');
    expect(update).not.toHaveProperty('likedRecipeIds');
    expect(update).not.toHaveProperty('dislikedRecipeIds');
    expect(state.tx.userAllergy.deleteMany).not.toHaveBeenCalled();
    expect(state.tx.userAllergy.createMany).not.toHaveBeenCalled();
    expect(state.preference().diet).toBe('vegetarian');
    expect(state.facts.get('declared.dietary.cultural_constraints')).toEqual(['no_pork']);
    expect(state.facts.get('declared.constraints.cooking_time_workday')).toBe('under_15');
    expect(state.facts.get('declared.context.cooks_for_count')).toBe('3_4');
    expect(state.tx.userFeatureVector.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(state.tx.userFeature.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(state.tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(state.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(state.prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' });
    expect(state.mutation()?.response).toEqual(result);
    expect(state.mutation()?.response).not.toHaveProperty('dietPattern');
    expect(state.mutation()?.response).not.toHaveProperty('dietaryRules');
  });

  it('rejects stale revisions before any projection or cache write', async () => {
    const state = makePrisma();
    await expect(new OnboardingV2Service(state.prisma).updateProfilePreferences(
      USER_ID,
      updateDto({ expectedRevision: 6 }),
    )).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'revision_conflict', currentRevision: 7 }),
    });
    expect(state.userPreferenceUpsert).not.toHaveBeenCalled();
    expect(state.onboardingProfileUpsert).not.toHaveBeenCalled();
    expect(state.tx.userFeatureVector.deleteMany).not.toHaveBeenCalled();
    expect(state.tx.onboardingMutation.create).not.toHaveBeenCalled();
  });

  it('rejects users who have not completed onboarding', async () => {
    const state = makePrisma({ completed: false });
    await expect(new OnboardingV2Service(state.prisma).updateProfilePreferences(
      USER_ID,
      updateDto(),
    )).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'onboarding_not_completed' }),
    });
    expect(state.userPreferenceUpsert).not.toHaveBeenCalled();
    expect(state.onboardingProfileUpsert).not.toHaveBeenCalled();
  });

  it('creates and completes the V2 projection for a safely proven legacy completion', async () => {
    const state = makePrisma({ legacyOnly: true });
    const result = await new OnboardingV2Service(state.prisma).updateProfilePreferences(
      USER_ID,
      updateDto({ expectedRevision: 0 }),
    );

    expect(result.revision).toBe(1);
    expect(state.profile()).toMatchObject({
      revision: 1,
      completedAt: COMPLETED_AT,
      safetyStatus: 'declared',
      allergyIds: ['dairy', 'egg'],
      dietPattern: 'vegetarian',
      weekdayTimeBucket: 'under_15',
      cooksForCount: '3_4',
    });
    expect(state.tx.userAllergy.deleteMany).not.toHaveBeenCalled();
    expect(state.tx.userAllergy.createMany).not.toHaveBeenCalled();
  });

  it('replays the same idempotency key and rejects reuse with different answers', async () => {
    const state = makePrisma();
    const service = new OnboardingV2Service(state.prisma);
    const first = await service.updateProfilePreferences(USER_ID, updateDto());
    const replay = await service.updateProfilePreferences(USER_ID, updateDto());

    expect(first.replayed).toBe(false);
    expect(replay).toEqual({ ...first, replayed: true });
    expect(state.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(state.onboardingProfileUpsert).toHaveBeenCalledTimes(1);

    await expect(service.updateProfilePreferences(
      USER_ID,
      updateDto({ dietPattern: 'vegan' }),
    )).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'idempotency_key_reused' }),
    });
    expect(state.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('fails the transaction when a canonical projection cannot be read back', async () => {
    const state = makePrisma({ stalePreferenceRead: true });
    await expect(new OnboardingV2Service(state.prisma).updateProfilePreferences(
      USER_ID,
      updateDto(),
    )).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'profile_preferences_commit_verification_failed' }),
    });
    expect(state.tx.onboardingMutation.create).not.toHaveBeenCalled();
  });
});
