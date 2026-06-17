import { EventQualityService } from './event-quality.service';
import { GamificationService } from '../gamification/gamification.service';

/**
 * BE-FIX-EVENT-QUALITY-DELIBERATE-SIGNALS.
 *
 * The bug: `calcBotProbability` keys its high-frequency counter on `bot:<userId>` alone (shared across ALL
 * event types). A heavy `recipe_view` / `recommendation_impression` burst poisons it, so a real
 * `cook_complete` fired right after is rejected as "bot" → no UserEvent is written → gamification counts 0
 * cooks. The fix: deliberate, user-initiated signals bypass the bot/duplicate heuristic entirely.
 *
 * These tests (1) prove the gate still fires for a non-deliberate event under the burst — i.e. the exact
 * condition that USED to drop `cook_complete`; (2) prove the deliberate signals are now accepted after the
 * same burst; (3) prove the noise gate is unchanged for views/impressions/page_view + the else-branch
 * dedup; and (4) prove end-to-end through the REAL (frozen) gamification engine that a `cook_complete`
 * arriving after a burst increments `totalCooks` and moves the weekly streak.
 */

/** Fire a burst of cheap events (default recipe_view) for one user — poisons `bot:<userId>`. */
function burst(svc: EventQualityService, userId: string, n = 25, type = 'recipe_view') {
  for (let i = 0; i < n; i++) svc.assess({ userId, type, payload: { i } });
}

describe('EventQualityService — the bot gate that USED to drop deliberate signals still fires for noise', () => {
  it('a non-deliberate event (recommendation_impression) is rejected as "bot" right after a burst', () => {
    const svc = new EventQualityService();
    burst(svc, 'u1'); // >20 events in <60s, sub-3s gaps → bot:<u1> is now poisoned
    const r = svc.assess({ userId: 'u1', type: 'recommendation_impression', payload: { recipeId: 'x' } });
    // this is exactly the verdict cook_complete USED to get (it shares the same bot:<userId> counter)
    expect(r.isValid).toBe(false);
    expect(r.reason).toBe('bot');
    expect(r.evidence?.botProbability).toBeGreaterThan(0.8);
  });
});

describe('EventQualityService — DELIBERATE signals are ALWAYS accepted (the fix)', () => {
  it('cook_complete is ACCEPTED right after the same burst that rejects noise', () => {
    const svc = new EventQualityService();
    burst(svc, 'u1');
    const r = svc.assess({ userId: 'u1', type: 'cook_complete', payload: { recipeId: 'r1' } });
    expect(r.isValid).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(r.evidence?.botProbability).toBe(0);
    expect(r.evidence?.duplicateCheck).toBe(false);
    expect(r.confidence).toBe(1.0); // base confidence for cook_complete
  });

  it('favorite_add and mealplan_add are accepted after a burst', () => {
    const svc = new EventQualityService();
    burst(svc, 'u1');
    expect(svc.assess({ userId: 'u1', type: 'favorite_add', payload: { recipeId: 'r1' } }).isValid).toBe(true);
    expect(svc.assess({ userId: 'u1', type: 'mealplan_add', payload: { recipeId: 'r2' } }).isValid).toBe(true);
  });

  it('EVERY deliberate signal is accepted after a burst (leak check — none drop)', () => {
    const svc = new EventQualityService();
    const deliberate = [
      'cook_complete', 'favorite_add', 'mealplan_add', 'recommendation_save', 'recommendation_cook',
      'shopping_item_add', 'ai_message_send', 'onboarding_answered', 'preference_update',
    ];
    burst(svc, 'u-many', 30);
    for (const type of deliberate) {
      const r = svc.assess({ userId: 'u-many', type, payload: { k: type } });
      expect(r.isValid).toBe(true);
      expect(r.reason).toBeUndefined();
    }
  });

  it('deliberate signals carry a base confidence ≥ their map value (default 1.0 when unmapped)', () => {
    const svc = new EventQualityService();
    expect(svc.assess({ userId: 'u2', type: 'cook_complete', payload: {} }).confidence).toBe(1.0);
    expect(svc.assess({ userId: 'u2', type: 'mealplan_add', payload: { x: 1 } }).confidence).toBe(0.9); // from the map
    expect(svc.assess({ userId: 'u2', type: 'onboarding_answered', payload: { x: 1 } }).confidence).toBe(1.0); // unmapped → 1.0
  });
});

describe('EventQualityService — the NOISE gate is unchanged (regression)', () => {
  it('recommendation_impression flood is still bot-rejected', () => {
    const svc = new EventQualityService();
    burst(svc, 'u-noise', 25, 'recommendation_impression');
    const r = svc.assess({ userId: 'u-noise', type: 'recommendation_impression', payload: { recipeId: 'z' } });
    expect(r.isValid).toBe(false);
    expect(r.reason).toBe('bot');
  });

  it('page_view flood is still bot-rejected (nonDuplicate branch, bot-checked)', () => {
    const svc = new EventQualityService();
    burst(svc, 'u-pv', 25, 'page_view');
    const r = svc.assess({ userId: 'u-pv', type: 'page_view', payload: { p: '/home' } });
    expect(r.isValid).toBe(false);
    expect(r.reason).toBe('bot');
  });

  it('a single recipe_view / impression is still accepted (not over-gated)', () => {
    const svc = new EventQualityService();
    expect(svc.assess({ userId: 'u-ok', type: 'recipe_view', payload: { recipeId: 'r' } }).isValid).toBe(true);
    expect(svc.assess({ userId: 'u-ok2', type: 'recommendation_impression', payload: { recipeId: 'r' } }).isValid).toBe(true);
  });

  it('a non-deliberate else-branch event (search_query) is still deduped within 30s', () => {
    const svc = new EventQualityService();
    const ev = { userId: 'u-dup', type: 'search_query', payload: { q: 'مرغ' } };
    expect(svc.assess(ev).isValid).toBe(true); // first
    const second = svc.assess(ev); // identical within 30s
    expect(second.isValid).toBe(false);
    expect(second.reason).toBe('duplicate');
  });
});

