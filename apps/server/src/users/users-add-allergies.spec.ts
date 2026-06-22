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
