import { IneService, INE_REAL_SEND_FLAG } from './ine.service';

function makeService(
  opts: { consents?: string[]; sent24?: number; dismissals?: number; shoppingItems?: number; churn?: number } = {},
  hasPurpose: jest.Mock = jest.fn().mockResolvedValue(true),
) {
  const notifCreate = jest.fn();
  const prisma: any = {
    notification: {
      // resolveState calls count() twice: 1) sentLast24h, 2) recentDismissals
      count: jest.fn().mockResolvedValueOnce(opts.sent24 ?? 0).mockResolvedValueOnce(opts.dismissals ?? 0).mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      create: notifCreate, // must NEVER be called by the INE (dry-run)
    },
    shoppingList: { findFirst: jest.fn().mockResolvedValue(opts.shoppingItems ? { items: Array.from({ length: opts.shoppingItems }, () => ({})) } : null) },
    mealPlan: { findFirst: jest.fn().mockResolvedValue(null) },
    userBehaviorProfile: { findUnique: jest.fn().mockResolvedValue(opts.churn ? { churnRiskScore: opts.churn } : null) },
  };
  const profiles: any = {
    getLivingUserProfile: jest.fn().mockResolvedValue({ observed: { byDimension: {} } }),
    getConsentState: jest.fn().mockResolvedValue({ granted: opts.consents ?? ['core'] }),
  };
  const consent: any = { hasPurpose };
  return {
    svc: new IneService(prisma, profiles, consent),
    prisma,
    profiles,
    consent,
    notifCreate,
  };
}

const NOON = new Date('2026-06-15T12:00:00');

describe('IneService — DRY-RUN (no real send)', () => {
  const prev = process.env[INE_REAL_SEND_FLAG];
  const previousRuntime = process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;

  beforeEach(() => {
    process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = 'true';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[INE_REAL_SEND_FLAG];
    else process.env[INE_REAL_SEND_FLAG] = prev;
    if (previousRuntime === undefined)
      delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    else
      process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED = previousRuntime;
  });

  it('runtime OFF returns an empty preview with zero optional IO', async () => {
    delete process.env.OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED;
    const { svc, prisma, profiles, consent } = makeService({ shoppingItems: 2, churn: 90 });

    const preview = await svc.previewForUser('u1', NOON);

    expect(preview.decisions).toEqual([]);
    expect(consent.hasPurpose).not.toHaveBeenCalled();
    expect(profiles.getLivingUserProfile).not.toHaveBeenCalled();
    expect(profiles.getConsentState).not.toHaveBeenCalled();
    expect(prisma.notification.count).not.toHaveBeenCalled();
    expect(prisma.shoppingList.findFirst).not.toHaveBeenCalled();
    expect(prisma.mealPlan.findFirst).not.toHaveBeenCalled();
    expect(prisma.userBehaviorProfile.findUnique).not.toHaveBeenCalled();
  });

  it('withdrawal returns empty candidates/state before optional IO', async () => {
    const { svc, prisma, profiles } = makeService(
      { shoppingItems: 2, churn: 90 },
      jest.fn().mockResolvedValue(false),
    );

    await expect(svc.resolveCandidates('u1', NOON)).resolves.toEqual([]);
    const state = await svc.resolveState('u1', NOON);

    expect(state.consents).toEqual(['core']);
    expect(profiles.getLivingUserProfile).not.toHaveBeenCalled();
    expect(prisma.notification.count).not.toHaveBeenCalled();
    expect(prisma.shoppingList.findFirst).not.toHaveBeenCalled();
  });

  it('consent read error is fail-closed before optional IO', async () => {
    const { svc, prisma, profiles } = makeService(
      {},
      jest.fn().mockRejectedValue(new Error('ledger unavailable')),
    );

    const state = await svc.resolveState('u1', NOON);
    await expect(svc.resolveCandidates('u1', NOON)).resolves.toEqual([]);

    expect(state.consents).toEqual(['core']);
    expect(profiles.getLivingUserProfile).not.toHaveBeenCalled();
    expect(prisma.notification.findMany).not.toHaveBeenCalled();
    expect(prisma.shoppingList.findFirst).not.toHaveBeenCalled();
  });

  it('real-send path is DEFAULT-OFF and the engine never dispatches', async () => {
    delete process.env[INE_REAL_SEND_FLAG];
    const { svc, notifCreate } = makeService({ shoppingItems: 3, churn: 80 });
    const preview = await svc.previewForUser('u1', NOON);
    expect(svc.realSendEnabled()).toBe(false);
    expect(preview.dryRun).toBe(true);
    expect(notifCreate).not.toHaveBeenCalled(); // NEVER creates/dispatches a notification
    expect(preview.decisions.length).toBeGreaterThan(0);
  });

  it('records decisions to the queryable dry-run ledger', async () => {
    const { svc } = makeService({ shoppingItems: 2 });
    await svc.previewForUser('u1', NOON);
    expect(svc.getLedger().length).toBeGreaterThan(0);
    expect(svc.getLedger().every((e) => e.dryRun === true && typeof e.at === 'string')).toBe(true);
  });

  it('reuses the unified profile + consent state (no parallel profile)', async () => {
    const { svc, profiles } = makeService({ shoppingItems: 1 });
    await svc.previewForUser('u1', NOON);
    expect(profiles.getLivingUserProfile).toHaveBeenCalledWith('u1');
    expect(profiles.getConsentState).toHaveBeenCalledWith('u1');
  });

  it('CONSENT hard gate: a personalization trigger is suppressed without personalization consent', async () => {
    const { svc } = makeService({ consents: ['core'], churn: 90 }); // churn → personalization trigger
    const decisions = await svc.decideForUser('u1', [{ triggerKey: 'churn_reengagement' }], NOON);
    expect(decisions[0].decision).toBe('suppress');
    expect(decisions[0].gates.consent).toBe(false);
  });

  it('FATIGUE hard gate via service state: daily cap reached → suppress', async () => {
    const { svc } = makeService({ consents: ['core'], sent24: 5, dismissals: 0 });
    const decisions = await svc.decideForUser('u1', [{ triggerKey: 'shopping_unchecked', payload: { count: 2 } }], NOON);
    expect(decisions[0].decision).toBe('suppress');
    expect(decisions[0].gates.fatigue).toBe(false);
  });
});
