import { GuestReaperService } from './guest-reaper.service';

const make = () => {
  const findMany = jest.fn();
  const del = jest.fn();
  const prisma: any = { user: { findMany, delete: del } };
  return { svc: new GuestReaperService(prisma), findMany, del };
};

describe('GuestReaperService.reapOnce', () => {
  it('only targets EMPTY guests older than the TTL (isGuest + cutoff + every trace empty)', async () => {
    const { svc, findMany, del } = make();
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    del.mockResolvedValue({});
    const now = new Date('2026-06-22T12:00:00.000Z');

    const out = await svc.reapOnce(now);

    const where = findMany.mock.calls[0][0].where;
    expect(where.isGuest).toBe(true);
    // 48h TTL cutoff computed from the injected now
    expect(where.createdAt.lt.toISOString()).toBe('2026-06-20T12:00:00.000Z');
    // a declared allergy / any activity must protect the row
    expect(where.allergies).toEqual({ none: {} });
    expect(where.favorites).toEqual({ none: {} });
    expect(where.events).toEqual({ none: {} });
    expect(where.mealPlans).toEqual({ none: {} });
    expect(where.preferences).toEqual({ is: null });
    expect(out).toEqual({ deleted: 2, scanned: 2 });
    expect(del).toHaveBeenCalledTimes(2);
  });

  it('never aborts the batch on a single bad row (residual FK) — skips and continues', async () => {
    const { svc, findMany, del } = make();
    findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    del
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: 'P2003' }) // FK blocked → keep, skip
      .mockResolvedValueOnce({});
    const out = await svc.reapOnce(new Date('2026-06-22T12:00:00.000Z'));
    expect(out).toEqual({ deleted: 2, scanned: 3 });
  });

  it('no candidates → deletes nothing', async () => {
    const { svc, findMany, del } = make();
    findMany.mockResolvedValue([]);
    const out = await svc.reapOnce(new Date('2026-06-22T12:00:00.000Z'));
    expect(del).not.toHaveBeenCalled();
    expect(out).toEqual({ deleted: 0, scanned: 0 });
  });
});
