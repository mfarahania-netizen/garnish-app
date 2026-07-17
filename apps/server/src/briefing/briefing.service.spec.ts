import { BriefingService } from './briefing.service';

const NOW = new Date('2026-06-15T09:00:00Z');

function makeService(opts: {
  recipes?: any[];
  planFilled?: number;
  uncheckedItems?: number;
  favorites?: { recipeId: string; recipe: { title: string } }[];
  cookedEvents?: { payload: string }[];
  lastEventDaysAgo?: number | null;
  streak?: any;
  celebrate?: any;
  personalized?: boolean;
  analyticsAccepted?: boolean;
} = {}) {
  const trackEvent = jest.fn().mockResolvedValue(opts.analyticsAccepted === false ? null : {});
  const decideForUser = jest.fn().mockResolvedValue([{ triggerKey: 'daily_briefing', decision: 'send', dryRun: true }]);
  const prisma: any = {
    favoriteRecipe: { findMany: jest.fn().mockResolvedValue(opts.favorites ?? []) },
    userEvent: {
      findMany: jest.fn().mockResolvedValue(opts.cookedEvents ?? []),
      findFirst: jest.fn().mockResolvedValue(opts.lastEventDaysAgo == null ? null : { timestamp: new Date(NOW.getTime() - opts.lastEventDaysAgo * 86_400_000) }),
    },
  };
  const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue({ declared: { dimensions: {} }, reconciled: { dimensions: {} } }) };
  const recipes: any = { findAll: jest.fn().mockResolvedValue({ data: opts.recipes ?? [{ id: 'r1', title: 'خوراک لوبیا', allergens: '[]' }], total: 1 }) };
  const slots = Array.from({ length: opts.planFilled ?? 0 }, (_, i) => ({ recipeId: `r${i}`, dayOfWeek: i }));
  const mealPlans: any = { getCurrentPlan: jest.fn().mockResolvedValue({ slots }) };
  const shopping: any = { getList: jest.fn().mockResolvedValue({ items: Array.from({ length: opts.uncheckedItems ?? 0 }, () => ({ isChecked: false })) }) };
  const gamification: any = { getSummary: jest.fn().mockResolvedValue({ streak: opts.streak ?? { currentWeeks: 2, status: 'active', kindMessage: '۲ هفتهٔ پیاپی — عالیه!' }, celebrate: opts.celebrate ?? null }) };
  const ine: any = { decideForUser: decideForUser, realSendEnabled: () => false };
  const consent: any = { hasPurpose: jest.fn().mockResolvedValue(opts.personalized ?? true) };
  const svc = new BriefingService(prisma, profiles, recipes, mealPlans, shopping, gamification, ine, { trackEvent } as any, consent);
  return { svc, prisma, profiles, recipes, mealPlans, shopping, gamification, ine, trackEvent, decideForUser, consent };
}

describe('BriefingService — reuse-composed, honest, dry-run', () => {
  it('REUSE: composes from profile + recipes/S07 + meal-plan + shopping + gamification', async () => {
    const { svc, profiles, recipes, gamification } = makeService({ planFilled: 2, uncheckedItems: 3 });
    const b = await svc.getTodayBriefing('u1', NOW);
    expect(profiles.getLivingUserProfile).toHaveBeenCalledWith('u1');
    expect(recipes.findAll).toHaveBeenCalled();
    expect(gamification.getSummary).toHaveBeenCalled();
    expect(b.proposesOnly).toBe(true);
    expect(['breakfast', 'lunch', 'dinner']).toContain(b.mealContext); // context is local-hour derived
  });

  it('logs briefing_view via the existing analytics ingest (feeds the signal loop)', async () => {
    const { svc, trackEvent } = makeService();
    await svc.getTodayBriefing('u1', NOW);
    expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', type: 'briefing_view' }));
  });

  it('nudge priority: an incomplete weekly plan wins over shopping', async () => {
    const { svc } = makeService({ planFilled: 2, uncheckedItems: 5 });
    const b = await svc.getTodayBriefing('u1', NOW);
    expect(b.nudge?.kind).toBe('plan_gap');
  });

  it('falls back to a shopping nudge when the plan is full', async () => {
    const { svc } = makeService({ planFilled: 7, uncheckedItems: 4 });
    const b = await svc.getTodayBriefing('u1', NOW);
    expect(b.nudge?.kind).toBe('shopping');
  });

  it('DELIVERY is DRY-RUN via the S6 INE (daily_briefing), never sent directly', async () => {
    const { svc, decideForUser } = makeService({ lastEventDaysAgo: 1 });
    const out = await svc.evaluateDelivery('u1', NOW);
    expect(decideForUser).toHaveBeenCalled();
    expect(out.dryRun).toBe(true);
    expect(decideForUser.mock.calls[0][1].some((c: any) => c.triggerKey === 'daily_briefing')).toBe(true);
    // a recently-active user gets NO reengagement candidate
    expect(decideForUser.mock.calls[0][1].some((c: any) => c.triggerKey === 'reengagement_gentle')).toBe(false);
  });

  it('uses only personalization-provenance cook events for saved-recipe nudges', async () => {
    const { svc, prisma } = makeService({
      planFilled: 7,
      favorites: [{ recipeId: 'r1', recipe: { title: 'Saved recipe' } }],
    });
    await svc.getTodayBriefing('u1', NOW);
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ consentPurpose: 'personalization' }),
      }),
    );
  });

  it('after a quiet stretch → adds a KIND reengagement candidate (via INE, fatigue-capped)', async () => {
    const { svc, decideForUser } = makeService({ lastEventDaysAgo: 14 });
    await svc.evaluateDelivery('u1', NOW);
    expect(decideForUser.mock.calls[0][1].some((c: any) => c.triggerKey === 'reengagement_gentle')).toBe(true);
  });

  it('logFeedback records accept/reject/swap through analytics; rejects nothing silently', async () => {
    const { svc, trackEvent } = makeService();
    const r = await svc.logFeedback('u1', 'accept', { recipeId: 'r1' });
    expect(r.type).toBe('briefing_accept');
    expect(trackEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'briefing_accept' }));
  });

  it('reports feedback as not logged when analytics consent denies persistence', async () => {
    const { svc } = makeService({ analyticsAccepted: false });
    await expect(svc.logFeedback('u1', 'reject', { recipeId: 'r1' })).resolves.toEqual({
      logged: false,
      type: 'briefing_reject',
      reason: 'consent_not_granted',
    });
  });

  it('fails closed without personalization consent and performs no private behavior reads', async () => {
    const { svc, prisma, profiles, recipes, mealPlans, shopping, gamification, trackEvent, decideForUser } = makeService({ personalized: false });
    const briefing = await svc.getTodayBriefing('u1', NOW);
    expect(briefing.personalizationEnabled).toBe(false);
    expect(briefing.items).toEqual([]);
    expect(profiles.getLivingUserProfile).not.toHaveBeenCalled();
    expect(recipes.findAll).not.toHaveBeenCalled();
    expect(mealPlans.getCurrentPlan).not.toHaveBeenCalled();
    expect(shopping.getList).not.toHaveBeenCalled();
    expect(gamification.getSummary).not.toHaveBeenCalled();
    expect(prisma.favoriteRecipe.findMany).not.toHaveBeenCalled();
    expect(prisma.userEvent.findMany).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();

    const delivery = await svc.evaluateDelivery('u1', NOW);
    expect(delivery.decisions).toEqual([]);
    expect(decideForUser).not.toHaveBeenCalled();
    expect(prisma.userEvent.findFirst).not.toHaveBeenCalled();
  });
});
