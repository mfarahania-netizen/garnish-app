import { GamificationService } from './gamification.service';
import { weekOrdinal, mondayIso } from './engine/gamification-streak';

const now = new Date('2026-06-20T12:00:00Z'); // a Saturday → late in the week
const nowOrd = weekOrdinal(now);
const cookInWeek = (k: number, recipeId = 'r1') => ({ timestamp: new Date(mondayIso(nowOrd - k) + 'T12:00:00Z'), payload: JSON.stringify({ recipeId }) });

function makeService(opts: {
  events?: { timestamp: Date; payload: string }[];
  recipes?: any[];
  favorites?: number;
  fullWeekPlans?: number;
  existingAchievements?: string[];
  consents?: string[];
} = {}) {
  const created: Record<string, any[]> = { userAchievement: [], gamificationEvent: [] };
  const prisma: any = {
    userEvent: { findMany: jest.fn().mockResolvedValue(opts.events ?? []) },
    recipe: { findMany: jest.fn().mockResolvedValue(opts.recipes ?? []) },
    favoriteRecipe: { count: jest.fn().mockResolvedValue(opts.favorites ?? 0) },
    mealPlan: { findMany: jest.fn().mockResolvedValue(Array.from({ length: opts.fullWeekPlans ?? 0 }, () => ({ _count: { slots: 7 } }))) },
    userAchievement: { findMany: jest.fn().mockResolvedValue((opts.existingAchievements ?? []).map((k) => ({ achievementKey: k }))), createMany: jest.fn(async (a: any) => { created.userAchievement.push(...a.data); return { count: a.data.length }; }) },
    userStreak: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    userProgress: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
    gamificationEvent: { createMany: jest.fn(async (a: any) => { created.gamificationEvent.push(...a.data); return { count: a.data.length }; }), create: jest.fn(async (a: any) => { created.gamificationEvent.push(a.data); return a.data; }) },
  };
  const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue({ declared: { dimensions: {} } }) };
  const ineDecide = jest.fn().mockResolvedValue([{ triggerKey: 'streak_at_risk', decision: 'suppress', dryRun: true }]);
  const ine: any = { decideForUser: ineDecide, realSendEnabled: () => false };
  return { svc: new GamificationService(prisma, profiles, ine), prisma, profiles, ineDecide, created };
}

describe('GamificationService — honest, server-authoritative', () => {
  it('SERVER-AUTHORITATIVE: awards are derived from real cook events (UserEvent), not client input', async () => {
    const { svc, prisma, created } = makeService({ events: [cookInWeek(0), cookInWeek(1), cookInWeek(2)] });
    const state = await svc.recomputeForUser('u1', now);
    expect(prisma.userEvent.findMany).toHaveBeenCalled(); // the trusted source was read
    expect(state.stats.totalCooks).toBe(3);
    expect(state.achievements.allEarned).toContain('first_cook');
    expect(created.userAchievement.map((a) => a.achievementKey)).toContain('first_cook');
  });

  it('COOK RECORDING: a single cook_complete event increments cooks + moves the weekly streak; engine reads the canonical type', async () => {
    const { svc, prisma } = makeService({ events: [cookInWeek(0)] });
    const state = await svc.recomputeForUser('u1', now);
    // a real completed cook = a real +1 (no longer stuck at اولین آشپزی / سطح ۱)
    expect(state.stats.totalCooks).toBe(1);
    expect(state.streak.currentWeeks).toBeGreaterThanOrEqual(1);
    // contract: the engine counts UserEvent type 'cook_complete' — the FE must emit exactly this
    expect(prisma.userEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ type: { in: ['cook_complete'] } }) }),
    );
  });

  it('a user with ZERO cook events earns NOTHING (client cannot self-assert progress)', async () => {
    const { svc, created } = makeService({ events: [] });
    const state = await svc.recomputeForUser('u1', now);
    expect(state.stats.totalCooks).toBe(0);
    expect(state.achievements.allEarned).toEqual([]);
    expect(created.userAchievement).toEqual([]);
    expect(state.streak.status).toBe('idle');
  });

  it('exposes NO client-award / claim method (only server-derived recompute/read/notify)', () => {
    const { svc } = makeService();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(svc));
    expect(methods.some((m) => /award|grant|claim|setAchievement|addPoints/i.test(m))).toBe(false);
  });

  it('IDEMPOTENT: an already-unlocked achievement is not re-awarded', async () => {
    const { svc, created } = makeService({ events: [cookInWeek(0)], existingAchievements: ['first_cook'] });
    const state = await svc.recomputeForUser('u1', now);
    expect(state.achievements.newlyUnlocked.map((a) => a.key)).not.toContain('first_cook');
    expect(created.userAchievement).toEqual([]); // nothing new written
    expect(state.achievements.allEarned).toContain('first_cook');
  });

  it('private-only summary: marked private, no other-user data, celebrate capped at 1', async () => {
    const { svc } = makeService({ events: [cookInWeek(0), cookInWeek(1)] });
    const summary = await svc.getSummary('u1', now);
    expect(summary.private).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/leaderboard|rank|compare|otherUser/i);
    expect(Array.isArray(summary.achievements.newlyUnlocked)).toBe(true);
    expect(summary.celebrate === null || typeof summary.celebrate === 'object').toBe(true);
  });

  it('routes streak-at-risk through the S6 INE (dry-run), never sending directly', async () => {
    // cooks in the two prior weeks but NOT this week, on a Saturday → at risk
    const { svc, ineDecide } = makeService({ events: [cookInWeek(1), cookInWeek(2)] });
    const out = await svc.evaluateNotifications('u1', now);
    expect(ineDecide).toHaveBeenCalled();
    const candidates = ineDecide.mock.calls[0][1];
    expect(candidates.some((c: any) => c.triggerKey === 'streak_at_risk')).toBe(true);
    expect(out.decisions[0].dryRun).toBe(true);
  });
});
