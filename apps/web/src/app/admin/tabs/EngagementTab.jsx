// «درگیری و قیف» — activity trend (real chart) + onboarding/cook funnels + top pages. §3/§5.
// Activity counts run over the current TEST users until the pilot — flagged honestly. Funnels are real math.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconUsers, IconUserPlus, IconCalendarWeek, IconActivity, IconAlertTriangle, IconEye, IconPointer, IconFlame, IconThumbDown } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, HBar, Panel, Note, Awaiting, TrendChart, grid, toFaDigits, fmtInt, fmtPct01 } from '../_ui';

const get = (url, params) => apiClient.get(url, params ? { params } : undefined).then((r) => r.data);
// Persian labels for the app's routes — so "top pages" reads «خانه/کشف/برنامه» not «/discover».
const PAGE_FA = {
  '/': 'خانه', '/discover': 'کشف', '/recipes': 'رسپی‌ها', '/recipe': 'صفحهٔ رسپی', '/plan': 'برنامهٔ غذایی',
  '/shopping-list': 'لیست خرید', '/favorites': 'علاقه‌مندی‌ها', '/assistant': 'دستیار', '/profile': 'پروفایل',
  '/food-dna': 'شناسهٔ ذائقه', '/cook': 'حالت پخت', '/settings': 'تنظیمات', '/notifications': 'اعلان‌ها',
  '/achievements': 'دستاوردها', '/support': 'پشتیبانی', '/onboarding': 'ورود اولیه', '/login': 'ورود',
};

