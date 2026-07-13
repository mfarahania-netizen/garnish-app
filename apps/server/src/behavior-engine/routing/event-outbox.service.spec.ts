import { EventOutboxService } from './event-outbox.service';

const routableEvent = (id = 'ev1') => ({
  id,
  userId: 'u1',
  type: 'cook_complete',
  timestamp: new Date(Date.now() - 600_000),
  consentPurpose: 'personalization',
});

function make(
  routeImpl?: () => Promise<void>,
  consentImpl: (userId: string, purpose: string) => Promise<boolean> = async () => true,
  epochImpl: () => Promise<Date | null> = async () =>
    new Date(Date.now() - 3_600_000),
) {
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
  let missingEventReads = 0;
  const prisma: any = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'u1' }]),
    eventOutbox: {
      create: jest.fn(async ({ data }: any) => { const id = `ob${++seq}`; const row = { id, status: 'pending', attempts: 0, claimedAt: null, processedAt: null, error: null, createdAt: new Date(), ...data }; rows.set(id, row); return row; }),
      upsert: jest.fn(async ({ where, create }: any) => {
        const existing = [...rows.values()].find((row) => row.eventId === where.eventId);
        if (existing) return existing;
        const id = `ob${++seq}`;
        const row = { id, status: 'pending', attempts: 0, claimedAt: null, processedAt: null, error: null, createdAt: new Date(), ...create };
        rows.set(id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: any) => { const r = rows.get(where.id); const next = apply(r, data); rows.set(where.id, next); return next; }),
      updateMany: jest.fn(async ({ where, data }: any) => { const r = rows.get(where.id); if (r && (where.status == null || r.status === where.status)) { rows.set(where.id, apply(r, data)); return { count: 1 }; } return { count: 0 }; }),
      findMany: jest.fn(async ({ where }: any) => [...rows.values()].filter((r) => matches(r, where))),
    },
    userEvent: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id === 'missing' && missingEventReads++ > 1) return null;
        return routableEvent(where.id);
      }),
    },
    userConsent: {
      findMany: jest.fn(async () => {
        const epoch = await epochImpl();
        if (!epoch) return [];
        return ['analytics', 'personalization'].map((purpose) => ({
          id: `consent-${purpose}`,
          purpose,
          status: 'granted',
          policyVersion: 'privacy-1405-03-29',
          createdAt: epoch,
        }));
      }),
    },
  };
  prisma.$transaction = jest.fn(async (callback: (tx: typeof prisma) => unknown) =>
    callback(prisma));
  const router: any = { route: jest.fn(routeImpl || (async () => undefined)) };
  const consent: any = {
    hasPurpose: jest.fn(consentImpl),
    currentGrantEpoch: jest.fn(epochImpl),
  };
  return {
    svc: new EventOutboxService(prisma, router, consent),
    prisma,
    router,
    consent,
    rows,
  };
}
const ago = (ms: number) => new Date(Date.now() - ms);

