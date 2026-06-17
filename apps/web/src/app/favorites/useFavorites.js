import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { faDuration, faDifficulty } from '../../components/ges/format';

/**
 * useFavorites — the saved recipes (GET /favorites → [{recipe}]). Unsave via DELETE /favorites/:recipeId
 * (optimistic). When empty, the screen offers 3 REAL starter suggestions from GET /recommendations (a warm
 * non-dead-end), each savable via POST /favorites/:recipeId. No personalized fit is fabricated.
 */

const seed = (id) => { const s = String(id ?? ''); let h = 0; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

export function useFavorites() {
  const favs = useQuery({ queryKey: ['favorites', 'list'], queryFn: () => apiClient.get('/favorites').then((r) => r.data) });
  const [removed, setRemoved] = useState({}); // optimistic unsave overlay

  const saved = useMemo(() => {
    const arr = Array.isArray(favs.data) ? favs.data : [];
    return arr
      .map((f) => f?.recipe)
      .filter((r) => r && r.id && !removed[r.id])
      .map((r) => ({ recipeId: r.id, title: r.title || 'دستور', seed: seed(r.id), cookTimeText: faDuration(r.cookingTime || r.totalTime), difficultyText: faDifficulty(r.difficulty) }));
  }, [favs.data, removed]);

  const isEmpty = !favs.isLoading && !favs.isError && saved.length === 0;

  // starter suggestions only when empty
  const recs = useQuery({
    queryKey: ['home', 'recommendations'],
    queryFn: () => apiClient.get('/recommendations', { params: { limit: 12 } }).then((r) => r.data),
    enabled: isEmpty,
  });
  const suggestions = useMemo(() => {
    const list = Array.isArray(recs.data) ? recs.data : [];
    return list.slice(0, 3).map((r) => ({ recipeId: r.recipeId, title: r.title || 'دستور پیشنهادی', seed: seed(r.recipeId) }));
  }, [recs.data]);

  const unsave = useCallback(async (recipeId) => {
    setRemoved((m) => ({ ...m, [recipeId]: true }));
    try {
      await apiClient.delete(`/favorites/${recipeId}`);
      await favs.refetch();
    } catch {
      setRemoved((m) => { const n = { ...m }; delete n[recipeId]; return n; }); // revert on failure
      return false;
    }
    return true;
  }, [favs]);

  const save = useCallback(async (recipeId) => {
    try {
      await apiClient.post(`/favorites/${recipeId}`);
      await favs.refetch();
      return true;
    } catch {
      return false;
    }
  }, [favs]);

  let status = 'ready';
  if (favs.isLoading) status = 'loading';
  else if (favs.isError) status = 'error';
  else if (isEmpty) status = 'empty';

  return { status, refetch: () => favs.refetch(), saved, suggestions, unsave, save };
}
