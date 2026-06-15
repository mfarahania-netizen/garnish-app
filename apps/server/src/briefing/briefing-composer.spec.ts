import { composeBriefing, mealContextFor, briefingDayKey, stableSeed, BriefingPickInput } from './briefing-composer';

const pick = (over: Partial<BriefingPickInput>): BriefingPickInput => ({
  recipeId: 'r1', title: 'خوراک', fitScore: 0.8, recommendation: 'great_fit', reasons: ['به سلیقه‌ات نزدیکه'], safe: true, ...over,
});
const baseArgs = (over: any = {}) => ({
  userId: 'u1', now: new Date('2026-06-15T09:00:00Z'), context: 'breakfast' as const,
  picks: [pick({ recipeId: 'r1', fitScore: 0.9 }), pick({ recipeId: 'r2', fitScore: 0.7 })],
  nudge: { kind: 'plan_gap' as const, reason: 'چند وعدهٔ این هفته خالیه' },
  progress: { streakWeeks: 3, streakStatus: 'active', streakMessage: '۳ هفتهٔ پیاپی آشپزی — عالیه!', newlyUnlockedTitle: null },
  ...over,
});

describe('briefing composer — one per day per context, deterministic, honest', () => {
  it('mealContextFor maps hours to contexts', () => {
    expect(mealContextFor(new Date('2026-06-15T08:00:00'))).toBe('breakfast');
    expect(mealContextFor(new Date('2026-06-15T13:00:00'))).toBe('lunch');
    expect(mealContextFor(new Date('2026-06-15T19:00:00'))).toBe('dinner');
  });

  it('produces a stable dayKey per (user, date, context)', () => {
    const a = briefingDayKey('u1', new Date('2026-06-15T09:00:00Z'), 'breakfast');
    const b = briefingDayKey('u1', new Date('2026-06-15T10:30:00Z'), 'breakfast');
    expect(a).toBe(b); // same day + context → same identity
    expect(a).not.toBe(briefingDayKey('u1', new Date('2026-06-15T19:00:00Z'), 'dinner'));
  });

  it('DETERMINISTIC: same args → identical briefing (no randomness)', () => {
    const x = composeBriefing(baseArgs());
    const y = composeBriefing(baseArgs());
    expect(JSON.stringify(x)).toBe(JSON.stringify(y));
    expect(stableSeed('abc')).toBe(stableSeed('abc'));
  });

  it('only surfaces SAFE picks (allergen-conflicting are never chosen)', () => {
    const b = composeBriefing(baseArgs({
      picks: [pick({ recipeId: 'bad', fitScore: 0.99, recommendation: 'avoid_allergen', safe: false }), pick({ recipeId: 'good', fitScore: 0.5 })],
    }));
    expect(b.pick?.recipeId).toBe('good');
  });

  it('no safe pick → pick is null but the briefing still composes (graceful)', () => {
    const b = composeBriefing(baseArgs({ picks: [pick({ safe: false, recommendation: 'avoid_allergen' })] }));
    expect(b.pick).toBeNull();
    expect(b.items.some((i) => i.type === 'nudge')).toBe(true);
  });

  it('proposes only and includes for-you + nudge + progress items', () => {
    const b = composeBriefing(baseArgs());
    expect(b.proposesOnly).toBe(true);
    expect(b.items.map((i) => i.type)).toEqual(expect.arrayContaining(['for_you', 'nudge', 'progress']));
    expect(b.pick?.why).toBeTruthy();
  });

  it('idle streak with no new achievement → no progress item (no nagging)', () => {
    const b = composeBriefing(baseArgs({ progress: { streakWeeks: 0, streakStatus: 'idle', streakMessage: 'هر وقت آماده بودی', newlyUnlockedTitle: null } }));
    expect(b.items.some((i) => i.type === 'progress')).toBe(false);
  });
});
