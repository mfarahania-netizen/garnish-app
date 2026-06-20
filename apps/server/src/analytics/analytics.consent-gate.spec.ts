import { AnalyticsService } from './analytics.service';

// L0/B — recipeId denormalization at ingest + the default-OFF consent-at-ingest gate (gates ROUTING into
// the personalization engine, never the raw write).
function make(consentAllowed = true) {
  const created: any[] = [];
  const prisma: any = { userEvent: { create: jest.fn(async ({ data }: any) => { created.push(data); return { id: 'ev1', ...data }; }) } };
  const enrichment: any = { enrichEvent: jest.fn() };
  const router: any = { route: jest.fn(async () => undefined) };
  const quality: any = { assess: jest.fn(() => ({ isValid: true })) };
  const consent: any = { hasPurpose: jest.fn(async () => consentAllowed) };
  return { svc: new AnalyticsService(prisma, enrichment, router, quality, consent), created, router, consent };
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
    const { svc, router, consent } = make(false);
    await svc.trackEvent(cook);
    expect(router.route).toHaveBeenCalled();
    expect(consent.hasPurpose).not.toHaveBeenCalled();
  });

  it('gate ENFORCE + no personalization consent → event stored but NOT routed into personalization', async () => {
    process.env.EVENT_CONSENT_GATE_MODE = 'enforce';
    const { svc, created, router } = make(false);
    const ev = await svc.trackEvent(cook);
    expect(created.length).toBe(1); // raw event still stored (ops / legitimate interest)
    expect(ev).toBeTruthy();
    expect(router.route).not.toHaveBeenCalled(); // …but no personalization profile built
  });

  it('gate ENFORCE + consent granted → routes normally', async () => {
    process.env.EVENT_CONSENT_GATE_MODE = 'enforce';
    const { svc, router } = make(true);
    await svc.trackEvent(cook);
    expect(router.route).toHaveBeenCalled();
  });
});
