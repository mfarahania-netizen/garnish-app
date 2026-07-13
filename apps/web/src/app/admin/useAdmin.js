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
export function deriveOverviewData({ health = {}, safety = {}, userStats = {}, trends = {}, intel = {} } = {}, days = 30) {
  const seriesTotal = (key) => (Array.isArray(trends.series?.[key]) ? trends.series[key].reduce((n, b) => n + (b.count || 0), 0) : 0);
  const trendsReal = trends.status === 'real';
  const registeredReal = typeof userStats.registeredUsers === 'number';
  const guestReal = typeof userStats.guestUsers === 'number';

  return {
    growth: {
      registered: { real: registeredReal, value: userStats.registeredUsers ?? 0 },
      guests: { real: guestReal, value: userStats.guestUsers ?? 0 },
      total: { real: typeof userStats.totalUsers === 'number', value: userStats.totalUsers ?? 0 },
      cooks: { real: trendsReal, value: seriesTotal('cook_complete') },
      searches: { real: trendsReal, value: seriesTotal('search_query') },
      ai: { real: trendsReal, value: seriesTotal('ai_message_send') },
    },
    latency: { real: health.aiCalls?.status === 'real', p50: health.aiCalls?.latencyMsP50 ?? null, p95: health.aiCalls?.latencyMsP95 ?? null, total: health.aiCalls?.total ?? 0 },
    eventQuality: { real: health.eventQuality?.status === 'real', rate: typeof health.eventQuality?.wellFormedRate === 'number' ? health.eventQuality.wellFormedRate : null, sampled: health.eventQuality?.sampled ?? 0 },
    guards: { cases: safety.guardCorpus?.casesEvaluated ?? 0, blocked: safety.guardCorpus?.blockedCases ?? 0, byGuard: safety.guardCorpus?.byGuard || {}, source: safety.guardCorpus?.source || '' },
    allergen: safety.allergySafety ? { pass: !!safety.allergySafety.pass, leaks: safety.allergySafety.leaks ?? 0, indicator: safety.allergySafety.indicator || '' } : null,
    notif: safety.notificationDelivery ? { posture: safety.notificationDelivery.posture || 'dry-run', realSendEnabled: !!safety.notificationDelivery.realSendEnabled } : null,
    foodDna: { real: intel.foodDna?.status === 'real', bands: intel.foodDna?.bands || {}, sampled: intel.foodDna?.sampled ?? 0 },
    recsys: { real: intel.recsys?.status === 'real', offline: intel.recsys?.offline || {}, allergySafety: intel.recsys?.allergySafety || null },
    meta: {
      windowDays: days,
      sources: ['User snapshot', 'UserEvent', 'ops health', 'safety fixture corpus', 'product intelligence'],
    },
  };
}

export const OVERVIEW_SOURCE_IDS = {
  health: 'ops-health',
  safety: 'safety-compliance',
  userStats: 'user-stats',
  trends: 'activity-trends',
  intel: 'product-intelligence',
};

export function getFailedOverviewSourceIds(queries = {}) {
  return Object.entries(OVERVIEW_SOURCE_IDS)
    .filter(([queryKey]) => queries[queryKey]?.isError)
    .map(([, sourceId]) => sourceId);
}

export function retryFailedOverviewSources(queries = {}) {
  return Promise.all(Object.keys(OVERVIEW_SOURCE_IDS)
    .filter((queryKey) => queries[queryKey]?.isError && typeof queries[queryKey]?.refetch === 'function')
    .map((queryKey) => queries[queryKey].refetch()));
}

export function useOverviewData(days = 30) {
  const health = useQuery({ queryKey: ['admin', 'ops-health'], queryFn: () => apiClient.get('/admin/ops/health').then((r) => r.data) });
  const safety = useQuery({ queryKey: ['admin', 'ops-safety'], queryFn: () => apiClient.get('/admin/ops/safety-compliance').then((r) => r.data) });
  const userStats = useQuery({ queryKey: ['admin', 'user-stats'], queryFn: () => apiClient.get('/admin/analytics/user-stats').then((r) => r.data) });
  const trends = useQuery({ queryKey: ['admin', 'trends', days], queryFn: () => apiClient.get('/admin/analytics/trends', { params: { bucket: 'day', days } }).then((r) => r.data) });
  const intel = useQuery({ queryKey: ['admin', 'product-intelligence'], queryFn: () => apiClient.get('/admin/analytics/product-intelligence').then((r) => r.data) });

  const derived = useMemo(() => deriveOverviewData({
    health: health.data,
    safety: safety.data,
    userStats: userStats.data,
    trends: trends.data,
    intel: intel.data,
  }, days), [health.data, safety.data, userStats.data, trends.data, intel.data, days]);

  const queries = { health, safety, userStats, trends, intel };
  const queryList = Object.values(queries);
  const loading = queryList.some((q) => q.isLoading);
  const failedSourceIds = getFailedOverviewSourceIds(queries);
  const error = failedSourceIds.length > 0;
  const retry = () => retryFailedOverviewSources(queries);
  const updated = queryList.map((q) => q.dataUpdatedAt).filter((v) => Number(v) > 0);
  const refreshedAt = updated.length ? new Date(Math.min(...updated)).toISOString() : null;
  return { d: derived, loading, error, failedSourceIds, retry, refreshedAt };
}
