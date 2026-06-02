import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient'; // 👈 جایگزین axios
import { useAuth } from '../context/AuthContext';

const fetchFavorites = async () => {
  const { data } = await apiClient.get('/favorites');
  return data;
};

export function useFavoritesQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: favorites = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
    enabled: !!token,
  });

  const addMutation = useMutation({
    mutationFn: (recipeId) =>
      apiClient.post(`/favorites/${recipeId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const removeMutation = useMutation({
    mutationFn: (recipeId) =>
      apiClient.delete(`/favorites/${recipeId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const isFavorite = (recipeId) => favorites.some((fav) => fav.recipeId === recipeId);

  return {
    favorites,
    isLoading,
    error,
    addFavorite: addMutation.mutate,
    removeFavorite: removeMutation.mutate,
    isFavorite,
  };
}