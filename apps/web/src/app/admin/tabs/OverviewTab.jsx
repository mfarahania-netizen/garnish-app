// «نمای کلی» — the landing tab. Growth + pre-pilot readiness + safety/compliance evidence + DNA/recsys.
// Honest discipline: real numbers only when status==='real'; otherwise an awaiting state. Safety evidence is
// deterministic (real guard runs over the fixture corpus) so it's investor-grade even pre-pilot.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  IconUsers, IconToolsKitchen2, IconSearch, IconSparkles, IconShieldCheck,
  IconCircleCheck, IconAlertTriangle, IconBulb,
} from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { useOverviewData } from '../useAdmin';
import AttentionQueue from '../AttentionQueue';
import PulseStrip from '../PulseStrip';
import DailyBrief from '../DailyBrief';
import { Section, Kpi, HBar, Panel, Note, Awaiting, ErrorState, grid, CARD, toFaDigits } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const IMP = { high: 'var(--g-color-state-danger-fg, #c0392b)', medium: 'var(--g-color-state-warning-fg, #c0801c)', low: 'var(--g-color-text-secondary)' };

const GUARD_FA = { ai_safety: 'ایمنی هوش مصنوعی', prompt_injection: 'تزریق پرامپت', nutrition_claim: 'ادعای تغذیه‌ای' };
const BAND_FA = { empty: 'تازه', forming: 'در حال شکل‌گیری', developing: 'در حال رشد', mature: 'پخته' };
const RECSYS_FA = { catalogCoverage: 'پوشش کاتالوگ', coverage: 'پوشش', diversity: 'تنوع', fitQuality: 'کیفیت تناسب', quality: 'کیفیت', popularityBias: 'سوگیری محبوبیت' };
const recsysRows = (offline) => Object.entries(offline || {}).filter(([, m]) => m && typeof m.value === 'number');
const st = (real) => (real ? 'real' : 'awaiting_pilot');

const OVERVIEW_SOURCE_FA = {
  'ops-health': 'سلامت عملیات (/admin/ops/health)',
  'safety-compliance': 'ایمنی و انطباق (/admin/ops/safety-compliance)',
  'user-stats': 'آمار کاربران (/admin/analytics/user-stats)',
  'activity-trends': 'روند فعالیت (/admin/analytics/trends)',
  'product-intelligence': 'هوشمندی محصول (/admin/analytics/product-intelligence)',
};

export function describeOverviewFailures(sourceIds = []) {
  const sources = sourceIds.map((id) => OVERVIEW_SOURCE_FA[id] || id);
  return `منابع زیر از سرور خوانده نشدند: ${sources.join('، ')}. تا بازیابی این منبع‌ها، اعداد این نما قابل اتکا نیستند.`;
}

