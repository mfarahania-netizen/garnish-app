import { computeStreak, weekOrdinal, mondayIso, dayOfWeekMon } from './gamification-streak';

const DAY = 86_400_000;
const now = new Date('2026-06-17T12:00:00Z');
const nowOrd = weekOrdinal(now);
const monThisWeek = new Date(mondayIso(nowOrd) + 'T12:00:00Z');
const inWeek = (k: number) => new Date(mondayIso(nowOrd - k) + 'T12:00:00Z'); // a cook in week (now - k)
const satThisWeek = new Date(monThisWeek.getTime() + 5 * DAY); // Saturday (late in week)
const tueThisWeek = new Date(monThisWeek.getTime() + 1 * DAY); // Tuesday (early)

describe('streak engine — weekly cadence, grace, kind framing', () => {
  it('no cooks → idle, no shame, encouraging copy', () => {
    const s = computeStreak([], now);
    expect(s.status).toBe('idle');
    expect(s.currentWeeks).toBe(0);
    expect(s.atRisk).toBe(false);
    expect(s.kindMessage).toBeTruthy();
    expect(/شکست|باختی|از دست دادی/.test(s.kindMessage)).toBe(false); // never shaming
  });

  it('cooking this week + the prior weeks → active streak', () => {
    const s = computeStreak([inWeek(0), inWeek(1), inWeek(2)], now);
    expect(s.status).toBe('active');
    expect(s.currentWeeks).toBe(3);
    expect(s.longestWeeks).toBeGreaterThanOrEqual(3);
  });

  it('GRACE/freeze: a single missed week inside the run does NOT reset it', () => {
    const s = computeStreak([inWeek(0), inWeek(2), inWeek(3)], now); // gap at week-1
    expect(s.currentWeeks).toBe(3);
    expect(s.graceUsed).toBe(true);
  });

  it('current week not yet cooked, late in the week, with a live run → at-risk (kind nudge)', () => {
    const s = computeStreak([inWeek(1), inWeek(2)], satThisWeek);
    expect(s.status).toBe('grace');
    expect(s.currentWeeks).toBe(2);
    expect(s.atRisk).toBe(true);
    expect(s.kindMessage).toBeTruthy();
  });

  it('same run but early in the week → not yet at-risk', () => {
    const s = computeStreak([inWeek(1), inWeek(2)], tueThisWeek);
    expect(s.atRisk).toBe(false);
  });

  it('two missed weeks (beyond one grace) → the run resets, kindly (no shame copy)', () => {
    const s = computeStreak([inWeek(3), inWeek(4)], now); // weeks 1 and 2 both missed
    expect(s.currentWeeks).toBe(0);
    expect(/شکست|باختی|تنبل/.test(s.kindMessage)).toBe(false);
  });

  it('helpers: weekOrdinal increments weekly; dayOfWeekMon 0=Mon', () => {
    expect(weekOrdinal(new Date(monThisWeek.getTime() + WEEKMS())) - nowOrd).toBe(1);
    expect(dayOfWeekMon(monThisWeek)).toBe(0);
    expect(dayOfWeekMon(satThisWeek)).toBe(5);
  });
});

function WEEKMS() { return 7 * DAY; }
