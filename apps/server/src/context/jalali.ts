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
export type EuOccasionKey = 'christmas' | 'new_year' | 'easter' | 'valentines' | 'halloween' | 'kings_day_nl' | 'none';

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

/** Gregorian (Western/Computus) Easter Sunday for a year → [month(3|4), day]. Anonymous Gregorian algorithm. */
export function gregorianEaster(gy: number): [number, number] {
  const a = gy % 19, b = div(gy, 100), c = gy % 100, d = div(b, 4), e = b % 4;
  const f = div(b + 8, 25), g = div(b - f + 1, 3);
  const h = (19 * a + b - d - g + 15) % 30, i = div(c, 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = div(a + 11 * h + 22 * l, 451);
  const month = div(h + l - 7 * m + 114, 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

/**
 * Detect a EUROPEAN cultural FOOD occasion from a Gregorian date — CORE for the general-public Europe launch
 * (NOT a deferred localization). Fixed feasts + the movable Easter window (Good Friday→Easter Monday).
 * 'en' is the label; the surface localizes. (King's Day = NL-specific; broaden per market later.)
 */
export function gregorianOccasion(gy: number, gm: number, gd: number): { key: EuOccasionKey; en: string; confidence: number } {
  if (gm === 12 && gd >= 24 && gd <= 26) return { key: 'christmas', en: 'Christmas', confidence: gd === 25 ? 1 : 0.8 };
  if ((gm === 12 && gd === 31) || (gm === 1 && gd === 1)) return { key: 'new_year', en: 'New Year', confidence: 1 };
  if (gm === 2 && gd === 14) return { key: 'valentines', en: "Valentine's Day", confidence: 1 };
  if (gm === 10 && gd === 31) return { key: 'halloween', en: 'Halloween', confidence: 1 };
  if (gm === 4 && gd === 27) return { key: 'kings_day_nl', en: "King's Day (NL)", confidence: 1 };
  const [em, ed] = gregorianEaster(gy);
  // Easter window: Good Friday (-2) → Easter Monday (+1)
  const easter = new Date(Date.UTC(gy, em - 1, ed));
  const today = new Date(Date.UTC(gy, gm - 1, gd));
  const diffDays = Math.round((today.getTime() - easter.getTime()) / 86_400_000);
  if (diffDays >= -2 && diffDays <= 1) return { key: 'easter', en: 'Easter', confidence: diffDays === 0 ? 1 : 0.8 };
  return { key: 'none', en: '', confidence: 0 };
}
