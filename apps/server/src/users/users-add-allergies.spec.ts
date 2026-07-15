import { UsersService } from './users.service';
import { validate } from 'class-validator';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

function withCanonicalUserLock(tx: Record<string, any>, order: string[] = []) {
  tx.$executeRaw = jest.fn().mockResolvedValue(0);
  tx.$queryRaw = jest.fn().mockImplementation(async () => {
    order.push('user-lock');
    return [{ id: 'u1' }];
  });
  return tx;
}

/** Focused spec for the ADDITIVE allergy write (conversational-allergy §3). Mocks only the Prisma surface
 *  addAllergies touches; the other UsersService deps are unused here. */
function makeService() {
  const order: string[] = [];
  const upsert = jest.fn().mockImplementation(async () => {
    order.push('allergy-upsert');
    return {};
  });
  const findMany = jest.fn().mockImplementation(({ where }: any) => {
    order.push('allergy-read');
    return Promise.resolve((where.name.in as string[]).map((_n, i) => ({ id: 'a' + i })));
  });
  const createMany = jest.fn().mockImplementation(async () => {
    order.push('user-allergy-write');
    return { count: 1 };
  });
  const tx = withCanonicalUserLock({ allergy: { upsert, findMany }, userAllergy: { createMany } }, order);
  const prisma = { $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)) } as any;
  const svc = new UsersService(prisma, {} as any, {} as any, {} as any);
  return { svc, prisma, tx, order, upsert, findMany, createMany };
}

