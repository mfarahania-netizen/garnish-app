/**
 * تاریخ شروع هفته را برمی‌گرداند (شنبه ساعت ۰۰:۰۰:۰۰)
 * @param date - یک تاریخ (اختیاری، پیش‌فرض امروز)
 * @returns تاریخ شروع هفته (شنبه)
 */
export function getStartOfWeek(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday, 6=Saturday
  // محاسبه فاصله تا شنبه قبلی
  const diff = (day === 6) ? 0 : (day + 1);
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Saturday-00:00 of the week `weekOffset` weeks from the current week (0 = this week, +1 = next, -1 = last). The single
 * key for multi-week meal plans — every plan read/write derives its `weekStart` from this so a given offset always maps
 * to the same stored week. A non-integer/NaN offset is treated as 0 (current week).
 */
export function getStartOfWeekOffset(weekOffset = 0): Date {
  const n = Number.isFinite(weekOffset) ? Math.trunc(weekOffset) : 0;
  const d = getStartOfWeek();
  d.setDate(d.getDate() + n * 7);
  return d;
}