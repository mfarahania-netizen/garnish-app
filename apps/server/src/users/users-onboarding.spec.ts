/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { validate } from 'class-validator';
import {
  CURRENT_PRIVACY_POLICY_VERSION,
  CURRENT_TERMS_POLICY_VERSION,
  TERMS_LAWFUL_BASIS,
} from '../consent/consent.constants';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UsersService } from './users.service';
import { OptionalProcessingBoundaryOperationalError } from '../consent/optional-processing-transaction-boundary.service';
import { sanitizeUser } from '../common/serializers/user.serializer';

const dto = (
  overrides: Partial<CompleteOnboardingDto> = {},
): CompleteOnboardingDto =>
  Object.assign(new CompleteOnboardingDto(), {
    allergies: ['egg'],
    allergyDecision: 'declared',
    diet: 'vegan',
    termsAccepted: true,
    personalizationConsent: false,
    termsPolicyVersion: CURRENT_TERMS_POLICY_VERSION,
    privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    ...overrides,
  });

function harness(
  options: {
    completedAt?: Date | null;
    readBackAllergies?: string[];
    existingDecisions?: boolean;
    failAt?: 'preference' | 'allergy' | 'terms-consent' | 'personalization-consent';
    serializeTransactions?: boolean;
  } = {},
) {
  const completedAt = options.completedAt ?? null;
  const latest = new Map<string, any>();
  if (options.existingDecisions) {
    latest.set('terms', {
      status: 'granted',
      lawfulBasis: TERMS_LAWFUL_BASIS,
      policyVersion: CURRENT_TERMS_POLICY_VERSION,
      source: 'onboarding',
    });
    latest.set('personalization', {
      status: 'declined',
      lawfulBasis: 'consent',
      policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      source: 'onboarding',
    });
  }
  const user = {
    id: 'u1',
    phone: '09120000000',
    name: null,
    email: null,
    avatar: null,
    isAdmin: false,
    adminRole: 'viewer',
    isGuest: false,
    onboardingCompletedAt: completedAt,
    createdAt: new Date('2026-01-01'),
  };
  const userUpdate = jest.fn(async () => ({
    ...user,
    onboardingCompletedAt: (user.onboardingCompletedAt = new Date('2026-07-12')),
  }));
  const consentCreate = jest.fn(async ({ data }: any) => {
    if (options.failAt === `${data.purpose}-consent`) throw new Error('injected write failure');
    const row = { ...data };
    latest.set(data.purpose, row);
    return row;
  });
  const consentLogExisting = options.existingDecisions
    ? { purpose: 'terms', granted: true }
    : null;
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    user: { findUnique: jest.fn(async () => user), update: userUpdate },
    userPreference: {
      upsert: jest.fn(async () => {
        if (options.failAt === 'preference') throw new Error('injected write failure');
        return {};
      }),
      findUnique: jest.fn(async () => ({ id: 'pref-1', diet: 'vegan' })),
    },
    allergy: {
      upsert: jest.fn(async () => ({})),
      findMany: jest.fn(async ({ where }: any) =>
        (where.name.in as string[]).map((name) => ({ id: `a-${name}` })),
      ),
    },
    userAllergy: {
      deleteMany: jest.fn(async () => {
        if (options.failAt === 'allergy') throw new Error('injected write failure');
        return { count: 1 };
      }),
      createMany: jest.fn(async () => ({ count: 1 })),
      findMany: jest.fn(async () =>
        (options.readBackAllergies ?? ['egg']).map((name) => ({
          allergy: { name },
        })),
      ),
    },
    userConsent: {
      findFirst: jest.fn(
        async ({ where }: any) => latest.get(where.purpose) ?? null,
      ),
      create: consentCreate,
    },
    consentLog: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (!options.existingDecisions) return null;
        return where.userId_type.type === 'terms'
          ? consentLogExisting
          : { purpose: 'personalization', granted: false };
      }),
      create: jest.fn(async () => ({})),
      update: jest.fn(async () => ({})),
    },
  };
  let transactionQueue = Promise.resolve<unknown>(undefined);
  const transaction = jest.fn((fn: any) => {
    if (!options.serializeTransactions) return fn(tx);
    const result = transactionQueue.then(() => fn(tx));
    transactionQueue = result.then(() => undefined, () => undefined);
    return result;
  });
  const prisma = { $transaction: transaction } as any;
  const service = new UsersService(prisma, {} as any, {} as any, {} as any);
  return { service, prisma, tx, userUpdate, consentCreate };
}

