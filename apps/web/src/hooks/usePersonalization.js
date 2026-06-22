import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAnalytics } from './useAnalytics';

/**
 * usePersonalization — the single shared "session personalization" layer for one recipe.
 *
 * Holds {servedFor, swaps, removed} and persists it to sessionStorage keyed by recipe id, so the
 * Recipe Detail page and Cook Mode (separate routes) read the SAME personalization without a parallel
 * fetch or prop-drilling across navigation. This is the one piece of architecture that unlocks all
 * three interactive features (scale · swap · remove) at once.
 *
 * Honesty/safety: this is a SESSION-scoped override only — it never writes to the DB, never touches
 * getLivingUserProfile, and never softens the hard allergy filter (those stay byte-identical). Swaps
 * carry the real target ingredient name surfaced by the grounded substitution endpoint.
 */
const KEY = (id) => `garnish:personalization:${id}`;
const EMPTY = { servedFor: null, swaps: {}, removed: [] };

function read(id) {
  if (!id) return EMPTY;
  try {
    const raw = sessionStorage.getItem(KEY(id));
    if (!raw) return EMPTY;
    const p = JSON.parse(raw);
    return {
      servedFor: typeof p?.servedFor === 'number' && p.servedFor > 0 ? p.servedFor : null,
      swaps: p?.swaps && typeof p.swaps === 'object' ? p.swaps : {},
      removed: Array.isArray(p?.removed) ? p.removed.filter((n) => typeof n === 'string') : [],
    };
  } catch {
    return EMPTY;
  }
}

const isEmpty = (s) => !s.servedFor && !s.removed.length && !Object.keys(s.swaps).length;

export function usePersonalization(recipeId, baseServings = 4) {
  const [state, setState] = useState(() => read(recipeId));
  const { trackEvent } = useAnalytics();

  // re-hydrate when navigating to a different recipe
  useEffect(() => { setState(read(recipeId)); }, [recipeId]);

  // P0 signal capture: a swap/scale/remove is the strongest taste signal in the app — emit it (was session-only).
  // The emit reads the LATEST state via a ref so toggleRemoved can tell add-from-remove without a stale closure;
  // emission is fire-and-forget + no-op for anonymous users (useAnalytics gates on a real token).
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // persist every change so a later Cook-Mode mount reads the identical personalization
  useEffect(() => {
    if (!recipeId) return;
    try {
      if (isEmpty(state)) sessionStorage.removeItem(KEY(recipeId));
      else sessionStorage.setItem(KEY(recipeId), JSON.stringify(state));
    } catch {
      /* sessionStorage unavailable (private mode / SSR) → in-memory only, still works this session */
    }
  }, [recipeId, state]);

  const setServedFor = useCallback((n) => {
    if (n > 0 && n !== stateRef.current.servedFor) trackEvent('portion_scaled', { recipeId, servedFor: n, baseServings });
    setState((s) => ({ ...s, servedFor: n > 0 ? n : null }));
  }, [recipeId, baseServings, trackEvent]);
  const applySwap = useCallback((from, to, meta = {}) => {
    if (!from || !to) return;
    trackEvent('ingredient_swapped', { recipeId, from, to, ...meta });
    setState((s) => ({ ...s, swaps: { ...s.swaps, [from]: { to, ...meta } } }));
  }, [recipeId, trackEvent]);
  const clearSwap = useCallback((from) => setState((s) => {
    if (!(from in s.swaps)) return s;
    const next = { ...s.swaps };
    delete next[from];
    return { ...s, swaps: next };
  }), []);
  const toggleRemoved = useCallback((name) => {
    if (!name) return;
    const willRemove = !stateRef.current.removed.includes(name);
    if (willRemove) trackEvent('ingredient_removed', { recipeId, ingredient: name });
    setState((s) => ({ ...s, removed: s.removed.includes(name) ? s.removed.filter((n) => n !== name) : [...s.removed, name] }));
  }, [recipeId, trackEvent]);
  const reset = useCallback(() => setState(EMPTY), []);

  const scaleFactor = useMemo(() => {
    const base = baseServings > 0 ? baseServings : 4;
    return state.servedFor && state.servedFor > 0 ? state.servedFor / base : 1;
  }, [state.servedFor, baseServings]);

  return useMemo(() => ({
    servedFor: state.servedFor,
    swaps: state.swaps,
    removed: state.removed,
    scaleFactor,
    isPersonalized: !isEmpty(state),
    isRemoved: (name) => state.removed.includes(name),
    swapFor: (name) => state.swaps[name] || null,
    setServedFor, applySwap, clearSwap, toggleRemoved, reset,
  }), [state, scaleFactor, setServedFor, applySwap, clearSwap, toggleRemoved, reset]);
}
