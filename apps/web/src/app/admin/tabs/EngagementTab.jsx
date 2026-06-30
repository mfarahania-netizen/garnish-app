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

// A compact 2-column Sankey for page→page flow: source pages on the RIGHT, destinations on the LEFT (RTL),
// band width ∝ transition count. Brand-tinted (data viz, not a state colour). Hover a band for the exact count.
function FlowSankey({ flow, label }) {
  const sources = {}, dests = {};
  flow.forEach((f) => { sources[f.from] = (sources[f.from] || 0) + f.count; dests[f.to] = (dests[f.to] || 0) + f.count; });
  const srcKeys = Object.keys(sources).sort((a, b) => sources[b] - sources[a]);
  const dstKeys = Object.keys(dests).sort((a, b) => dests[b] - dests[a]);
  const totalSrc = srcKeys.reduce((s, k) => s + sources[k], 0) || 1;
  const totalDst = dstKeys.reduce((s, k) => s + dests[k], 0) || 1;
  const W = 600, nodeW = 10, gapPx = 9, labelPad = 78;
  const rows = Math.max(srcKeys.length, dstKeys.length, 1), H = Math.max(150, rows * 42);
  const srcX = W - labelPad - nodeW, dstX = labelPad;
  const srcScale = (H - gapPx * (srcKeys.length - 1)) / totalSrc;
  const dstScale = (H - gapPx * (dstKeys.length - 1)) / totalDst;
  const srcNodes = {}; let sy = 0; srcKeys.forEach((k) => { const h = Math.max(4, sources[k] * srcScale); srcNodes[k] = { y: sy, h, off: 0 }; sy += h + gapPx; });
  const dstNodes = {}; let dy = 0; dstKeys.forEach((k) => { const h = Math.max(4, dests[k] * dstScale); dstNodes[k] = { y: dy, h, off: 0 }; dy += h + gapPx; });
  const bands = flow.map((f, i) => {
    const sn = srcNodes[f.from], dn = dstNodes[f.to];
    const sh = Math.max(2, f.count * srcScale), dh = Math.max(2, f.count * dstScale);
    const a = sn.y + sn.off; sn.off += sh;
    const b = dn.y + dn.off; dn.off += dh;
    const x0 = srcX, x1 = dstX + nodeW, mx = (x0 + x1) / 2;
    return { key: i, title: `${label(f.from)} ‹ ${label(f.to)} · ${f.count}`, d: `M${x0} ${a} C${mx} ${a},${mx} ${b},${x1} ${b} L${x1} ${b + dh} C${mx} ${b + dh},${mx} ${a + sh},${x0} ${a + sh} Z` };
  });
  const txt = { fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', fill: 'var(--g-color-text-secondary)' };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} role="img" aria-label="نمودارِ جریانِ صفحات">
      {bands.map((bd) => <path key={bd.key} d={bd.d} fill="var(--g-color-brand-400)" opacity="0.3"><title>{bd.title}</title></path>)}
      {srcKeys.map((k) => <rect key={'s' + k} x={srcX} y={srcNodes[k].y} width={nodeW} height={srcNodes[k].h} rx="2" fill="var(--g-color-brand-600)" />)}
      {dstKeys.map((k) => <rect key={'d' + k} x={dstX} y={dstNodes[k].y} width={nodeW} height={dstNodes[k].h} rx="2" fill="var(--g-color-brand-600)" />)}
      {srcKeys.map((k) => <text key={'sl' + k} x={srcX + nodeW + 6} y={srcNodes[k].y + srcNodes[k].h / 2 + 3.5} textAnchor="start" style={txt}>{label(k)}</text>)}
      {dstKeys.map((k) => <text key={'dl' + k} x={dstX - 6} y={dstNodes[k].y + dstNodes[k].h / 2 + 3.5} textAnchor="end" style={txt}>{label(k)}</text>)}
    </svg>
  );
}

