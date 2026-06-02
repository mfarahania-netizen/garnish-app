const STORAGE_KEY = 'garnish_ai_preferences';

export const loadUserPreferences = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

export const saveUserPreferences = (prefs) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
};

export const getUserContext = () => {
  // دریافت تنظیمات از Contextهای موجود
  const stored = localStorage.getItem('garnish_user');
  const user = stored ? JSON.parse(stored) : null;
  
  const dietPrefs = localStorage.getItem('garnish_diet_prefs');
  const diet = dietPrefs ? JSON.parse(dietPrefs) : {};
  
  return {
    phone: user?.phone || null,
    name: user?.name || 'کاربر',
    diet: diet.diet || [],
    allergies: diet.allergies || [],
    skillLevel: diet.skillLevel || 'متوسط',
    favorites: JSON.parse(localStorage.getItem('garnish_favorites') || '[]'),
    recentRecipes: JSON.parse(localStorage.getItem('garnish_recent_recipes') || '[]'),
    weeklyPlan: JSON.parse(localStorage.getItem('garnish_weekly_plan') || '[]'),
  };
};

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