const PLAN_KEY = 'garnish_weekly_plan';

export function loadPlan() {
  try {
    return JSON.parse(localStorage.getItem(PLAN_KEY) || '{}');
  } catch {
    return {};
  }
}

export function savePlan(plan) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  return plan;
}

export function updateMeal(day, meal, recipeId) {
  const plan = loadPlan();
  const key = `${day}-${meal}`;
  if (recipeId === null) {
    delete plan[key];
  } else {
    plan[key] = recipeId;
  }
  savePlan(plan);
  return plan;
}

export function getRecipeId(plan, day, meal) {
  return plan[`${day}-${meal}`] || null;
}

export function getAllPlannedRecipeIds() {
  const plan = loadPlan();
  return [...new Set(Object.values(plan))];
}
