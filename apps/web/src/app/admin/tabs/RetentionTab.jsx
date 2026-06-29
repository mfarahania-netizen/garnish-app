// «ماندگاری» — cohort retention heatmap + behavioral consistency/churn-risk. §4.
// Math is real; over the current TEST users until the pilot — flagged honestly.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconUsers, IconActivity, IconAlertTriangle, IconHeartbeat } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, Panel, Note, Awaiting, grid, toFaDigits, fmtInt, fmtPct01, faPercent } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);

function Cell({ val }) {
  const v = typeof val === 'number' ? val : 0;
  return (
    <Box style={{ position: 'relative', borderRadius: 6, padding: '6px 0', textAlign: 'center', overflow: 'hidden', minInlineSize: 46 }}>
      <Box aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--g-color-brand-500)', opacity: Math.max(0.05, v) }} />
      <Text component="span" style={{ position: 'relative', fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', fontWeight: 500, color: v > 0.5 ? '#fff' : 'var(--g-color-text-primary)' }}>{faPercent(Math.round(v * 100))}</Text>
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
    </>
  );
}
