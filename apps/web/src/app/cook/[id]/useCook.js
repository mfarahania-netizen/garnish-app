import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../lib/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { useRecipeDetail } from '../../recipe/[id]/useRecipeDetail';
import { usePersonalization } from '../../../hooks/usePersonalization';
import { recallRecommendation } from '../../../lib/recommendationAttribution';
import { extractBaseServings } from '../../../components/ges/scaling';
import { patchStepText, swapsList } from '../../../components/ges/personalize';

/**
 * useCook — immersive step-by-step cook flow. GRIS-aware: when the recipe has a GRIS object it cooks
 * from gris.steps (flame · tempC · durationMin · sees · recovery · doneness) instead of the flat text
 * steps, and reflects the SAME session personalization (swaps/removes) the recipe page set — so what you
 * tuned is what you cook. Step AI help is grounded on GET /ai/recipes/:id/technique?step=, disclosed +
 * hedged. Finish records a REAL `cook_complete` event the gamification engine counts (never fabricated).
 */

// honest per-step duration parsed from free Persian text (e.g. «۶ تا ۷ دقیقه» → 7m, «۲ ساعت» → 120m);
// GRIS steps carry a structured durationMin and skip this entirely (H3).
const FA = '۰۱۲۳۴۵۶۷۸۹';
const toLatinNum = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d));
function stepMinutesFromText(text) {
  const t = toLatinNum(text);
  let mins = 0;
  const h = t.match(/(\d+)\s*ساعت/);
  if (h) mins += parseInt(h[1], 10) * 60;
  const range = t.match(/(\d+)\s*(?:تا|الی|-)\s*(\d+)\s*دقیقه/);
  const m = t.match(/(\d+)\s*دقیقه/);
  if (range) mins += parseInt(range[2], 10);
  else if (m) mins += parseInt(m[1], 10);
  return mins > 0 && mins <= 600 ? mins : 0;
}

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
  const baseServings = extractBaseServings(detail.recipe?.servingsText, 4);
  const perso = usePersonalization(id, baseServings);
  const gam = useQuery({ queryKey: ['home', 'gamification'], queryFn: () => apiClient.get('/gamification/me').then((r) => r.data), enabled: !!token });

  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [help, setHelp] = useState({ loading: false, text: null, error: false });

  // Fire the canonical `start_cooking_click` the moment a cook session genuinely begins (recipe loaded + authed),
  // once per mount. Without it the cook funnel read view→0→complete (completes with no starts) — a fake cliff; the
  // event is already in the taxonomy, only the FE emitter was missing. Authed-gated to match cook_complete so the
  // start→complete rate is a clean same-population measure.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!startedRef.current && token && detail.recipe?.id) {
      startedRef.current = true;
      trackEvent('start_cooking_click', { recipeId: id });
    }
  }, [token, detail.recipe?.id, trackEvent, id]);

  // Build the cook step list: prefer GRIS (rich, structured), else the flat text steps. Both reflect the
  // session swaps/removes via patchStepText so Cook Mode matches the personalized recipe page (C9/M4).
  const steps = useMemo(() => {
    const gris = detail.gris;
    const sList = swapsList(perso.swaps);
    const removed = perso.removed;
    const fromGris = Array.isArray(gris?.steps) && gris.steps.length;
    const raw = fromGris ? gris.steps : (detail.recipe?.steps || []);
    return raw.map((s, i) => {
      const isObj = s && typeof s === 'object';
      const rawText = isObj ? (s.instruction || '') : String(s || '');
      const patched = patchStepText(rawText, sList, removed);
      return {
        order: isObj && s.order ? s.order : i + 1,
        title: isObj ? (s.title || null) : null,
        instruction: patched.text,
        caveats: patched.caveats,
        flame: isObj ? (s.flame || null) : null,
        tempC: isObj && typeof s.tempC === 'number' ? s.tempC : null,
        // GRIS structured duration (H3); flat steps fall back to honest text parsing
        durationMin: isObj && typeof s.durationMin === 'number' ? s.durationMin : stepMinutesFromText(rawText),
        sees: isObj ? (s.sees || null) : null,
        recovery: isObj ? (s.recovery || null) : null,
        doneness: isObj ? (s.doneness || null) : null,
        tip: isObj ? (s.tip || null) : null,
      };
    });
  }, [detail.gris, detail.recipe, perso.swaps, perso.removed]);

  const total = steps.length;

  const next = useCallback(() => {
    if (step >= total - 1) {
      if (!finished) {
        setFinished(true);
        // CANONICAL completion event the gamification engine counts (UserEvent type 'cook_complete').
        if (token) {
          trackEvent('cook_complete', { recipeId: id });
          // If this recipe was reached from a recommendation (within the window), also fire the explicit
          // `recommendation_cook` reward with the slate requestId — the strongest exposure↔reward signal.
          const rid = recallRecommendation(id);
          if (rid) trackEvent('recommendation_cook', { recipeId: id, requestId: rid });
        }
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
    currentStep: steps[step] || null,
    isGris: Array.isArray(detail.gris?.steps) && detail.gris.steps.length > 0,
    personalization: { servedFor: perso.servedFor, swaps: perso.swaps, removed: perso.removed, isPersonalized: perso.isPersonalized },
    finished,
    next, prev,
    loggedIn: !!token,
    streakWeeks: gam.data?.streak?.currentWeeks || 0,
    sheetOpen, openHelp, closeHelp, help,
  };
}
