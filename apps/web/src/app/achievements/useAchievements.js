import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { queryKeys } from '../../lib/queryKeys';
import {
  IconToolsKitchen2, IconChefHat, IconArrowsShuffle, IconWorld, IconFlame,
  IconCalendarEvent, IconCalendarCheck, IconBookmark, IconChartBar,
} from '@tabler/icons-react';

/**
 * useAchievements — private gamification (GET /gamification/me): streak (weekly), the earned-badge set,
 * and the single OVERALL mastery track. No leaderboard / comparison / shame; the broken-streak is framed
 * with grace. The badge catalog mirrors the backend gamification-achievements.ts (display set); `earned`
 * comes from the API, the rest render as honest not-yet (locked, never shamed).
 */

// catalog copied from apps/server/.../gamification-achievements.ts (titles/descriptions verbatim) + icons
const CATALOG = [
  { key: 'first_cook', title: 'اولین آشپزی', description: 'اولین غذات رو پختی — شروع عالی!', Icon: IconToolsKitchen2 },
  { key: 'cook_5', title: '۵ آشپزی', description: '۵ بار آشپزی کردی.', Icon: IconChefHat },
  { key: 'cook_25', title: 'آشپز پرکار', description: '۲۵ بار آشپزی کردی.', Icon: IconChefHat },
  { key: 'recipe_variety_10', title: 'تنوع‌دوست', description: '۱۰ رسپی متفاوت رو امتحان کردی.', Icon: IconArrowsShuffle },
  { key: 'cuisine_explorer', title: 'کاشف آشپزی‌ها', description: 'از ۳ آشپزی متفاوت غذا پختی.', Icon: IconWorld },
  { key: 'brave_cook', title: 'دل به دریا', description: 'یه رسپی چالشی رو پختی.', Icon: IconFlame },
  { key: 'week_planner', title: 'برنامه‌ریز هفته', description: 'یه هفتهٔ کامل غذایی برنامه‌ریزی کردی.', Icon: IconCalendarEvent },
  { key: 'consistency_4w', title: 'پایدار و منظم', description: '۴ هفتهٔ پیاپی آشپزی کردی.', Icon: IconCalendarCheck },
  { key: 'collector_10', title: 'گردآورنده', description: '۱۰ رسپی رو ذخیره کردی.', Icon: IconBookmark },
];

export function useAchievements() {
  const q = useQuery({ queryKey: queryKeys.gamificationMe, queryFn: () => apiClient.get('/gamification/me').then((r) => r.data) });

  return useMemo(() => {
    let status = 'ready';
    if (q.isLoading) status = 'loading';
    else if (q.isError || !q.data) status = 'error';
    if (status !== 'ready') return { status, refetch: () => q.refetch() };

    const d = q.data;
    const earnedKeys = new Set((d.achievements?.earned || []).map((a) => (typeof a === 'string' ? a : a?.key)).filter(Boolean));
    const badges = CATALOG.map((c) => ({ ...c, earned: earnedKeys.has(c.key) }));
    const earnedCount = badges.filter((b) => b.earned).length;

    const streakWeeks = d.streak?.currentWeeks || 0;
    const longestWeeks = d.streak?.longestWeeks || 0;
    const totalCooks = d.stats?.totalCooks || 0;
    const kindMessage = d.streak?.kindMessage || '';

    const isNewUser = totalCooks === 0 && earnedCount === 0;
    const streakState = streakWeeks > 0 ? 'active' : (longestWeeks > 0 || totalCooks > 0) ? 'broken' : 'none';

    const m = d.mastery || {};
    const mastery = (m.levelName || typeof m.progressToNext === 'number')
      ? { level: m.level || 1, levelName: m.levelName || '', progressToNext: typeof m.progressToNext === 'number' ? m.progressToNext : 0, basis: m.basis || '' }
      : null;

    return {
      status,
      refetch: () => q.refetch(),
      isNewUser,
      streak: { weeks: streakWeeks, longest: longestWeeks, atRisk: !!d.streak?.atRisk, graceUsed: !!d.streak?.graceUsed, kindMessage, state: streakState },
      badges, earnedCount,
      mastery,
      masteryIcon: IconChartBar,
    };
  }, [q.data, q.isLoading, q.isError, q]);
}
