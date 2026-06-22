import { UsersService } from './users.service';

/** Focused spec for the ADDITIVE allergy write (conversational-allergy §3). Mocks only the Prisma surface
 *  addAllergies touches; the other UsersService deps are unused here. */
function makeService() {
  const upsert = jest.fn().mockResolvedValue({});
  const findMany = jest.fn().mockImplementation(({ where }: any) =>
    Promise.resolve((where.name.in as string[]).map((_n, i) => ({ id: 'a' + i }))));
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = { allergy: { upsert, findMany }, userAllergy: { createMany } };
  const prisma = { $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)) } as any;
  const svc = new UsersService(prisma, {} as any, {} as any, {} as any);
  return { svc, prisma, upsert, findMany, createMany };
}

describe('UsersService.addAllergies (additive §3 write)', () => {
  it('ADDS allergens WITHOUT replacing the set (no deleteMany), idempotent via skipDuplicates', async () => {
    const { svc, upsert, createMany, prisma } = makeService();
    const r = await svc.addAllergies('u1', ['nut', 'peanut']);
    expect(r.added).toEqual(['nut', 'peanut']);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    // additive: there is NO deleteMany on userAllergy anywhere in the transaction (unlike updatePreferences).
    expect(JSON.stringify(prisma.$transaction.mock.calls)).not.toContain('deleteMany');
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
    const r = await svc.addAllergies('u1', ['nut', 'free_text', 'DROP TABLE allergies', 'peanut', 'tree_nuts']);
    expect(r.added).toEqual(['nut', 'peanut']); // 'tree_nuts' is the recipe-side token, not a profile chip → dropped
  });

  it('all-invalid input is a no-op that never opens a transaction', async () => {
    const svc2 = makeService();
    const r = await svc2.svc.addAllergies('u1', ['banana', 'chocolate', 'gluten_free']);
    expect(r.added).toEqual([]);
    expect(svc2.prisma.$transaction).not.toHaveBeenCalled();
  });
});

// guardian (re-verify pass): the PRIMARY allergy write (updatePreferences, used by onboarding + settings) must
// enforce the SAME canonical allowlist as addAllergies — else a crafted client pollutes the global Allergy table
// and writes a non-canonical token the hard gate silently ignores.
describe('UsersService.updatePreferences allergy allowlist', () => {
  it('writes ONLY canonical chip tokens; drops free-text/typo/injection tokens', async () => {
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
    const svc = new UsersService(prisma, {} as any, {} as any, {} as any);

    await svc.updatePreferences('u1', { allergies: ['nut', 'free_text', 'peanut', 'DROP TABLE allergies', 'penut'], diet: 'omnivore', skillLevel: 'beginner', budget: 'low' } as any);

    const upserted = allergyUpsert.mock.calls.map((c: any) => c[0].where.name).sort();
    expect(upserted).toEqual(['nut', 'peanut']); // 'free_text'/'DROP TABLE…'/typo 'penut' dropped
  });
});
