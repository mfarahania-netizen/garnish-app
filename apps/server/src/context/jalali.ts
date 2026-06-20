/**
 * Pure Gregorian → Jalali (Solar Hijri / Persian) calendar conversion + Persian season & cultural-occasion
 * derivation. Deterministic (no Date.now/new Date inside). Iran abolished DST in 2022 → fixed UTC+03:30,
 * so a single offset is exact year-round.
 *
 * WHY this exists: a generic context engine sees only Gregorian "summer/winter". For a Persian-first app
 * the moat is knowing it's «شبِ یلدا» (longest night → warming stews) or «نوروز» (festive table) or Ramadan.
 * That is a localization differentiator a global competitor cannot easily copy.
 */

const div = (a: number, b: number) => Math.trunc(a / b);

export type JalaliDate = { jy: number; jm: number; jd: number; monthName: string };

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export type PersianSeason = 'بهار' | 'تابستان' | 'پاییز' | 'زمستان';
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter';
export type OccasionKey = 'nowruz' | 'sizdah_bedar' | 'chaharshanbe_suri' | 'yalda' | 'none';

/** Standard, widely-used Gregorian→Jalali algorithm (gm is 1-12). Accurate for all modern dates. */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const gDM = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days = 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) - 80 + gd + gDM[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

export function toJalaliDate(gy: number, gm: number, gd: number): JalaliDate {
  const [jy, jm, jd] = gregorianToJalali(gy, gm, gd);
  return { jy, jm, jd, monthName: JALALI_MONTHS[jm - 1] };
}

/** Jalali month → season. 1-3 spring, 4-6 summer, 7-9 autumn, 10-12 winter. */
export function jalaliSeason(jm: number): { key: SeasonKey; fa: PersianSeason } {
  if (jm <= 3) return { key: 'spring', fa: 'بهار' };
  if (jm <= 6) return { key: 'summer', fa: 'تابستان' };
  if (jm <= 9) return { key: 'autumn', fa: 'پاییز' };
  return { key: 'winter', fa: 'زمستان' };
}

/**
 * Detect a Persian cultural FOOD occasion from a Jalali date (the ones that move the menu). Lunar
 * occasions (Ramadan / Eid) are Hijri, not Jalali-derivable here → returned as 'none' (a Hijri calendar
 * is a deliberate follow-up). Returns the occasion + a human label + a 0..1 confidence.
 */
export function persianOccasion(j: JalaliDate): { key: OccasionKey; fa: string; confidence: number } {
  const { jm, jd } = j;
  // سیزده‌بدر — Farvardin 13 (checked BEFORE the Nowruz range so it isn't shadowed)
  if (jm === 1 && jd === 13) return { key: 'sizdah_bedar', fa: 'سیزده‌بدر', confidence: 1 };
  // نوروز — Farvardin 1–12 (peak 1–4)
  if (jm === 1 && jd <= 12) return { key: 'nowruz', fa: 'نوروز', confidence: jd <= 4 ? 1 : 0.7 };
  // شبِ یلدا — the longest night, on the autumn→winter threshold: eve = آذر ۲۹/۳۰, spilling into دی ۱
  if (jm === 9 && jd >= 29) return { key: 'yalda', fa: 'شبِ یلدا', confidence: jd === 30 ? 1 : 0.8 };
  if (jm === 10 && jd === 1) return { key: 'yalda', fa: 'شبِ یلدا', confidence: 0.9 };
  // چهارشنبه‌سوری / آستانهٔ نوروز — last ~week of اسفند
  if (jm === 12 && jd >= 24) return { key: 'chaharshanbe_suri', fa: 'آستانهٔ نوروز / چهارشنبه‌سوری', confidence: 0.6 };
  return { key: 'none', fa: '', confidence: 0 };
}
