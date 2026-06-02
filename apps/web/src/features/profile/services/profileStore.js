const PROFILE_KEY = 'garnish_user';
const AVATAR_KEY = 'garnish_avatar';

export function loadUser() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch { return null; }
}

export function saveUser(user) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(user));
}

export function updateUserName(name) {
  const user = loadUser();
  if (!user) return null;
  const updated = { ...user, name };
  saveUser(updated);
  return updated;
}

export function getUserStats() {
  const recipes = JSON.parse(localStorage.getItem('user_recipes') || '[]');
  const tickets = JSON.parse(localStorage.getItem('support_tickets') || '[]');
  const plan = JSON.parse(localStorage.getItem('garnish_weekly_plan') || '{}');
  const favorites = JSON.parse(localStorage.getItem('garnish_favorites') || '[]');

  let breakfastCount = 0;
  Object.entries(plan).forEach(([key]) => {
    if (key.endsWith('-صبحانه')) breakfastCount++;
  });

  return {
    recipeCount: recipes.length,
    ticketCount: tickets.length,
    plannedMeals: Object.keys(plan).length,
    favoriteCount: favorites.length,
    breakfastCount,
  };
}

export function saveAvatar(base64) {
  localStorage.setItem(AVATAR_KEY, base64);
}

export function loadAvatar() {
  return localStorage.getItem(AVATAR_KEY) || null;
}