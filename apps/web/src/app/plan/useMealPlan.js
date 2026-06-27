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

const MEALS = [{ key: 'breakfast', label: 'صبحانه' }, { key: 'lunch', label: 'ناهار' }, { key: 'dinner', label: 'شام' }];
const DAY_LABELS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

const faDay = (d) => { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric' }).format(d); } catch { return ''; } };
const faMonth = (d) => { try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long' }).format(d); } catch { return ''; } };

function buildWeek() {
  const now = new Date();
  const sinceSat = (now.getDay() + 1) % 7; // Sat→0 … Fri→6 (server convention 0=Sat..6=Fri)
  const sat = new Date(now);
  sat.setDate(now.getDate() - sinceSat);
  sat.setHours(0, 0, 0, 0);
  const days = DAY_LABELS.map((label, i) => {
    const d = new Date(sat); d.setDate(sat.getDate() + i);
    return { dayOfWeek: i, label, dayFa: faDay(d), monthFa: faMonth(d), isToday: i === sinceSat };
  });
  const range = days.length ? `${days[0].dayFa} تا ${days[6].dayFa} ${days[6].monthFa}` : '';
  return { days, range };
}

export function useMealPlan() {
  const queryClient = useQueryClient();
  const plan = useQuery({ queryKey: ['plan', 'current'], queryFn: () => apiClient.get('/meal-plans').then((r) => r.data) });
  const [proposal, setProposal] = useState(null); // ProposedSlot[] | null
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState(false);
  const [applying, setApplying] = useState(false);
  // FI-STEP-1.3: per-slot recipeIds already shown (so repeated «یکی دیگه» cycles, never re-offers one)
  const shownBySlot = useRef({});

  const week = useMemo(() => buildWeek(), []);

  // real, already-saved slots: key `${dayOfWeek}:${mealType}` → {recipeId, title, cookTimeText}
  const filled = useMemo(() => {
    const map = {};
    const slots = plan.data?.slots || [];
    for (const s of slots) {
      if (!s?.recipeId || !s?.recipe) continue;
      // no-cook dishes (salads/smoothies/دویماج) have cookingTime 0 but a real totalTime — fall back so the card
      // isn't blank (20 recipes were showing no time).
      map[`${s.dayOfWeek}:${s.mealType}`] = { recipeId: s.recipeId, title: s.recipe.title || 'دستور', cookTimeText: faDuration(s.recipe.cookingTime || Number(s.recipe.totalTime) || 0) };
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
    const key = ['plan', 'current'];
    const prev = queryClient.getQueryData(key);
    queryClient.setQueryData(key, (old) => (
      old?.slots ? { ...old, slots: old.slots.filter((s) => !(s.dayOfWeek === dayOfWeek && s.mealType === mealType)) } : old
    ));
    try {
      await apiClient.delete(`/meal-plans/slots/${dayOfWeek}/${mealType}`);
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
      await apiClient.post('/meal-plans/slots', { dayOfWeek: s.dayOfWeek, mealType: s.mealType, recipeId: s.recipeId });
      await plan.refetch();
      return true;
    } catch {
      return false;
    } finally {
      setApplying(false);
    }
  }, [plan]);

  // each slot via the real apply path; one failure never aborts the rest, and the result is reported honestly.
  // `suggested` already excludes any key that is now `filled` (line: skip filled), so no separate accepted set.
  const acceptAll = useCallback(async () => {
    const items = Object.values(suggested);
    setApplying(true);
    let failed = 0;
    for (const s of items) {
      try {
        await apiClient.post('/meal-plans/slots', { dayOfWeek: s.dayOfWeek, mealType: s.mealType, recipeId: s.recipeId });
      } catch {
        failed += 1;
      }
    }
    await plan.refetch(); // sync filled with what actually wrote
    setApplying(false);
    if (failed === 0) { setProposal(null); shownBySlot.current = {}; }
    return { ok: failed === 0, failed, total: items.length };
  }, [suggested, plan]);

  let status = 'ready';
  if (plan.isLoading) status = 'loading';
  else if (plan.isError) status = 'error';

  return {
    status,
    refetch: () => plan.refetch(),
    week, meals: MEALS,
    filled, suggested,
    hasPlan,
    proposalActive: !!proposal,
    proposing, proposeError, applying,
    propose, clearProposal, acceptSlot, acceptAll, removeSlot, swapSlot,
  };
}
