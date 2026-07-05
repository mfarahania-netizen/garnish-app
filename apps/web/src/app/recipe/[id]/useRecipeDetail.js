import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../lib/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { faDuration, faDifficulty, toFaDigits, recipeDurationMinutes } from '../../../components/ges/format';
import { FIT_LABEL, recipeFitReasons, faAllergen, faCategory } from '../../home/lib/reasons';

const asText = (s) => (typeof s === 'string' ? s : s?.text || s?.instruction || s?.description || s?.step || s?.body || '');
const toolText = (s) => (typeof s === 'string' ? s : s?.name || s?.title || s?.label || s?.tool || '');
const faqItem = (f) => ({ q: asText(f?.question || f?.q || f?.title) || asText(f), a: asText(f?.answer || f?.a || f?.body) });
const asList = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return trimmed.split(',').map((x) => x.trim()).filter(Boolean);
    }
  }
  return [];
};
const hasTag = (v, tag) => Array.isArray(v) && v.includes(tag);
const minutesText = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? faDuration(n) : '';
};
const normalizeStep = (s, index) => {
  if (typeof s === 'string') {
    const instruction = s.trim();
    return instruction ? { order: index + 1, title: '', instruction, durationText: '', imageUrl: null } : null;
  }
  if (!s || typeof s !== 'object') return null;
  const instruction = asText(s).trim();
  if (!instruction) return null;
  const durationText = s.durationText || s.duration || s.time || minutesText(s.durationMin ?? s.minutes ?? s.durationMinutes);
  return {
    order: Number.isFinite(Number(s.order)) ? Number(s.order) : index + 1,
    title: asText(s.title || s.name || s.heading),
    instruction,
    durationText: typeof durationText === 'string' ? durationText : '',
    imageUrl: s.imageUrl || s.image || s.photoUrl || null,
    tip: asText(s.tip || s.note),
  };
};
const isLiteFoodRecipe = (r) => {
  const adminNote = r?.adminNote && typeof r.adminNote === 'object' ? r.adminNote : {};
  const lite = adminNote?.lite || adminNote?.aiContext?.lite || {};
  return (
    lite?.contentType === 'lite_food' ||
    adminNote?.contentType === 'lite_food' ||
    hasTag(r?.dishType, 'lite_food') ||
    String(r?.id || '').startsWith('garnish_lite_')
  );
};
// localized meal types — never a raw enum key like "dinner"
const FA_MEAL = { breakfast: 'صبحانه', brunch: 'میان‌وعده', lunch: 'ناهار', dinner: 'شام', supper: 'شام', snack: 'میان‌وعده', dessert: 'دسر', appetizer: 'پیش‌غذا', side: 'مخلفات', drink: 'نوشیدنی', beverage: 'نوشیدنی' };
const FA_COST = { low: 'اقتصادی', medium: 'متوسط', high: 'گران‌تر', budget: 'اقتصادی', cheap: 'اقتصادی' };
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
      isLiteFood: isLiteFoodRecipe(r),
      title: r.title || 'دستور',
      imageUrl: r.imageUrl || null,
      // localized to Persian — never a raw enum key like "main_course"
      categories: [...new Set(asList(r.categories).map(faCategory).filter(Boolean))].slice(0, 3),
      // time source-of-truth: GRIS glance is the authored, accurate time; the legacy cookingTime field is
      // unreliable across the corpus (founder: wrong for every dish). Fall back to legacy only when no GRIS.
      cookTimeText: faDuration(recipeDurationMinutes(r)),
      difficultyText: faDifficulty(r.difficulty),
      servingsText: r.servings ? `${toFaDigits(r.servings)} نفر` : '',
      description: r.description || '',
      author: r.author?.name || (typeof r.author === 'string' ? r.author : '') || '',
      ingredients: asList(r.ingredients).map((ing) => ({
        name: ing?.name || '',
        amountText: ing?.amount ? `${toFaDigits(ing.amount)} ${ing.displayUnit || ing.unit || ''}`.trim() : '',
      })).filter((i) => i.name),
      tips: asList(r.tips).map(asText).filter(Boolean),
      // S3 Option-2 — the four authored arrays, now persisted separately (were merged into `tips`). Rendered
      // as distinct sections when present; the merged `tips` accordion is the back-compat fallback.
      chefTips: asList(r.chefTips).map(asText).filter(Boolean),
      commonMistakes: asList(r.commonMistakes).map(asText).filter(Boolean),
      servingSuggestions: asList(r.servingSuggestions).map(asText).filter(Boolean),
      authoredSwaps: asList(r.substitutions).map(asText).filter(Boolean),
      faq: asList(r.faq).map(faqItem).filter((f) => f.q),
      steps: asList(r.steps).map(normalizeStep).filter(Boolean),
      // tools + mealType: persisted + returned by the API but the UI previously never rendered them
      tools: asList(r.tools).map(toolText).filter(Boolean),
      mealTypes: [...new Set(asList(r.mealType).map((m) => FA_MEAL[String(m).toLowerCase().trim()] || faCategory(m)).filter(Boolean))],
      detailChips: [
        ...asList(r.region || r.cuisineOrigin || r.cuisine).map(faCategory),
        ...asList(r.dishType || r.category).map(faCategory),
        ...asList(r.occasion).map(faCategory),
      ].filter(Boolean).slice(0, 4),
      prepTimeText: minutesText(r.prepTime),
      totalTimeText: minutesText(r.totalTime),
      costText: FA_COST[String(r.cost || '').toLowerCase().trim()] || faCategory(r.cost) || (typeof r.cost === 'string' && /[آ-ی]/.test(r.cost) ? r.cost : ''),
    };

    // grounded substitutions the /full read ALREADY computes (allergen/dislike swaps) — UI previously dropped
    // them. Only entries with at least one real option are shown (graceful omission; never blank/fabricated).
    const substitutions = asList(rich.substitutions)
      .map((s) => ({
        ingredient: asText(s?.ingredient),
        reason: s?.reason === 'allergen' ? 'allergen' : 'dislike',
        options: asList(s?.result?.substitutions).map((o) => toolText(o)).filter(Boolean).slice(0, 3),
      }))
      .filter((s) => s.ingredient && s.options.length);

    // ingredient-resolution coverage from the integrity report (also previously dropped). Honest, non-medical,
    // non-technical: only the resolved/total signal — never the raw English warnings.
    const ir = rich.integrity?.ingredientResolution;
    const integrity = ir && ir.total > 0 ? { total: ir.total, resolved: ir.resolved } : null;

    return {
      status,
      gris: r.gris ?? null, // GRIS v2 full object when present → premium page render
      recipe,
      nutrition,
      fit: recommendation ? { recommendation, label: FIT_LABEL[recommendation] || null, reasons: recipeFitReasons(fit, 3), allergens } : null,
      substitutions,
      integrity,
      refetch: () => (token ? full.refetch() : basic.refetch()),
    };
  }, [id, token, full.data, full.isLoading, full.isError, basic.data, basic.isLoading, basic.isError, full, basic]);
}
