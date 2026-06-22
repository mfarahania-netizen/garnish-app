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
});
