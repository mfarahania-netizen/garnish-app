// Home greeting helpers — real weekday + time-of-day (computed client-side, fa).
// Day-of-week aligns between Gregorian and Jalali, so getDay() gives the correct
// Persian weekday name; the assembled mockup shows only weekday + time-of-day (no date number).

// getDay(): 0=Sun … 6=Sat
const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export const faWeekday = (date = new Date()) => WEEKDAYS[date.getDay()];

export function faTimeOfDay(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'صبح';
  if (h >= 11 && h < 15) return 'ظهر';
  if (h >= 15 && h < 19) return 'عصر';
  return 'شب';
}

// "سه‌شنبه · عصر"
export const weekdayTimeLine = (date = new Date()) => `${faWeekday(date)} · ${faTimeOfDay(date)}`;
