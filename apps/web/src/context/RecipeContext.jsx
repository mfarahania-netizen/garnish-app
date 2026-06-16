// GARNISH-SEC-PRELAUNCH-19 (R17) — the missing RecipeContext that 4 surfaces import.
//
// AddFromFavoritesModal, AddFromPlanModal, RecipePickerModal, and AIChatContext all do
// `import { useRecipeContext } from '.../context/RecipeContext'` and read `{ recipes }`. That module
// did not exist → those surfaces crashed on mount. This provides the context from the existing
// `useRecipes` data hook (mirrors ThemeContext/AuthContext), wrapped once at the app root inside the
// QueryClientProvider. No feature redesign — corrective only.
import { createContext, useContext } from 'react';
import { useRecipes } from '../hooks/useRecipes';

const RecipeContext = createContext(null);

export function RecipeProvider({ children }) {
  // single source of recipe data for the app; react-query dedupes the underlying fetch
  const value = useRecipes(); // { recipes, loading, error, getRecipeById, uniqueValues, searchRecipes, ... }
  return <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>;
}

export function useRecipeContext() {
  const ctx = useContext(RecipeContext);
  if (!ctx) {
    throw new Error('useRecipeContext must be used within a <RecipeProvider> (wire it in App.jsx).');
  }
  return ctx;
}