export default function EngagementTab({ days = 30 }) {
  const trends = useQuery({ queryKey: ['admin', 'trends', days], queryFn: () => get('/admin/analytics/trends', { bucket: 'day', days }) });
  const funnels = useQuery({ queryKey: ['admin', 'funnels'], queryFn: () => get('/admin/analytics/funnels') });
  const pages = useQuery({ queryKey: ['admin', 'page-views'], queryFn: () => get('/admin/analytics/page-views') });
  const userStats = useQuery({ queryKey: ['admin', 'user-stats'], queryFn: () => get('/admin/analytics/user-stats') });
  const rec = useQuery({ queryKey: ['admin', 'rec-funnel'], queryFn: () => get('/admin/analytics/recommendation-funnel') });
  const sourceQ = useQuery({ queryKey: ['admin', 'add-source'], queryFn: () => get('/admin/analytics/add-source') });

  if (trends.isLoading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 60 }}><Loader color="var(--g-color-brand-600)" /></Box>;

  const u = userStats.data || {};
  const daily = (pages.data?.dailyViews || []).map((d) => ({ label: d.date.slice(5), value: d.count }));
  const topPages = pages.data?.topPages || [];
  const bottomPages = pages.data?.bottomPages || [];
  const flow = pages.data?.flow || [];
  const dwell = pages.data?.dwell || [];
  const clicks = pages.data?.clicks || [];
  const src = sourceQ.data || {};
  const PG = (p) => PAGE_FA[p] || p || '/';
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
          <HBar key={p.page} label={PG(p.page)} value={p.views} max={topPages[0]?.views || 1} display={toFaDigits(p.views)} />
        )) : <Awaiting note="بازدیدی ثبت نشده." />}
      </Panel>

      {bottomPages.length > 0 ? (
        <>
          <Section title="کم‌بازدیدترین صفحه‌ها" sub="کمترین بازدید — شاید گمشده یا کم‌اهمیت دیده می‌شوند" />
          <Panel status="real">
            {bottomPages.map((p) => <HBar key={p.page} label={PG(p.page)} value={p.views} max={bottomPages[0]?.views || 1} display={toFaDigits(p.views)} color="var(--g-color-text-muted)" />)}
          </Panel>
        </>
      ) : null}

      <Section title="مسیرِ کاربر — از کجا به کجا" sub="نمودارِ جریان: مبدأ سمتِ راست، مقصد سمتِ چپ، پهنای باند ∝ تعداد" />
      <Panel status={flow.length ? 'real' : 'awaiting_pilot'}>
        {flow.length ? (
          <>
            <FlowSankey flow={flow} label={PG} />
            <Box style={{ display: 'flex', justifyContent: 'space-between', marginBlockStart: 6, fontFamily: 'var(--g-font-fa)', fontSize: '10.5px', color: 'var(--g-color-text-muted)' }}>
              <span>مقصد</span><span>مبدأ</span>
            </Box>
          </>
        ) : <Awaiting note="هنوز جابه‌جاییِ صفحه‌ای ثبت نشده — با ناوبریِ کاربرِ واقعی پر می‌شود." />}
      </Panel>

      <Section title="زمانِ ماندن در هر صفحه" sub="میانهٔ ثانیه‌هایی که کاربر در هر صفحه می‌مانَد" />
      <Panel status={dwell.length ? 'real' : 'awaiting_pilot'}>
        {dwell.length ? dwell.map((d) => <HBar key={d.page} label={PG(d.page)} value={d.medianSec} max={dwell[0]?.medianSec || 1} display={`${toFaDigits(d.medianSec)} ثانیه`} color="var(--g-color-brand-400)" />) : <Awaiting note="هنوز زمانِ ماندنی ثبت نشده — با گشت‌وگذارِ کاربر پر می‌شود." />}
      </Panel>

      <Section title="کلیک در هر صفحه" sub="کدام صفحه بیشترین تعاملِ کلیکی را دارد" />
      <Panel status={clicks.length ? 'real' : 'awaiting_pilot'}>
        {clicks.length ? clicks.map((c) => <HBar key={c.page} label={PG(c.page)} value={c.total} max={clicks[0]?.total || 1} display={`${toFaDigits(c.total)} · میانگین ${toFaDigits(c.avgPerVisit)}`} />) : <Awaiting note="هنوز کلیکی ثبت نشده." />}
      </Panel>

      <Section title="منبعِ افزودن به لیستِ خرید" sub="دستی یا از روی برنامهٔ غذایی؟" />
      <Panel status={src.status === 'real' ? 'real' : 'awaiting_pilot'}>
        {src.status === 'real' ? (
          <>
            <HBar label="دستی" value={src.shopping?.manual || 0} max={src.shopping?.total || 1} display={toFaDigits(src.shopping?.manual || 0)} />
            <HBar label="از روی برنامه" value={src.shopping?.fromPlan || 0} max={src.shopping?.total || 1} display={toFaDigits(src.shopping?.fromPlan || 0)} color="var(--g-color-brand-400)" />
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', marginBlockStart: 6 }}>{src.shopping?.manualRate != null ? `${fmtPct01(src.shopping.manualRate)} دستی` : '—'} · افزودنِ دستیار جدا ثبت نمی‌شود (به‌زودی)</Text>
          </>
        ) : <Awaiting note="هنوز چیزی به لیستِ خرید اضافه نشده." />}
      </Panel>
    </>
  );
}