describe('UsersService.addAllergies (additive §3 write)', () => {
  it('ADDS allergens WITHOUT replacing the set (no deleteMany), idempotent via skipDuplicates', async () => {
    const { svc, upsert, createMany, prisma, tx, order } = makeService();
    const r = await svc.addAllergies('u1', ['nut', 'peanut']);
    expect(r.added).toEqual(['nut', 'peanut']);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    // additive: there is NO deleteMany on userAllergy anywhere in the transaction (unlike updatePreferences).
    expect(JSON.stringify(prisma.$transaction.mock.calls)).not.toContain('deleteMany');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(order[0]).toBe('user-lock');
    expect(order.indexOf('user-allergy-write')).toBeGreaterThan(order.indexOf('user-lock'));
  });

  it('dedups + lowercases + trims; empty input is a no-op that never opens a transaction', async () => {
    const { svc } = makeService();
    expect((await svc.addAllergies('u1', [' Nut ', 'nut', '', '  '])).added).toEqual(['nut']);

    const fresh = makeService();
    expect((await fresh.svc.addAllergies('u1', [])).added).toEqual([]);
    expect(fresh.prisma.$transaction).not.toHaveBeenCalled();
  });

  // guardian: WRITE-BOUNDARY allowlist — only canonical EU-14 chip tokens are written; a crafted client cannot
  // pollute the global Allergy table with arbitrary strings.
  it('drops non-canonical tokens; keeps valid ones from a mixed batch', async () => {
    const { svc } = makeService();
    const r = await svc.addAllergies('u1', [
      'nut',
      'free_text',
      'DROP TABLE allergies',
      'peanut',
      'tree_nuts',
      'lupin',
      'sulphites',
    ]);
    expect(r.added).toEqual(['nut', 'peanut']); // deferred + recipe-side + arbitrary tokens are dropped
  });

  it('all-invalid input is a no-op that never opens a transaction', async () => {
    const svc2 = makeService();
    const r = await svc2.svc.addAllergies('u1', ['banana', 'chocolate', 'gluten_free']);
    expect(r.added).toEqual([]);
    expect(svc2.prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('UsersService.removeAllergies', () => {
  it('removes only requested canonical allergens for that user', async () => {
    const order: string[] = [];
    const findMany = jest.fn().mockImplementation(async () => {
      order.push('allergy-read');
      return [{ id: 'a1', name: 'egg' }];
    });
    const deleteMany = jest.fn().mockImplementation(async () => {
      order.push('user-allergy-delete');
      return { count: 1 };
    });
    const tx = withCanonicalUserLock({ allergy: { findMany }, userAllergy: { deleteMany } }, order);
    const prisma = { $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)) } as any;
    const svc = new UsersService(prisma, {} as any, {} as any, {} as any);

    const r = await svc.removeAllergies('u1', ['egg', 'banana', 'DROP TABLE allergies']);

    expect(r.removed).toEqual(['egg']);
    expect(findMany).toHaveBeenCalledWith({ where: { name: { in: ['egg'] } }, select: { id: true, name: true } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', allergyId: { in: ['a1'] } } });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['user-lock', 'allergy-read', 'user-allergy-delete']);
  });

  it('allows explicit removal of a deferred legacy declaration without allowing its creation', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'legacy-lupin', name: 'lupin' }]);
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = withCanonicalUserLock({ allergy: { findMany }, userAllergy: { deleteMany } });
    const prisma = { $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)) } as any;
    const svc = new UsersService(prisma, {} as any, {} as any, {} as any);

    await expect(svc.removeAllergies('u1', ['lupin'])).resolves.toEqual({ removed: ['lupin'] });
    expect(findMany).toHaveBeenCalledWith({
      where: { name: { in: ['lupin'] } },
      select: { id: true, name: true },
    });
  });

  it('all-invalid removal is a no-op that never opens a transaction', async () => {
    const prisma = { $transaction: jest.fn() } as any;
    const svc = new UsersService(prisma, {} as any, {} as any, {} as any);

    await expect(svc.removeAllergies('u1', ['banana'])).resolves.toEqual({ removed: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

// guardian (re-verify pass): the PRIMARY allergy write (updatePreferences, used by onboarding + settings) must
// enforce the SAME canonical allowlist as addAllergies — else a crafted client pollutes the global Allergy table
// and writes a non-canonical token the hard gate silently ignores.
describe('UsersService.updatePreferences allergy allowlist', () => {
  it('rejects a mixed unsupported payload without writing any allergy token', async () => {
    const allergyUpsert = jest.fn(async () => ({}));
    const tx = {
      userPreference: { upsert: jest.fn(async () => ({})) },
      userAllergy: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
      allergy: { upsert: allergyUpsert, findMany: jest.fn(async () => []) },
      userCuisine: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
      cuisine: { upsert: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
      userHealthGoal: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
      healthGoal: { upsert: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
      preferenceHistory: { createMany: jest.fn(async () => ({})) },
    };
    const prisma = { user: { findUnique: jest.fn(async () => null) }, $transaction: jest.fn(async (cb: any) => cb(tx)) } as any;
    const consent = { hasPurpose: jest.fn(async () => true) };
    const svc = new UsersService(prisma, {} as any, {} as any, consent as any);

    await expect(svc.updatePreferences('u1', { allergies: ['nut', 'free_text', 'peanut', 'DROP TABLE allergies', 'penut', 'lupin', 'sulphites'], diet: 'omnivore', skillLevel: 'beginner', budget: 'low' } as any))
      .rejects.toThrow('Preferences contain an unsupported allergen token');

    expect(consent.hasPurpose).toHaveBeenCalledWith('u1', 'personalization');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(allergyUpsert).not.toHaveBeenCalled();
  });

  it('locks before its in-transaction read and preserves a concurrent legacy exclusion during replace', async () => {
    const order: string[] = [];
    const allergyUpsert = jest.fn(async () => {
      order.push('allergy-upsert');
      return {};
    });
    const createMany = jest.fn(async () => {
      order.push('user-allergy-create');
      return {};
    });
    const tx = withCanonicalUserLock({
      user: {
        // This is the state visible only after waiting for the canonical User lock.
        // Preserving lupin proves the replace did not use an unlocked stale pre-read.
        findUnique: jest.fn(async () => {
          order.push('locked-profile-read');
          return {
            preferences: null,
            allergies: [{ allergy: { name: 'lupin' } }],
            cuisines: [],
            healthGoals: [],
          };
        }),
      },
      userPreference: { upsert: jest.fn(async () => ({})) },
      userAllergy: {
        deleteMany: jest.fn(async () => {
          order.push('user-allergy-delete');
          return {};
        }),
        createMany,
      },
      allergy: {
        upsert: allergyUpsert,
        findMany: jest.fn(async ({ where }: any) =>
          where.name.in.map((name: string, index: number) => ({ id: `a${index}`, name }))),
      },
      userCuisine: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
      cuisine: { upsert: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
      userHealthGoal: { deleteMany: jest.fn(async () => ({})), createMany: jest.fn(async () => ({})) },
      healthGoal: { upsert: jest.fn(async () => ({})), findMany: jest.fn(async () => []) },
      preferenceHistory: { createMany: jest.fn(async () => ({})) },
    }, order);
    const rootRead = jest.fn(async () => {
      order.push('post-commit-profile-read');
      return {
        preferences: null,
        allergies: [{ allergy: { name: 'egg' } }, { allergy: { name: 'lupin' } }],
        cuisines: [],
        healthGoals: [],
      };
    });
    const prisma = {
      user: { findUnique: rootRead },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    } as any;
    const svc = new UsersService(prisma, {} as any, {} as any, {} as any);

    await svc.updatePreferences('u1', { allergies: ['egg'] } as any);

    expect(allergyUpsert.mock.calls.map((call: any) => call[0].where.name).sort())
      .toEqual(['egg', 'lupin']);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: 'u1', allergyId: 'a0' }),
        expect.objectContaining({ userId: 'u1', allergyId: 'a1' }),
      ]),
    }));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(rootRead).toHaveBeenCalledTimes(1);
    expect(order.indexOf('locked-profile-read')).toBeGreaterThan(order.indexOf('user-lock'));
    expect(order.indexOf('user-allergy-delete')).toBeGreaterThan(order.indexOf('locked-profile-read'));
    expect(order.at(-1)).toBe('post-commit-profile-read');
  });
});

describe('UpdatePreferencesDto', () => {
  it('accepts the settings food-profile payload with array fields', async () => {
    const dto = Object.assign(new UpdatePreferencesDto(), {
      diet: 'omnivore',
      allergies: ['egg', 'gluten'],
      cuisine: [],
      healthGoals: [],
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects malformed scalar allergy fields before they reach the write path', async () => {
    const dto = Object.assign(new UpdatePreferencesDto(), {
      diet: 'omnivore',
      allergies: 'egg',
    });

    await expect(validate(dto)).resolves.not.toEqual([]);
  });
});
