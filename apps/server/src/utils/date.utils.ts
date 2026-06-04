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