export const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const MEALS = ['صبحانه', 'ناهار', 'شام'];

export function getMealEmoji(meal) {
  switch (meal) {
    case 'صبحانه':
      return '🌅';
    case 'ناهار':
      return '☀️';
    case 'شام':
      return '🌙';
    default:
      return '🍽️';
  }
}

export function getMealTime(meal) {
  switch (meal) {
    case 'صبحانه':
      return '۸:۰۰';
    case 'ناهار':
      return '۱۲:۰۰';
    case 'شام':
      return '۱۹:۰۰';
    default:
      return '';
  }
}

export function getTodayIndex() {
  const jsDay = new Date().getDay();
  return (jsDay + 1) % 7;
}
