import { EventOutboxService } from './event-outbox.service';

function make(routeImpl?: () => Promise<void>) {
  const rows = new Map<string, any>();
  let seq = 0;
  const matches = (r: any, where: any) =>
    (where.status == null || r.status === where.status) &&
    (!where.createdAt?.lt || r.createdAt < where.createdAt.lt) &&
    (!where.claimedAt?.lt || (r.claimedAt && r.claimedAt < where.claimedAt.lt)) &&
    (where.attempts?.lt == null || r.attempts < where.attempts.lt);
  const apply = (r: any, data: any) => {
    const next = { ...r, ...data };
    if (data.attempts?.increment != null) next.attempts = (r.attempts || 0) + data.attempts.increment;
    return next;
  };
  const prisma: any = {
    eventOutbox: {
      create: jest.fn(async ({ data }: any) => { const id = `ob${++seq}`; const row = { id, status: 'pending', attempts: 0, claimedAt: null, processedAt: null, error: null, createdAt: new Date(), ...data }; rows.set(id, row); return row; }),
      update: jest.fn(async ({ where, data }: any) => { const r = rows.get(where.id); const next = apply(r, data); rows.set(where.id, next); return next; }),
      updateMany: jest.fn(async ({ where, data }: any) => { const r = rows.get(where.id); if (r && (where.status == null || r.status === where.status)) { rows.set(where.id, apply(r, data)); return { count: 1 }; } return { count: 0 }; }),
      findMany: jest.fn(async ({ where }: any) => [...rows.values()].filter((r) => matches(r, where))),
    },
    userEvent: { findUnique: jest.fn(async ({ where }: any) => (where.id === 'missing' ? null : { id: where.id, userId: 'u1', type: 'cook_complete' })) },
  };
  const router: any = { route: jest.fn(routeImpl || (async () => undefined)) };
  return { svc: new EventOutboxService(prisma, router), prisma, router, rows };
}
const ago = (ms: number) => new Date(Date.now() - ms);

describe('EventOutboxService — durable routing (no lost signals)', () => {
  it('enqueue creates a pending row and returns its id', async () => {
    const { svc, rows } = make();
    const id = await svc.enqueue('ev1');
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

  it('drain re-routes a pending straggler and marks it done', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('ev1');
    rows.get(id!).createdAt = ago(300_000);
    const res = await svc.drain();
    expect(res.processed).toBe(1);
    expect(router.route).toHaveBeenCalledTimes(1);
    expect(rows.get(id!).status).toBe('done');
  });

  it('drain leaves a fresh (within-grace) row alone', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('ev1');
    const res = await svc.drain();
    expect(res.processed).toBe(0);
    expect(router.route).not.toHaveBeenCalled();
    expect(rows.get(id!).status).toBe('pending');
  });

  it('drain marks a row whose event no longer exists as done (nothing to route)', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('missing');
    rows.get(id!).createdAt = ago(300_000);
    const res = await svc.drain();
    expect(res.processed).toBe(0);
    expect(router.route).not.toHaveBeenCalled();
    expect(rows.get(id!).status).toBe('done');
  });

  // guardian fix 3a — exhausted retries dead-letter instead of looping/stranding forever
  it('drain dead-letters a row that has exhausted maxAttempts on failure', async () => {
    const { svc, rows } = make(async () => { throw new Error('still down'); });
    const id = await svc.enqueue('ev1');
    Object.assign(rows.get(id!), { createdAt: ago(300_000), attempts: 9 }); // one try from the cap (10)
    const res = await svc.drain({ maxAttempts: 10 });
    expect(res.dead).toBe(1);
    expect(rows.get(id!).status).toBe('dead');
  });

  // guardian fix 3b — a row stuck in 'processing' after a crash is revived (not lost forever)
  it('drain revives a row stuck in processing past the TTL, then re-routes it', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('ev1');
    Object.assign(rows.get(id!), { status: 'processing', claimedAt: ago(600_000), createdAt: ago(600_000) });
    const res = await svc.drain({ staleProcessingMs: 300_000 });
    expect(res.revived).toBe(1);
    expect(router.route).toHaveBeenCalledTimes(1); // revived → pending → re-routed in the same drain
    expect(rows.get(id!).status).toBe('done');
  });

  // guardian non-blocking note → covered: a stuck 'processing' row that has exhausted its attempts is
  // dead-lettered by the reaper (not revived forever)
  it('drain dead-letters a stuck processing row that has exhausted maxAttempts (no infinite revival)', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('ev1');
    Object.assign(rows.get(id!), { status: 'processing', claimedAt: ago(600_000), createdAt: ago(600_000), attempts: 9 });
    const res = await svc.drain({ staleProcessingMs: 300_000, maxAttempts: 10 });
    expect(res.revived).toBe(1);
    expect(rows.get(id!).status).toBe('dead'); // reaper exhaustion path → dead, not re-routed
    expect(router.route).not.toHaveBeenCalled();
  });
});
