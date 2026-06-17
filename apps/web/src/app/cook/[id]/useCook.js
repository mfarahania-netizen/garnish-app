import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../lib/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { useRecipeDetail } from '../../recipe/[id]/useRecipeDetail';

/**
 * useCook — immersive step-by-step cook flow over the recipe's REAL steps (GET /recipes/:id/full
 * via useRecipeDetail). Step AI help is grounded on the real GET /ai/recipes/:id/technique?step=
 * endpoint, disclosed + hedged, with a Persian-only defensive render (never raw English/[object Object])
 * and an honest fallback. Finish records a REAL `cook_complete` event (logged-in, POST /analytics/event →
 * UserEvent) — the canonical type the gamification engine counts, so a completed cook genuinely moves the
 * streak/level. Honest: a real completed cook = a real +1; we never fabricate an increment.
 */

// pull the longest Persian string from an unknown grounded-tool response (no English / no [object Object])
function extractFa(data) {
  const out = [];
  const visit = (v, depth) => {
    if (depth > 3 || v == null) return;
    if (typeof v === 'string') { const s = v.trim(); if (s.length >= 8 && /[؀-ۿ]/.test(s)) out.push(s); }
    else if (Array.isArray(v)) v.forEach((x) => visit(x, depth + 1));
    else if (typeof v === 'object') Object.values(v).forEach((x) => visit(x, depth + 1));
  };
  visit(data, 0);
  if (!out.length) return null;
  out.sort((a, b) => b.length - a.length);
  // strip stray Latin-word fragments so only Persian reaches the user (digits/units survive)
  const cleaned = out[0].replace(/[A-Za-z]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s:،.\-–]+/, '').trim();
  return cleaned.length >= 6 ? cleaned : null;
}

export function useCook(id) {
  const { token } = useAuth();
  const { trackEvent } = useAnalytics();
  const detail = useRecipeDetail(id);
  const gam = useQuery({ queryKey: ['home', 'gamification'], queryFn: () => apiClient.get('/gamification/me').then((r) => r.data), enabled: !!token });

  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [help, setHelp] = useState({ loading: false, text: null, error: false });

  const steps = detail.recipe?.steps || [];
  const total = steps.length;

  // side effects at the top level (never inside a setState updater → no StrictMode double-fire)
  const next = useCallback(() => {
    if (step >= total - 1) {
      if (!finished) {
        setFinished(true);
        // Emit the CANONICAL completion event the gamification engine actually counts
        // (UserEvent type 'cook_complete' → streak/mastery). The old 'recipe_cooked' was never
        // counted (gamification reads type IN ['cook_complete']) so the streak never moved.
        if (token) trackEvent('cook_complete', { recipeId: id });
      }
      return;
    }
    setStep((s) => s + 1);
  }, [step, total, finished, token, trackEvent, id]);

  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  const openHelp = useCallback(async () => {
    setSheetOpen(true);
    setHelp({ loading: true, text: null, error: false });
    try {
      // backend step is 1-based; honor the honest-degradation contract (only render an 'ok' result)
      const data = await apiClient.get(`/ai/recipes/${id}/technique`, { params: { step: step + 1 } }).then((r) => r.data);
      if (data?.resultStatus && data.resultStatus !== 'ok') { setHelp({ loading: false, text: null, error: true }); return; }
      const text = extractFa(data);
      setHelp({ loading: false, text, error: !text });
    } catch {
      setHelp({ loading: false, text: null, error: true });
    }
  }, [id, step]);

  const closeHelp = useCallback(() => setSheetOpen(false), []);

  return {
    status: detail.status,
    recipe: detail.recipe,
    refetch: detail.refetch,
    step, total,
    currentStep: steps[step] || '',
    finished,
    next, prev,
    loggedIn: !!token,
    streakWeeks: gam.data?.streak?.currentWeeks || 0,
    sheetOpen, openHelp, closeHelp, help,
  };
}
