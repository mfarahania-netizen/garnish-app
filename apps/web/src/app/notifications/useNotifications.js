import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { toFaDigits } from '../../components/ges/format';
import { IconFlame, IconAward, IconCalendarEvent, IconSparkles, IconBell } from '@tabler/icons-react';

/**
 * useNotifications — the calm notification center (GET /notifications, real data, take 50). Mark a single
 * read via PATCH /notifications/:id/read (optimistic); «همه را خواندم» loops the unread ones (no bulk
 * endpoint exists). No FOMO/guilt — just the engine's messages, time-stamped. The notification `type` is
 * used only to pick an icon (never shown raw).
 */

const TYPE_META = {
  streak_at_risk: { Icon: IconFlame, tone: 'brand' }, streak: { Icon: IconFlame, tone: 'brand' },
  achievement_unlocked: { Icon: IconAward, tone: 'success' }, achievement: { Icon: IconAward, tone: 'success' }, mastery_levelup: { Icon: IconAward, tone: 'success' },
  briefing: { Icon: IconCalendarEvent, tone: 'neutral' }, weekly_briefing: { Icon: IconCalendarEvent, tone: 'neutral' },
  suggestion: { Icon: IconSparkles, tone: 'brand' }, recommendation: { Icon: IconSparkles, tone: 'brand' }, reengagement: { Icon: IconSparkles, tone: 'brand' },
};
const metaFor = (type) => TYPE_META[String(type || '').toLowerCase()] || { Icon: IconBell, tone: 'neutral' };

function relTime(createdAt) {
  const then = new Date(createdAt).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'همین حالا';
  if (min < 60) return `${toFaDigits(min)} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${toFaDigits(hr)} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'دیروز';
  if (day < 7) return `${toFaDigits(day)} روز پیش`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${toFaDigits(wk)} هفته پیش`;
  try { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { day: 'numeric', month: 'long' }).format(new Date(createdAt)); } catch { return ''; }
}

function recipeIdOf(data) {
  if (!data) return null;
  try { const d = typeof data === 'string' ? JSON.parse(data) : data; return d?.recipeId || d?.recipe_id || null; } catch { return null; }
}

export function useNotifications() {
  const q = useQuery({ queryKey: ['notifications', 'list'], queryFn: () => apiClient.get('/notifications').then((r) => r.data) });
  const [readOverride, setReadOverride] = useState({}); // id → true

  const items = useMemo(() => {
    const arr = Array.isArray(q.data) ? q.data : [];
    return arr.filter((n) => n && n.id).map((n) => ({
      id: n.id,
      title: n.title || 'اعلان',
      body: n.body || '',
      isRead: !!n.isRead || !!readOverride[n.id],
      timeText: relTime(n.createdAt),
      recipeId: recipeIdOf(n.data),
      ...metaFor(n.type),
    }));
  }, [q.data, readOverride]);

  const unread = items.reduce((n, it) => n + (it.isRead ? 0 : 1), 0);

  const markRead = useCallback(async (id) => {
    setReadOverride((m) => ({ ...m, [id]: true }));
    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch {
      // self-correct: roll back the optimistic read so the UI never claims read when the server didn't persist
      setReadOverride((m) => { const next = { ...m }; delete next[id]; return next; });
    }
  }, []);

  const markAll = useCallback(async () => {
    const unreadIds = items.filter((it) => !it.isRead).map((it) => it.id);
    if (!unreadIds.length) return;
    setReadOverride((m) => { const next = { ...m }; unreadIds.forEach((id) => { next[id] = true; }); return next; });
    await Promise.allSettled(unreadIds.map((id) => apiClient.patch(`/notifications/${id}/read`)));
    q.refetch();
  }, [items, q]);

  let status = 'ready';
  if (q.isLoading) status = 'loading';
  else if (q.isError) status = 'error';
  else if (items.length === 0) status = 'empty';

  return { status, refetch: () => q.refetch(), items, unread, markRead, markAll };
}
