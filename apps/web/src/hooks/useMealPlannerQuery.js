import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { DAYS } from '../features/meal-planner/services/planHelpers'; // 👈 حالا از فایل اصلی می‌آید

export function useMealPlannerQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: plan, isLoading: loading } = useQuery({
    queryKey: ['mealPlan'],
    queryFn: async () => {
      const { data } = await apiClient.get('/meal-plans');
      return data || { slots: [] };
    },
    enabled: !!token,
    staleTime: 0,
  });

  const addMealMutation = useMutation({
    mutationFn: async ({ dayOfWeek, mealType, recipeId }) => {
      await apiClient.post('/meal-plans/slots', { dayOfWeek, mealType, recipeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
    },
  });

  const removeMealMutation = useMutation({
    mutationFn: async ({ dayOfWeek, mealType }) => {
      await apiClient.delete(`/meal-plans/slots/${dayOfWeek}/${mealType}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/meal-plans/generate');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const weekStart = plan?.weekStart || new Date().toISOString();
      await apiClient.post('/meal-plans', { weekStart, slots: [] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
    },
  });

  const addMeal = (day, mealType, recipeId) => {
    const dayIndex = DAYS.indexOf(day);
    if (dayIndex === -1) return;
    addMealMutation.mutate({ dayOfWeek: dayIndex, mealType, recipeId });
  };

  const removeMeal = (day, mealType) => {
    const dayIndex = DAYS.indexOf(day);
    if (dayIndex === -1) return;
    removeMealMutation.mutate({ dayOfWeek: dayIndex, mealType });
  };

  const generateSmartPlan = () => generateMutation.mutate();

  const clearPlan = () => clearMutation.mutate();

  return {
    plan,
    loading: loading || addMealMutation.isPending || removeMealMutation.isPending || generateMutation.isPending || clearMutation.isPending,
    addMeal,
    removeMeal,
    generateSmartPlan,
    clearPlan,
  };
}