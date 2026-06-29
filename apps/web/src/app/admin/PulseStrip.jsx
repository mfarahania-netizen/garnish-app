// PulseStrip (P0-1) — the mission-control ≤9-tile System Pulse: the black-box "is everything OK?" answered in ONE
// glance. Grayscale-calm (P0-5 baked in): a healthy tile is near-neutral; color (amber→red) is spent ONLY on a
// deviation, so the first anomaly is the only thing that lights up. Every tile is REAL or an explicit "No-data"
// state (a 4th state ≠ green) — never a fabricated zero dressed as healthy (the founder's #1 law).
import { Box, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconActivity, IconShieldHalf, IconSparkles, IconCoin, IconChartBar, IconDatabase, IconShieldCheck, IconBolt, IconClock } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import { grid, toFaDigits, faPercent } from './_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
// color-as-signal: ok is near-neutral (just a quiet green dot), deviation lights amber→red, no-data is gray.
const STATE = {
  ok: { dot: 'var(--g-color-state-success-fg, #2e7d4f)', val: 'var(--g-color-text-primary)', word: 'سالم' },
  degraded: { dot: 'var(--g-color-state-warning-fg, #c0801c)', val: 'var(--g-color-state-warning-fg, #c0801c)', word: 'افت' },
  down: { dot: 'var(--g-color-state-danger-fg, #c0392b)', val: 'var(--g-color-state-danger-fg, #c0392b)', word: 'خراب' },
  nodata: { dot: 'var(--g-color-border-strong)', val: 'var(--g-color-text-muted)', word: 'بدونِ داده' },
};

function Tile({ icon: Icon, label, state, value, sub }) {
  const s = STATE[state] || STATE.nodata;
  const down = state === 'down';
  return (
    <Box style={{ background: 'var(--g-color-bg-surface)', border: `1px solid ${down ? s.dot : 'var(--g-color-border-subtle)'}`, borderRadius: '14px', padding: '12px 14px', ...(state === 'nodata' ? { borderStyle: 'dashed' } : {}) }}>
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minInlineSize: 0 }}>
          {Icon ? <Icon size={14} stroke={1.7} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} /> : null}
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</Text>
        </Box>
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Box aria-hidden="true" style={{ inlineSize: 7, blockSize: 7, borderRadius: '50%', background: s.dot }} />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10px', color: s.dot, fontWeight: 600 }}>{s.word}</Text>
        </Box>
      </Box>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '20px', fontWeight: 700, color: s.val, marginBlockStart: 6, lineHeight: 1.1 }}>{value}</Text>
      {sub ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', marginBlockStart: 3 }}>{sub}</Text> : null}
    </Box>
  );
}

