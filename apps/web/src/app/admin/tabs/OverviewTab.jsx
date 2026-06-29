// «نمای کلی» — the landing tab. Growth + pre-pilot readiness + safety/compliance evidence + DNA/recsys.
// Honest discipline: real numbers only when status==='real'; otherwise an awaiting state. Safety evidence is
// deterministic (real guard runs over the fixture corpus) so it's investor-grade even pre-pilot.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  IconUsers, IconToolsKitchen2, IconSearch, IconSparkles, IconShieldCheck, IconShieldHalf,
  IconClock, IconChartBar, IconCircleCheck, IconAlertTriangle, IconBulb,
} from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { useOverviewData } from '../useAdmin';
import { Section, Kpi, HBar, Panel, Note, Awaiting, grid, CARD, toFaDigits, faPercent } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const SEV = {
  critical: { fg: 'var(--g-color-state-danger-fg, #c0392b)', bg: 'var(--g-color-state-danger-bg, #fdecea)', label: 'بحرانی' },
  warning: { fg: 'var(--g-color-state-warning-fg, #c0801c)', bg: 'var(--g-color-state-warning-bg, #fdf3e3)', label: 'هشدار' },
  info: { fg: 'var(--g-color-text-secondary)', bg: 'var(--g-color-state-info-bg)', label: 'اطلاع' },
};
const IMP = { high: 'var(--g-color-state-danger-fg, #c0392b)', medium: 'var(--g-color-state-warning-fg, #c0801c)', low: 'var(--g-color-text-secondary)' };

const GUARD_FA = { ai_safety: 'ایمنی هوش مصنوعی', prompt_injection: 'تزریق پرامپت', nutrition_claim: 'ادعای تغذیه‌ای' };
const BAND_FA = { empty: 'تازه', forming: 'در حال شکل‌گیری', developing: 'در حال رشد', mature: 'پخته' };
const RECSYS_FA = { catalogCoverage: 'پوشش کاتالوگ', coverage: 'پوشش', diversity: 'تنوع', fitQuality: 'کیفیت تناسب', quality: 'کیفیت', popularityBias: 'سوگیری محبوبیت' };
const recsysRows = (offline) => Object.entries(offline || {}).filter(([, m]) => m && typeof m.value === 'number');
const st = (real) => (real ? 'real' : 'awaiting_pilot');

