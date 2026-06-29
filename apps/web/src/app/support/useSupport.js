// Data layer for the user-facing support screen — wired to the real /support/tickets backend
// (the old SupportContext was localStorage-only and never reached the server).
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';

const get = (url) => apiClient.get(url).then((r) => r.data);

export function useSupportList() {
  return useQuery({ queryKey: ['support', 'tickets'], queryFn: () => get('/support/tickets') });
}

export function useSupportTicket(id) {
  return useQuery({ queryKey: ['support', 'ticket', id], queryFn: () => get('/support/tickets/' + id), enabled: !!id });
}

export function useSupportActions() {
  const qc = useQueryClient();
  const inval = (id) => {
    qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
    if (id) qc.invalidateQueries({ queryKey: ['support', 'ticket', id] });
  };
  const create = useMutation({ mutationFn: (body) => apiClient.post('/support/tickets', body).then((r) => r.data), onSuccess: () => inval() });
  const reply = useMutation({ mutationFn: ({ id, message }) => apiClient.post(`/support/tickets/${id}/replies`, { message }), onSuccess: (_d, v) => inval(v.id) });
  const close = useMutation({ mutationFn: ({ id }) => apiClient.patch(`/support/tickets/${id}/close`), onSuccess: (_d, v) => inval(v.id) });
  const rate = useMutation({ mutationFn: ({ id, rating, comment }) => apiClient.patch(`/support/tickets/${id}/rate`, { rating, comment }), onSuccess: (_d, v) => inval(v.id) });
  return { create, reply, close, rate };
}