export default function PulseStrip() {
  const health = useQuery({ queryKey: ['admin', 'pulse', 'health'], queryFn: () => get('/admin/ops/health'), refetchInterval: 30000 });
  const safety = useQuery({ queryKey: ['admin', 'pulse', 'safety'], queryFn: () => get('/admin/ops/safety-compliance'), refetchInterval: 30000 });
  const aiobs = useQuery({ queryKey: ['admin', 'pulse', 'aiobs'], queryFn: () => get('/admin/ops/ai-observability'), refetchInterval: 30000 });
  const stats = useQuery({ queryKey: ['admin', 'pulse', 'stats'], queryFn: () => get('/admin/analytics/stats'), refetchInterval: 15000 });
  const alerts = useQuery({ queryKey: ['admin', 'attention', 'alerts'], queryFn: () => get('/admin/workflows/alerts?status=open&limit=50'), refetchInterval: 20000 });

  const h = health.data || {}, s = safety.data || {}, o = aiobs.data || {}, st = stats.data || {}, al = alerts.data || {};
  const T = o.totals || {};
  const openAlerts = al.alerts || [];
  const criticals = openAlerts.filter((a) => a.severity === 'critical').length;
  const warnings = openAlerts.filter((a) => a.severity === 'warning').length;

  const allergy = s.allergySafety;
  const guards = s.guardCorpus;
  const eq = h.eventQuality;
  const eqReal = eq?.status === 'real';
  const aiReal = T.calls > 0;
  const p95 = T.latencyMsP95 ?? h.aiCalls?.latencyMsP95 ?? null;
  const fallback = T.fallbackRate ?? 0;
  const errCount = Object.values(o.byErrorCode || {}).reduce((n, x) => n + (x || 0), 0);
  const sysState = (health.isError && safety.isError) ? 'nodata' : criticals > 0 || (allergy && allergy.leaks > 0) ? 'down' : warnings > 0 ? 'degraded' : 'ok';

  const tiles = [
    { icon: IconActivity, label: 'وضعیتِ سیستم', state: sysState, value: STATE[sysState].word, sub: criticals ? `${toFaDigits(criticals)} بحرانی` : warnings ? `${toFaDigits(warnings)} هشدار` : 'بدونِ هشدار' },
    { icon: IconShieldHalf, label: 'نشتِ آلرژی', state: !allergy ? 'nodata' : allergy.leaks > 0 ? 'down' : 'ok', value: allergy ? toFaDigits(allergy.leaks ?? 0) : '—', sub: allergy ? (allergy.pass ? 'گاردِ سخت می‌گذراند' : 'بررسی') : 'در حالِ ارزیابی' },
    { icon: IconSparkles, label: 'سلامتِ چتِ AI', state: !aiReal ? 'nodata' : (fallback > 0.7 || errCount > 0) ? 'degraded' : 'ok', value: aiReal ? faPercent(fallback * 100) : '—', sub: aiReal ? `نرخِ fallback · ${toFaDigits(errCount)} خطا` : 'در انتظارِ فراخوان' },
    { icon: IconCoin, label: 'هزینهٔ AI امروز', state: T.totalCostUsd != null ? 'ok' : 'nodata', value: T.totalCostUsd != null ? '$' + toFaDigits(Math.round((T.totalCostUsd || 0) * 1e4) / 1e4) : '—', sub: T.totalCostUsd != null ? 'حداقلِ نرخ‌دار' : 'نرخِ تأییدشده نیست' },
    { icon: IconChartBar, label: 'ترافیکِ امروز', state: st.todayEvents > 0 ? 'ok' : 'nodata', value: st.todayEvents != null ? toFaDigits(st.todayEvents) : '—', sub: 'رویدادِ امروز' },
    { icon: IconDatabase, label: 'کیفیتِ خطِ‌داده', state: !eqReal ? 'nodata' : (eq.wellFormedRate != null && eq.wellFormedRate < 0.9) ? 'degraded' : 'ok', value: eqReal && eq.wellFormedRate != null ? faPercent(eq.wellFormedRate * 100) : '—', sub: 'رویدادِ معتبر' },
    { icon: IconShieldCheck, label: 'گاردهای ایمنی', state: guards ? 'ok' : 'nodata', value: guards ? toFaDigits(guards.blockedCases ?? 0) : '—', sub: guards ? `از ${toFaDigits(guards.casesEvaluated ?? 0)} موردِ پیکره` : 'در حالِ آماده‌سازی' },
    { icon: IconBolt, label: 'بحرانی‌های باز', state: criticals > 0 ? 'down' : warnings > 0 ? 'degraded' : 'ok', value: toFaDigits(al.openCount ?? openAlerts.length ?? 0), sub: criticals ? `${toFaDigits(criticals)} بحرانی` : 'صفِ توجه' },
    { icon: IconClock, label: 'تأخیرِ p۹۵', state: !aiReal ? 'nodata' : (p95 != null && p95 > 12000) ? 'degraded' : 'ok', value: aiReal && p95 != null ? `${toFaDigits(p95)}ms` : '—', sub: aiReal ? (h.aiCalls?.latencyMsP50 != null ? `p۵۰ ${toFaDigits(h.aiCalls.latencyMsP50)}ms` : 'زمانِ پاسخ') : 'در انتظار' },
  ];

  return (
    <Box style={grid(150)}>
      {tiles.map((t, i) => <Tile key={i} {...t} />)}
    </Box>
  );
}
