import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { faDuration, faDifficulty } from '../../components/ges/format';
import { faAllergen } from '../home/lib/reasons';

/**
 * useDiscovery — the کشف screen's data.
 * No query  → browse: popular catalog + personalized "based on your kitchen" rails.
 * Active q  → GET /recipes/search?q=… (public TF-IDF; honest-empty). Each result carries
 *            `_search.matchedTerms` — the REAL reasons (Persian corpus tokens) shown in the WhyChip;
 *            no personalized fit is fabricated (search is anonymous-ranked).
 * No results → the captured-intent unmetSearch state; we record it (trackEvent → POST /analytics/event,
 *            which only fires for a signed-in user — Discovery lives behind the auth gate — so the
 *            "درخواستت ثبت شد" line is true, not decorative).
 * Allergen demote-not-hidden: a result whose listed ingredients match a declared allergy is moved to
 *            the bottom + flagged (real signals only; never hidden, never a fabricated guarantee).
 */

const stableSeed = (id) => {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

const hasPersian = (s) => /[؀-ۿ]/.test(String(s));
const cleanTerms = (terms) => {
  const out = [];
  for (const t of terms || []) {
    const v = String(t || '').trim();
    if (v.length >= 2 && hasPersian(v) && !out.includes(v)) out.push(v);
    if (out.length >= 3) break;
  }
  return out;
};

// allergy (declared, localized) → ingredient terms to look for (conservative token match)
const ALLERGEN_TERMS = {
  گلوتن: ['گلوتن', 'گندم', 'آرد', 'نان', 'ماکارونی', 'رشته'],
  گندم: ['گندم', 'آرد', 'نان'],
  لبنیات: ['شیر', 'پنیر', 'ماست', 'خامه', 'کره', 'دوغ', 'کشک'],
  شیر: ['شیر', 'خامه', 'کره'],
  'تخم‌مرغ': ['تخم‌مرغ', 'تخم مرغ'],
  آجیل: ['آجیل', 'گردو', 'بادام', 'فندق', 'پسته'],
  'بادام‌زمینی': ['بادام‌زمینی', 'بادام زمینی'],
  صدف: ['صدف', 'میگو', 'خرچنگ'],
  سویا: ['سویا'],
  کنجد: ['کنجد', 'ارده', 'طحینی'],
  ماهی: ['ماهی', 'تن'],
};

const tokenize = (name) => String(name || '').split(/[\s‌،,]+/).filter(Boolean);

function ingredientNames(recipe) {
  return (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
    .map((ing) => ing?.name || ing?.ingredient?.name || '')
    .filter(Boolean);
}

// returns the conflicting allergen label (Persian) or null — uses ONLY real declared allergies + listed ingredients
function allergenConflict(recipe, allergiesFa) {
  if (!allergiesFa.length) return null;
  const names = ingredientNames(recipe);
  if (!names.length) return null;
  const tokensByName = names.map(tokenize);
  for (const a of allergiesFa) {
    const terms = ALLERGEN_TERMS[a] || [a];
    for (const term of terms) {
      const multi = term.includes(' ');
      const hit = multi
        ? names.some((n) => n.includes(term))
        : tokensByName.some((toks) => toks.includes(term));
      if (hit) return a;
    }
  }
  return null;
}

export function useDiscovery() {
  const { token } = useAuth();
  const { trackEvent } = useAnalytics();

  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({});

  // debounce the typed input → query
  useEffect(() => {
    const id = setTimeout(() => setQuery(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);

  const active = query.length >= 2;

  // ── browse data ──
  const catalog = useQuery({
    queryKey: ['discover', 'catalog'],
    queryFn: () => apiClient.get('/recipes', { params: { limit: 30 } }).then((r) => r.data),
    enabled: !active,
  });
  const recs = useQuery({
    queryKey: ['home', 'recommendations'],
    queryFn: () => apiClient.get('/recommendations', { params: { limit: 12 } }).then((r) => r.data),
    enabled: !active && !!token,
  });
  const prefs = useQuery({
    queryKey: ['discover', 'preferences'],
    queryFn: () => apiClient.get('/users/preferences').then((r) => r.data),
    enabled: !!token,
  });

  // ── search ──
  const search = useQuery({
    queryKey: ['discover', 'search', query],
    queryFn: () => apiClient.get('/recipes/search', { params: { q: query, limit: 20 } }).then((r) => r.data),
    enabled: active,
  });

  const allergiesFa = useMemo(
    () => (Array.isArray(prefs.data?.allergies) ? prefs.data.allergies : []).map(faAllergen).filter(Boolean),
    [prefs.data],
  );

  const toCard = useCallback((r) => ({
    id: r.id,
    title: r.title || 'دستور',
    seed: stableSeed(r.id),
    cookTimeText: faDuration(r.cookingTime || r.totalTime),
    difficultyText: faDifficulty(r.difficulty),
  }), []);

  // browse rails (RecipeRail keys on recipeId)
  const catalogList = useMemo(() => (Array.isArray(catalog.data?.data) ? catalog.data.data : Array.isArray(catalog.data) ? catalog.data : []), [catalog.data]);
  const popular = useMemo(() => catalogList.slice(0, 10).map((r) => ({
    recipeId: r.id, title: r.title || 'دستور', seed: stableSeed(r.id), cookTimeText: faDuration(r.cookingTime || r.totalTime), difficultyText: faDifficulty(r.difficulty),
  })), [catalogList]);
  const forYou = useMemo(() => {
    const byId = new Map(catalogList.map((r) => [String(r.id), r]));
    const list = Array.isArray(recs.data) ? recs.data : [];
    return list.slice(0, 10).map((rec) => {
      const r = byId.get(String(rec.recipeId)) || {};
      return { recipeId: rec.recipeId, title: rec.title || r.title || 'دستور پیشنهادی', seed: stableSeed(rec.recipeId), cookTimeText: faDuration(r.cookingTime), difficultyText: faDifficulty(r.difficulty) };
    });
  }, [recs.data, catalogList]);

  // results (with allergen demote-not-hidden + WhyChip terms)
  const results = useMemo(() => {
    const list = Array.isArray(search.data) ? search.data : [];
    let mapped = list.map((r) => ({
      ...toCard(r),
      reasons: cleanTerms(r?._search?.matchedTerms),
      allergen: allergenConflict(r, allergiesFa),
      cats: Array.isArray(r.categories) ? r.categories : [],
      cookingTime: r.cookingTime || r.totalTime || null,
    }));

    // client-side quick filters
    if (filters.under60) mapped = mapped.filter((m) => m.cookingTime && m.cookingTime <= 60);
    if (filters.quick) mapped = mapped.filter((m) => m.cookingTime && m.cookingTime <= 30);
    if (filters.veg) mapped = mapped.filter((m) => m.cats.some((c) => /گیاه|vegan|vegetarian/i.test(String(c))));

    // demote-not-hidden: allergen conflicts to the bottom
    const safe = mapped.filter((m) => !m.allergen);
    const flagged = mapped.filter((m) => m.allergen);
    return { safe, flagged, total: mapped.length };
  }, [search.data, allergiesFa, filters, toCard]);

  // status
  let status = 'browse';
  if (active) {
    if (search.isLoading) status = 'loading';
    else if (search.isError) status = 'error';
    else if (results.total === 0) status = 'noresults';
    else status = 'results';
  }

  // record the unmet search once per query (honest: real analytics event, signed-in only)
  const recorded = useRef('');
  useEffect(() => {
    if (status === 'noresults' && query && recorded.current !== query) {
      recorded.current = query;
      trackEvent('search_unmet', { query });
    }
  }, [status, query, trackEvent]);

  const setQueryNow = useCallback((q) => { setInput(q); setQuery(q.trim()); }, []);
  const clear = useCallback(() => { setInput(''); setQuery(''); setFilters({}); }, []);
  const toggleFilter = useCallback((id) => setFilters((f) => ({ ...f, [id]: !f[id] })), []);

  return {
    input, setInput, query, active, status,
    popular, forYou,
    results,
    filters, toggleFilter,
    setQueryNow, clear,
    refetch: () => search.refetch(),
  };
}
