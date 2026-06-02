import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';

export function useSupportQuery() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: tickets = [], isLoading: loading } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data } = await apiClient.get('/support/tickets');
      return data;
    },
    enabled: !!token,
    staleTime: 0,
  });

  const createMutation = useMutation({
    mutationFn: async ({ subject, message, category, priority }) => {
      await apiClient.post('/support/tickets', {
        subject,
        message,
        data: { category, priority },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ ticketId, message }) => {
      await apiClient.post(`/support/tickets/${ticketId}/replies`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (ticketId) => {
      await apiClient.patch(`/support/tickets/${ticketId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tickets']);
    },
  });

  return {
    tickets,
    loading: loading || createMutation.isPending || replyMutation.isPending || closeMutation.isPending,
    createTicket: createMutation.mutate,
    addReply: (ticketId, message) => replyMutation.mutate({ ticketId, message }),
    closeTicket: closeMutation.mutate,
  };
}