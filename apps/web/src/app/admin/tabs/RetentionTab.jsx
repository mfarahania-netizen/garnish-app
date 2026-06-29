// «ماندگاری» — cohort retention heatmap + behavioral consistency/churn-risk. §4.
// Math is real; over the current TEST users until the pilot — flagged honestly.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconUsers, IconActivity, IconAlertTriangle, IconHeartbeat } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, Panel, Note, Awaiting, grid, toFaDigits, fmtInt, fmtPct01, faPercent } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const FREQ_FA = { daily: 'روزانه', weekly: 'هفتگی', occasional: 'گاه‌به‌گاه', rare: 'به‌ندرت', inactive: 'غیرفعال' };
const riskColor = (r) => (r >= 66 ? 'var(--g-color-state-danger-fg, #c0392b)' : r >= 33 ? 'var(--g-color-state-warning-fg, #c0801c)' : 'var(--g-color-text-secondary)');

function Cell({ val }) {
  const v = typeof val === 'number' ? val : 0;
  return (
    <Box style={{ position: 'relative', borderRadius: 6, padding: '6px 0', textAlign: 'center', overflow: 'hidden', minInlineSize: 46 }}>
      <Box aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--g-color-brand-500)', opacity: Math.max(0.05, v) }} />
      <Text component="span" style={{ position: 'relative', fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', fontWeight: 500, color: v > 0.5 ? 'var(--g-color-text-inverse, #fff)' : 'var(--g-color-text-primary)' }}>{faPercent(Math.round(v * 100))}</Text>
    </Box>
  );
}

export default function RetentionTab() {
  const cohorts = useQuery({ queryKey: ['admin', 'cohorts'], queryFn: () => get('/admin/analytics/cohorts') });
  const profiles = useQuery({ queryKey: ['admin', 'behavior-profiles'], queryFn: () => get('/admin/analytics/behavior-profiles') });

  if (cohorts.isLoading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 60 }}><Loader color="var(--g-color-brand-600)" /></Box>;

  const c = cohorts.data || {};
  const p = profiles.data || {};
  const periods = c.periods || [1, 2, 4];
  const rows = c.cohorts || [];
  // The per-user churn-risk list — previously fetched then dropped (only the count rendered). Surface the actual
  // at-risk users (highest risk first) so the operator can target re-engagement. Names are admin-scoped; phone
  // arrives already masked from the backend.
  const atRisk = [...(p.profiles || [])].filter((x) => typeof x.churnRiskScore === 'number').sort((a, b) => b.churnRiskScore - a.churnRiskScore).slice(0, 10);

  return (
    <>
      <Note tone="warn" icon={IconAlertTriangle}>
        ماندگاری روی <Text component="span" style={{ fontWeight: 600 }}>کاربرانِ تستیِ فعلی</Text> محاسبه می‌شود — ریاضی درست است و با ورود کاربرِ واقعی همین جدول خودکار پر می‌شود.
      </Note>

      <Box style={grid(184)}>
        <Kpi icon={IconUsers} label="کل کاربرانِ کوهورت" status={c.status === 'real' ? 'real' : 'awaiting_pilot'} value={fmtInt(c.totalUsers)} sub={`${toFaDigits(rows.length)} کوهورتِ هفتگی`} awaitNote="در انتظار ثبت‌نام واقعی" />
        <Kpi icon={IconHeartbeat} label="میانگین ثبات" status={typeof p.avgConsistency === 'number' && p.avgConsistency > 0 ? 'real' : 'awaiting_pilot'} value={typeof p.avgConsistency === 'number' ? faPercent(Math.round(p.avgConsistency)) : '—'} sub="هرچه بالاتر، عادتِ قوی‌تر" awaitNote="در انتظار رفتار واقعی" />
        <Kpi icon={IconActivity} label="میانگین ریسکِ ریزش" status={typeof p.avgChurnRisk === 'number' && p.avgChurnRisk > 0 ? 'real' : 'awaiting_pilot'} value={typeof p.avgChurnRisk === 'number' ? faPercent(Math.round(p.avgChurnRisk)) : '—'} sub="هرچه پایین‌تر، بهتر" tone={p.avgChurnRisk > 50 ? 'warn' : undefined} awaitNote="در انتظار رفتار واقعی" />
        <Kpi icon={IconUsers} label="پروفایلِ رفتاری" status={(p.totalProfiles ?? p.profiles?.length ?? 0) > 0 ? 'real' : 'awaiting_pilot'} value={fmtInt(p.totalProfiles ?? p.profiles?.length)} sub="کاربرانِ دارای مدلِ ذائقه" awaitNote="—" />
      </Box>

      <Section title="نقشهٔ حرارتیِ ماندگاری" sub="درصدِ بازگشتِ هر کوهورت در هفته‌های بعد" />
      <Panel status={c.status === 'real' ? 'real' : 'awaiting_pilot'}>
        {rows.length ? (
          <Box style={{ overflowX: 'auto' }}>
            <Box style={{ display: 'grid', gridTemplateColumns: `minmax(96px,1.2fr) repeat(${periods.length}, minmax(46px,1fr))`, gap: 6, alignItems: 'center' }}>
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}>کوهورت</Text>
              {periods.map((pr) => <Text key={pr} component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', textAlign: 'center' }}>هفتهٔ {toFaDigits(pr)}</Text>)}
              {rows.slice(0, 12).map((r) => (
                <Box key={r.cohortWeek} style={{ display: 'contents' }}>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-secondary)' }}>{r.cohortWeek} · {toFaDigits(r.size)}</Text>
                  {periods.map((pr) => <Cell key={pr} val={r.retention?.[`W${pr}`]} />)}
                </Box>
              ))}
            </Box>
          </Box>
        ) : <Awaiting note={c.note || 'هنوز کوهورتی برای محاسبه نیست.'} />}
      </Panel>

      <Section title="کاربرانِ در ریسکِ ریزش" sub="مرتب بر اساسِ ریسک — بالاترین در صدر؛ فهرستِ هدفِ مداخله" />
      <Panel status={atRisk.length ? 'real' : 'awaiting_pilot'}>
        {atRisk.length ? atRisk.map((u) => (
          <Box key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 9, borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
            <Box style={{ flex: 1, minInlineSize: 0 }}>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 500, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.user?.name || 'کاربرِ بی‌نام'}</Text>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', marginBlockStart: 1 }}>{FREQ_FA[u.cookingFrequency] || u.cookingFrequency || '—'} · ثبات {u.consistencyScore != null ? faPercent(Math.round(u.consistencyScore)) : '—'}</Text>
            </Box>
            <Box style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', fontWeight: 600, color: riskColor(u.churnRiskScore), background: 'var(--g-color-bg-canvas)', borderRadius: '7px', paddingInline: 9, paddingBlock: 4, flexShrink: 0 }}>ریسک {faPercent(Math.round(u.churnRiskScore))}</Box>
          </Box>
        )) : <Awaiting note="پروفایلی برای نمایش نیست." />}
      </Panel>
    </>
  );
}
