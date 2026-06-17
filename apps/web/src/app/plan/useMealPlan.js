import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { faDuration } from '../../components/ges/format';

/**
 * useMealPlan — the weekly plan (RTL, Sat→Fri). Reads the REAL current plan (GET /meal-plans) and,
 * on request, fetches an AI PROPOSAL (POST /meal-plans/propose — PLANNER-L4-09: allergy hard-excluded,
 * writes nothing). The proposal is shown as SUGGESTED slots; nothing is applied until the user accepts
 * a slot / the whole plan via POST /meal-plans/slots (the real apply path) — proposes-not-auto.
 * The proposal's English `why` is NEVER rendered; only the real fitScore drives a localized confidence.
 */

const MEALS = [{ key: 'lunch', label: 'ناهار' }, { key: 'dinner', label: 'شام' }];
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

const confFromFit = (s) => (s >= 0.6 ? 'high' : s >= 0.4 ? 'med' : 'low');

export function useMealPlan() {
  const plan = useQuery({ queryKey: ['plan', 'current'], queryFn: () => apiClient.get('/meal-plans').then((r) => r.data) });
  const [proposal, setProposal] = useState(null); // ProposedSlot[] | null
  const [proposing, setProposing] = useState(false);
  const [proposeError, setProposeError] = useState(false);
  const [applying, setApplying] = useState(false);
  const [accepted, setAccepted] = useState({}); // key → true (per-slot accepted this session)

  const week = useMemo(() => buildWeek(), []);

  // real, already-saved slots: key `${dayOfWeek}:${mealType}` → {recipeId, title, cookTimeText}
  const filled = useMemo(() => {
    const map = {};
    const slots = plan.data?.slots || [];
    for (const s of slots) {
      if (!s?.recipeId || !s?.recipe) continue;
      map[`${s.dayOfWeek}:${s.mealType}`] = { recipeId: s.recipeId, title: s.recipe.title || 'دستور', cookTimeText: faDuration(s.recipe.cookingTime) };
    }
    return map;
  }, [plan.data]);

  const suggested = useMemo(() => {
    const map = {};
    for (const s of proposal || []) {
      const key = `${s.dayOfWeek}:${s.mealType}`;
      if (filled[key]) continue; // never overlay an already-saved slot
      if (!s.recipeId || !s.title) continue; // never present a placeholder as a real dish name
      map[key] = { recipeId: s.recipeId, title: s.title, conf: confFromFit(typeof s.fitScore === 'number' ? s.fitScore : 0), dayOfWeek: s.dayOfWeek, mealType: s.mealType };
    }
    return map;
  }, [proposal, filled]);

  const hasPlan = Object.keys(filled).length > 0;

  // returns true on success / false on failure so the caller never claims a proposal that didn't arrive
  const propose = useCallback(async () => {
    setProposing(true); setProposeError(false);
    try {
      const data = await apiClient.post('/meal-plans/propose', { days: 7, meals: ['lunch', 'dinner'] }).then((r) => r.data);
      setProposal(Array.isArray(data?.slots) ? data.slots : []);
      return true;
    } catch {
      setProposeError(true);
      return false;
    } finally {
      setProposing(false);
    }
  }, []);

  const clearProposal = useCallback(() => { setProposal(null); setAccepted({}); }, []);

  const acceptSlot = useCallback(async (s) => {
    const key = `${s.dayOfWeek}:${s.mealType}`;
    setApplying(true);
    try {
      await apiClient.post('/meal-plans/slots', { dayOfWeek: s.dayOfWeek, mealType: s.mealType, recipeId: s.recipeId });
      setAccepted((a) => ({ ...a, [key]: true }));
      await plan.refetch();
      return true;
    } catch {
      return false;
    } finally {
      setApplying(false);
    }
  }, [plan]);

  // each slot via the real apply path; one failure never aborts the rest, and the result is reported honestly
  const acceptAll = useCallback(async () => {
    const items = Object.values(suggested).filter((s) => !accepted[`${s.dayOfWeek}:${s.mealType}`]);
    setApplying(true);
    let failed = 0;
    for (const s of items) {
      try {
        await apiClient.post('/meal-plans/slots', { dayOfWeek: s.dayOfWeek, mealType: s.mealType, recipeId: s.recipeId });
      } catch {
        failed += 1;
      }
    }
    await plan.refetch(); // sync filled/accepted with what actually wrote
    setApplying(false);
    if (failed === 0) { setProposal(null); setAccepted({}); }
    return { ok: failed === 0, failed, total: items.length };
  }, [suggested, accepted, plan]);

  let status = 'ready';
  if (plan.isLoading) status = 'loading';
  else if (plan.isError) status = 'error';

  return {
    status,
    refetch: () => plan.refetch(),
    week, meals: MEALS,
    filled, suggested, accepted,
    hasPlan,
    proposalActive: !!proposal,
    proposing, proposeError, applying,
    propose, clearProposal, acceptSlot, acceptAll,
  };
}
