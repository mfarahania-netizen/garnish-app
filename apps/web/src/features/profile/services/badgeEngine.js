export function generateBadges(stats = {}) {
  const badges = [];
  const { recipeCount = 0, favoriteCount = 0, plannedMeals = 0 } = stats;

  // اولین‌ها
  if (recipeCount >= 1) badges.push({ id: 'first_recipe', title: 'اولین رسپی', description: 'شما اولین رسپی را ثبت کردید', icon: '🍳', progress: 100, color: 'green' });
  if (favoriteCount >= 1) badges.push({ id: 'first_fav', title: 'علاقه‌مند', description: 'شما اولین غذای مورد علاقه را دارید', icon: '❤️', progress: 100, color: 'pink' });
  if (plannedMeals >= 1) badges.push({ id: 'first_plan', title: 'برنامه‌ریز', description: 'شما برنامه غذایی دارید', icon: '📅', progress: 100, color: 'orange' });

  // نشان‌های پیشرفت
  if (recipeCount >= 5) badges.push({ id: 'recipe_5', title: 'آشپز فعال', description: '۵ رسپی ثبت کردید', icon: '👨‍🍳', progress: 100, color: 'teal' });
  if (favoriteCount >= 10) badges.push({ id: 'fav_10', title: 'کلکسیونر', description: '۱۰ غذای مورد علاقه', icon: '💖', progress: 100, color: 'red' });
  if (plannedMeals >= 7) badges.push({ id: 'plan_7', title: 'برنامه‌ریز هفتگی', description: 'برنامه کامل هفتگی دارید', icon: '🗓️', progress: 100, color: 'indigo' });

  // سطح کاربر
  const totalXP = recipeCount * 10 + favoriteCount * 5 + plannedMeals * 3;
  let level = 1;
  if (totalXP >= 500) level = 5;
  else if (totalXP >= 200) level = 4;
  else if (totalXP >= 100) level = 3;
  else if (totalXP >= 50) level = 2;

  const levelTitles = ['', 'نوآموز', 'آشپز', 'سرآشپز', 'مستر شف', 'افسانه'];
  const levelColors = ['gray', 'gray', 'blue', 'orange', 'red', 'yellow'];
  badges.push({
    id: 'level',
    title: levelTitles[level],
    description: `سطح ${level} – ${totalXP} XP`,
    icon: '⭐',
    progress: Math.min((totalXP / 500) * 100, 100),
    color: levelColors[level],
  });

  return badges;
}