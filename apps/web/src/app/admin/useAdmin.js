import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';

/**
 * useAdmin — the admin overview. Admin-gated on the real isAdmin signal (useAuth().user.isAdmin; the
 * backend endpoints are themselves RolesGuard-protected — the FE gate is UX, not security).
 *
 * Honesty: every metric block from /admin/* carries a `status: 'real' | 'awaiting_pilot'`. We render the
 * real number ONLY when status==='real' and otherwise the AwaitingPilot honest state — NEVER a fabricated
 * growth/vanity number. The safety/compliance evidence (guard-fire counts over the fixture corpus, allergen
 * hard-filter, recsys offline) is deterministic + real even pre-pilot.
 */

const RANGES = [{ id: 1, label: '۲۴ ساعت' }, { id: 7, label: '۷ روز' }, { id: 30, label: '۳۰ روز' }];

export function useAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [days, setDays] = useState(30);

  const health = useQuery({ queryKey: ['admin', 'ops-health'], queryFn: () => apiClient.get('/admin/ops/health').then((r) => r.data), enabled: isAdmin });
  const safety = useQuery({ queryKey: ['admin', 'ops-safety'], queryFn: () => apiClient.get('/admin/ops/safety-compliance').then((r) => r.data), enabled: isAdmin });
  const userStats = useQuery({ queryKey: ['admin', 'user-stats'], queryFn: () => apiClient.get('/admin/analytics/user-stats').then((r) => r.data), enabled: isAdmin });
  const trends = useQuery({ queryKey: ['admin', 'trends', days], queryFn: () => apiClient.get('/admin/analytics/trends', { params: { bucket: 'day', days } }).then((r) => r.data), enabled: isAdmin });
  const intel = useQuery({ queryKey: ['admin', 'product-intelligence'], queryFn: () => apiClient.get('/admin/analytics/product-intelligence').then((r) => r.data), enabled: isAdmin });

  const refetchAll = () => { health.refetch(); safety.refetch(); userStats.refetch(); trends.refetch(); intel.refetch(); };

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
      latency: {
        real: h.aiCalls?.status === 'real',
        p50: h.aiCalls?.latencyMsP50 ?? null, p95: h.aiCalls?.latencyMsP95 ?? null, total: h.aiCalls?.total ?? 0,
      },
      eventQuality: {
        real: h.eventQuality?.status === 'real',
        rate: typeof h.eventQuality?.wellFormedRate === 'number' ? h.eventQuality.wellFormedRate : null,
        sampled: h.eventQuality?.sampled ?? 0,
      },
      guards: {
        cases: s.guardCorpus?.casesEvaluated ?? 0,
        blocked: s.guardCorpus?.blockedCases ?? 0,
        byGuard: s.guardCorpus?.byGuard || {},
        source: s.guardCorpus?.source || '',
      },
      allergen: s.allergySafety ? { pass: !!s.allergySafety.pass, leaks: s.allergySafety.leaks ?? 0, indicator: s.allergySafety.indicator || '' } : null,
      notif: s.notificationDelivery ? { posture: s.notificationDelivery.posture || 'dry-run', realSendEnabled: !!s.notificationDelivery.realSendEnabled } : null,
      consent: { real: s.consentPosture?.status === 'real', byPurpose: s.consentPosture?.byPurpose || {} },
      foodDna: { real: i.foodDna?.status === 'real', bands: i.foodDna?.bands || {}, sampled: i.foodDna?.sampled ?? 0 },
      recsys: {
        real: i.recsys?.status === 'real' || !!i.recsys?.offline,
        offline: i.recsys?.offline || {},
        allergySafety: i.recsys?.allergySafety || null,
        online: i.recsys?.online || {},
      },
      readiness: {
        jobs: h.scheduledJobs?.jobs || [],
        destructive: !!h.retentionDestructiveEnabled,
      },
    };
  }, [health.data, safety.data, userStats.data, trends.data, intel.data]);

  const anyLoading = health.isLoading || safety.isLoading || userStats.isLoading || trends.isLoading || intel.isLoading;
  const anyError = health.isError && safety.isError; // tolerate partial; only hard-error if the core ops fail

  let status = 'ready';
  if (authLoading) status = 'auth';
  else if (!isAdmin) status = 'denied';
  else if (anyLoading) status = 'loading';
  else if (anyError) status = 'error';

  return { status, isAdmin, ranges: RANGES, days, setDays, refetchAll, d: derived };
}
