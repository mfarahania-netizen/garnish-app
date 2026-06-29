import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';

/**
 * useOverviewData — the «نمای کلی» tab's data layer (the admin layout owns auth + the range selector).
 *
 * Honesty: every metric block from /admin/* carries a `status: 'real' | 'awaiting_pilot'`. We render the
 * real number ONLY when status==='real' and otherwise an honest awaiting state — NEVER a fabricated
 * growth/vanity number. Safety/compliance evidence (guard-fire counts over the fixture corpus, the allergen
 * hard-filter, recsys offline eval) is deterministic + real even pre-pilot.
 */
export function useOverviewData(days = 30) {
  const health = useQuery({ queryKey: ['admin', 'ops-health'], queryFn: () => apiClient.get('/admin/ops/health').then((r) => r.data) });
  const safety = useQuery({ queryKey: ['admin', 'ops-safety'], queryFn: () => apiClient.get('/admin/ops/safety-compliance').then((r) => r.data) });
  const userStats = useQuery({ queryKey: ['admin', 'user-stats'], queryFn: () => apiClient.get('/admin/analytics/user-stats').then((r) => r.data) });
  const trends = useQuery({ queryKey: ['admin', 'trends', days], queryFn: () => apiClient.get('/admin/analytics/trends', { params: { bucket: 'day', days } }).then((r) => r.data) });
  const intel = useQuery({ queryKey: ['admin', 'product-intelligence'], queryFn: () => apiClient.get('/admin/analytics/product-intelligence').then((r) => r.data) });

  const derived = useMemo(() => {
    const h = health.data || {};
    const s = safety.data || {};
    const t = trends.data || {};
    const i = intel.data || {};
    const seriesTotal = (key) => (Array.isArray(t.series?.[key]) ? t.series[key].reduce((n, b) => n + (b.count || 0), 0) : 0);
    const trendsReal = t.status === 'real';

    return {
      growth: {
        users: { real: typeof userStats.data?.totalUsers === 'number', value: userStats.data?.totalUsers ?? 0 },
        cooks: { real: trendsReal, value: seriesTotal('cook_complete') },
        searches: { real: trendsReal, value: seriesTotal('search_query') },
        ai: { real: trendsReal, value: seriesTotal('ai_message_send') },
      },
      latency: { real: h.aiCalls?.status === 'real', p50: h.aiCalls?.latencyMsP50 ?? null, p95: h.aiCalls?.latencyMsP95 ?? null, total: h.aiCalls?.total ?? 0 },
      eventQuality: { real: h.eventQuality?.status === 'real', rate: typeof h.eventQuality?.wellFormedRate === 'number' ? h.eventQuality.wellFormedRate : null, sampled: h.eventQuality?.sampled ?? 0 },
      guards: { cases: s.guardCorpus?.casesEvaluated ?? 0, blocked: s.guardCorpus?.blockedCases ?? 0, byGuard: s.guardCorpus?.byGuard || {}, source: s.guardCorpus?.source || '' },
      allergen: s.allergySafety ? { pass: !!s.allergySafety.pass, leaks: s.allergySafety.leaks ?? 0, indicator: s.allergySafety.indicator || '' } : null,
      notif: s.notificationDelivery ? { posture: s.notificationDelivery.posture || 'dry-run', realSendEnabled: !!s.notificationDelivery.realSendEnabled } : null,
      foodDna: { real: i.foodDna?.status === 'real', bands: i.foodDna?.bands || {}, sampled: i.foodDna?.sampled ?? 0 },
      recsys: { real: i.recsys?.status === 'real', offline: i.recsys?.offline || {}, allergySafety: i.recsys?.allergySafety || null },
    };
  }, [health.data, safety.data, userStats.data, trends.data, intel.data]);

  const loading = health.isLoading || safety.isLoading || userStats.isLoading || trends.isLoading || intel.isLoading;
  const error = health.isError && safety.isError; // tolerate partial; only hard-error if core ops fail
  return { d: derived, loading, error };
}
