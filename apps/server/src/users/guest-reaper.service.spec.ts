import { GuestReaperService } from './guest-reaper.service';
import { Prisma } from '@prisma/client';

const make = () => {
  const findMany = jest.fn();
  const deleteMany = jest.fn();
  const prisma: any = { user: { findMany, deleteMany } };
  return { svc: new GuestReaperService(prisma), findMany, deleteMany };
};

describe('GuestReaperService', () => {
  it('emptyGuestWhere guards EVERY User relation (DMMF-driven — no hand-list drift)', () => {
    const { svc } = make();
    const where: any = svc.emptyGuestWhere(new Date('2026-06-22T12:00:00.000Z'));

    expect(where.isGuest).toBe(true);
    expect(where.createdAt.lt.toISOString()).toBe('2026-06-20T12:00:00.000Z'); // 48h cutoff

    // every relation field on the User model must appear in the guard
    const userModel = Prisma.dmmf.datamodel.models.find((m) => m.name === 'User')!;
    const relations = userModel.fields.filter((f) => f.kind === 'object');
    for (const f of relations) {
      expect(where[f.name]).toEqual(f.isList ? { none: {} } : { is: null });
    }
    // spot-check the GDPR-sensitive + safety relations that the prior hand-list missed
    expect(where.userConsents).toEqual({ none: {} });
    expect(where.pantryItems).toEqual({ none: {} });
    expect(where.allergies).toEqual({ none: {} });
    expect(where.preferences).toEqual({ is: null });
  });

  it('deletes via an ATOMIC deleteMany that re-applies the full guard (closes find→delete TOCTOU)', async () => {
    const { svc, findMany, deleteMany } = make();
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    deleteMany.mockResolvedValue({ count: 1 });
    const now = new Date('2026-06-22T12:00:00.000Z');

    const out = await svc.reapOnce(now);

    expect(deleteMany).toHaveBeenCalledTimes(2);
    const arg = deleteMany.mock.calls[0][0].where;
    expect(arg.id).toBe('a');
    expect(arg.isGuest).toBe(true);
    expect(arg.userConsents).toEqual({ none: {} }); // full guard re-applied at delete time
    expect(out).toEqual({ deleted: 2, scanned: 2 });
  });

  it('does NOT count a guest that became active mid-pass (deleteMany matches 0)', async () => {
    const { svc, findMany, deleteMany } = make();
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 }) // became active between scan and delete → untouched
      .mockResolvedValueOnce({ count: 1 });
    const out = await svc.reapOnce(new Date('2026-06-22T12:00:00.000Z'));
    expect(out).toEqual({ deleted: 2, scanned: 3 });
  });

  it('never aborts the batch on a single delete error', async () => {
    const { svc, findMany, deleteMany } = make();
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    deleteMany.mockRejectedValueOnce({ code: 'P1001' }).mockResolvedValueOnce({ count: 1 });
    const out = await svc.reapOnce(new Date('2026-06-22T12:00:00.000Z'));
    expect(out).toEqual({ deleted: 1, scanned: 2 });
  });

  it('no candidates → deletes nothing', async () => {
    const { svc, findMany, deleteMany } = make();
    findMany.mockResolvedValue([]);
    const out = await svc.reapOnce(new Date('2026-06-22T12:00:00.000Z'));
    expect(deleteMany).not.toHaveBeenCalled();
    expect(out).toEqual({ deleted: 0, scanned: 0 });
  });
});
