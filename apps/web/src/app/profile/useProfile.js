import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { toFaDigits } from '../../components/ges/format';
import { traitsFromProfile, dimensionBreakdown, tasteReconciliation, faAllergen } from '../home/lib/reasons';

/**
 * useProfile — the «تو» screen's data, all from real owner-scoped reads (no fabrication):
 *   GET /users/me        → name + member-since (createdAt)
 *   GET /profile         → maturity (band, overallScore) + observed dimension confidences + reconciliation
 *   GET /gamification/me → streak (weeks) + cooked count + earned badges (private; no leaderboard)
 *   GET /users/preferences → declared allergies (the active safety flag) + top dietary pattern
 */

const BAND_SHORT = { empty: 'تازه شروع شده', forming: 'در حال شکل‌گیری', developing: 'در حال رشد', mature: 'پخته و روشن' };
const DIET_FA = {
  omnivore: 'همه‌چیزخوار', vegetarian: 'گیاه‌خوار', vegan: 'وگن', pescatarian: 'ماهی‌خوار',
  flexitarian: 'گیاه‌محور', mediterranean: 'مدیترانه‌ای', keto: 'کتو', low_carb: 'کم‌کربوهیدرات',
  paleo: 'پالئو', halal: 'حلال', kosher: 'کوشر',
};

function memberSince(createdAt) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return '';
  }
}

export function useProfile() {
  const { token } = useAuth();
  const enabled = !!token;

  const me = useQuery({ queryKey: ['home', 'me'], queryFn: () => apiClient.get('/users/me').then((r) => r.data), enabled });
  const profile = useQuery({ queryKey: ['home', 'profile'], queryFn: () => apiClient.get('/profile').then((r) => r.data), enabled });
  const gamification = useQuery({ queryKey: ['home', 'gamification'], queryFn: () => apiClient.get('/gamification/me').then((r) => r.data), enabled });
  const prefs = useQuery({ queryKey: ['discover', 'preferences'], queryFn: () => apiClient.get('/users/preferences').then((r) => r.data), enabled });

  return useMemo(() => {
    const anyLoading = me.isLoading || profile.isLoading || gamification.isLoading;
    const anyError = me.isError || profile.isError || gamification.isError;
    let status = 'ready';
    if (anyLoading) status = 'loading';
    else if (anyError || !me.data) status = 'error';

    if (status !== 'ready') {
      return { status, refetch: () => { me.refetch(); profile.refetch(); gamification.refetch(); prefs.refetch(); } };
    }

    const name = (me.data?.name || '').trim() || 'تو';
    const maturity = profile.data?.maturity;
    const band = maturity?.band || 'empty';
    const score = typeof maturity?.overallScore === 'number' ? maturity.overallScore : 0;

    const totalCooks = gamification.data?.stats?.totalCooks ?? 0;
    const streakWeeks = gamification.data?.streak?.currentWeeks ?? 0;
    const badges = Array.isArray(gamification.data?.achievements?.earned) ? gamification.data.achievements.earned.length : 0;

    const traits = traitsFromProfile(profile.data, 3);
    const since = memberSince(me.data?.createdAt);

    // «آنچه از تو می‌دانیم»
    const dietId = prefs.data?.diet || null;
    const dietLabel = dietId ? (DIET_FA[dietId] || null) : null;
    const allergies = (Array.isArray(prefs.data?.allergies) ? prefs.data.allergies : []).map(faAllergen).filter(Boolean);

    return {
      status,
      refetch: () => { me.refetch(); profile.refetch(); gamification.refetch(); prefs.refetch(); },
      header: {
        name,
        initial: name.charAt(0) || 'گ',
        since,
        cooksText: totalCooks > 0 ? `${toFaDigits(totalCooks)} دستور پخته` : 'هنوز دستوری ثبت نشده',
        streakWeeks,
      },
      dna: {
        band,
        bandLabel: BAND_SHORT[band] || 'در حال شکل‌گیری',
        score,
        traits,
        breakdown: dimensionBreakdown(profile.data, 5),
        reconciliation: tasteReconciliation(profile.data),
        forming: band === 'empty' || band === 'forming',
      },
      progress: {
        streakWeeks,
        totalCooks,
        badges,
      },
      known: {
        dietLabel: dietLabel || (traits[0] || null),
        allergen: allergies[0] || null,
      },
    };
  }, [me.data, me.isLoading, me.isError, profile.data, profile.isLoading, profile.isError, gamification.data, gamification.isLoading, gamification.isError, prefs.data, me, profile, gamification, prefs]);
}
