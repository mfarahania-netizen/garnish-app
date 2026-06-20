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

describe('buildRealTimeContext — locale awareness (Iran vs Europe)', () => {
  const tz = (iso: string, timeZone: string) => buildRealTimeContext(new Date(iso), { timeZone });

  it('the SAME instant is a different local time in Tehran vs Amsterdam', () => {
    const inst = '2025-07-15T18:00:00Z';
    const tehran = tz(inst, 'Asia/Tehran'); // UTC+3:30 → 21:30
    const ams = tz(inst, 'Europe/Amsterdam'); // CEST UTC+2 → 20:00
    expect(tehran.hour).toBe(21);
    expect(tehran.timeOfDay).toBe('night');
    expect(ams.hour).toBe(20);
    expect(ams.timeOfDay).toBe('evening');
  });

  it('handles European DST (Amsterdam CET+1 in winter, CEST+2 in summer)', () => {
    expect(tz('2025-01-15T12:00:00Z', 'Europe/Amsterdam').hour).toBe(13); // CET
    expect(tz('2025-07-15T12:00:00Z', 'Europe/Amsterdam').hour).toBe(14); // CEST
  });

  it('weekend is locale-aware: Saturday is weekend in NL but a workday in Iran', () => {
    const satNoonUtc = '2025-07-19T09:00:00Z'; // a Saturday, ~noon-ish both zones
    expect(tz(satNoonUtc, 'Europe/Amsterdam').isWeekend).toBe(true); // Sat = weekend in NL
    expect(tz(satNoonUtc, 'Asia/Tehran').isWeekend).toBe(false); // شنبه = workday in Iran
  });

  it('Persian occasions still resolve for the diaspora abroad (Yalda for an Amsterdam user)', () => {
    expect(tz('2024-12-20T19:00:00Z', 'Europe/Amsterdam').occasion.key).toBe('yalda');
  });
});