describe('UsersService.completeOnboardingCommand', () => {
  it('commits canonical binary allergies, explicit decisions and only then completion', async () => {
    const h = harness();

    const result = await h.service.completeOnboardingCommand(
      'u1',
      dto(),
      '127.0.0.1',
    );

    expect(h.tx.userAllergy.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(h.tx.userAllergy.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(h.consentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purpose: 'terms',
          status: 'granted',
          lawfulBasis: TERMS_LAWFUL_BASIS,
          policyVersion: CURRENT_TERMS_POLICY_VERSION,
          source: 'onboarding',
        }),
      }),
    );
    expect(h.consentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          purpose: 'personalization',
          status: 'declined',
          lawfulBasis: 'consent',
          policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          source: 'onboarding',
        }),
      }),
    );
    expect(h.userUpdate).toHaveBeenCalledTimes(1);
    expect(result.preferences).toEqual({
      diet: 'vegan',
      allergies: ['egg'],
      allergyDecision: 'declared',
    });
    expect(result.consent.personalization.granted).toBe(false);
    expect(result.consent.personalization.processingEnabled).toBe(false);
  });

  it('fails before completion when canonical read-back does not match', async () => {
    const h = harness({ readBackAllergies: [] });

    await expect(
      h.service.completeOnboardingCommand('u1', dto()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.userUpdate).not.toHaveBeenCalled();
  });

  it.each(['preference', 'allergy', 'terms-consent', 'personalization-consent'] as const)(
    'never reaches completion when the %s critical write fails',
    async (failAt) => {
      const h = harness({ failAt });
      await expect(h.service.completeOnboardingCommand('u1', dto())).rejects.toMatchObject({
        name: OptionalProcessingBoundaryOperationalError.name,
        cause: expect.objectContaining({ message: 'injected write failure' }),
      });
      expect(h.userUpdate).not.toHaveBeenCalled();
    },
  );

  it('rejects non-canonical allergens before opening a transaction', async () => {
    const h = harness();

    await expect(
      h.service.completeOnboardingCommand(
        'u1',
        dto({ allergies: ['egg', 'free-text'] }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['none with a non-empty set', { allergyDecision: 'none', allergies: ['egg'] }],
    ['declared with an empty set', { allergyDecision: 'declared', allergies: [] }],
  ] as Array<[string, Partial<CompleteOnboardingDto>]>)('rejects inconsistent explicit allergy decisions: %s', async (_label, overrides) => {
    const h = harness();
    await expect(
      h.service.completeOnboardingCommand(
        'u1',
        dto(overrides),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('retries idempotently: matching decisions are not duplicated and completion time is preserved', async () => {
    const firstCompletion = new Date('2026-06-01T10:00:00.000Z');
    const h = harness({
      completedAt: firstCompletion,
      existingDecisions: true,
    });

    const result = await h.service.completeOnboardingCommand('u1', dto());

    expect(h.consentCreate).not.toHaveBeenCalled();
    expect(h.userUpdate).not.toHaveBeenCalled();
    expect(h.tx.userPreference.upsert).not.toHaveBeenCalled();
    expect(h.tx.userAllergy.deleteMany).not.toHaveBeenCalled();
    expect(result.user.onboardingCompletedAt).toEqual(firstCompletion);
  });

  it('serializes concurrent identical commands into one mutation and one exact retry', async () => {
    const h = harness({ serializeTransactions: true });

    const [first, second] = await Promise.all([
      h.service.completeOnboardingCommand('u1', dto()),
      h.service.completeOnboardingCommand('u1', dto()),
    ]);

    expect(first.preferences).toEqual(second.preferences);
    expect(h.userUpdate).toHaveBeenCalledTimes(1);
    expect(h.tx.userAllergy.deleteMany).toHaveBeenCalledTimes(1);
    expect(h.consentCreate).toHaveBeenCalledTimes(2);
    expect(h.prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'ReadCommitted' }),
    );
  });

  it('rejects the conflicting command after a concurrent winner completes', async () => {
    const h = harness({ serializeTransactions: true });

    const results = await Promise.allSettled([
      h.service.completeOnboardingCommand('u1', dto()),
      h.service.completeOnboardingCommand('u1', dto({ allergyDecision: 'none', allergies: [] })),
    ]);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    if (results[1].status === 'rejected') expect(results[1].reason).toBeInstanceOf(ConflictException);
    expect(h.userUpdate).toHaveBeenCalledTimes(1);
    expect(h.tx.userAllergy.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('retries a serializable transaction conflict and re-enters the canonical command', async () => {
    const h = harness();
    let firstAttempt = true;
    h.prisma.$transaction.mockImplementation((fn: any) => {
      if (firstAttempt) {
        firstAttempt = false;
        return Promise.reject(Object.assign(new Error('serialization conflict'), { code: 'P2034' }));
      }
      return fn(h.tx);
    });

    await expect(h.service.completeOnboardingCommand('u1', dto())).resolves.toMatchObject({
      user: { onboardingCompletedAt: expect.any(Date) },
    });
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('records an explicit personalization grant separately from Terms', async () => {
    const h = harness();

    const result = await h.service.completeOnboardingCommand(
      'u1',
      dto({ personalizationConsent: true }),
    );

    expect(h.consentCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        purpose: 'personalization',
        status: 'granted',
        lawfulBasis: 'consent',
      }),
    }));
    expect(result.consent.personalization.granted).toBe(true);
    expect(result.consent.personalization.processingEnabled).toBe(false);
  });

  it('rejects a replay that differs from completed canonical state without mutating it', async () => {
    const h = harness({ completedAt: new Date('2026-06-01'), existingDecisions: true });

    await expect(
      h.service.completeOnboardingCommand('u1', dto({ allergies: [], allergyDecision: 'none' })),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(h.tx.userPreference.upsert).not.toHaveBeenCalled();
    expect(h.tx.userAllergy.deleteMany).not.toHaveBeenCalled();
    expect(h.consentCreate).not.toHaveBeenCalled();
    expect(h.userUpdate).not.toHaveBeenCalled();
  });

  it('keeps the legacy completion route fail-closed for an incomplete user without prerequisites', async () => {
    const h = harness();

    await expect(h.service.completeOnboarding('u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(h.userUpdate).not.toHaveBeenCalled();
  });

  it('legacy completion still rejects when preferences and current consents pre-exist but no allergy decision proof exists', async () => {
    const h = harness({ existingDecisions: true });

    await expect(h.service.completeOnboarding('u1')).rejects.toBeInstanceOf(BadRequestException);

    expect(h.tx.userPreference.findUnique).not.toHaveBeenCalled();
    expect(h.tx.userConsent.findFirst).not.toHaveBeenCalled();
    expect(h.userUpdate).not.toHaveBeenCalled();
  });
});

describe('legacy onboarding safety remediation', () => {
  const lookup = async (row: Record<string, unknown>) => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(row) } };
    const service = new UsersService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { user: await service.findByPhone('09120000000'), prisma };
  };

  it('routes a completed legacy user with empty allergies and no explicit decision proof back to onboarding', async () => {
    const { user } = await lookup({
      id: 'legacy-empty',
      onboardingCompletedAt: new Date('2025-01-01'),
      _count: { allergies: 0 },
      userConsents: [],
    });

    expect(user?.onboardingComplete).toBe(false);
  });

  it.each([
    ['a populated declared-allergy set', { _count: { allergies: 1 }, userConsents: [] }],
    ['atomic explicit-none proof', {
      _count: { allergies: 0 },
      userConsents: [
        { purpose: 'terms', status: 'granted', policyVersion: CURRENT_TERMS_POLICY_VERSION, source: 'onboarding' },
        { purpose: 'personalization', status: 'declined', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'onboarding' },
      ],
    }],
  ])('keeps a completed user compatible when safety is proven by %s', async (_label, proof) => {
    const { user } = await lookup({
      id: 'verified',
      onboardingCompletedAt: new Date('2026-07-12'),
      ...proof,
    });

    expect(user?.onboardingComplete).toBe(true);
  });

  it.each(['granted', 'withdrawn', 'declined'])(
    'keeps zero-allergy V2 completion true after a later Settings %s decision and through the auth serializer',
    async (settingsStatus) => {
      const completedAt = new Date('2026-07-14T10:00:00.000Z');
      const row = {
        id: `v2-${settingsStatus}`,
        phone: '09120000000',
        name: null,
        onboardingCompletedAt: completedAt,
        onboardingProfile: { completedAt },
        _count: { allergies: 0 },
        userConsents: [{
          purpose: 'personalization',
          status: settingsStatus,
          policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
          source: 'settings',
        }],
      };
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(row) } };
      const service = new UsersService(prisma as never, {} as never, {} as never, {} as never);

      const phoneUser = await service.findByPhone(row.phone);
      const idUser = await service.findById(row.id);

      expect(phoneUser?.onboardingComplete).toBe(true);
      expect((idUser as Record<string, any> | null)?.onboardingComplete).toBe(true);
      expect(sanitizeUser(phoneUser as Record<string, any>)?.onboardingComplete).toBe(true);
      expect(sanitizeUser(idUser as Record<string, any>)?.onboardingComplete).toBe(true);
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({
        include: expect.objectContaining({ onboardingProfile: { select: { completedAt: true } } }),
      }));
      expect(prisma.user.findUnique).toHaveBeenNthCalledWith(2, expect.objectContaining({
        select: expect.objectContaining({ onboardingProfile: { select: { completedAt: true } } }),
      }));
    },
  );

  it('uses historical atomic onboarding proof even when the latest optional decision is a Settings withdrawal', async () => {
    const { user } = await lookup({
      id: 'legacy-withdrawn-after-completion',
      onboardingCompletedAt: new Date('2026-07-12'),
      onboardingProfile: null,
      _count: { allergies: 0 },
      userConsents: [
        { purpose: 'personalization', status: 'withdrawn', policyVersion: CURRENT_PRIVACY_POLICY_VERSION, source: 'settings' },
        { purpose: 'personalization', status: 'declined', policyVersion: 'privacy-legacy', source: 'onboarding' },
        { purpose: 'terms', status: 'granted', policyVersion: 'terms-legacy', source: 'onboarding' },
      ],
    });

    expect(user?.onboardingComplete).toBe(true);
    expect(sanitizeUser(user as Record<string, any>)?.onboardingComplete).toBe(true);
  });

  it('treats immutable V2 profile completion as authoritative without the redundant legacy marker', async () => {
    const completedAt = new Date('2026-07-14T10:00:00.000Z');
    const { user } = await lookup({
      id: 'v2-profile-authoritative',
      onboardingCompletedAt: null,
      onboardingProfile: { completedAt },
      _count: { allergies: 0 },
      userConsents: [],
    });

    expect(user?.onboardingComplete).toBe(true);
    expect(sanitizeUser(user as Record<string, any>)?.onboardingComplete).toBe(true);
  });
});

describe('CompleteOnboardingDto', () => {
  it('accepts the current explicit contract', async () => {
    await expect(validate(dto())).resolves.toEqual([]);
  });

  it('rejects stale policy versions, missing personalization decision and non-array allergies', async () => {
    const invalid = dto({
      allergies: '["egg"]' as any,
      allergyDecision: 'unknown' as any,
      personalizationConsent: undefined,
      termsPolicyVersion: 'terms-stale' as any,
    });
    const errors = await validate(invalid);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining([
        'allergies',
        'allergyDecision',
        'personalizationConsent',
        'termsPolicyVersion',
      ]),
    );
  });
});
