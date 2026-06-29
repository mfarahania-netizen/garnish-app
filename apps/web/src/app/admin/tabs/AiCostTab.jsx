// «هوش مصنوعی» — the strongest REAL panel + the most precise (founder: must never mislead). Tokens, $cost
// (rated-only, labelled as such), latency p50/p95/p99, model-mix donut + fallback visibility, 429/errors,
// intent — all from the real AICallLog ledger. Catalog §9/§8.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  IconCoin, IconUsers, IconClock, IconDatabase, IconAlertTriangle,
  IconSparkles, IconStack2, IconRouteAltLeft, IconWallet,
} from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, HBar, Panel, Note, Awaiting, ErrorState, Table, Donut, Legend, grid, fmtInt, fmtCompact, fmtUsd, fmtSec, fmtPct01, toFaDigits } from '../_ui';

const q = (key, url) => ({ queryKey: ['admin', key], queryFn: () => apiClient.get(url).then((r) => r.data) });
const modelName = (k) => (k === 'unknown' ? 'نامشخص (ثبت‌نشده)' : k);
const provLabel = (k) => (String(k).startsWith('fallback(') ? `زنجیرهٔ fallback · ${(String(k).match(/>/g) || []).length + 1} مدل` : k);

export default function AiCostTab() {
  const obs = useQuery(q('ai-observability', '/admin/ops/ai-observability'));
  const ai = useQuery(q('ai-interaction', '/admin/analytics/ai-interaction'));

  if (obs.isLoading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 60 }}><Loader color="var(--g-color-brand-600)" /></Box>;
  if (obs.isError) return <Box style={{ paddingBlock: 60 }}><ErrorState note="رصدِ هوش مصنوعی از سرور خوانده نشد — این «خطا» است، نه «در انتظار»." onRetry={() => obs.refetch()} /></Box>;

  const o = obs.data || {};
  const T = o.totals || {};
  const real = o.status === 'real';
  const a = ai.data || {};

  const modelRows = (o.byModel || []).map((m) => ({ ...m, _key: m.key, name: modelName(m.key) }));
  const providerRows = o.byProvider || [];
  const intentRows = (o.byIntent || []).filter((m) => m.key !== 'unknown');
  const errorEntries = Object.entries(o.byErrorCode || {}).sort((x, y) => y[1] - x[1]);
  const donutData = modelRows.map((m) => ({ name: m.name, value: m.calls }));

  const aggCols = [
    { key: 'name', label: 'مدل' },
    { key: 'calls', label: 'فراخوان', align: 'center', render: (r) => toFaDigits(r.calls) },
    { key: 'share', label: 'سهم', align: 'center', render: (r) => fmtPct01(r.share) },
    { key: 'tokens', label: 'توکن', align: 'center', render: (r) => fmtCompact(r.tokens) },
    { key: 'cost', label: 'هزینه', align: 'center', render: (r) => (r.cost != null ? fmtUsd(r.cost) : 'رایگان') },
    { key: 'p95', label: 'p۹۵', align: 'center', render: (r) => fmtSec(r.latencyMsP95) },
  ];

  return (
    <>
      <Section title="هزینه و مصرف هوش مصنوعی" sub="از دفترِ واقعیِ فراخوان‌های مدل (AICallLog) · ۳۰ روز" />
      <Note tone="brand">
        <Text component="span" style={{ fontWeight: 600 }}>دفترِ واقعی</Text> — {toFaDigits(T.calls ?? 0)} فراخوانِ واقعیِ مدل{T.stubCalls ? ` (+${toFaDigits(T.stubCalls)} ردیفِ stubِ قدیمی، جدا)` : ''}. اعداد تخمینِ حسابداری‌اند، نه صورتحساب.
      </Note>

      <Box style={grid(184)}>
        <Kpi icon={IconStack2} label="کل توکن" status={real ? 'real' : 'awaiting_pilot'} value={fmtCompact(T.tokens)} sub={`${toFaDigits(T.avgTokensPerCall ?? 0)} میانگین/فراخوان`} awaitNote="در انتظار فراخوان واقعی" />
        <Kpi icon={IconCoin} label="هزینهٔ نرخ‌دار (حداقل)" status={T.totalCostUsd != null ? 'partial' : 'awaiting_rates'} value={fmtUsd(T.totalCostUsd)} sub={`فقط ${fmtPct01(T.ratedCallShare)} فراخوان نرخ دارد`} awaitNote="نرخِ تأییدشده برای مدل‌ها نیست" />
        <Kpi icon={IconWallet} label="هزینه/کاربرِ نرخ‌دار" status={T.costPerUserUsd != null ? 'partial' : 'awaiting_rates'} value={fmtUsd(T.costPerUserUsd)} sub={`بر ${toFaDigits(T.ratedUsers ?? 0)} کاربرِ نرخ‌دار`} awaitNote="—" />
        <Kpi icon={IconUsers} label="کاربران فعال AI" status={real ? 'real' : 'awaiting_pilot'} value={toFaDigits(T.distinctUsers ?? 0)} sub="کاربرانِ یکتا در ۳۰ روز" awaitNote="در انتظار کاربر واقعی" />
        <Kpi icon={IconClock} label="تأخیر p۹۵" status={T.latencyMsP95 != null ? 'real' : 'awaiting_pilot'} value={fmtSec(T.latencyMsP95)} sub={`p۵۰ ${fmtSec(T.latencyMsP50)} · p۹۹ ${fmtSec(T.latencyMsP99)}`} tone={T.latencyMsP95 > 10000 ? 'warn' : undefined} awaitNote="در انتظار فراخوان موفق" />
        <Kpi icon={IconRouteAltLeft} label="نرخ fallback" status={real ? 'real' : 'awaiting_pilot'} value={fmtPct01(T.fallbackRate)} sub="نوبت‌های رد‌شده از زنجیرهٔ مدل" tone={T.fallbackRate > 0.5 ? 'warn' : undefined} awaitNote="—" />
      </Box>

      <Note tone="warn" icon={IconAlertTriangle}>
        <Text component="span" style={{ fontWeight: 600 }}>دربارهٔ هزینه:</Text> رقمِ دلاری فقط فراخوان‌های <Text component="span" style={{ fontWeight: 600 }}>نرخ‌دار</Text> (مدلِ gemini) را پوشش می‌دهد — یعنی {fmtPct01(T.ratedCallShare)} فراخوان‌ها و {fmtPct01(T.ratedTokenShare)} توکن‌ها. بقیه ({fmtPct01(1 - (T.ratedCallShare || 0))}) روی مدل‌های <Text component="span" style={{ fontWeight: 600 }}>رایگانِ</Text> OpenRouter بوده و نرخِ تأییدشده ندارد. پس این عدد «حداقلِ شناخته‌شده» است، نه کلِ هزینه.
      </Note>

      <Section title="سهم مدل‌ها" sub="کدام مدل چه‌قدر از نوبت‌ها را سرو کرده" />
      <Box style={grid(300)}>
        <Panel title="توزیع فراخوان بین مدل‌ها" status={real ? 'real' : 'awaiting_pilot'}>
          <Donut data={donutData} unit="" />
        </Panel>
        <Panel title="جزئیاتِ مدل" status={real ? 'real' : 'awaiting_pilot'}>
          {modelRows.length ? <Table columns={aggCols} rows={modelRows} /> : <Awaiting note="فراخوان واقعیِ مدل هنوز ثبت نشده." />}
        </Panel>
      </Box>

      <Section title="زنجیرهٔ تأمین‌کننده و خطاها" sub="اگر بیشترِ نوبت‌ها روی زنجیرهٔ fallback بنشیند، مدلِ اصلی عملاً خاموش است" />
      <Box style={grid(300)}>
        <Panel title="سهمِ هر تأمین‌کننده" status={real ? 'real' : 'awaiting_pilot'}>
          {providerRows.length ? providerRows.map((p) => <HBar key={p.key} label={provLabel(p.key)} value={p.calls} max={T.calls || 1} display={`${toFaDigits(p.calls)} · ${fmtPct01(p.share)}`} />) : <Awaiting note="—" />}
        </Panel>
        <Panel title="خطاها و محدودیت نرخ (۴۲۹)" status={errorEntries.length ? 'real' : 'awaiting_pilot'}>
          {errorEntries.length ? (
            errorEntries.map(([code, n]) => (
              <Box key={code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBlock: 6, borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
                <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconAlertTriangle size={13} stroke={1.8} style={{ color: 'var(--g-color-state-warning-fg, #c0801c)' }} /><Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px' }}>{code}</Text></Box>
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 600 }}>{toFaDigits(n)}</Text>
              </Box>
            ))
          ) : (
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--g-color-state-success-fg)', fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 500, marginBlockStart: 8 }}>بدون خطای ثبت‌شده ✓</Box>
          )}
        </Panel>
      </Box>

      <Section title="هدف و موضوعات کاربر" sub="intent هر فراخوان + پرتکرارترین مفاهیمِ پیام‌ها" />
      <Box style={grid(300)}>
        <Panel title="بر اساس هدف (intent)" status={intentRows.length ? 'real' : 'awaiting_pilot'} right={<IconRouteAltLeft size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
          {intentRows.length ? intentRows.map((p) => <HBar key={p.key} label={p.key} value={p.calls} max={T.calls || 1} display={toFaDigits(p.calls)} />) : <Awaiting note="intent روی فراخوان‌ها ثبت نشده." />}
        </Panel>
        <Panel title="موضوعاتِ پرتکرارِ کاربر" status={(a.topConcepts?.length || a.topIngredients?.length) ? 'real' : 'awaiting_pilot'} right={<IconSparkles size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
          {(a.topIngredients?.length || a.topConcepts?.length) ? (
            [...(a.topIngredients || []), ...(a.topConcepts || [])].slice(0, 8).map((it, idx) => <HBar key={`${it.name}-${idx}`} label={it.name} value={it.count} max={Math.max(1, ...(a.topIngredients || []).concat(a.topConcepts || []).map((x) => x.count))} display={toFaDigits(it.count)} />)
          ) : <Awaiting note={`${toFaDigits(a.totalMessages ?? 0)} پیام — موضوعی استخراج نشده`} />}
        </Panel>
      </Box>

      <Legend />
    </>
  );
}
