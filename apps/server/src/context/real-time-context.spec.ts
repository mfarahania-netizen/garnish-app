import { buildRealTimeContext } from './real-time-context';
import { gregorianToJalali } from './jalali';

// Tehran wall-clock is made explicit with a +03:30 offset in each fixture.
const at = (iso: string) => buildRealTimeContext(new Date(iso));

describe('jalali conversion (anchored on a known date)', () => {
  it('Nowruz 1403 = 2024-03-20', () => {
    expect(gregorianToJalali(2024, 3, 20)).toEqual([1403, 1, 1]);
  });
});

describe('buildRealTimeContext — Persian calendar awareness (L0 "every second")', () => {
  it('شبِ یلدا (longest night, آذر ۳۰) → autumn + occasion yalda', () => {
    const c = at('2024-12-20T20:00:00+03:30'); // آذر ۳۰، ۱۴۰۳
    expect(c.jalali.jm).toBe(9); // آذر
    expect(c.season.key).toBe('autumn');
    expect(c.occasion.key).toBe('yalda');
    expect(c.timeOfDay).toBe('evening');
    expect(c.mealWindow).toBe('dinner');
  });

  it('یلدا also covers the night-after threshold (دی ۱ → winter, still yalda)', () => {
    const c = at('2024-12-21T01:00:00+03:30'); // دی ۱
    expect(c.season.key).toBe('winter');
    expect(c.occasion.key).toBe('yalda');
  });

  it('نوروز → spring + occasion nowruz', () => {
    const c = at('2026-03-25T12:00:00+03:30');
    expect(c.season.key).toBe('spring');
    expect(c.occasion.key).toBe('nowruz');
    expect(c.timeOfDay).toBe('midday');
  });

  it('an ordinary summer evening → summer + dinner + evening, not weekend', () => {
    const c = at('2025-07-15T20:00:00+03:30'); // a Tuesday
    expect(c.season.key).toBe('summer');
    expect(c.timeOfDay).toBe('evening');
    expect(c.mealWindow).toBe('dinner');
    expect(c.isWeekend).toBe(false);
    expect(c.occasion.key).toBe('none');
  });

  it('morning → breakfast window', () => {
    expect(at('2025-07-15T08:30:00+03:30').mealWindow).toBe('breakfast');
  });

  it('Iran weekend = Thursday + Friday', () => {
    expect(at('2025-07-18T12:00:00+03:30').isWeekend).toBe(true); // Friday
    expect(at('2025-07-18T12:00:00+03:30').dayNameFa).toBe('جمعه');
    expect(at('2025-07-17T12:00:00+03:30').isWeekend).toBe(true); // Thursday
  });

  it('computes in Tehran time, not UTC (23:00Z → 02:30 Tehran → night)', () => {
    const c = at('2025-07-15T23:00:00Z');
    expect(c.hour).toBe(2);
    expect(c.timeOfDay).toBe('night');
  });

  it('is pure/deterministic — same instant → identical context', () => {
    expect(at('2025-12-21T20:00:00+03:30')).toEqual(at('2025-12-21T20:00:00+03:30'));
  });
});
