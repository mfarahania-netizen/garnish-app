// TODO: کد این ماژول را جایگزین کنید
import { normalize } from '../../../data/shoppingConstants';

const INTERACTION_KEY = 'garnish_interaction_history';

export function loadInteractionHistory() {
  try {
    return JSON.parse(localStorage.getItem(INTERACTION_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveInteractionHistory(history) {
  localStorage.setItem(INTERACTION_KEY, JSON.stringify(history));
}

export function checkHardConstraints(recipe, userPrefs) {
  const ings = (recipe.ingredients || []).join(' ');
  const dietConstraints = {
    'گیاه‌خوار': () => ings.includes('گوشت') || ings.includes('مرغ'),
    'وگان': () => ings.includes('گوشت') || ings.includes('مرغ') || ings.includes('شیر') || ings.includes('تخم‌مرغ') || ings.includes('عسل'),
    'کتو': () => ings.includes('برنج') || ings.includes('نان') || ings.includes('شکر'),
    'دیابتی': () => ings.includes('شکر'),
  };
  if (userPrefs.diet && dietConstraints[userPrefs.diet]?.()) return true;

  const allergyMap = {
    'گلوتن': ['آرد', 'گندم', 'نان', 'ماکارونی'],
    'لاکتوز': ['شیر', 'ماست', 'پنیر', 'خامه'],
    'تخم‌مرغ': ['تخم‌مرغ'],
    'آجیل': ['گردو', 'بادام', 'پسته'],
    'غذاهای دریایی': ['ماهی', 'میگو'],
  };
  if (userPrefs.allergies) {
    for (const allergy of userPrefs.allergies) {
      const forbidden = allergyMap[allergy] || [];
      if (forbidden.some(f => ings.includes(f))) return true;
    }
  }
  return false;
}

export function calculateContextScore(recipe, context) {
  let score = 50;
  const { hour, isWeekend, userPrefs, season, upcomingEvent, fatigue } = context;
  const recipeTime = parseInt(recipe.cook_time) || 60;
  const title = recipe.title || '';

  if (hour >= 6 && hour < 10) {
    if (title.includes('صبحانه') || title.includes('املت') || title.includes('عدسی')) score += 30;
    if (recipeTime > 60) score -= 20;
  } else if (hour >= 10 && hour < 15) {
    if (recipeTime > 180 && !isWeekend) score -= 20;
    if (isWeekend && recipeTime > 60) score += 10;
  } else if (hour >= 15 && hour < 20) {
    if (recipeTime > 120) score -= 10;
    if (title.includes('سالاد') || title.includes('سوپ')) score += 15;
  }

  if (isWeekend) {
    if (title.includes('مجلسی') || title.includes('کباب')) score += 15;
  } else {
    if (recipeTime <= 60) score += 10;
  }

  if (fatigue === 'high') {
    if (recipe.difficulty === 'سخت') score -= 40;
    if (recipeTime <= 30) score += 25;
  }

  if (userPrefs.skill === 'مبتدی' && recipe.difficulty === 'سخت') score -= 40;
  if (userPrefs.skill === 'حرفه‌ای' && recipe.difficulty === 'سخت') score += 15;

  if (season === 'winter' && (title.includes('آش') || title.includes('سوپ'))) score += 20;
  if (season === 'summer' && (title.includes('سالاد') || title.includes('نوشیدنی'))) score += 20;

  if (upcomingEvent === 'nowruz' && (title.includes('سبزی') || title.includes('ماهی'))) score += 30;

  return score;
}

export function calculateLearnedScore(recipe, favorites, interactionHistory) {
  let score = 0;
  if (favorites.includes(recipe.id)) score += 30;

  const recipeHistory = interactionHistory[recipe.id] || { shown: 0, clicked: 0, dismissed: 0 };
  if (recipeHistory.clicked > 0) score += 15 * recipeHistory.clicked;
  if (recipeHistory.dismissed > 0) score -= 30 * recipeHistory.dismissed;

  return score;
}