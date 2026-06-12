import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useCallback } from 'react';
import apiClient from '../lib/apiClient';
import Fuse from 'fuse.js';

const fetchRecipes = async (page = 1, limit = 20) => {
  const { data } = await apiClient.get(`/recipes?page=${page}&limit=${limit}`);
  return data;
};

const EMPTY_RECIPES = [];

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [value];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
};

const normalizeJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeRecipe = (apiRecipe) => {
  const categories = normalizeList(apiRecipe.categories);
  const allergens = normalizeList(apiRecipe.allergens);
  const occasion = normalizeList(apiRecipe.occasion);
  const mealType = normalizeList(apiRecipe.mealType);
  const tools = normalizeJsonArray(apiRecipe.tools);
  const tips = normalizeJsonArray(apiRecipe.tips);
  const faq = normalizeJsonArray(apiRecipe.faq);

  return {
    id: apiRecipe.id,
    title: apiRecipe.title,
    description: apiRecipe.description || '',
    excerpt: apiRecipe.description?.substring(0, 160) || '',
    category: apiRecipe.category || (categories.length > 0 ? categories[0] : ''),
    region: apiRecipe.region || '',
    difficulty: apiRecipe.difficulty || '',
    cook_time: apiRecipe.cookingTime ? String(apiRecipe.cookingTime) : '',
    prep_time: apiRecipe.prepTime || '',
    total_time: apiRecipe.totalTime || '',
    cookingTime: apiRecipe.cookingTime,
    prepTime: apiRecipe.prepTime,
    totalTime: apiRecipe.totalTime,
    servings: apiRecipe.servings,
    ingredients: (apiRecipe.ingredients || []).map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      displayUnit: ingredient.displayUnit,
      preparation: ingredient.preparation,
      ingredientId: ingredient.ingredientId,
      ingredientCode: ingredient.ingredientCode,
      confidence: ingredient.confidence,
      notes: ingredient.notes || '',
    })),
    steps: apiRecipe.steps || [],
    tools,
    tips,
    faq,
    nutrition: apiRecipe.nutrition || null,
    searchableTerms: apiRecipe.searchTerms?.map((term) => term.term) || [],
    categories,
    allergens,
    occasion,
    cost: apiRecipe.cost || '',
    foodType: apiRecipe.category || (categories.length > 0 ? categories[0] : ''),
    mealType,
    diet: apiRecipe.diet || '',
    isQuick: Number(apiRecipe.cookingTime || 0) > 0 && Number(apiRecipe.cookingTime) <= 30,
    isHealthy: categories.includes('healthy') || apiRecipe.diet === 'vegan' || apiRecipe.diet === 'vegetarian',
  };
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

  const apiRecipes = response?.data ?? EMPTY_RECIPES;
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
    return apiRecipes.map(normalizeRecipe);
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

  const getRecipeById = (id) => recipes.find((recipe) => recipe.id == id) || null;

  const uniqueValues = useMemo(() => ({
    foodTypes: [...new Set(recipes.map((recipe) => recipe.foodType).filter(Boolean))],
    allCategories: [...new Set(recipes.flatMap((recipe) => recipe.categories).filter(Boolean))],
    mealTypes: [...new Set(recipes.flatMap((recipe) => normalizeList(recipe.mealType)))].filter(Boolean),
    diets: [...new Set(recipes.map((recipe) => recipe.diet).filter(Boolean))],
    regions: [...new Set(recipes.map((recipe) => recipe.region).filter(Boolean))],
    occasions: [...new Set(recipes.flatMap((recipe) => recipe.occasion).filter(Boolean))],
    allergens: [...new Set(recipes.flatMap((recipe) => recipe.allergens).filter(Boolean))],
    costs: [...new Set(recipes.map((recipe) => recipe.cost).filter(Boolean))],
  }), [recipes]);

  const searchRecipes = (query, options = {}) => {
    if (!fuse) return [];
    let items = fuse.search(query, { limit: options.limit || 10 }).map((result) => result.item);
    if (options.mealType) items = items.filter((recipe) => normalizeList(recipe.mealType).includes(options.mealType));
    if (options.diet) items = items.filter((recipe) => recipe.diet === options.diet);
    if (options.isQuick) items = items.filter((recipe) => recipe.isQuick);
    if (options.isHealthy) items = items.filter((recipe) => recipe.isHealthy);
    if (options.region) items = items.filter((recipe) => recipe.region === options.region);
    if (options.category) items = items.filter((recipe) => recipe.categories?.includes(options.category) || recipe.foodType === options.category);
    if (options.occasion) items = items.filter((recipe) => recipe.occasion?.includes(options.occasion));
    if (options.allergen) items = items.filter((recipe) => !recipe.allergens?.includes(options.allergen));
    if (options.cost) items = items.filter((recipe) => recipe.cost === options.cost);
    return items;
  };

  return {
    recipes,
    loading: isLoading,
    error,
    getRecipeById,
    uniqueValues,
    searchRecipes,
    total,
    currentPage,
    pageSize,
    totalPages,
    changePage,
  };
}
