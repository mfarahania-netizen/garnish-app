import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../lib/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { faDuration, faDifficulty, toFaDigits } from '../../../components/ges/format';
import { FIT_LABEL, recipeFitReasons, faAllergen } from '../../home/lib/reasons';

const asText = (s) => (typeof s === 'string' ? s : s?.text || s?.instruction || s?.description || s?.step || s?.body || '');
const faqItem = (f) => ({ q: asText(f?.question || f?.q || f?.title) || asText(f), a: asText(f?.answer || f?.a || f?.body) });
const asList = (v) => (Array.isArray(v) ? v : []);
const calorieOf = (n) =>
  n && typeof n === 'object'
    ? n.calories ?? n.kcal ?? n.energy ?? n.perServing?.calories ?? n.perServing?.kcal ?? null
    : null;

/**
 * useRecipeDetail — one read for the Recipe Detail screen.
 * Logged-in: GET /recipes/:id/full (recipe + integrity + personalized fit + safety + swaps).
 * Logged-out: GET /recipes/:id (public basic recipe, no personalization) — honest fallback.
 * No fabrication: fit/nutrition shown only when the API provides them; the English fit reasons
 * are never rendered (Persian is built from the structured fit fields).
 */
export function useRecipeDetail(id) {
  const { token } = useAuth();
  const full = useQuery({ queryKey: ['recipe-full', id], queryFn: () => apiClient.get(`/recipes/${id}/full`).then((r) => r.data), enabled: !!id && !!token, retry: 1 });
  const basic = useQuery({ queryKey: ['recipe-basic', id], queryFn: () => apiClient.get(`/recipes/${id}`).then((r) => r.data), enabled: !!id && !token, retry: 1 });

  return useMemo(() => {
    const active = token ? full : basic;
    const rich = token ? full.data : basic.data ? { recipe: basic.data, fit: null } : null;
    const r = rich?.recipe;

    let status = 'ready';
    if (!id) status = 'error';
    else if (active.isLoading) status = 'loading';
    else if (active.isError) status = 'error';
    else if (!r) status = 'empty';

    if (status !== 'ready' || !r) {
      return { status, refetch: () => (token ? full.refetch() : basic.refetch()) };
    }

    const fit = rich.fit || null;
    const allergens = (fit?.safety?.conflictingAllergens || []).map(faAllergen);
    const recommendation = fit?.recommendation || null;

    const cal = calorieOf(r.nutrition);
    const nutrition = {
      calories: typeof cal === 'number' && cal > 0 ? toFaDigits(Math.round(cal)) : null,
      state: typeof cal === 'number' && cal > 0 ? 'estimate' : 'unavailable',
    };

    const recipe = {
      id: r.id,
      title: r.title || 'دستور',
      imageUrl: r.imageUrl || null,
      categories: (Array.isArray(r.categories) ? r.categories : []).slice(0, 3),
      cookTimeText: faDuration(r.cookingTime || r.totalTime),
      difficultyText: faDifficulty(r.difficulty),
      servingsText: r.servings ? `${toFaDigits(r.servings)} نفر` : '',
      description: r.description || '',
      author: r.author?.name || (typeof r.author === 'string' ? r.author : '') || '',
      ingredients: asList(r.ingredients).map((ing) => ({
        name: ing?.name || '',
        amountText: ing?.amount ? `${toFaDigits(ing.amount)} ${ing.displayUnit || ing.unit || ''}`.trim() : '',
      })).filter((i) => i.name),
      steps: asList(r.steps).map(asText).filter(Boolean),
      tips: asList(r.tips).map(asText).filter(Boolean),
      faq: asList(r.faq).map(faqItem).filter((f) => f.q),
    };

    return {
      status,
      recipe,
      nutrition,
      fit: recommendation ? { recommendation, label: FIT_LABEL[recommendation] || null, reasons: recipeFitReasons(fit, 3), allergens } : null,
      refetch: () => (token ? full.refetch() : basic.refetch()),
    };
  }, [id, token, full.data, full.isLoading, full.isError, basic.data, basic.isLoading, basic.isError, full, basic]);
}
