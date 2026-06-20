/**
 * Real-time CONTEXT object (L0) — the "every second" vector the founder asked for: the same dish ranks
 * differently at 8am vs 8pm, summer vs winter, an ordinary Tuesday vs شبِ یلدا. Pure + deterministic given
 * `now` (testable, cacheable); computed in Tehran local time (fixed UTC+03:30, no DST). It carries FACTS
 * (time/season/occasion) — consumers (the L1 ranker, the L2a assistant) decide what to do with them.
 *
 * It is intentionally STANDALONE: not baked into getLivingUserProfile (which is per-user state and must
 * stay byte-identical) — context is per-request and changes every second, so it is built at serve time.
 */
import { toJalaliDate, jalaliSeason, persianOccasion, JalaliDate, SeasonKey, PersianSeason, OccasionKey } from './jalali';

const TEHRAN_OFFSET_MIN = 210; // UTC+03:30, year-round (Iran abolished DST in 2022)
const DAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']; // index = JS getUTCDay (0=Sun)

export type TimeOfDay = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
export type MealWindow = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'late_night';

export interface RealTimeContext {
  at: string; // ISO instant of `now`
  tz: 'Asia/Tehran';
  hour: number; // Tehran local hour 0-23
  timeOfDay: TimeOfDay;
  mealWindow: MealWindow;
  dayOfWeek: number; // 0=Sun .. 6=Sat (Tehran local)
  dayNameFa: string;
  isWeekend: boolean; // Iran weekend = پنجشنبه + جمعه (Thu+Fri)
  jalali: JalaliDate;
  season: { key: SeasonKey; fa: PersianSeason };
  occasion: { key: OccasionKey; fa: string; confidence: number };
}

function timeOfDayFor(h: number): TimeOfDay {
  if (h >= 5 && h < 8) return 'early_morning';
  if (h >= 8 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'midday';
  if (h >= 14 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function mealWindowFor(h: number): MealWindow {
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 19) return 'snack';
  if (h >= 19 && h < 23) return 'dinner';
  return 'late_night';
}

/** Build the real-time context for an instant. tzOffsetMinutes defaults to Tehran (+03:30). */
export function buildRealTimeContext(now: Date, opts: { tzOffsetMinutes?: number } = {}): RealTimeContext {
  const offset = opts.tzOffsetMinutes ?? TEHRAN_OFFSET_MIN;
  // shift the instant so its UTC components read as Tehran wall-clock (deterministic, DST-free)
  const local = new Date(now.getTime() + offset * 60_000);
  const hour = local.getUTCHours();
  const dow = local.getUTCDay();
  const jalali = toJalaliDate(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate());

  return {
    at: now.toISOString(),
    tz: 'Asia/Tehran',
    hour,
    timeOfDay: timeOfDayFor(hour),
    mealWindow: mealWindowFor(hour),
    dayOfWeek: dow,
    dayNameFa: DAY_NAMES_FA[dow],
    isWeekend: dow === 4 || dow === 5, // Thursday + Friday
    jalali,
    season: jalaliSeason(jalali.jm),
    occasion: persianOccasion(jalali),
  };
}
