import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

export function usePreferencesQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: preferences, isLoading: loading } = useQuery({
    queryKey: ['preferences'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users/preferences');
      return {
        diet: data?.diet || 'omnivore',
        allergies: data?.allergies ? JSON.parse(data.allergies) : [],
        skill: data?.skillLevel || 'beginner',
        cuisine: data?.cuisine ? JSON.parse(data.cuisine) : [],
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
        allergies: JSON.stringify(newPrefs.allergies ?? preferences?.allergies ?? []),
        skillLevel: newPrefs.skill ?? preferences?.skill ?? 'beginner',
        cuisine: JSON.stringify(newPrefs.cuisine ?? preferences?.cuisine ?? []),
        budget: newPrefs.budget ?? preferences?.budget ?? 'low',
      };
      await apiClient.put('/users/preferences', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['preferences']);
    },
  });

  const updatePreferences = async (newPrefs) => {
    await updateMutation.mutateAsync(newPrefs);
  };

  return {
    preferences: preferences || { diet: 'omnivore', allergies: [], skill: 'beginner', cuisine: [], budget: 'low' },
    updatePreferences,
    loading: loading || updateMutation.isPending,
  };
}