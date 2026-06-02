import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

export function useMealPlannerQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: plan, isLoading: loading } = useQuery({
    queryKey: ['mealPlan'],
    queryFn: async () => {
      const { data } = await apiClient.get('/meal-plans');
      return data || { slots: [], weekStart: new Date().toISOString() };
    },
    enabled: !!token,
    staleTime: 0,
  });

  // به‌روزرسانی خوش‌بینانه برای افزودن/حذف وعده
  const saveMutation = useMutation({
    mutationFn: async ({ weekStart, slots }) => {
      const { data } = await apiClient.post('/meal-plans', { weekStart, slots });
      return data;
    },
    onMutate: async (newPlan) => {
      await queryClient.cancelQueries({ queryKey: ['mealPlan'] });
      const previousPlan = queryClient.getQueryData(['mealPlan']);
      // بلافاصله UI را با داده جدید به‌روز کن
      queryClient.setQueryData(['mealPlan'], (old) => ({
        ...old,
        slots: newPlan.slots,
      }));
      return { previousPlan };
    },
    onError: (err, newPlan, context) => {
      // در صورت خطا، به حالت قبلی برگرد
      queryClient.setQueryData(['mealPlan'], context.previousPlan);
    },
    onSettled: () => {
      // در نهایت، داده را از سرور re-fetch کن
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post('/meal-plans/generate');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mealPlan'] });
    },
  });

  const addMeal = (day, mealType, recipeId) => {
    const dayIndex = DAYS.indexOf(day);
    if (dayIndex === -1) return;
    const currentSlots = plan?.slots || [];
    // هوشمندانه: اگر قبلاً این وعده وجود داشت، حذفش کن و بعد جدید را اضافه کن (جایگزینی)
    const filteredSlots = currentSlots.filter(s => !(s.dayOfWeek === dayIndex && s.mealType === mealType));
    const updatedSlots = [...filteredSlots, { dayOfWeek: dayIndex, mealType, recipeId, notes: '' }];
    saveMutation.mutate({ weekStart: plan?.weekStart || new Date().toISOString(), slots: updatedSlots });
  };

  const removeMeal = (day, mealType) => {
    const dayIndex = DAYS.indexOf(day);
    if (dayIndex === -1) return;
    const currentSlots = plan?.slots || [];
    const updatedSlots = currentSlots.filter(s => !(s.dayOfWeek === dayIndex && s.mealType === mealType));
    saveMutation.mutate({ weekStart: plan?.weekStart || new Date().toISOString(), slots: updatedSlots });
  };

  const generateSmartPlan = () => generateMutation.mutate();

  const clearPlan = () => {
    saveMutation.mutate({ weekStart: plan?.weekStart || new Date().toISOString(), slots: [] });
  };

  return {
    plan,
    loading: loading || generateMutation.isPending,
    isSaving: saveMutation.isPending,
    addMeal,
    removeMeal,
    generateSmartPlan,
    clearPlan,
    fetchPlan: () => queryClient.invalidateQueries({ queryKey: ['mealPlan'] }),
  };
}