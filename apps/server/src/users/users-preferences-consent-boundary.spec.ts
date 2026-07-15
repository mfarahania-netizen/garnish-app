import { CURRENT_PRIVACY_POLICY_VERSION } from '../consent/consent.constants';
import { UsersService } from './users.service';

const grantAt = new Date('2026-07-15T08:00:00.000Z');
const withdrawalAt = new Date('2026-07-15T08:01:00.000Z');

function consentRow(status: 'granted' | 'withdrawn', createdAt: Date) {
  return {
    id: `${status}-${createdAt.getTime()}`,
    purpose: 'personalization',
    status,
    policyVersion: CURRENT_PRIVACY_POLICY_VERSION,
    createdAt,
  };
}

function transactionHarness(rows: ReturnType<typeof consentRow>[]) {
  const order: string[] = [];
  const userPreferenceUpsert = jest.fn(async () => {
    order.push('preference-write');
    return {};
  });
  const transactionUserRead = jest.fn(async () => {
    order.push('profile-read');
    return {
      preferences: null,
      allergies: [],
      cuisines: [],
      healthGoals: [],
    };
  });
  const tx = {
    $executeRaw: jest.fn(async () => 0),
    $queryRaw: jest.fn(async () => {
      order.push('user-lock');
      return [{ id: 'u1' }];
    }),
    userConsent: {
      findMany: jest.fn(async () => {
        order.push('canonical-consent-read');
        return rows;
      }),
    },
    user: { findUnique: transactionUserRead },
    userPreference: { upsert: userPreferenceUpsert },
    userAllergy: {
      deleteMany: jest.fn(async () => {
        order.push('user-allergy-delete');
        return {};
      }),
      createMany: jest.fn(async () => {
        order.push('user-allergy-create');
        return {};
      }),
    },
    allergy: {
      upsert: jest.fn(async () => {
        order.push('allergy-upsert');
        return {};
      }),
      findMany: jest.fn(async () => {
        order.push('allergy-read');
        return [{ id: 'a1', name: 'egg' }];
      }),
    },
    userCuisine: {
      deleteMany: jest.fn(async () => ({})),
      createMany: jest.fn(async () => ({})),
    },
    cuisine: {
      upsert: jest.fn(async () => ({})),
      findMany: jest.fn(async () => [{ id: 'c1' }]),
    },
    userHealthGoal: { deleteMany: jest.fn(), createMany: jest.fn() },
    healthGoal: { upsert: jest.fn(), findMany: jest.fn() },
    preferenceHistory: { createMany: jest.fn(async () => ({})) },
  };
  const rootUserRead = jest.fn(async () => ({
    preferences: null,
    allergies: [],
    cuisines: [{ cuisine: { name: 'persian' } }],
    healthGoals: [],
  }));
  const prisma = {
    user: { findUnique: rootUserRead },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const consent = { hasPurpose: jest.fn(async () => true) };
  const service = new UsersService(
    prisma as any,
    {} as any,
    {} as any,
    consent as any,
  );
  return {
    service,
    prisma,
    consent,
    tx,
    order,
    rootUserRead,
    transactionUserRead,
    userPreferenceUpsert,
  };
}

describe('UsersService.updatePreferences canonical personalization boundary', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
  });

  afterAll(() => {
    if (previousRuntime === undefined) {
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    } else {
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
    }
  });

  it.each([
    ['cuisine', { cuisine: ['persian'] }],
    ['budget', { budget: 'low' }],
    ['healthGoals', { healthGoals: ['weight_loss'] }],
  ])('rejects a withdrawal that wins after the preflight check for %s without reading or writing optional profile data', async (_field, dto) => {
    const h = transactionHarness([
      consentRow('granted', grantAt),
      consentRow('withdrawn', withdrawalAt),
    ]);

    await expect(
      h.service.updatePreferences('u1', dto as any),
    ).rejects.toThrow('Personalization processing is not active');

    expect(h.consent.hasPurpose).toHaveBeenCalledWith('u1', 'personalization');
    expect(h.tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.tx.userConsent.findMany).toHaveBeenCalledTimes(1);
    expect(h.transactionUserRead).not.toHaveBeenCalled();
    expect(h.rootUserRead).not.toHaveBeenCalled();
    expect(h.userPreferenceUpsert).not.toHaveBeenCalled();
    expect(h.tx.userCuisine.deleteMany).not.toHaveBeenCalled();
    expect(h.tx.userHealthGoal.deleteMany).not.toHaveBeenCalled();
  });

  it('re-checks current consent under the user lock before the optional preference write', async () => {
    const h = transactionHarness([consentRow('granted', grantAt)]);

    await expect(
      h.service.updatePreferences('u1', { cuisine: ['persian'] } as any),
    ).resolves.toMatchObject({ cuisine: ['persian'] });

    expect(h.userPreferenceUpsert).toHaveBeenCalledTimes(1);
    expect(h.tx.userCuisine.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', cuisineId: 'c1' }],
      skipDuplicates: true,
    });
    expect(h.order.indexOf('user-lock')).toBeLessThan(
      h.order.indexOf('canonical-consent-read'),
    );
    expect(h.order.indexOf('canonical-consent-read')).toBeLessThan(
      h.order.indexOf('profile-read'),
    );
    expect(h.order.indexOf('profile-read')).toBeLessThan(
      h.order.indexOf('preference-write'),
    );
  });

  it('uses the same user-lock-first order when an optional save also replaces allergies', async () => {
    const h = transactionHarness([consentRow('granted', grantAt)]);

    await h.service.updatePreferences('u1', {
      cuisine: ['persian'],
      allergies: ['egg'],
    } as any);

    expect(h.tx.userAllergy.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(h.tx.userAllergy.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'u1', allergyId: 'a1' }],
      skipDuplicates: true,
    });
    expect(h.order.indexOf('user-lock')).toBeLessThan(
      h.order.indexOf('canonical-consent-read'),
    );
    expect(h.order.indexOf('canonical-consent-read')).toBeLessThan(
      h.order.indexOf('profile-read'),
    );
    expect(h.order.indexOf('profile-read')).toBeLessThan(
      h.order.indexOf('user-allergy-delete'),
    );
  });
});