export default function OverviewTab({ days = 30 }) {
  const { d, loading } = useOverviewData(days);
  // Pulse: what needs ATTENTION first — the background guards' open alerts + the top things to improve.
  const alertsQ = useQuery({ queryKey: ['admin', 'workflow-alerts'], queryFn: () => get('/admin/workflows/alerts?status=open&limit=10'), refetchInterval: 20000 });
  const behaviorQ = useQuery({ queryKey: ['admin', 'behavior'], queryFn: () => get('/admin/insights/behavior'), refetchInterval: 30000 });
  const attention = (alertsQ.data?.alerts || []).filter((a) => a.severity === 'critical' || a.severity === 'warning');
  const improve = (behaviorQ.data?.improve || []).slice(0, 4);

  if (loading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 'var(--g-space-8)' }}><Loader color="var(--g-color-brand-600)" /></Box>;

  return (
    <>
      {/* ── PULSE: needs-attention first (alerts) + what to improve ── */}
      <Section title="وضعیتِ امروز" sub="در ۳۰ ثانیه: چیزی خراب است؟ چه کنم؟">
        {attention.length === 0 ? (
          <Box style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--g-color-state-success-bg, #e9f6ee)', border: 'none' }}>
            <IconCircleCheck size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-success-fg, #2e7d4f)', flexShrink: 0 }} />
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 600, color: 'var(--g-color-state-success-fg, #2e7d4f)' }}>همه‌چیز سالم است — هیچ هشدارِ بحرانی‌ای نیست.</Text>
          </Box>
        ) : (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attention.map((a) => {
              const s = SEV[a.severity] || SEV.info;
              return (
                <Box key={a.id} style={{ ...CARD, borderInlineStartWidth: 3, borderInlineStartColor: s.fg, borderInlineStartStyle: 'solid', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Box style={{ fontFamily: 'var(--g-font-fa)', fontSize: '10px', fontWeight: 600, color: s.fg, background: s.bg, borderRadius: '5px', padding: '2px 7px', flexShrink: 0 }}>{s.label}</Box>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{a.title}</Text>
                  {a.value != null ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}>· {toFaDigits(Math.round(a.value * 1000) / 1000)}</Text> : null}
                </Box>
              );
            })}
          </Box>
        )}

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
        اعدادِ «رشد و فعالیت» و «توزیع DNA» روی <Text component="span" style={{ fontWeight: 700 }}>کاربرانِ تستیِ فعلی</Text> محاسبه شده‌اند (هنوز کاربرِ واقعی نداریم) — واقعی‌اند ولی تا پایلوت معنادار نیستند. شواهدِ مستقلِ واقعی (هزینه و تأخیرِ واقعیِ هوش مصنوعی در تبِ «هوش مصنوعی»، گاردهای ایمنی، ارزیابیِ پیشنهادگر) به دادهٔ پایلوت وابسته نیستند.
      </Note>
      <Section title="رشد و فعالیت">
        <Box style={grid(190)}>
          <Kpi icon={IconUsers} label="کل کاربران" status={st(d.growth.users.real)} value={toFaDigits(d.growth.users.value)} sub="کاربرانِ ثبت‌شده" awaitNote="هنوز کاربری نداریم" />
          <Kpi icon={IconToolsKitchen2} label="پخت" status={st(d.growth.cooks.real)} value={toFaDigits(d.growth.cooks.value)} sub={`در ${toFaDigits(days)} روز`} awaitNote="در انتظار پخت واقعی" />
          <Kpi icon={IconSearch} label="جستجو" status={st(d.growth.searches.real)} value={toFaDigits(d.growth.searches.value)} sub={`در ${toFaDigits(days)} روز`} awaitNote="در انتظار جستجوی واقعی" />
          <Kpi icon={IconSparkles} label="استفاده از هوش مصنوعی" status={st(d.growth.ai.real)} value={toFaDigits(d.growth.ai.value)} sub={`در ${toFaDigits(days)} روز`} awaitNote="در انتظار کاربر واقعی" />
        </Box>
      </Section>

      <Section title="آمادگی پیش از پایلوت">
        <Box style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', background: 'var(--g-color-state-success-bg)', border: 'none', marginBlockEnd: 'var(--g-space-3)' }}>
          <IconCircleCheck size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-success-fg)' }} />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-state-success-fg)' }}>سامانه آمادهٔ راه‌اندازی</Text>
        </Box>
        <Box style={grid(190)}>
          <Kpi icon={IconShieldCheck} label="گاردهای ایمنی" status="real" value={toFaDigits(d.guards.blocked)} sub={`از ${toFaDigits(d.guards.cases)} موردِ پیکره · مسدودشده`} />
          <Kpi icon={IconShieldHalf} label="فیلتر آلرژن" status={d.allergen ? 'real' : 'awaiting_pilot'} value={d.allergen?.pass ? 'گذراند' : 'بررسی'} sub={d.allergen ? `${toFaDigits(d.allergen.leaks)} نشت` : ''} awaitNote="در حال ارزیابی" />
          <Kpi icon={IconClock} label="تأخیر p۹۵ (ms)" status={d.latency.real && d.latency.p95 != null ? 'real' : 'awaiting_pilot'} value={d.latency.p95 != null ? toFaDigits(d.latency.p95) : '—'} sub={d.latency.p50 != null ? `p۵۰ ${toFaDigits(d.latency.p50)}ms` : ''} awaitNote="در انتظار فراخوان واقعی" />
          <Kpi icon={IconChartBar} label="کیفیت رویداد" status={d.eventQuality.real ? 'real' : 'awaiting_pilot'} value={d.eventQuality.rate != null ? faPercent(d.eventQuality.rate * 100) : '—'} sub="رویدادهای معتبر" awaitNote="در انتظار رویداد واقعی" />
        </Box>
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
