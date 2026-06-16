import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../lib/apiClient';
import { useAuth } from '../../../context/AuthContext';
import { useRecipeContext } from '../../../context/RecipeContext';
import { faDuration, faDifficulty } from '../../../components/ges/format';
import { reasonLabels, fitFromScore, DNA_BAND } from './reasons';
import { weekdayTimeLine } from './greeting';

/**
 * useHomeData — single source for the Home screen, wired to REAL endpoints, no fabrication.
 *
 * - GET /users/me → greeting name (nullable → generic greeting)
 * - GET /recommendations → bare array of picks (finalScore, matchedSignals, title); NO imageUrl
 *   (→ branded PlatePlaceholder), NO fit field (→ derived from finalScore), NO Persian reasons
 *   (→ localized from matchedSignals; the English `explanation` is never shown)
 * - GET /profile → taste-maturity ring (maturity.band + maturity.overallScore)
 * - GET /gamification/me → weekly streak badge
 * Picks are enriched with cook-time/difficulty from the app's cached recipe list (joined by id).
 *
 * All authed queries are gated on a token so a logged-out shell shows the warm onboarding empty
 * state instead of triggering the apiClient 401 redirect. Status: loading | error | empty | ready.
 */
export function useHomeData() {
  const { token } = useAuth();
  const enabled = !!token;
  const { recipes } = useRecipeContext();

  // Literal paths so the coverage scanner detects the calls (apiClient.<verb>('/literal')).
  const me = useQuery({ queryKey: ['home', 'me'], queryFn: () => apiClient.get('/users/me').then((r) => r.data), enabled });
  const recs = useQuery({ queryKey: ['home', 'recommendations'], queryFn: () => apiClient.get('/recommendations', { params: { limit: 10 } }).then((r) => r.data), enabled });
  const profile = useQuery({ queryKey: ['home', 'profile'], queryFn: () => apiClient.get('/profile').then((r) => r.data), enabled });
  const gamification = useQuery({ queryKey: ['home', 'gamification'], queryFn: () => apiClient.get('/gamification/me').then((r) => r.data), enabled });

  const recipeById = useMemo(() => {
    const map = new Map();
    for (const r of recipes || []) map.set(String(r.id), r);
    return map;
  }, [recipes]);

  return useMemo(() => {
    const name = me.data?.name || '';
    const list = Array.isArray(recs.data) ? recs.data : [];

    // Food DNA maturity (calm ring) — real, from /profile; band drives headline + tone.
    const maturity = profile.data?.maturity;
    const band = maturity?.band || 'empty';
    const dna = {
      band,
      score: typeof maturity?.overallScore === 'number' ? maturity.overallScore : 0,
      headline: (DNA_BAND[band] || DNA_BAND.developing).title,
      tone: (DNA_BAND[band] || DNA_BAND.developing).tone,
      // traits = the user's strongest REAL taste signals (aggregated from recommendations),
      // localized; empty while cold-starting.
      traits: reasonLabels(list.flatMap((r) => r.matchedSignals || r.reasonSignals || []), 3),
    };

    const picks = list.slice(0, 3).map((r, i) => {
      const recipe = recipeById.get(String(r.recipeId));
      const signals = r.matchedSignals || r.reasonSignals || [];
      const labels = reasonLabels(signals, 3);
      return {
        recipeId: r.recipeId,
        title: r.title || recipe?.title || 'دستور پیشنهادی',
        seed: i + 1,
        fit: fitFromScore(r.finalScore),
        cookTimeText: faDuration(recipe?.cookingTime),
        difficultyText: faDifficulty(recipe?.difficulty),
        reasons: labels,
        reasonText: labels.length ? `${labels.join(' · ')} — متناسب با ذائقه‌ات` : '',
      };
    });

    const whisper = list[0]
      ? { recipeId: list[0].recipeId, text: `برای امشب: ${list[0].title || 'یک پیشنهاد تازه'}`, sub: 'بر اساس انتخاب‌های اخیر تو' }
      : null;

    const streakWeeks = gamification.data?.streak?.currentWeeks || 0;
    const greeting = {
      name,
      line: weekdayTimeLine(),
      streak: streakWeeks > 0 ? streakWeeks : null,
      initial: name ? name.trim().charAt(0) : null,
    };

    let status = 'ready';
    if (!enabled) status = 'empty';
    else if (recs.isLoading || profile.isLoading) status = 'loading';
    else if (recs.isError) status = 'error';
    else if (list.length === 0) status = 'empty';

    return {
      status,
      greeting,
      dna,
      whisper,
      picks,
      refetch: () => {
        recs.refetch();
        profile.refetch();
      },
    };
  }, [enabled, me.data, recs.data, recs.isLoading, recs.isError, profile.data, profile.isLoading, gamification.data, recipeById, recs, profile]);
}
