import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useCallback } from 'react';
import apiClient from '../lib/apiClient';
import Fuse from 'fuse.js';

const fetchRecipes = async (page = 1, limit = 20) => {
  const { data } = await apiClient.get(`/recipes?page=${page}&limit=${limit}`);
  return data; // { data: [], total, page, pageSize }
};

export function useRecipes() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['recipes', page],
    queryFn: () => fetchRecipes(page, limit),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const apiRecipes = response?.data ?? [];
  const total = response?.total ?? 0;
  const currentPage = response?.page ?? page;
  const pageSize = response?.pageSize ?? limit;
  const totalPages = Math.ceil(total / pageSize);

  const changePage = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  const recipes = useMemo(() => {
    if (!apiRecipes) return [];
    return apiRecipes.map(apiRecipe => {
      let tools = [];
      let tips = [];
      let faq = [];
      let categories = [];
      let allergens = [];
      let occasion = [];
      try { tools = JSON.parse(apiRecipe.tools || '[]'); } catch (e) { }
      try { tips = JSON.parse(apiRecipe.tips || '[]'); } catch (e) { }
      try { faq = JSON.parse(apiRecipe.faq || '[]'); } catch (e) { }
      try { categories = JSON.parse(apiRecipe.categories || '[]'); } catch (e) { }
      try { allergens = JSON.parse(apiRecipe.allergens || '[]'); } catch (e) { }
      try { occasion = JSON.parse(apiRecipe.occasion || '[]'); } catch (e) { }

      let nutrition = null;
      if (apiRecipe.nutrition) {
        nutrition = {
          کالری: apiRecipe.nutrition.calories != null ? apiRecipe.nutrition.calories + ' کیلوکالری' : '',
          پروتئین: apiRecipe.nutrition.protein != null ? apiRecipe.nutrition.protein + ' گرم' : '',
          چربی: apiRecipe.nutrition.fat != null ? apiRecipe.nutrition.fat + ' گرم' : '',
          کربوهیدرات: apiRecipe.nutrition.carbs != null ? apiRecipe.nutrition.carbs + ' گرم' : '',
          فیبر: apiRecipe.nutrition.fiber != null ? apiRecipe.nutrition.fiber + ' گرم' : '',
        };
      }

      return {
        id: apiRecipe.id,
        title: apiRecipe.title,
        description: apiRecipe.description || '',
        excerpt: apiRecipe.description?.substring(0, 100) || '',
        category: apiRecipe.category || (categories.length > 0 ? categories[0] : ''),
        region: apiRecipe.region || '',
        difficulty: apiRecipe.difficulty || '',
        cook_time: apiRecipe.cookingTime ? String(apiRecipe.cookingTime) : '',
        prep_time: apiRecipe.prepTime || '',
        total_time: apiRecipe.totalTime || '',
        servings: apiRecipe.servings,
        ingredients: apiRecipe.ingredients.map(ing => ({
          name: ing.name,
          amount: ing.amount,
          notes: ing.notes || '',
        })),
        steps: apiRecipe.steps.map(s => s.instruction),
        tools,
        tips,
        faq,
        nutrition,
        searchableTerms: apiRecipe.searchTerms?.map(t => t.term) || [],
        categories,
        allergens,
        occasion,
        cost: apiRecipe.cost || '',
        foodType: apiRecipe.category || (categories.length > 0 ? categories[0] : ''),
        mealType: apiRecipe.mealType || '',
        diet: apiRecipe.diet || '',
        isQuick: false,
        isHealthy: false,
      };
    });
  }, [apiRecipes]);

  const fuse = useMemo(() => {
    if (!recipes.length) return null;
    return new Fuse(recipes, {
      keys: [
        { name: 'title', weight: 0.5 },
        { name: 'ingredients.name', weight: 0.3 },
        { name: 'searchableTerms', weight: 0.2 },
        { name: 'excerpt', weight: 0.1 },
      ],
      threshold: 0.3,
      minMatchCharLength: 2,
      includeScore: true,
    });
  }, [recipes]);

  const getRecipeById = (id) => recipes.find(r => r.id == id) || null;

  const uniqueValues = useMemo(() => ({
    foodTypes: [...new Set(recipes.map(r => r.foodType).filter(Boolean))],
    allCategories: [...new Set(recipes.flatMap(r => r.categories).filter(Boolean))],
    mealTypes: [...new Set(recipes.flatMap(r => (r.mealType || '').split(',')))].filter(Boolean),
    diets: [...new Set(recipes.map(r => r.diet).filter(Boolean))],
    regions: [...new Set(recipes.map(r => r.region).filter(Boolean))],
    occasions: [...new Set(recipes.flatMap(r => r.occasion).filter(Boolean))],
    allergens: [...new Set(recipes.flatMap(r => r.allergens).filter(Boolean))],
    costs: [...new Set(recipes.map(r => r.cost).filter(Boolean))],
  }), [recipes]);

  const searchRecipes = (query, options = {}) => {
    if (!fuse) return [];
    let items = fuse.search(query, { limit: options.limit || 10 }).map(r => r.item);
    if (options.mealType) items = items.filter(r => r.mealType?.includes(options.mealType));
    if (options.diet) items = items.filter(r => r.diet === options.diet);
    if (options.isQuick) items = items.filter(r => r.isQuick);
    if (options.isHealthy) items = items.filter(r => r.isHealthy);
    if (options.region) items = items.filter(r => r.region === options.region);
    if (options.category) items = items.filter(r => r.categories?.includes(options.category) || r.foodType === options.category);
    if (options.occasion) items = items.filter(r => r.occasion?.includes(options.occasion));
    if (options.allergen) items = items.filter(r => !r.allergens?.includes(options.allergen));
    if (options.cost) items = items.filter(r => r.cost === options.cost);
    return items;
  };

  return {
    recipes,
    loading: isLoading,
    error,
    getRecipeById,
    uniqueValues,
    searchRecipes,
    // 🆕 موارد صفحه‌بندی
    total,
    currentPage,
    pageSize,
    totalPages,
    changePage,
  };
}