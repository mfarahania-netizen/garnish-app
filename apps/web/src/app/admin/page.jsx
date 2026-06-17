import { Box, Text, UnstyledButton, Loader } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconLeaf, IconLock, IconRefresh, IconDownload, IconShieldCheck, IconShieldHalf, IconAlertTriangle,
  IconClock, IconUsers, IconToolsKitchen2, IconSearch, IconSparkles, IconCircleCheck, IconHome, IconChartBar,
} from '@tabler/icons-react';
import { useAdmin } from './useAdmin';
import { toFaDigits, faPercent } from '../../components/ges/format';

const card = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' };
const sectionTitle = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)' };
const grid = (min) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 'var(--g-space-3)' });

function Badge({ real }) {
  return (
    <Text component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, paddingInline: 'var(--g-space-2)', paddingBlock: 2, borderRadius: 'var(--g-radius-chip)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, background: real ? 'var(--g-color-state-success-bg)' : 'var(--g-color-state-info-bg)', color: real ? 'var(--g-color-state-success-fg)' : 'var(--g-color-text-secondary)' }}>
      {real ? 'داده واقعی' : 'در انتظار پایلوت'}
    </Text>
  );
}

function Kpi({ icon: Icon, label, value, sub, real, awaitNote }) {
  return (
    <Box style={{ ...card, ...(real ? {} : { borderStyle: 'dashed' }) }}>
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)' }}>
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', color: 'var(--g-color-text-secondary)' }}>
          {Icon ? <Icon size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} /> : null}
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{label}</Text>
        </Box>
        <Badge real={real} />
      </Box>
      {real ? (
        <>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-28)', fontWeight: 800, color: 'var(--g-color-text-primary)', marginBlockStart: 'var(--g-space-2)' }}>{value}</Text>
          {sub ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>{sub}</Text> : null}
        </>
      ) : (
        <Box style={{ marginBlockStart: 'var(--g-space-2)' }}>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-secondary)' }}>در انتظار کاربران واقعی</Text>
          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>{awaitNote || 'Track ۷ · هنوز کاربری نداریم'}</Text>
        </Box>
      )}
    </Box>
  );
}

function HBar({ label, value, max, suffix }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <Box style={{ marginBlockStart: 'var(--g-space-3)' }}>
      <Box style={{ display: 'flex', justifyContent: 'space-between', marginBlockEnd: 6 }}>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{label}</Text>
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>{toFaDigits(value)}{suffix || ''}</Text>
      </Box>
      <Box aria-hidden="true" style={{ blockSize: 6, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-border-subtle)', overflow: 'hidden' }}>
        <Box style={{ inlineSize: `${pct}%`, blockSize: '100%', background: 'var(--g-color-brand-500)' }} />
      </Box>
    </Box>
  );
}

const GUARD_FA = { ai_safety: 'ایمنی هوش مصنوعی', prompt_injection: 'تزریق پرامپت', nutrition_claim: 'ادعای تغذیه‌ای' };
const BAND_FA = { empty: 'تازه', forming: 'در حال شکل‌گیری', developing: 'در حال رشد', mature: 'پخته' };
const RECSYS_FA = { catalogCoverage: 'پوشش کاتالوگ', coverage: 'پوشش', diversity: 'تنوع', fitQuality: 'کیفیت تناسب', quality: 'کیفیت', popularityBias: 'سوگیری محبوبیت' };
// recsys.offline is Record<string, MetricResult{value,threshold,pass,note}> — only render numeric 0..1 values
const recsysRows = (offline) => Object.entries(offline || {}).filter(([, m]) => m && typeof m.value === 'number');

