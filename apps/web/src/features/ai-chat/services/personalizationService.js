/**
 * AI-chat ephemeral context helpers.
 *
 * NOTE (GARNISH-RESET-01, Amendment 2 §A2.3): the previous localStorage-based "personalization" preference
 * store (`loadUserPreferences` / `saveUserPreferences` / `getUserContext` reading `garnish_*` keys) was
 * REMOVED. It was fake client-side personalization. Real personalization context comes from the server
 * (the `/ai/chat` BehavioralContextSnapshot orchestrator); the client only contributes lightweight,
 * ephemeral time/season hints below — no persisted preference store, no localStorage.
 */

export const getTimeBasedContext = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return 'صبحانه';
  if (hour >= 10 && hour < 12) return 'میان‌وعده صبح';
  if (hour >= 12 && hour < 15) return 'ناهار';
  if (hour >= 15 && hour < 18) return 'عصرانه';
  if (hour >= 18 && hour < 22) return 'شام';
  return 'میان‌وعده شب';
};

export const getSeasonContext = () => {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'بهار';
  if (month >= 6 && month <= 8) return 'تابستان';
  if (month >= 9 && month <= 11) return 'پاییز';
  return 'زمستان';
};
