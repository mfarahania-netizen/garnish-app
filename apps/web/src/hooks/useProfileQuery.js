import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { generateBadges } from '../features/profile/services/badgeEngine';

export function useProfileQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  // پروفایل اصلی
  const { data: userData, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: () => apiClient.get('/users/me').then(res => res.data),
    enabled: !!token,
  });

  // آمار
  const { data: favData } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => apiClient.get('/favorites').then(res => res.data),
    enabled: !!token,
  });
  const { data: planData } = useQuery({
    queryKey: ['mealPlan'],
    queryFn: () => apiClient.get('/meal-plans').then(res => res.data),
    enabled: !!token,
  });
  const { data: myRecipesData } = useQuery({
    queryKey: ['myRecipes'],
    queryFn: () => apiClient.get('/recipes/my').then(res => res.data),
    enabled: !!token,
  });

  const stats = {
    recipeCount: myRecipesData?.length || 0,
    favoriteCount: favData?.length || 0,
    plannedMeals: planData?.slots?.length || 0,
  };

  const badges = generateBadges(stats);

  const [avatar, setAvatar] = useState(() => localStorage.getItem('garnish_avatar') || null);

  const updateNameMutation = useMutation({
    mutationFn: (newName) => apiClient.patch('/users/me', { name: newName }),
    onSuccess: () => queryClient.invalidateQueries(['userProfile']),
  });

  const updateName = async (newName) => {
    await updateNameMutation.mutateAsync(newName);
  };

  const updateAvatar = (newAvatar) => {
    localStorage.setItem('garnish_avatar', newAvatar);
    setAvatar(newAvatar);
  };

  return {
    profile: {
      name: userData?.name || '',
      phone: userData?.phone || '',
      avatar,
    },
    stats,
    badges,
    myRecipes: myRecipesData || [],
    loading: profileLoading,
    updateName,
    updateAvatar,
  };
}