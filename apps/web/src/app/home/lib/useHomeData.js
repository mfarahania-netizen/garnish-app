import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../lib/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { queryKeys } from '../../../lib/queryKeys';
import { faDuration, faDifficulty, toFaDigits } from '../../../components/ges/format';
import { reasonLabels, fitFromScore, DNA_BAND, traitsFromProfile } from './reasons';
import { weekdayTimeLine } from './greeting';

/**
 * useHomeData — single source for the full Home command-center, wired to REAL endpoints,
 * no fabrication. Authed queries are token-gated (logged-out → onboarding empty state, no
 * 401 redirect). Literal paths so the coverage scanner detects the calls.
 *
 * /users/me        → greeting name        /profile          → Food DNA maturity ring
 * /gamification/me → streak + mastery     /recommendations  → real hero/more suggestions
 * /recipes         → fallback hero + popular rail (no imageUrl → placeholder)
 */
const stableSeed = (id) => {
  let s = 0;
  for (const c of String(id ?? '')) s += c.charCodeAt(0);
  return s % 6;
};

export function useHomeData() {
  const { token } = useAuth();
  const enabled = !!token;

  const me = useQuery({ queryKey: queryKeys.me, queryFn: () => apiClient.get('/users/me').then((r) => r.data), enabled });
  const recs = useQuery({ queryKey: ['home', 'recommendations'], queryFn: () => apiClient.get('/recommendations', { params: { limit: 12 } }).then((r) => r.data), enabled });
  const profile = useQuery({ queryKey: queryKeys.profile.living, queryFn: () => apiClient.get('/profile').then((r) => r.data), enabled });
  const gamification = useQuery({ queryKey: queryKeys.gamificationMe, queryFn: () => apiClient.get('/gamification/me').then((r) => r.data), enabled });
  const recipes = useQuery({ queryKey: ['home', 'recipes'], queryFn: () => apiClient.get('/recipes', { params: { limit: 60 } }).then((r) => r.data), enabled });

  return useMemo(() => {
    const name = me.data?.name || '';
    const recList = Array.isArray(recs.data) ? recs.data : [];
    const catalog = Array.isArray(recipes.data?.data) ? recipes.data.data : Array.isArray(recipes.data) ? recipes.data : [];

    const catalogById = new Map();
    for (const r of catalog) catalogById.set(String(r.id), r);

    const railItem = (r) => ({
      recipeId: r.id,
      title: r.title,
      seed: stableSeed(r.id),
      cookTimeText: faDuration(r.cookingTime),
      difficultyText: faDifficulty(r.difficulty),
    });

    // ── Food DNA (calm ring) from real /profile maturity ──
    const maturity = profile.data?.maturity;
    const band = maturity?.band || 'empty';
    const dna = {
      band,
      score: typeof maturity?.overallScore === 'number' ? maturity.overallScore : 0,
      headline: (DNA_BAND[band] || DNA_BAND.developing).title,
      tone: (DNA_BAND[band] || DNA_BAND.developing).tone,
      // traits = the profile's taste/behaviour DIMENSIONS (never recipe ingredients like قارچ);
      // empty while cold-starting (honest forming state).
      traits: traitsFromProfile(profile.data, 3),
    };

    // ── Gamification (private; real streak + mastery) ──
    const streakWeeks = gamification.data?.streak?.currentWeeks || 0;
    const mastery = gamification.data?.mastery;
    const gam = {
      show: !!gamification.data && (streakWeeks > 0 || !!mastery),
      headline:
        gamification.data?.streak?.kindMessage ||
        (streakWeeks > 0 ? `${toFaDigits(streakWeeks)} هفته پشت‌سر‌هم پختی — عالیه!` : 'بیا اولین پختت رو ثبت کنیم'),
      progressLabel: mastery?.levelName ? `سطح ${toFaDigits(mastery.level || 1)} · ${mastery.levelName}` : null,
      progress: typeof mastery?.progressToNext === 'number' ? mastery.progressToNext : 0,
    };

    const recommendationCard = (r) => {
      const recipe = catalogById.get(String(r.recipeId));
      const labels = reasonLabels(r.matchedSignals || r.reasonSignals || [], 3);
      return {
        recipeId: r.recipeId,
        requestId: r.requestId || null,
        title: r.title || recipe?.title || 'دستور پیشنهادی',
        seed: stableSeed(r.recipeId),
        fit: fitFromScore(r.finalScore),
        cookTimeText: faDuration(recipe?.cookingTime),
        difficultyText: faDifficulty(recipe?.difficulty),
        servingsText: recipe?.servings ? `${toFaDigits(recipe.servings)} نفر` : '',
        // Real signals power the WhyChip popover (on tap). No inline reason line on the card face
        // — the API returns the same top signals per item, so an inline line would just repeat.
        reasons: labels,
        reasonText: '',
      };
    };

    const catalogCard = (r) => ({
      recipeId: r.id,
      requestId: null,
      title: r.title || 'دستور',
      seed: stableSeed(r.id),
      fit: null,
      cookTimeText: faDuration(r.cookingTime || r.totalTime),
      difficultyText: faDifficulty(r.difficulty),
      servingsText: r.servings ? `${toFaDigits(r.servings)} نفر` : '',
      reasons: [],
      reasonText: '',
    });

    // ── Hero and rails: one decision-first hero + max two rails. Recommendations are used
    // only when real; otherwise the public catalog fallback is labelled non-personally.
    const hero = recList[0]
      ? { ...recommendationCard(recList[0]), source: 'recommendation', label: 'پیشنهاد امروز' }
      : catalog[0]
        ? { ...catalogCard(catalog[0]), source: 'fallback', label: 'برای شروع' }
        : null;

    const picks = (recList.length ? recList.slice(1, 7).map(recommendationCard) : catalog.slice(1, 7).map(catalogCard));

    const popular = catalog.slice(0, 8).map(railItem);

    const greeting = {
      name,
      line: weekdayTimeLine(),
      streak: streakWeeks > 0 ? streakWeeks : null,
      initial: name ? name.trim().charAt(0) : null,
    };

    let status = 'ready';
    if (!enabled) status = 'empty';
    else if (recs.isLoading || profile.isLoading || recipes.isLoading) status = 'loading';
    else if (recs.isError) status = 'error';
    else if (!hero) status = 'empty';

    return {
      status,
      greeting,
      dna,
      gam,
      hero,
      picks,
      rails: { more: picks, popular },
      // Resume "ادامهٔ پخت" — null until Cook Mode writes in-progress-cook state; the section
      // is wired in Home and renders only when this is present (never fabricated).
      resume: null,
      refetch: () => { recs.refetch(); profile.refetch(); recipes.refetch(); },
    };
  }, [enabled, me.data, recs.data, recs.isLoading, recs.isError, profile.data, profile.isLoading, gamification.data, recipes.data, recs, profile, recipes]);
}