describe('EventOutboxService — durable routing (no lost signals)', () => {
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
  const previousAnalyticsRuntime = process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
    process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = 'true';
  });

  afterAll(() => {
    if (previousRuntime === undefined) delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
    if (previousAnalyticsRuntime === undefined) delete process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED;
    else process.env.OPTIONAL_ANALYTICS_INGEST_ENABLED = previousAnalyticsRuntime;
  });

  it('runtime OFF performs zero outbox/event IO at every public entry point', async () => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    const { svc, prisma, router, consent } = make();

    await expect(svc.enqueue('ev1')).resolves.toBeNull();
    await expect(svc.processNow('legacy-row', routableEvent(), 'u1')).resolves.toBeUndefined();
    await expect(svc.drain()).resolves.toEqual({
      processed: 0,
      failed: 0,
      dead: 0,
      revived: 0,
      suppressed: 0,
    });

    expect(prisma.eventOutbox.create).not.toHaveBeenCalled();
    expect(prisma.eventOutbox.findMany).not.toHaveBeenCalled();
    expect(prisma.userEvent.findUnique).not.toHaveBeenCalled();
    expect(consent.hasPurpose).not.toHaveBeenCalled();
    expect(consent.currentGrantEpoch).not.toHaveBeenCalled();
    expect(router.route).not.toHaveBeenCalled();
  });

  it('enqueue creates a pending row and returns its id', async () => {
    const { svc, rows } = make();
    const id = await svc.enqueue('ev1');
    expect(rows.get(id!).status).toBe('pending');
    expect(rows.get(id!).eventId).toBe('ev1');
  });

  it('enqueue performs zero outbox writes when either current grant is absent', async () => {
    const { svc, prisma } = make(
      undefined,
      async () => true,
      async () => null,
    );

    await expect(svc.enqueue('ev1')).resolves.toBeNull();

    expect(prisma.userConsent.findMany).toHaveBeenCalled();
    expect(prisma.eventOutbox.upsert).not.toHaveBeenCalled();
  });

  it('processNow success → routes once and marks the row done', async () => {
    const { svc, router, rows } = make();
    const id = await svc.enqueue('ev1');
    await svc.processNow(id!, routableEvent(), 'u1');
    expect(router.route).toHaveBeenCalledTimes(1);
    expect(rows.get(id!).status).toBe('done');
    expect(rows.get(id!).processedAt).toBeTruthy();
  });

  it('processNow failure → leaves the row pending with attempts++ (never throws)', async () => {
    const { svc, rows } = make(async () => { throw new Error('router down'); });
    const id = await svc.enqueue('ev1');
    await expect(
      svc.processNow(id!, routableEvent(), 'u1'),
    ).resolves.toBeUndefined();
    expect(rows.get(id!).status).toBe('pending');
    expect(rows.get(id!).attempts).toBe(1);
  });

  it('processNow deny → never routes and terminally suppresses the row', async () => {
    const { svc, router, consent, rows } = make(undefined, async () => false);
    const id = await svc.enqueue('ev1');

    await svc.processNow(id!, routableEvent(), 'u1');

    expect(consent.hasPurpose).toHaveBeenCalledWith('u1', 'personalization');
    expect(router.route).not.toHaveBeenCalled();
    expect(rows.get(id!)).toMatchObject({
      status: 'done',
      error: 'suppressed: personalization consent not granted at routing',
    });
    expect(rows.get(id!).processedAt).toBeTruthy();
  });

  it('processNow consent read error → fails closed and terminally suppresses the row', async () => {
    const { svc, router, rows } = make(undefined, async () => {
      throw new Error('consent store unavailable');
    });
    const id = await svc.enqueue('ev1');

    await expect(
      svc.processNow(id!, routableEvent(), 'u1'),
    ).resolves.toBeUndefined();

    expect(router.route).not.toHaveBeenCalled();
    expect(rows.get(id!)).toMatchObject({
      status: 'done',
      error: 'suppressed: personalization consent not granted at routing',
    });
  });

  it('consent-epoch read error fails closed before routing', async () => {
    const { svc, consent, router, rows } = make();
    const id = await svc.enqueue('ev1');
    consent.currentGrantEpoch.mockRejectedValueOnce(
      new Error('consent history unavailable'),
    );

    await svc.processNow(id!, routableEvent(), 'u1');

    expect(router.route).not.toHaveBeenCalled();
    expect(rows.get(id!)).toMatchObject({
      status: 'done',
      error: 'suppressed: personalization consent not granted at routing',
    });
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

  it('withdraw-between-queue-drain → pending row is terminally suppressed without routing', async () => {
    let granted = true;
    const { svc, router, consent, rows } = make(
      undefined,
      async () => granted,
    );
    const id = await svc.enqueue('ev1');
    rows.get(id!).createdAt = ago(300_000);

    // The event was queued while personalization was allowed, then withdrawn before the drain claimed it.
    granted = false;
    const res = await svc.drain();

    expect(consent.hasPurpose).toHaveBeenCalledWith('u1', 'personalization');
    expect(router.route).not.toHaveBeenCalled();
    expect(res.suppressed).toBe(1);
    expect(rows.get(id!)).toMatchObject({
      status: 'done',
      error: 'suppressed: personalization consent not granted at routing',
    });
  });

  it('analytics withdrawal after enqueue suppresses processNow before routing', async () => {
    let analyticsGranted = true;
    const { svc, router, consent, rows } = make(
      undefined,
      async (_userId, purpose) =>
        purpose === 'analytics' ? analyticsGranted : true,
    );
    const id = await svc.enqueue('ev1');
    analyticsGranted = false;

    await svc.processNow(id!, routableEvent(), 'u1');

    expect(consent.hasPurpose).toHaveBeenCalledWith('u1', 'analytics');
    expect(router.route).not.toHaveBeenCalled();
    expect(rows.get(id!)).toMatchObject({ status: 'done' });
  });

  it('temporary terminal-write failure plus re-grant never routes across withdrawal', async () => {
    let granted = false;
    const { svc, prisma, router, consent, rows } = make(
      undefined,
      async () => granted,
    );
    const event = routableEvent();
    const id = await svc.enqueue(event.id);

    prisma.eventOutbox.update
      .mockRejectedValueOnce(new Error('temporary write failure 1'))
      .mockRejectedValueOnce(new Error('temporary write failure 2'))
      .mockRejectedValueOnce(new Error('temporary write failure 3'));
    await svc.processNow(id!, event, event.userId);
    expect(rows.get(id!).status).toBe('pending');

    granted = true;
    consent.currentGrantEpoch.mockResolvedValue(
      new Date(event.timestamp.getTime() + 60_000),
    );
    rows.get(id!).createdAt = ago(300_000);
    const res = await svc.drain();

    expect(consent.currentGrantEpoch).toHaveBeenCalledWith('u1', [
      'analytics',
      'personalization',
    ]);
    expect(router.route).not.toHaveBeenCalled();
    expect(res.suppressed).toBe(1);
    expect(rows.get(id!)).toMatchObject({
      status: 'done',
      error: 'suppressed: personalization consent not granted at routing',
    });
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
