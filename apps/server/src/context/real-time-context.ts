/**
 * Real-time CONTEXT object (L0) — the "every second" vector: the same dish ranks differently at 8am vs 8pm,
 * summer vs winter, an ordinary Tuesday vs شبِ یلدا. Pure + deterministic given `now` + the user's timeZone.
 *
 * LOCALE-AWARE (Iran AND Europe): time-of-day / meal-window / weekend are computed in the USER's local
 * time via the IANA tz database (DST-correct for Amsterdam, no-DST for Tehran). Weekend differs by region
 * (Iran = پنجشنبه+جمعه, most of Europe = Sat+Sun).
 *
 * TARGET MARKET: the Europe/Holland launch is for the GENERAL population (everyone), NOT the diaspora — so
 * European occasions (Christmas/Easter/King's Day, Gregorian calendar) are CORE for that market and a
 * European occasion provider must be added here (a clean seam is left). Persian occasions (Yalda/Nowruz)
 * are computed always as CULTURAL-DISCOVERY moments offered to everyone ("experience a Persian Yalda"),
 * not a diaspora feature. The Jalali date is computed regardless (cheap + powers Persian discovery).
 *
 * Intentionally STANDALONE (not in getLivingUserProfile, which stays byte-identical) — context is per-request.
 */
import { toJalaliDate, jalaliSeason, persianOccasion, JalaliDate, SeasonKey, PersianSeason, OccasionKey } from './jalali';

export const IRAN_TZ = 'Asia/Tehran';
const DAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']; // index = day-of-week (0=Sun)
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type TimeOfDay = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
export type MealWindow = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'late_night';

export interface RealTimeContext {
  at: string; // ISO instant of `now`
  timeZone: string; // the IANA zone this context was computed in (the user's locale)
  hour: number; // local hour 0-23
  timeOfDay: TimeOfDay;
  mealWindow: MealWindow;
  dayOfWeek: number; // 0=Sun .. 6=Sat (local)
  dayNameFa: string;
  isWeekend: boolean; // locale-aware: Iran=Thu+Fri, elsewhere Sat+Sun (override via opts.weekendDays)
  jalali: JalaliDate;
  season: { key: SeasonKey; fa: PersianSeason };
  occasion: { key: OccasionKey; fa: string; confidence: number };
}

export interface ContextOpts {
  timeZone?: string; // the user's IANA zone (from profile/location); default Tehran
  weekendDays?: number[]; // override; default Iran [Thu,Fri] for Tehran else [Sun,Sat]
}

/** Extract DST-correct local calendar/clock parts for an instant in an arbitrary IANA timezone. */
function localParts(now: Date, timeZone: string): { year: number; month: number; day: number; hour: number; dow: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', hour12: false, weekday: 'short' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  let hour = parseInt(get('hour'), 10);
  if (hour === 24) hour = 0; // some engines render midnight as 24
  return { year: +get('year'), month: +get('month'), day: +get('day'), hour, dow: WD[get('weekday')] ?? 0 };
}

const timeOfDayFor = (h: number): TimeOfDay =>
  h >= 5 && h < 8 ? 'early_morning' : h >= 8 && h < 11 ? 'morning' : h >= 11 && h < 14 ? 'midday' : h >= 14 && h < 17 ? 'afternoon' : h >= 17 && h < 21 ? 'evening' : 'night';

const mealWindowFor = (h: number): MealWindow =>
  h >= 5 && h < 11 ? 'breakfast' : h >= 11 && h < 16 ? 'lunch' : h >= 16 && h < 19 ? 'snack' : h >= 19 && h < 23 ? 'dinner' : 'late_night';

/** Build the real-time context for an instant in the user's timezone (default Tehran). */
export function buildRealTimeContext(now: Date, opts: ContextOpts = {}): RealTimeContext {
  const timeZone = opts.timeZone || IRAN_TZ;
  const weekendDays = opts.weekendDays || (timeZone === IRAN_TZ ? [4, 5] : [0, 6]); // Thu+Fri vs Sun+Sat
  const { year, month, day, hour, dow } = localParts(now, timeZone);
  const jalali = toJalaliDate(year, month, day);

  return {
    at: now.toISOString(),
    timeZone,
    hour,
    timeOfDay: timeOfDayFor(hour),
    mealWindow: mealWindowFor(hour),
    dayOfWeek: dow,
    dayNameFa: DAY_NAMES_FA[dow],
    isWeekend: weekendDays.includes(dow),
    jalali,
    season: jalaliSeason(jalali.jm),
    occasion: persianOccasion(jalali),
  };
}
