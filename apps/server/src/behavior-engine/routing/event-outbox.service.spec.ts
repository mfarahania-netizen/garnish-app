import { EventOutboxService } from './event-outbox.service';

function make(routeImpl?: () => Promise<void>) {
  const rows = new Map<string, any>();
  let seq = 0;
  const prisma: any = {
    eventOutbox: {
      create: jest.fn(async ({ data }: any) => { const id = `ob${++seq}`; const row = { id, status: 'pending', attempts: 0, processedAt: null, createdAt: new Date(), ...data }; rows.set(id, row); return row; }),
      update: jest.fn(async ({ where, data }: any) => { const r = rows.get(where.id); const inc = data.attempts?.increment; const next = { ...r, ...data, attempts: inc != null ? (r.attempts || 0) + inc : (typeof data.attempts === 'number' ? data.attempts : r.attempts) }; rows.set(where.id, next); return next; }),
      updateMany: jest.fn(async ({ where, data }: any) => { const r = rows.get(where.id); if (r && (where.status == null || r.status === where.status)) { rows.set(where.id, { ...r, ...data }); return { count: 1 }; } return { count: 0 }; }),
      findMany: jest.fn(async ({ where }: any) => [...rows.values()].filter((r) => (where.status == null || r.status === where.status) && (!where.createdAt?.lt || r.createdAt < where.createdAt.lt) && (where.attempts?.lt == null || r.attempts < where.attempts.lt))),
    },
    userEvent: { findUnique: jest.fn(async ({ where }: any) => (where.id === 'missing' ? null : { id: where.id, userId: 'u1', type: 'cook_complete' })) },
  };
  const router: any = { route: jest.fn(routeImpl || (async () => undefined)) };
  return { svc: new EventOutboxService(prisma, router), prisma, router, rows };
}

describe('EventOutboxService — durable routing (no lost signals)', () => {
  it('enqueue creates a pending row and returns its id', async () => {
    const { svc, rows } = make();
    const id = await svc.enqueue('ev1');
    expect(id).toBeTruthy();
    expect(rows.get(id!).status).toBe('pending');
    expect(rows.get(id!).eventId).toBe('ev1');
  });

  it('processNow success → routes once and marks the row done', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('ev1');
    await svc.processNow(id!, { id: 'ev1' }, 'u1');
    expect(router.route).toHaveBeenCalledTimes(1);
    expect(rows.get(id!).status).toBe('done');
    expect(rows.get(id!).processedAt).toBeTruthy();
  });

  it('processNow failure → leaves the row pending with attempts++ (never throws)', async () => {
    const { svc, rows } = make(async () => { throw new Error('router down'); });
    const id = await svc.enqueue('ev1');
    await expect(svc.processNow(id!, { id: 'ev1' }, 'u1')).resolves.toBeUndefined();
    expect(rows.get(id!).status).toBe('pending');
    expect(rows.get(id!).attempts).toBe(1);
  });

  it('drain re-routes a pending straggler (the fast path never completed) and marks it done', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('ev1');
    rows.get(id!).createdAt = new Date(Date.now() - 300_000); // older than the grace period
    const res = await svc.drain();
    expect(res.processed).toBe(1);
    expect(router.route).toHaveBeenCalledTimes(1);
    expect(rows.get(id!).status).toBe('done');
  });

  it('drain leaves a fresh (within-grace) row alone', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('ev1'); // createdAt = now → within grace
    const res = await svc.drain();
    expect(res.processed).toBe(0);
    expect(router.route).not.toHaveBeenCalled();
    expect(rows.get(id!).status).toBe('pending');
  });

  it('drain marks a row whose event no longer exists as done (nothing to route)', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('missing');
    rows.get(id!).createdAt = new Date(Date.now() - 300_000);
    const res = await svc.drain();
    expect(res.processed).toBe(0);
    expect(router.route).not.toHaveBeenCalled();
    expect(rows.get(id!).status).toBe('done');
  });
});
