import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/apiClient';
import { swapsList } from '../components/ges/personalize';

/**
 * usePersonalizedCascade — calls POST /recipes/:id/personalize for the active {servings, swaps, removed}
 * and returns the grounded cascade: recomputed nutrition (source-locked, coverage-flagged) + per-swap
 * allergen re-gate + notes. Only runs when logged-in and something is actually personalized, and is keyed
 * by the personalization signature so it re-fetches when the user changes a swap/remove/serving.
 */
export function usePersonalizedCascade(id, perso, enabled) {
  const body = {
    servings: perso?.servedFor || undefined,
    swaps: swapsList(perso?.swaps),
    removed: Array.isArray(perso?.removed) ? perso.removed : [],
  };
  const q = useQuery({
    queryKey: ['recipe-personalize', id, JSON.stringify(body)],
    queryFn: () => apiClient.post(`/recipes/${id}/personalize`, body).then((r) => r.data),
    enabled: !!id && !!enabled && !!perso?.isPersonalized,
    staleTime: 60_000,
    retry: 1,
  });
  return q.data || null;
}
