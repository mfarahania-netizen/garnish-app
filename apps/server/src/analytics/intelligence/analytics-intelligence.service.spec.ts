import { AnalyticsIntelligenceService } from './analytics-intelligence.service';

const NOW = new Date('2026-06-16T00:00:00Z');

function emptyPrisma(): any {
  return {
    userEvent: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    recipe: { findMany: jest.fn().mockResolvedValue([]) },
    favoriteRecipe: { groupBy: jest.fn().mockResolvedValue([]) },
    userStreak: { findMany: jest.fn().mockResolvedValue([]) },
    userAchievement: { groupBy: jest.fn().mockResolvedValue([]) },
    userProgress: { groupBy: jest.fn().mockResolvedValue([]) },
  };
}
const profiles = (): any => ({ getLivingUserProfile: jest.fn().mockResolvedValue({ maturity: { band: 'forming', overallScore: 0.3 } }) });

describe('AnalyticsIntelligenceService — deterministic + HONEST (no faked numbers)', () => {
  it('HONEST-NULL: with no real data every user-dependent metric is awaiting_pilot, never a fabricated number', async () => {
    const svc = new AnalyticsIntelligenceService(emptyPrisma(), profiles());
    const funnels = await svc.getFunnels();
    expect(funnels.funnels.every((f) => f.status === 'awaiting_pilot')).toBe(true);
    expect((await svc.getTrends({ now: NOW })).status).toBe('awaiting_pilot');
    expect((await svc.getCohorts()).status).toBe('awaiting_pilot');
    const pi = await svc.getProductIntelligence(NOW);
    expect(pi.foodDna.status).toBe('awaiting_pilot');
    expect(pi.briefing.status).toBe('awaiting_pilot');
    expect(pi.briefing.acceptRate).toBeNull();
    expect(pi.gamification.status).toBe('awaiting_pilot');
  });

  it('computes REAL funnels from UserEvent distinct-user counts', async () => {
    const prisma = emptyPrisma();
    // register=10, recipe_view=8, start_cooking_click=3, cook_complete=2 (distinct users via findMany length)
    const counts: Record<string, number> = { register: 10, recipe_view: 8, start_cooking_click: 3, cook_complete: 2 };
    prisma.userEvent.findMany = jest.fn(async (args: any) => Array.from({ length: counts[args.where.type] ?? 0 }, (_, i) => ({ userId: `u${i}` })));
    const svc = new AnalyticsIntelligenceService(prisma, profiles());
    const { funnels } = await svc.getFunnels();
    const cook = funnels.find((f) => f.name === 'cook')!;
    expect(cook.status).toBe('real');
    expect(cook.stages[0].count).toBe(8);
    expect(cook.stages[2].count).toBe(2);
    expect(cook.overallConversion).toBe(0.25);
  });

  it('product-intelligence: recsys quality is REAL (from the S11 offline harness) when a catalog exists; INE is a deterministic simulation', async () => {
    const prisma = emptyPrisma();
    prisma.recipe.findMany = jest.fn().mockResolvedValue([
      { id: 'a', title: 'Lentil Soup', diet: 'vegan', difficulty: 'easy', cookingTime: 30, allergens: '[]', categories: '[]', region: 'intl', ingredients: [{ name: 'lentil', ingredient: null }] },
    ]);
    const svc = new AnalyticsIntelligenceService(prisma, profiles());
    const pi = await svc.getProductIntelligence(NOW);
    expect(pi.recsys.status).toBe('real');
    expect((pi.recsys.allergySafety as any).pass).toBe(true); // S11 allergy guard surfaced
    expect((pi.recsys.online as any).clickThroughRate.awaitingPilot).toBe(true); // online honest-null
    expect(pi.ine.realSends).toBe(0); // dry-run simulation
    expect(pi.ine.wouldSend + pi.ine.suppressed + pi.ine.deferred).toBeGreaterThan(0);
  });

  it('PII-SAFE: product-intelligence aggregates expose no raw user identifiers / sensitive fields', async () => {
    const prisma = emptyPrisma();
    prisma.user.findMany = jest.fn().mockResolvedValue([{ id: 'secret-user-id' }]);
    prisma.userStreak.findMany = jest.fn().mockResolvedValue([{ currentWeeks: 3, longestWeeks: 5 }]);
    const svc = new AnalyticsIntelligenceService(prisma, profiles());
    const pi = await svc.getProductIntelligence(NOW);
    const json = JSON.stringify(pi);
    expect(json).not.toMatch(/secret-user-id/);
    expect(json).not.toMatch(/email|phone|password|"userId"/i);
    expect(pi.foodDna.bands).toBeDefined(); // aggregate band counts only
  });

  it('DETERMINISTIC: identical inputs → identical trends + INE distribution', async () => {
    const svc = new AnalyticsIntelligenceService(emptyPrisma(), profiles());
    const a = await svc.getProductIntelligence(NOW);
    const b = await svc.getProductIntelligence(NOW);
    expect(JSON.stringify(a.ine)).toBe(JSON.stringify(b.ine));
  });
});
