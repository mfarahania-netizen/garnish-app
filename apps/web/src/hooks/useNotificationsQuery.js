import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

export function useNotificationsQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get('/notifications');
      return data;
    },
    enabled: !!token,
    refetchInterval: 120000,
    staleTime: 60000,
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const generateMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/generate'),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/notifications/${id}`),
    onSuccess: () => queryClient.invalidateQueries(['notifications']),
  });

  return {
    notifications,
    unreadCount,
    loading: isLoading,
    isGenerating: generateMutation.isPending,
    generateSuggestion: generateMutation.mutate,
    markAsRead: markAsReadMutation.mutate,
    deleteNotification: deleteMutation.mutate,
  };
}