export default function EngagementTab({ days = 30 }) {
  const trends = useQuery({ queryKey: ['admin', 'trends', days], queryFn: () => get('/admin/analytics/trends', { bucket: 'day', days }) });
  const funnels = useQuery({ queryKey: ['admin', 'funnels'], queryFn: () => get('/admin/analytics/funnels') });
  const pages = useQuery({ queryKey: ['admin', 'page-views'], queryFn: () => get('/admin/analytics/page-views') });
  const userStats = useQuery({ queryKey: ['admin', 'user-stats'], queryFn: () => get('/admin/analytics/user-stats') });
  const rec = useQuery({ queryKey: ['admin', 'rec-funnel'], queryFn: () => get('/admin/analytics/recommendation-funnel') });

  if (trends.isLoading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 60 }}><Loader color="var(--g-color-brand-600)" /></Box>;

  const u = userStats.data || {};
  const daily = (pages.data?.dailyViews || []).map((d) => ({ label: d.date.slice(5), value: d.count }));
  const topPages = pages.data?.topPages || [];
  const fnls = funnels.data?.funnels || [];
  const funnelName = (n) => (n === 'onboarding' ? 'قیفِ ورود (onboarding)' : n === 'cook' ? 'قیفِ پخت' : n);
  const rf = rec.data || {};
  const recLow = rf.status === 'real' && rf.impressions > 0 && rf.impressions < 30;

  return (
    <>
      <Note tone="warn" icon={IconAlertTriangle}>
        اعدادِ کاربر و فعالیت روی <Text component="span" style={{ fontWeight: 600 }}>کاربرانِ تستیِ فعلی</Text> محاسبه شده‌اند — واقعی‌اند ولی تا پایلوت معنادار نیستند. ریاضیِ قیف‌ها درست است و با کاربرِ واقعی خودکار پر می‌شود.
      </Note>

      <Box style={grid(184)}>
        <Kpi icon={IconUsers} label="کل کاربران" status="real" value={fmtInt(u.totalUsers)} sub="ثبت‌شده (شاملِ تستی)" />
        <Kpi icon={IconCalendarWeek} label="کاربرانِ هفتهٔ اخیر" status="real" value={fmtInt(u.weekUsers)} sub="۷ روز گذشته" />
        <Kpi icon={IconUserPlus} label="کاربرانِ امروز" status="real" value={fmtInt(u.todayUsers)} sub="از نیمه‌شب" />
        <Kpi icon={IconActivity} label="کل رویداد" status={trends.data?.status === 'real' ? 'real' : 'awaiting_pilot'} value={fmtInt(trends.data?.totalEvents)} sub={`در ${toFaDigits(days)} روز`} awaitNote="در انتظار رویداد واقعی" />
      </Box>

      <Section title="روندِ بازدیدِ روزانه" sub="رویدادهای page_view در طول زمان" />
      <Panel status={daily.length ? 'real' : 'awaiting_pilot'}>
        <TrendChart data={daily} height={170} />
      </Panel>

      <Section title="قیف‌های تبدیل" sub="چند کاربر از هر مرحله به بعدی می‌رسند" />
      <Box style={grid(300)}>
        {fnls.length ? fnls.map((f) => {
          // n-count honesty gate: a conversion % computed from a handful of users is noise, not a trend. Flag it
          // rather than letting a 1-of-2 = «۵۰٪» read like a stable rate. Threshold ~30 (statistical stability).
          const entryN = f.stages?.[0]?.count || 0;
          const lowSample = f.status === 'real' && entryN > 0 && entryN < 30;
          return (
            <Panel key={f.name} title={funnelName(f.name)} status={f.status} sub={f.status === 'real' ? `تبدیل کل: ${fmtPct01(f.overallConversion)}${lowSample ? ' · نمونهٔ کوچک' : ''}` : undefined}>
              {f.status === 'real' ? (
                <>
                  {lowSample ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-state-warning-fg, #c0801c)', marginBlockEnd: 4 }}>نمونهٔ کوچک ({toFaDigits(entryN)} کاربر) — درصدها هنوز آماری پایدار نیستند.</Text> : null}
                  {f.stages.map((s) => (
                    <HBar key={s.key} label={s.label} value={s.count} max={f.stages[0]?.count || 1} display={`${toFaDigits(s.count)}${s.dropOffFromPrev != null ? ` · افت ${fmtPct01(s.dropOffFromPrev)}` : ''}`} />
                  ))}
                </>
              ) : <Awaiting note="هنوز کسی واردِ این قیف نشده." />}
            </Panel>
          );
        }) : <Awaiting note="قیفی در دسترس نیست." />}
      </Box>

      <Section title="موتورِ پیشنهادِ صفحهٔ اصلی" sub="کیفیتِ پیشنهادها — چند درصد کلیک، پخت یا رد می‌شوند" />
      <Box style={grid(184)}>
        <Kpi icon={IconEye} label="نمایشِ پیشنهاد" status={rf.status === 'real' ? 'real' : 'awaiting_pilot'} value={fmtInt(rf.impressions)} sub="کلِ دفعاتِ نشان‌داده‌شده" awaitNote="در انتظار نمایش" />
        <Kpi icon={IconPointer} label="نرخِ کلیک (CTR)" status={rf.ctr != null ? 'real' : 'awaiting_pilot'} value={rf.ctr != null ? fmtPct01(rf.ctr) : '—'} sub={`${toFaDigits(rf.clicks ?? 0)} کلیک`} awaitNote="—" />
        <Kpi icon={IconFlame} label="نرخِ پخت" status={rf.cookRate != null ? 'real' : 'awaiting_pilot'} value={rf.cookRate != null ? fmtPct01(rf.cookRate) : '—'} sub={`${toFaDigits(rf.cooks ?? 0)} پخت`} awaitNote="—" />
        <Kpi icon={IconThumbDown} label="نرخِ رد" status={rf.dismissRate != null ? 'real' : 'awaiting_pilot'} value={rf.dismissRate != null ? fmtPct01(rf.dismissRate) : '—'} sub={`${toFaDigits(rf.dismisses ?? 0)} «علاقه ندارم»`} tone={rf.dismissRate > 0.3 ? 'warn' : undefined} awaitNote="—" />
      </Box>
      <Panel status={rf.status === 'real' ? 'real' : 'awaiting_pilot'}>
        {rf.status === 'real' ? (
          <>
            {recLow ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-state-warning-fg, #c0801c)', marginBlockEnd: 6 }}>نمونهٔ کوچک ({toFaDigits(rf.impressions)} نمایش) — نرخ‌ها هنوز آماری پایدار نیستند.</Text> : null}
            <HBar label="نمایش" value={rf.impressions} max={rf.impressions || 1} display={toFaDigits(rf.impressions)} />
            <HBar label="کلیک" value={rf.clicks} max={rf.impressions || 1} display={toFaDigits(rf.clicks)} color="var(--g-color-brand-400)" />
            <HBar label="پخت" value={rf.cooks} max={rf.impressions || 1} display={toFaDigits(rf.cooks)} color="var(--g-color-state-success-fg, #2e7d4f)" />
          </>
        ) : <Awaiting note="هنوز پیشنهادی نمایش داده نشده." />}
      </Panel>

      <Section title="پربازدیدترین صفحه‌ها" sub="بر اساس رویدادهای page_view" />
      <Panel status={topPages.length ? 'real' : 'awaiting_pilot'}>
        {topPages.length ? topPages.slice(0, 8).map((p) => (
          <HBar key={p.page} label={PAGE_FA[p.page] || p.page || '/'} value={p.views} max={topPages[0]?.views || 1} display={toFaDigits(p.views)} />
        )) : <Awaiting note="بازدیدی ثبت نشده." />}
      </Panel>
    </>
  );
}
