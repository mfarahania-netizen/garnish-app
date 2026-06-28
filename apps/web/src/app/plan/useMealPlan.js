import { useState, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { faDuration } from '../../components/ges/format';

/**
 * useMealPlan — the weekly plan (RTL, Sat→Fri). Reads the REAL current plan (GET /meal-plans) and,
 * on request, fetches an AI PROPOSAL (POST /meal-plans/propose — PLANNER-L4-09: allergy hard-excluded,
 * writes nothing). The proposal is shown as SUGGESTED slots; nothing is applied until the user accepts
 * a slot / the whole plan via POST /meal-plans/slots (the real apply path) — proposes-not-auto.
 * The proposal's English `why` is NEVER rendered; only the real fitScore drives a localized confidence.
 */

const MEALS = [{ key: 'breakfast', label: 'صبحانه' }, { key: 'lunch', label: 'ناهار' }, { key: 'dinner', label: 'شام' }, { key: 'snack', label: 'میان‌وعده' }];
const DAY_LABELS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

const faDay = (d) => { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' }).format(d); } catch { return ''; } };
const faMonth = (d) => { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(d); } catch { return ''; } };

function buildWeek(offset = 0) {
  const now = new Date();
  const sinceSat = (now.getDay() + 1) % 7; // Sat→0 … Fri→6 (server convention 0=Sat..6=Fri)
  const sat = new Date(now);
  sat.setDate(now.getDate() - sinceSat + offset * 7); // offset weeks from the current week
  sat.setHours(0, 0, 0, 0);
  const days = DAY_LABELS.map((label, i) => {
    const d = new Date(sat); d.setDate(sat.getDate() + i);
    return { dayOfWeek: i, label, dayFa: faDay(d), monthFa: faMonth(d), isToday: offset === 0 && i === sinceSat };
  });
  const range = days.length ? `${days[0].dayFa} تا ${days[6].dayFa} ${days[6].monthFa}` : '';
  return { days, range };
}

export function useMealPlan() {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, +1 next, -1 last (multi-week nav)
  const offsetRef = useRef(0); offsetRef.current = weekOffset; // always-fresh offset for mutation URLs/keys (no stale closure)
  const plan = useQuery({ queryKey: ['plan', weekOffset], queryFn: () => apiClient.get(`/meal-plans?offset=${weekOffset}`).then((r) => r.data) });
  const [proposal, setProposal] = useState(null); // ProposedSlot[] | null
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState(false);
  const [applying, setApplying] = useState(false);
  // FI-STEP-1.3: per-slot recipeIds already shown (so repeated «یکی دیگه» cycles, never re-offers one)
  const shownBySlot = useRef({});

  const week = useMemo(() => buildWeek(weekOffset), [weekOffset]);

  // real, already-saved slots: key `${dayOfWeek}:${mealType}` → {recipeId, title, cookTimeText}
  const filled = useMemo(() => {
    const map = {};
    const slots = plan.data?.slots || [];
    for (const s of slots) {
      if (!s?.recipeId || !s?.recipe) continue;
      // no-cook dishes (salads/smoothies/دویماج) have cookingTime 0 but a real totalTime — fall back so the card
      // isn't blank (20 recipes were showing no time).
      map[`${s.dayOfWeek}:${s.mealType}`] = { recipeId: s.recipeId, title: s.recipe.title || 'دستور', cookTimeText: faDuration(s.recipe.cookingTime || Number(s.recipe.totalTime) || 0), cookedAt: s.cookedAt || null, servings: s.servings ?? null, baseServings: s.recipe.servings ?? null, nutrition: s.recipe.nutrition || null };
    }
    return map;
  }, [plan.data]);

  const suggested = useMemo(() => {
    const map = {};
    for (const s of proposal || []) {
      const key = `${s.dayOfWeek}:${s.mealType}`;
      if (filled[key]) continue; // never overlay an already-saved slot
      if (!s.recipeId || !s.title) continue; // never present a placeholder as a real dish name
      map[key] = { recipeId: s.recipeId, title: s.title, dayOfWeek: s.dayOfWeek, mealType: s.mealType };
    }
    return map;
  }, [proposal, filled]);

  const hasPlan = Object.keys(filled).length > 0;

  // returns true on success / false on failure so the caller never claims a proposal that didn't arrive
  const propose = useCallback(async () => {
    setProposing(true); setProposeError(false);
    try {
      const data = await apiClient.post('/meal-plans/propose', { days: 7, meals: ['breakfast', 'lunch', 'dinner'] }).then((r) => r.data);
      setProposal(Array.isArray(data?.slots) ? data.slots : []);
      return true;
    } catch {
      setProposeError(true);
      return false;
    } finally {
      setProposing(false);
    }
  }, []);

  const clearProposal = useCallback(() => { setProposal(null); shownBySlot.current = {}; }, []);

  /**
   * FI-STEP-1.3 — per-slot «یکی دیگه». Fetches the next-best safe, course-valid candidate for THIS slot
   * (POST /meal-plans/slots/swap), excluding the current dish + everything already shown for this slot.
   * Replaces only that slot in the local proposal. Returns { ok, swappedOut } so the page can record the
   * swapped-out recipe as declined (recommendation_dismiss). Never regenerates the week.
   */
  const swapSlot = useCallback(async (s) => {
    const key = `${s.dayOfWeek}:${s.mealType}`;
    const shown = shownBySlot.current[key] || [];
    const excludeRecipeIds = [...new Set([...shown, s.recipeId])];
    try {
      const data = await apiClient.post('/meal-plans/slots/swap', { dayOfWeek: s.dayOfWeek, mealType: s.mealType, excludeRecipeIds }).then((r) => r.data);
      const next = data?.slot;
      if (!next?.recipeId) return { ok: false, swappedOut: s.recipeId }; // nothing else qualifies (honest)
      shownBySlot.current[key] = [...excludeRecipeIds, next.recipeId];
      setProposal((prev) => (prev || []).map((p) => (p.dayOfWeek === s.dayOfWeek && p.mealType === s.mealType ? { ...p, recipeId: next.recipeId, title: next.title, fitScore: next.fitScore } : p)));
      return { ok: true, swappedOut: s.recipeId };
    } catch {
      return { ok: false, error: true, swappedOut: s.recipeId };
    }
  }, []);

  // delete a real, already-saved slot via DELETE /meal-plans/slots/:dayOfWeek/:mealType.
  // Optimistic: drop it from the cached plan immediately; on failure, revert the cache + return false
  // (so the caller never claims a delete that did not happen).
  const removeSlot = useCallback(async (dayOfWeek, mealType) => {
    const key = ['plan', offsetRef.current];
    const prev = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old) => (
      old?.slots ? { ...old, slots: old.slots.filter((s) => !(s.dayOfWeek === dayOfWeek && s.mealType === mealType)) } : old
    ));
    try {
      await apiClient.delete(`/meal-plans/slots/${dayOfWeek}/${mealType}?offset=${offsetRef.current}`);
      await plan.refetch();
      return true;
    } catch {
      queryClient.setQueryData(key, prev); // revert to server truth
      return false;
    }
  }, [plan, queryClient]);

  // accept one suggested slot via the real apply path. On success it refetches → the slot moves from
  // `suggested` to `filled` (a real dish with a working remove). No persistent 'accepted' state — the
  // success is a transient toast (page), not a state that hides the remove (FI-STEP-1.3 FIX 4).
  const acceptSlot = useCallback(async (s) => {
    setApplying(true);
    try {
      await apiClient.post(`/meal-plans/slots?offset=${offsetRef.current}`, { dayOfWeek: s.dayOfWeek, mealType: s.mealType, recipeId: s.recipeId });
      await plan.refetch();
      return true;
    } catch {
      return false;
    } finally {
      setApplying(false);
    }
  }, [plan]);

  // MANUAL add — drop a user-chosen dish into a slot (the empty-slot picker). Same real apply path as accept; refetch
  // so the slot moves to `filled`. Founder bug: empty slots were dead «—» with no way to add a dish by hand.
  const addDish = useCallback(async (dayOfWeek, mealType, recipeId) => {
    try {
      await apiClient.post(`/meal-plans/slots?offset=${offsetRef.current}`, { dayOfWeek, mealType, recipeId });
      await plan.refetch();
      return true;
    } catch {
      return false;
    }
  }, [plan]);

  // mark a slot cooked / un-cooked (the "پختم" moment). Optimistic cache flip; reverts on failure.
  const markCooked = useCallback(async (dayOfWeek, mealType, cooked) => {
    const key = ['plan', offsetRef.current];
    const prev = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old) => (
      old?.slots ? { ...old, slots: old.slots.map((s) => (s.dayOfWeek === dayOfWeek && s.mealType === mealType ? { ...s, cookedAt: cooked ? new Date().toISOString() : null } : s)) } : old
    ));
    try {
      await apiClient.post(`/meal-plans/slots/${dayOfWeek}/${mealType}/cooked?offset=${offsetRef.current}`, { cooked });
      return true;
    } catch {
      queryClient.setQueryData(key, prev);
      return false;
    }
  }, [queryClient]);

  // set how many people a slot is cooked for (scales the shopping list). Optimistic; reverts on failure.
  const setServings = useCallback(async (dayOfWeek, mealType, servings) => {
    const key = ['plan', offsetRef.current];
    const prev = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old) => (
      old?.slots ? { ...old, slots: old.slots.map((s) => (s.dayOfWeek === dayOfWeek && s.mealType === mealType ? { ...s, servings } : s)) } : old
    ));
    try {
      await apiClient.post(`/meal-plans/slots/${dayOfWeek}/${mealType}/servings?offset=${offsetRef.current}`, { servings });
      return true;
    } catch {
      queryClient.setQueryData(key, prev);
      return false;
    }
  }, [queryClient]);

  // safe, meal-appropriate dishes for the picker (GET /meal-plans/dish-options — allergy-gated server-side). q searches.
  const fetchDishOptions = useCallback(async (mealType, q) => {
    try {
      const params = new URLSearchParams();
      if (mealType) params.set('meal', mealType);
      if (q && q.trim()) params.set('q', q.trim());
      const data = await apiClient.get('/meal-plans/dish-options?' + params.toString()).then((r) => r.data);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }, []);

  // each slot via the real apply path; one failure never aborts the rest, and the result is reported honestly.
  // `suggested` already excludes any key that is now `filled` (line: skip filled), so no separate accepted set.
  const acceptAll = useCallback(async () => {
    const items = Object.values(suggested);
    setApplying(true);
    let failed = 0;
    for (const s of items) {
      try {
        await apiClient.post(`/meal-plans/slots?offset=${offsetRef.current}`, { dayOfWeek: s.dayOfWeek, mealType: s.mealType, recipeId: s.recipeId });
      } catch {
        failed += 1;
      }
    }
    await plan.refetch(); // sync filled with what actually wrote
    setApplying(false);
    if (failed === 0) { setProposal(null); shownBySlot.current = {}; }
    return { ok: failed === 0, failed, total: items.length };
  }, [suggested, plan]);

  // multi-week navigation (clamped to the backend's ±8-week window)
  const nextWeek = useCallback(() => setWeekOffset((o) => Math.min(8, o + 1)), []);
  const prevWeek = useCallback(() => setWeekOffset((o) => Math.max(-8, o - 1)), []);
  const goToToday = useCallback(() => setWeekOffset(0), []);

  // clear every meal of the week being viewed (the «پاک‌کردنِ این هفته» action). Returns true on success.
  const clearWeek = useCallback(async () => {
    try {
      await apiClient.post(`/meal-plans/clear-week?offset=${offsetRef.current}`);
      await plan.refetch();
      return true;
    } catch {
      return false;
    }
  }, [plan]);

  // copy the PREVIOUS week's plan into the week being viewed (the repeat-use lever). Returns {ok, copied}.
  const copyPrevWeek = useCallback(async () => {
    try {
      const res = await apiClient.post(`/meal-plans/copy?from=${offsetRef.current - 1}&to=${offsetRef.current}`).then((r) => r.data);
      if (res?.ok) { await plan.refetch(); return { ok: true, copied: res.copied ?? 0 }; }
      return { ok: false };
    } catch {
      return { ok: false };
    }
  }, [plan]);

  let status = 'ready';
  if (plan.isLoading) status = 'loading';
  else if (plan.isError) status = 'error';

  return {
    status,
    refetch: () => plan.refetch(),
    week, meals: MEALS,
    weekOffset, nextWeek, prevWeek, goToToday, copyPrevWeek, clearWeek,
    filled, suggested,
    hasPlan,
    proposalActive: !!proposal,
    proposing, proposeError, applying,
    propose, clearProposal, acceptSlot, acceptAll, removeSlot, swapSlot, addDish, fetchDishOptions, markCooked, setServings,
  };
}