describe('EventQualityService — narrow ≤2s double-fire guard for deliberate signals', () => {
  it('a double-fired identical cook_complete (same recipe) within 2s is deduped', () => {
    const svc = new EventQualityService();
    const ev = { userId: 'u-dt', type: 'cook_complete', payload: { recipeId: 'r1' } };
    expect(svc.assess(ev).isValid).toBe(true); // genuine cook
    const second = svc.assess(ev); // accidental double-tap on «پایان»
    expect(second.isValid).toBe(false);
    expect(second.reason).toBe('duplicate');
  });

  it('two DISTINCT cooks within 2s are BOTH accepted (distinct payload never collapses)', () => {
    const svc = new EventQualityService();
    expect(svc.assess({ userId: 'u-dt2', type: 'cook_complete', payload: { recipeId: 'r1' } }).isValid).toBe(true);
    expect(svc.assess({ userId: 'u-dt2', type: 'cook_complete', payload: { recipeId: 'r2' } }).isValid).toBe(true);
  });

  it('the SAME cook more than 2s later is accepted again (guard window is ≤2s)', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-06-18T10:00:00.000Z'));
      const svc = new EventQualityService();
      const ev = { userId: 'u-dt3', type: 'cook_complete', payload: { recipeId: 'r1' } };
      expect(svc.assess(ev).isValid).toBe(true);
      jest.setSystemTime(new Date('2026-06-18T10:00:02.500Z')); // +2.5s > 2s window
      expect(svc.assess(ev).isValid).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('EventQualityService → Gamification (E2E: cook after a burst counts)', () => {
  it('a cook_complete that arrives AFTER a burst is recorded and increments totalCooks + moves the streak', async () => {
    const now = new Date('2026-06-18T12:00:00.000Z');
    const svc = new EventQualityService();

    // ── gate stage (mirrors analytics.service.trackEvent: only isValid events become UserEvents) ──
    const written: { type: string; timestamp: Date; payload: string }[] = [];
    const gate = (type: string, payload: any) => {
      const q = svc.assess({ userId: 'cook-user', type, payload });
      if (q.isValid) written.push({ type, timestamp: now, payload: JSON.stringify(payload) });
    };

    burst(svc, 'cook-user', 25); // heavy scrolling/impressions first (the failing scenario)
    gate('cook_complete', { recipeId: 'r1' }); // the real cook, right after the burst

    const cooks = written.filter((e) => e.type === 'cook_complete');
    expect(cooks).toHaveLength(1); // ← pre-fix this would be 0 (cook rejected as bot → never written)

    // ── feed the surviving events to the REAL, FROZEN gamification engine (imported, not modified) ──
    const prisma: any = {
      userEvent: { findMany: jest.fn().mockResolvedValue(cooks.map((c) => ({ timestamp: c.timestamp, payload: c.payload }))) },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      favoriteRecipe: { count: jest.fn().mockResolvedValue(0) },
      mealPlan: { findMany: jest.fn().mockResolvedValue([]) },
      userAchievement: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockResolvedValue({}) },
      userStreak: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      userProgress: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      gamificationEvent: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
    };
    const profiles: any = { getLivingUserProfile: jest.fn().mockResolvedValue(null) };
    const ine: any = { decideForUser: jest.fn() };
    const gamification = new GamificationService(prisma, profiles, ine);

    const state = await gamification.recomputeForUser('cook-user', now);

    expect(state.stats.totalCooks).toBe(1); // ← the bug fixed: cook is counted
    expect(state.streak.currentWeeks).toBe(1); // streak moved 0 → 1 (a cook this week)
    expect(state.achievements.allEarned).toContain('first_cook'); // «اولین آشپزی» unlocked
  });

  it('contrast: with ZERO surviving cooks the streak stays idle (proves the count is event-driven)', async () => {
    const now = new Date('2026-06-18T12:00:00.000Z');
    const prisma: any = {
      userEvent: { findMany: jest.fn().mockResolvedValue([]) },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      favoriteRecipe: { count: jest.fn().mockResolvedValue(0) },
      mealPlan: { findMany: jest.fn().mockResolvedValue([]) },
      userAchievement: { findMany: jest.fn().mockResolvedValue([]) },
      userStreak: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      userProgress: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      gamificationEvent: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({}) },
    };
    const gamification = new GamificationService(prisma, { getLivingUserProfile: jest.fn().mockResolvedValue(null) } as any, {} as any);
    const state = await gamification.recomputeForUser('empty-user', now);
    expect(state.stats.totalCooks).toBe(0);
    expect(state.streak.currentWeeks).toBe(0);
  });
});
