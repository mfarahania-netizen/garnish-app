import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

export function useShoppingListQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // واکشی لیست خرید
  const { data: list, isLoading } = useQuery({
    queryKey: ['shoppingList'],
    queryFn: async () => {
      const { data } = await apiClient.get('/shopping-list');
      return data;
    },
    enabled: !!token,
    staleTime: 0,
  });

  // افزودن آیتم‌ها
  const addMutation = useMutation({
    mutationFn: async (items) => {
      await apiClient.post('/shopping-list/items', { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['shoppingList']);
    },
  });

  // تغییر وضعیت تیک
  const toggleMutation = useMutation({
    mutationFn: async (itemId) => {
      await apiClient.patch(`/shopping-list/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['shoppingList']);
    },
  });

  // حذف آیتم
  const removeMutation = useMutation({
    mutationFn: async (itemId) => {
      await apiClient.delete(`/shopping-list/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['shoppingList']);
    },
  });

  return {
    list: list || { items: [] },
    loading: isLoading,
    addItems: addMutation.mutate,
    toggleItem: toggleMutation.mutate,
    removeItem: removeMutation.mutate,
  };
}