export default function OverviewTab({ days = 30 }) {
  const { d, loading, error, failedSourceIds, retry, refreshedAt } = useOverviewData(days);
  // Pulse: what needs ATTENTION first — the unified Attention Queue (alerts + tickets) + the top things to improve.
  const behaviorQ = useQuery({ queryKey: ['admin', 'behavior'], queryFn: () => get('/admin/insights/behavior'), refetchInterval: 30000 });
  const improve = (behaviorQ.data?.improve || []).slice(0, 4);

  if (loading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 'var(--g-space-8)' }}><Loader color="var(--g-color-brand-600)" /></Box>;
  // HONESTY (P0-3): the core ops feeds failed → say so. A dead backend must NEVER render as the green "all healthy" board.
  if (error) return <Box style={{ paddingBlock: 'var(--g-space-6)' }}><ErrorState note={describeOverviewFailures(failedSourceIds)} onRetry={retry} /></Box>;

  return (
    <>
      {/* ── SYSTEM PULSE: the ≤9-tile black-box glance (P0-1) ── */}
      <Section title="نبضِ سیستم" sub="در یک نگاه: همه‌چیز سالم است یا دقیقاً چه خراب است؟">
        <PulseStrip />
      </Section>

      {/* ── DAILY BRIEF: the deterministic analyst, in plain words ── */}
      <Section title="بریفِ امروز" sub="چه می‌گذرد و چه باید کرد — قواعدِ قطعی روی متریکِ زنده">
        <DailyBrief />
      </Section>

      {/* ── ATTENTION QUEUE + what to improve ── */}
      <Section title="وضعیتِ امروز" sub="در ۳۰ ثانیه: چیزی خراب است؟ چه کنم؟">
        <AttentionQueue />

        {improve.length > 0 ? (
          <Box style={{ ...CARD, marginBlockStart: 10 }}>
            <Box style={{ display: 'flex', alignItems: 'center', gap: 6, marginBlockEnd: 9 }}>
              <IconBulb size={15} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>کارهای بهبود</Text>
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}>· جزئیات در تبِ «رفتار و بهبود»</Text>
            </Box>
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {improve.map((it) => (
                <Box key={it.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--g-color-border-subtle)', borderRadius: '9px', paddingInline: 10, paddingBlock: 6 }}>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '14px', fontWeight: 700, color: IMP[it.severity] || IMP.low }}>{toFaDigits(it.count)}</Text>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-secondary)' }}>{it.title}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}
      </Section>

      <Note tone="info" icon={IconAlertTriangle}>
        منبع: snapshot جدول User برای شمارشِ حساب‌ها؛ UserEvent برای فعالیتِ <Text component="span" style={{ fontWeight: 700 }}>{toFaDigits(days)} روز اخیر</Text>؛ ops برای سلامت؛ و پیکرهٔ fixture برای گاردهای ایمنی. قدیمی‌ترین دریافتِ این نما: {refreshedAt ? new Date(refreshedAt).toLocaleString('fa-IR') : 'نامعلوم'}.
      </Note>
      <Section title="رشد و فعالیت">
        <Box style={grid(190)}>
          <Kpi icon={IconUsers} label="کاربرانِ ثبت‌شده" status={st(d.growth.registered.real)} value={toFaDigits(d.growth.registered.value)} sub={`${toFaDigits(d.growth.guests.value)} مهمان · ${toFaDigits(d.growth.total.value)} کل`} awaitNote="شمارش User در دسترس نیست" />
          <Kpi icon={IconToolsKitchen2} label="پخت" status={st(d.growth.cooks.real)} value={toFaDigits(d.growth.cooks.value)} sub={`در ${toFaDigits(days)} روز`} awaitNote="در انتظار پخت واقعی" />
          <Kpi icon={IconSearch} label="جستجو" status={st(d.growth.searches.real)} value={toFaDigits(d.growth.searches.value)} sub={`در ${toFaDigits(days)} روز`} awaitNote="در انتظار جستجوی واقعی" />
          <Kpi icon={IconSparkles} label="استفاده از هوش مصنوعی" status={st(d.growth.ai.real)} value={toFaDigits(d.growth.ai.value)} sub={`در ${toFaDigits(days)} روز`} awaitNote="در انتظار کاربر واقعی" />
        </Box>
      </Section>

      <Section title="دامنهٔ شواهد">
        <Note tone="info">این نما وضعیتِ داده و عملیات را گزارش می‌کند؛ نتیجهٔ سبزِ یک fixture یا نبودِ هشدار، به‌تنهایی تأییدِ آمادگیِ لانچ نیست. تصمیم لانچ به شواهد مرورگر، مسیرهای کاربر و gateهای انتشار جداگانه نیاز دارد.</Note>
      </Section>

      <Section title="ایمنی و انطباق">
        <Note tone="brand"><Text component="span" style={{ fontWeight: 700 }}>شواهد واقعی</Text> — نه دادهٔ ساختگی. اعداد از اجرای واقعیِ گاردها روی پیکرهٔ تست‌اند.</Note>
        <Box style={grid(280)}>
          <Panel title="شلیک گاردها" sub={`${toFaDigits(d.guards.blocked)} مورد مسدود · روی ${toFaDigits(d.guards.cases)} موردِ پیکره`}>
            {Object.entries(d.guards.byGuard).map(([k, v]) => <HBar key={k} label={GUARD_FA[k] || k} value={v} max={d.guards.cases || 1} />)}
          </Panel>
          <Panel title="فیلتر سخت آلرژن">
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: d.allergen?.pass ? 'var(--g-color-state-success-bg)' : 'var(--g-color-state-info-bg)', color: d.allergen?.pass ? 'var(--g-color-state-success-fg)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
              {d.allergen?.pass ? <IconCircleCheck size={13} stroke={1.8} aria-hidden="true" /> : <IconAlertTriangle size={13} stroke={1.8} aria-hidden="true" />}{d.allergen?.indicator || (d.allergen?.pass ? 'گذراند' : 'در حال ارزیابی')}
            </Box>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)', marginBlockStart: 'var(--g-space-4)' }}>ارسال اعلان</Text>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>{d.notif?.realSendEnabled ? 'ارسال واقعی فعال' : 'DRY-RUN — ارسال واقعی خاموش است، فقط شبیه‌سازی.'}</Text>
          </Panel>
        </Box>
      </Section>

      <Box style={grid(280)}>
        <Box>
          <Section title="توزیع باند DNA غذایی">
            <Panel>
              {d.foodDna.real ? (
                Object.entries(d.foodDna.bands).map(([k, v]) => <HBar key={k} label={BAND_FA[k] || k} value={v} max={d.foodDna.sampled || 1} />)
              ) : <Awaiting note="با ورود کاربران واقعی نمایش داده می‌شود." />}
            </Panel>
          </Section>
        </Box>
        <Box>
          <Section title="کیفیت پیشنهادگر">
            <Panel>
              {recsysRows(d.recsys.offline).length ? (
                recsysRows(d.recsys.offline).slice(0, 5).map(([k, m]) => <HBar key={k} label={RECSYS_FA[k] || k} value={Math.round(m.value * 100)} max={100} suffix="٪" />)
              ) : <Awaiting note="از هارنس ارزیابی recsys · در حال آماده‌سازی" />}
              {d.recsys.allergySafety ? (
                <Text component="div" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-3)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-state-success-fg)' }}>
                  <IconShieldCheck size={13} stroke={1.8} aria-hidden="true" />ایمنی آلرژن — {d.recsys.allergySafety.pass ? 'گذراند' : 'بررسی'}
                </Text>
              ) : null}
            </Panel>
          </Section>
        </Box>
      </Box>
    </>
  );
}
