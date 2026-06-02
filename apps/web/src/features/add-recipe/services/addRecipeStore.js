const STORAGE_KEY = 'submitted_recipes';

export const loadSubmittedRecipes = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
};

export const saveRecipeForReview = (recipe) => {
  const all = loadSubmittedRecipes();
  const newRecipe = {
    ...recipe,
    id: Date.now().toString(),
    status: 'pending',        // pending | approved | rejected
    adminNote: '',
    createdAt: new Date().toISOString(),
  };
  all.unshift(newRecipe);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return newRecipe;
};

export const updateRecipeStatus = (id, status, adminNote = '') => {
  const all = loadSubmittedRecipes().map(r =>
    r.id === id ? { ...r, status, adminNote } : r
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

// برای پنل ادمین (همه رسپی‌ها)
export const getAllSubmissions = () => loadSubmittedRecipes();

// برای کاربر: فقط رسپی‌های خودش را برگرداند (با فرض اینکه userId داریم)
// فعلاً با یک userId فرضی (می‌توان از AuthContext گرفت)
export const getUserSubmissions = (userId = 'user1') => {
  return loadSubmittedRecipes().filter(r => r.userId === userId);
};