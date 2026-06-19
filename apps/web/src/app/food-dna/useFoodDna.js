import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

/**
 * useFoodDna — the Food DNA activation data layer (S2).
 *
 * Consumes the REAL engine, no placeholders:
 *  - GET /profile/dna → the PII-free projection (maturity band/score/trustGuidance + the four dimensions
 *    with the engine's safeExplanation), hydrated from the user's real persisted behavior.
 *  - GET /profile/next-question + POST /profile/answer → the real onboarding question engine (declared is a
 *    small ≤20% prior; behavior is what grows the DNA). The next question is re-fetched after each answer.
 * Nothing is hardcoded; cold-start is surfaced honestly by the projection itself.
 */
export function useFoodDnaProjection() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['profile', 'dna'],
    queryFn: () => apiClient.get('/profile/dna').then((r) => r.data),
    enabled: !!token,
  });
}

/**
 * useTaste — FI-4.1 user-correctable soft taste. Lists the per-ingredient taste the engine inferred (+ any
 * the user already corrected) from GET /profile/taste, and writes corrections via POST /profile/taste/correct
 * ('like' | 'dislike' | 'neutral'). Reversible; soft taste only (never the declared-allergy hard filter).
 * On success it refreshes both the taste list and the DNA projection (a correction can nudge the picture).
 */
export function useTaste() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ['profile', 'taste'],
    queryFn: () => apiClient.get('/profile/taste').then((r) => r.data),
    enabled: !!token,
  });
  const correctMutation = useMutation({
    mutationFn: ({ ingredientId, stance }) =>
      apiClient.post('/profile/taste/correct', { ingredientId, stance }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile', 'taste'] });
      qc.invalidateQueries({ queryKey: ['profile', 'dna'] });
    },
  });
  return {
    items: Array.isArray(list.data) ? list.data : [],
    loading: list.isLoading,
    correct: (ingredientId, stance) => correctMutation.mutateAsync({ ingredientId, stance }),
    correcting: correctMutation.isPending,
  };
}

export function useFoodDna() {
  const { token } = useAuth();
  const proj = useFoodDnaProjection();
  const question = useQuery({
    queryKey: ['profile', 'next-question'],
    queryFn: () => apiClient.get('/profile/next-question').then((r) => r.data),
    enabled: !!token,
  });
  const [submitting, setSubmitting] = useState(false);

  // returns true only on a real accepted answer; never claims success on failure/rejection
  const submitAnswer = useCallback(async (key, value) => {
    if (!key) return false;
    setSubmitting(true);
    try {
      const r = await apiClient.post('/profile/answer', { key, value }).then((res) => res.data);
      const ok = r?.accepted !== false && r?.status !== 'rejected';
      await question.refetch();
      await proj.refetch(); // the declared prior may nudge maturity; behavior is what truly grows it
      return ok;
    } catch {
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [question, proj]);

  let status = 'loading';
  if (proj.isError) status = 'error';
  else if (!proj.isLoading && proj.data) status = 'ready';

  return {
    status,
    dna: proj.data ?? null,
    refetch: proj.refetch,
    question: question.data?.question ?? null,
    questionRemaining: question.data?.remaining ?? 0,
    submitAnswer,
    submitting,
  };
}