export default function AdminPage() {
  const navigate = useNavigate();
  const a = useAdmin();

  if (a.status === 'auth') {
    return <Box style={{ minBlockSize: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--g-color-bg-canvas)' }}><Loader color="var(--g-color-brand-600)" /></Box>;
  }
  if (a.status === 'denied') {
    return (
      <Box style={{ minBlockSize: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 'var(--g-space-2)', background: 'var(--g-color-bg-canvas)', paddingInline: 'var(--g-space-6)' }}>
        <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)' }}><IconLock size={28} stroke={1.6} /></Box>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-2) 0 0' }}>دسترسی محدود</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>این بخش فقط برای مدیران است.</Text>
        <UnstyledButton type="button" onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconHome size={16} stroke={1.8} aria-hidden="true" />خانه</UnstyledButton>
      </Box>
    );
  }

  const d = a.d;
  const onExport = () => {
    try {
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = 'garnish-admin-overview.json';
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    } catch { /* */ }
  };

  return (
    <Box style={{ minBlockSize: '100dvh', background: 'var(--g-color-bg-canvas)' }}>
      {/* header */}
      <Box style={{ position: 'sticky', insetBlockStart: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', flexWrap: 'wrap', paddingInline: 'var(--g-space-5)', paddingBlock: 'var(--g-space-3)', background: 'var(--g-color-bg-surface)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Box aria-hidden="true" style={{ inlineSize: 36, blockSize: 36, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center' }}><IconLeaf size={21} stroke={1.8} /></Box>
        <Box style={{ flex: 1, minInlineSize: 160 }}>
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>پنل مدیریت</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', margin: '2px 0 0' }}>نمای کلی · مدیر سیستم</Text>
        </Box>
        <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
          {a.ranges.map((r) => (
            <UnstyledButton key={r.id} type="button" onClick={() => a.setDays(r.id)} aria-pressed={a.days === r.id} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-3)', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--g-radius-chip)', background: a.days === r.id ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-canvas)', color: a.days === r.id ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{r.label}</UnstyledButton>
          ))}
        </Box>
        <UnstyledButton type="button" onClick={a.refetchAll} aria-label="به‌روزرسانی" style={{ inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', display: 'grid', placeItems: 'center' }}><IconRefresh size={18} stroke={1.8} /></UnstyledButton>
        <UnstyledButton type="button" onClick={onExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}><IconDownload size={16} stroke={1.8} aria-hidden="true" />خروجی</UnstyledButton>
      </Box>

      {a.status === 'loading' ? (
        <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 'var(--g-space-8)' }}><Loader color="var(--g-color-brand-600)" /></Box>
      ) : a.status === 'error' ? (
        <Box style={{ textAlign: 'center', paddingBlock: 'var(--g-space-8)' }}>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>بارگذاری نشد</Text>
          <UnstyledButton type="button" onClick={a.refetchAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={15} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
        </Box>
      ) : (
        <Box style={{ maxInlineSize: 1480, marginInline: 'auto', paddingInline: 'var(--g-space-5)', paddingBlockEnd: 'var(--g-space-8)' }}>
          {/* growth & activity */}
          <Text component="h2" style={sectionTitle}>رشد و فعالیت</Text>
          <Box style={grid(190)}>
            <Kpi icon={IconUsers} label="کل کاربران" real={d.growth.users.real} value={toFaDigits(d.growth.users.value)} sub="کاربرانِ ثبت‌شده" />
            <Kpi icon={IconToolsKitchen2} label="پخت" real={d.growth.cooks.real} value={toFaDigits(d.growth.cooks.value)} sub={`در ${toFaDigits(a.days)} روز`} />
            <Kpi icon={IconSearch} label="جستجو" real={d.growth.searches.real} value={toFaDigits(d.growth.searches.value)} sub={`در ${toFaDigits(a.days)} روز`} />
            <Kpi icon={IconSparkles} label="استفاده از هوش مصنوعی" real={d.growth.ai.real} value={toFaDigits(d.growth.ai.value)} sub={`در ${toFaDigits(a.days)} روز`} />
          </Box>

          {/* readiness */}
          <Text component="h2" style={sectionTitle}>آمادگی پیش از پایلوت</Text>
          <Box style={{ ...card, display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', background: 'var(--g-color-state-success-bg)', border: 'none', marginBlockEnd: 'var(--g-space-3)' }}>
            <IconCircleCheck size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-success-fg)' }} />
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-state-success-fg)' }}>سامانه آمادهٔ راه‌اندازی</Text>
          </Box>
          <Box style={grid(190)}>
            <Kpi icon={IconShieldCheck} label="گاردهای ایمنی" real value={toFaDigits(d.guards.blocked)} sub={`از ${toFaDigits(d.guards.cases)} موردِ پیکره · مسدودشده`} />
            <Kpi icon={IconShieldHalf} label="فیلتر آلرژن" real={!!d.allergen} value={d.allergen?.pass ? 'گذراند' : 'بررسی'} sub={d.allergen ? `${toFaDigits(d.allergen.leaks)} نشت` : ''} awaitNote="در حال ارزیابی" />
            <Kpi icon={IconClock} label="تأخیر p۹۵ (ms)" real={d.latency.real && d.latency.p95 != null} value={d.latency.p95 != null ? toFaDigits(d.latency.p95) : 'بدون نمونهٔ موفق'} sub={d.latency.p50 != null ? `p۵۰ ${toFaDigits(d.latency.p50)}ms · از فراخوان‌های ثبت‌شده` : ''} awaitNote="در انتظار فراخوان‌های واقعی" />
            <Kpi icon={IconChartBar} label="کیفیت رویداد" real={d.eventQuality.real} value={d.eventQuality.rate != null ? faPercent(d.eventQuality.rate * 100) : '—'} sub="رویدادهای معتبر" awaitNote="در انتظار رویدادهای واقعی" />
          </Box>

          {/* safety & compliance */}
          <Text component="h2" style={sectionTitle}>ایمنی و انطباق</Text>
          <Box style={{ ...card, display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)', background: 'var(--g-color-brand-50)', borderColor: 'var(--g-color-brand-200)', marginBlockEnd: 'var(--g-space-3)' }}>
            <IconShieldCheck size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-700)', flexShrink: 0, marginBlockStart: 2 }} />
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-brand-700)' }}>شواهد واقعی — نه دادهٔ ساختگی. اعداد از اجرای واقعیِ گاردها روی پیکرهٔ تست‌اند.</Text>
          </Box>
          <Box style={grid(280)}>
            <Box style={card}>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>شلیک گاردها</Text>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>{toFaDigits(d.guards.blocked)} مورد مسدود · روی {toFaDigits(d.guards.cases)} موردِ پیکره</Text>
              {Object.entries(d.guards.byGuard).map(([k, v]) => <HBar key={k} label={GUARD_FA[k] || k} value={v} max={d.guards.cases || 1} />)}
            </Box>
            <Box style={card}>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>فیلتر سخت آلرژن</Text>
              <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-2)', paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: d.allergen?.pass ? 'var(--g-color-state-success-bg)' : 'var(--g-color-state-info-bg)', color: d.allergen?.pass ? 'var(--g-color-state-success-fg)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
                {d.allergen?.pass ? <IconCircleCheck size={13} stroke={1.8} aria-hidden="true" /> : <IconAlertTriangle size={13} stroke={1.8} aria-hidden="true" />}{d.allergen?.indicator || (d.allergen?.pass ? 'گذراند' : 'در حال ارزیابی')}
              </Box>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)', marginBlockStart: 'var(--g-space-4)' }}>ارسال اعلان</Text>
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>{d.notif?.realSendEnabled ? 'ارسال واقعی فعال' : 'DRY-RUN — ارسال واقعی خاموش است، فقط شبیه‌سازی.'}</Text>
            </Box>
          </Box>

          {/* DNA bands + recsys */}
          <Box style={grid(280)}>
            <Box>
              <Text component="h2" style={sectionTitle}>توزیع باند DNA غذایی</Text>
              <Box style={card}>
                {d.foodDna.real ? (
                  Object.entries(d.foodDna.bands).map(([k, v]) => <HBar key={k} label={BAND_FA[k] || k} value={v} max={d.foodDna.sampled || 1} />)
                ) : (
                  <Box style={{ textAlign: 'center', paddingBlock: 'var(--g-space-4)' }}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-secondary)' }}>نمونه · پیش از پایلوت</Text>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>با ورود کاربران واقعی نمایش داده می‌شود.</Text>
                  </Box>
                )}
              </Box>
            </Box>
            <Box>
              <Text component="h2" style={sectionTitle}>کیفیت پیشنهادگر</Text>
              <Box style={card}>
                {recsysRows(d.recsys.offline).length ? (
                  recsysRows(d.recsys.offline).slice(0, 5).map(([k, m]) => <HBar key={k} label={RECSYS_FA[k] || k} value={Math.round(m.value * 100)} max={100} suffix="٪" />)
                ) : (
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', textAlign: 'center', paddingBlock: 'var(--g-space-4)' }}>از هارنس ارزیابی S۱۱ · در حال آماده‌سازی</Text>
                )}
                {d.recsys.allergySafety ? (
                  <Text component="div" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-3)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-state-success-fg)' }}>
                    <IconShieldCheck size={13} stroke={1.8} aria-hidden="true" />ایمنی آلرژن — {d.recsys.allergySafety.pass ? 'گذراند' : 'بررسی'}
                  </Text>
                ) : null}
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
