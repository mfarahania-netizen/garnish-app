import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { invalidateProfileDomain, queryKeys } from '../lib/queryKeys';

export function usePreferencesQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading: loading } = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: async () => {
      const { data } = await apiClient.get('/users/preferences');
      return {
        diet: data?.diet || 'omnivore',
        allergies: Array.isArray(data?.allergies) ? data.allergies : JSON.parse(data?.allergies || '[]'),
        skill: data?.skillLevel || 'beginner',
        cuisine: Array.isArray(data?.cuisine) ? data.cuisine : JSON.parse(data?.cuisine || '[]'),
        budget: data?.budget || 'low',
      };
    },
    enabled: !!token,
    staleTime: 0,
    placeholderData: {
      diet: 'omnivore',
      allergies: [],
      skill: 'beginner',
      cuisine: [],
      budget: 'low',
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (newPrefs) => {
      const body = {
        diet: newPrefs.diet || preferences?.diet || 'omnivore',
        allergies: newPrefs.allergies ?? preferences?.allergies ?? [],
        skillLevel: newPrefs.skill ?? preferences?.skill ?? 'beginner',
        cuisine: newPrefs.cuisine ?? preferences?.cuisine ?? [],
        budget: newPrefs.budget ?? preferences?.budget ?? 'low',
        healthGoals: newPrefs.healthGoals ?? preferences?.healthGoals ?? [],
      };
      await apiClient.put('/users/preferences', body);
    },
    onSuccess: () => {
      invalidateProfileDomain(queryClient);
    },
  });

  const updatePreferences = async (newPrefs) => {
    await updateMutation.mutateAsync(newPrefs);
  };

  return {
    preferences: preferences || { diet: 'omnivore', allergies: [], skill: 'beginner', cuisine: [], budget: 'low', healthGoals: [] },
    updatePreferences,
    loading: loading || updateMutation.isPending,
  };
}
