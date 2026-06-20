import { AnalyticsService } from './analytics.service';

// L0/B — recipeId denormalization at ingest + the default-OFF consent-at-ingest gate (gates ROUTING into
// the personalization engine, never the raw write).
function make(consentAllowed = true) {
  const created: any[] = [];
  const prisma: any = { userEvent: { create: jest.fn(async ({ data }: any) => { created.push(data); return { id: 'ev1', ...data }; }) } };
  const enrichment: any = { enrichEvent: jest.fn() };
  // routing now goes through the durable outbox (enqueue → processNow); a mock records the calls
  const outbox: any = { enqueue: jest.fn(async () => 'ob1'), processNow: jest.fn(async () => undefined) };
  const quality: any = { assess: jest.fn(() => ({ isValid: true })) };
  const consent: any = { hasPurpose: jest.fn(async () => consentAllowed) };
  return { svc: new AnalyticsService(prisma, enrichment, outbox, quality, consent), created, outbox, consent };
}
const cook = { userId: 'u1', type: 'cook_complete', payload: { recipeId: 'r1' } };

describe('AnalyticsService.trackEvent — L0/B ingest', () => {
  const ORIG = process.env.EVENT_CONSENT_GATE_MODE;
  afterEach(() => { if (ORIG === undefined) delete process.env.EVENT_CONSENT_GATE_MODE; else process.env.EVENT_CONSENT_GATE_MODE = ORIG; });

  it('denormalizes payload.recipeId onto the event row', async () => {
    delete process.env.EVENT_CONSENT_GATE_MODE;
    const { svc, created } = make();
    await svc.trackEvent(cook);
    expect(created[0].recipeId).toBe('r1');
  });

  it('gate OFF (default) → always routes into the signal engine (byte-identical), never checks consent', async () => {
    delete process.env.EVENT_CONSENT_GATE_MODE;
    const { svc, outbox, consent } = make(false);
    await svc.trackEvent(cook);
    expect(outbox.enqueue).toHaveBeenCalled();
    expect(outbox.processNow).toHaveBeenCalled();
    expect(consent.hasPurpose).not.toHaveBeenCalled();
  });

  it('gate ENFORCE + no personalization consent → event stored but NOT routed into personalization', async () => {
    process.env.EVENT_CONSENT_GATE_MODE = 'enforce';
    const { svc, created, outbox } = make(false);
    const ev = await svc.trackEvent(cook);
    expect(created.length).toBe(1); // raw event still stored (ops / legitimate interest)
    expect(ev).toBeTruthy();
    expect(outbox.enqueue).not.toHaveBeenCalled(); // …but never enqueued for routing → no profile built
  });

  it('gate ENFORCE + consent granted → routes normally (durably enqueued)', async () => {
    process.env.EVENT_CONSENT_GATE_MODE = 'enforce';
    const { svc, outbox } = make(true);
    await svc.trackEvent(cook);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  // L0 gate — GDPR provenance: every event records the consent purpose it was collected under.
  it('gate OFF → stamps consentPurpose=analytics (legitimate-interest baseline), no consent read', async () => {
    delete process.env.EVENT_CONSENT_GATE_MODE;
    const { svc, created, consent } = make(false);
    await svc.trackEvent(cook);
    expect(created[0].consentPurpose).toBe('analytics');
    expect(consent.hasPurpose).not.toHaveBeenCalled(); // baseline needs no query → byte-identical when off
  });

  it('gate ENFORCE + consent granted → stamps consentPurpose=personalization (reuses the gate read)', async () => {
    process.env.EVENT_CONSENT_GATE_MODE = 'enforce';
    const { svc, created, consent } = make(true);
    await svc.trackEvent(cook);
    expect(created[0].consentPurpose).toBe('personalization');
    expect(consent.hasPurpose).toHaveBeenCalledTimes(1); // one read, reused for stamp + gate
  });

  it('gate ENFORCE + consent denied → stamps consentPurpose=analytics (downgraded, still recorded)', async () => {
    process.env.EVENT_CONSENT_GATE_MODE = 'enforce';
    const { svc, created } = make(false);
    await svc.trackEvent(cook);
    expect(created[0].consentPurpose).toBe('analytics');
  });
});
