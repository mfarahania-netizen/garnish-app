export const ALLOWED_HOURS = [8, 11, 16, 19];
export const MAX_MEAL_SUGGESTIONS_PER_DAY = 3;
export const SHOPPING_CHECK_INTERVAL = 30 * 60 * 1000;
export const MIN_SHOPPING_ITEMS = 3;
export const SHOPPING_NOTIFY_COOLDOWN = 60 * 60 * 1000;

let lastShoppingNotifyTime = 0;

export function shouldSendShoppingReminder() {
  const now = Date.now();
  return (now - lastShoppingNotifyTime) >= SHOPPING_NOTIFY_COOLDOWN;
}

export function markShoppingReminderSent() {
  lastShoppingNotifyTime = Date.now();
}

export function getMealType(hour) {
  if (hour >= 6 && hour < 10) return { type: 'صبحانه', emoji: '🌅' };
  if (hour >= 10 && hour < 15) return { type: 'ناهار', emoji: '☀️' };
  if (hour >= 15 && hour < 20) return { type: 'شام', emoji: '🌙' };
  return { type: 'میان‌وعده', emoji: '🍿' };
}

export function getSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function getUpcomingEvent() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (month === 3 && day >= 15 && day <= 28) return 'nowruz';
  if (month === 12 && day >= 20) return 'yalda';
  return null;
}