import { useState, useRef, useEffect } from 'react';
import { Box, Modal, Text, UnstyledButton } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IconSalad, IconShieldHalf, IconShieldLock, IconUserCircle, IconAdjustments,
  IconDeviceMobile, IconDownload, IconTrash, IconChevronLeft, IconAlertTriangle, IconPlus, IconCheck,
  IconInfoCircle, IconCloudOff, IconRefresh,
  IconSparkles, IconClock, IconUsers,
} from '@tabler/icons-react';
import { useSettings } from './useSettings';
import { SkeletonLine } from '../../components/ges/LoadingSkeleton';
import Toast from '../../components/ges/Toast';

const card = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' };
const SectionHead = ({ icon: Icon, children, id }) => (
  <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginInline: 2, marginBlock: 'var(--g-space-6) var(--g-space-3)' }}>
    <Icon size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
    <Text id={id} component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{children}</Text>
  </Box>
);
const subLabel = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-secondary)' };

function Switch({ on, onClick, label, disabled = false }) {
  return (
    <UnstyledButton type="button" onClick={onClick} disabled={disabled} role="switch" aria-checked={on} aria-label={label} style={{ inlineSize: 44, blockSize: 44, flexShrink: 0, display: 'grid', placeItems: 'center', opacity: disabled ? 0.55 : 1 }}>
      <Box aria-hidden="true" style={{ position: 'relative', inlineSize: 44, blockSize: 26, borderRadius: 'var(--g-radius-chip)', background: on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)' }}>
        <Box style={{ position: 'absolute', insetBlockStart: 3, insetInlineStart: on ? 21 : 3, inlineSize: 20, blockSize: 20, borderRadius: '50%', background: 'var(--g-color-bg-surface)', boxShadow: 'var(--g-shadow-1)' }} />
      </Box>
    </UnstyledButton>
  );
}

function ToggleRow({ label, sub, on, onClick, first, disabled = false }) {
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)', borderBlockStart: first ? 'none' : '1px solid var(--g-color-border-subtle)' }}>
      <Box style={{ flex: 1, minInlineSize: 0 }}>
        <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{label}</Text>
        {sub ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>{sub}</Text> : null}
      </Box>
      <Switch on={on} onClick={onClick} label={label} disabled={disabled} />
    </Box>
  );
}

function Chip({ label, on, onClick, danger, ariaLabel, disabled = false }) {
  const fg = danger ? 'var(--g-color-allergen-fg)' : on ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)';
  const bg = danger ? 'var(--g-color-allergen-bg)' : on ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)';
  const bd = danger ? 'var(--g-color-allergen-fg)' : on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)';
  return (
    <UnstyledButton type="button" onClick={onClick} disabled={disabled} aria-pressed={on} aria-label={ariaLabel || label} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', border: `1px solid ${on ? bd : 'var(--g-color-border-subtle)'}`, background: on ? bg : 'var(--g-color-bg-surface)', color: on ? fg : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, opacity: disabled ? 0.58 : 1 }}>
      {danger ? <IconAlertTriangle size={12} stroke={2} aria-hidden="true" style={{ opacity: on ? 1 : 0.6 }} /> : (on ? <IconCheck size={12} stroke={2.4} aria-hidden="true" /> : <IconPlus size={12} stroke={2} aria-hidden="true" />)}
      {label}
    </UnstyledButton>
  );
}

function Seg({ active, label, soon, onClick }) {
  return (
    <UnstyledButton type="button" onClick={onClick} aria-pressed={active} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', background: active ? 'var(--g-color-brand-600)' : 'transparent', color: active ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>
      {label}{soon ? <Text component="span" style={{ fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}> · به‌زودی</Text> : null}
    </UnstyledButton>
  );
}

export default function SettingsPage() {
  const s = useSettings();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [toast, setToast] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const tt = useRef();
  useEffect(() => () => { clearTimeout(tt.current); }, []);
  useEffect(() => {
    if (!s.toast) return;
    clearTimeout(tt.current);
    setToast({ message: s.toast.message, Icon: s.toast.icon === 'err' ? IconCloudOff : IconCheck });
    tt.current = setTimeout(() => setToast(null), 2200);
  }, [s.toast?.ts]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (s.status !== 'ready' || !hash) return undefined;
    let id = '';
    try { id = decodeURIComponent(hash.slice(1)); } catch { return undefined; }
    if (!['food-profile', 'allergies', 'personalization-profile'].includes(id)) return undefined;

    // The target does not exist while Settings is hydrating. Resolve it only
    // after the ready content mounts, then focus without triggering a second
    // browser scroll. The allowlist above avoids selector/hash injection.
    const timer = window.setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.focus({ preventScroll: true });
      if (typeof target.scrollIntoView === 'function') {
        const reduceMotion = typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hash, s.status]);

  const closeDeleteDialog = () => {
    if (s.busy) return;
    setDeleteOpen(false);
    setDeleteConfirmation('');
  };

  if (s.status === 'loading') {
    return (
      <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ padding: 'var(--g-space-4)' }}>
        <SkeletonLine w="40%" h={14} />
        <Box className="g-skeleton" style={{ blockSize: 120, borderRadius: 'var(--g-radius-card)', marginBlockStart: 'var(--g-space-3)' }} />
        <Box className="g-skeleton" style={{ blockSize: 120, borderRadius: 'var(--g-radius-card)', marginBlockStart: 'var(--g-space-4)' }} />
      </Box>
    );
  }
  if (s.status === 'error') {
    return (
      <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
        <Box aria-hidden="true" style={{ inlineSize: 54, blockSize: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)' }}><IconCloudOff size={24} stroke={1.6} /></Box>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, margin: 'var(--g-space-2) 0 0', color: 'var(--g-color-text-primary)' }}>تنظیمات بارگذاری نشد</Text>
        <UnstyledButton type="button" onClick={s.refetch} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={15} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
      </Box>
    );
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>تنظیمات</Text>
        <Text component="p" style={{ margin: 'var(--g-space-1) 0 0', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>پروفایل غذایی، حریم خصوصی و حساب را از یک‌جا مدیریت کن.</Text>
      </Box>

      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-8)' }}>
        {/* food profile */}
        <Box component="section" id="food-profile" tabIndex={-1} aria-labelledby="food-profile-title" style={{ scrollMarginBlockStart: 88, outline: 'none', boxShadow: 'none' }}>
          <SectionHead id="food-profile-title" icon={IconSalad}>پروفایل غذایی</SectionHead>
          <Box style={{ ...card, overflow: 'hidden' }}>
            <Box role="note" style={{ display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', padding: 'var(--g-space-3) var(--g-space-4)', background: 'var(--g-color-state-info-bg)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
              <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" style={{ marginBlockStart: 2, color: 'var(--g-color-brand-700)', flexShrink: 0 }} />
              <Text component="p" style={{ margin: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>
                الگوی غذایی و پرچم‌های ایمنی با هر انتخاب ذخیره می‌شوند. برای موارد پزشکی، برچسب مواد اولیه را هم بررسی کن.
              </Text>
            </Box>
            <Box style={{ padding: 'var(--g-space-4)' }}>
              <Text component="h3" style={{ ...subLabel, fontSize: 'var(--g-font-size-14)', margin: '0 0 var(--g-space-2)' }}>الگوی غذایی</Text>
              <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                {s.patternOptions.map((p) => <Chip key={p.id} label={p.label} on={s.pattern === p.id} onClick={() => s.choosePattern(p.id)} />)}
              </Box>
            </Box>
            <Box id="allergies" tabIndex={-1} aria-labelledby="allergies-title" style={{ padding: 'var(--g-space-4)', borderBlockStart: '1px solid var(--g-color-border-subtle)', scrollMarginBlockStart: 88, outline: 'none', boxShadow: 'none' }}>
              <Text id="allergies-title" component="h3" style={{ ...subLabel, fontSize: 'var(--g-font-size-14)', margin: '0 0 var(--g-space-1)' }}>حساسیت‌ها</Text>
              <Text component="p" style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', margin: '0 0 var(--g-space-3)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>
                <IconShieldHalf size={13} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-warning-fg)', flexShrink: 0, marginBlockStart: 1 }} />پرچمِ ایمنی — اطلاع‌رسانی، نه توصیهٔ پزشکی.
              </Text>
              <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                {s.allergenOptions.map((a) => <Chip key={a.id} label={a.label} on={!!s.allergens[a.id]} onClick={() => s.toggleAllergen(a.id)} danger />)}
              </Box>
              {s.legacyAllergenOptions?.length ? (
                <Box role="note" style={{ marginBlockStart: 'var(--g-space-3)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-state-warning-bg)' }}>
                  <Text component="p" style={{ margin: '0 0 var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-state-warning-fg)' }}>
                    این موارد از نسخهٔ قبلی حفظ شده‌اند، اما پوشش کامل دادهٔ دستورها هنوز تأیید نشده؛ مواد اولیه را هم بررسی کن. برای حذف، همان مورد را بزن.
                  </Text>
                  <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                    {s.legacyAllergenOptions.map((a) => <Chip key={a.id} label={`${a.label} · قدیمی`} ariaLabel={`حذف ${a.label}`} on onClick={() => s.removeLegacyAllergen(a.id)} danger />)}
                  </Box>
                </Box>
              ) : null}
            </Box>
          </Box>
        </Box>

        <Box component="section" id="personalization-profile" tabIndex={-1} aria-labelledby="personalization-profile-title" style={{ scrollMarginBlockStart: 88, outline: 'none', boxShadow: 'none' }}>
          <SectionHead id="personalization-profile-title" icon={IconSparkles}>پاسخ‌های شخصی‌سازی</SectionHead>
          {s.profileAnswersStatus === 'loading' ? (
            <Box role="status" aria-label="در حال بارگذاری پاسخ‌های شخصی‌سازی" style={{ ...card, padding: 'var(--g-space-4)' }}>
              <SkeletonLine w="55%" h={14} />
              <SkeletonLine w="80%" h={12} style={{ marginBlockStart: 'var(--g-space-3)' }} />
            </Box>
          ) : s.profileAnswersStatus === 'error' ? (
            <Box role="alert" style={{ ...card, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', padding: 'var(--g-space-4)' }}>
              <IconCloudOff size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-danger-fg)', flexShrink: 0 }} />
              <Text component="p" style={{ flex: 1, margin: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>پاسخ‌های قبلی تأیید نشدند؛ چیزی را حدس نمی‌زنیم.</Text>
              <UnstyledButton type="button" onClick={s.refetch} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-3)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 800 }}>تلاش دوباره</UnstyledButton>
            </Box>
          ) : (
            <Box style={{ ...card, overflow: 'hidden' }}>
              <Box role="note" style={{ display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', padding: 'var(--g-space-3) var(--g-space-4)', background: 'var(--g-color-state-info-bg)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
                <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" style={{ marginBlockStart: 2, color: 'var(--g-color-brand-700)', flexShrink: 0 }} />
                <Text component="p" style={{ margin: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>
                  این پاسخ‌ها روی زمان دستورها و مقدار خرید اثر می‌گذارند؛ فقط چیزهایی را نگه دار که هنوز درست‌اند.
                </Text>
              </Box>
              <Box style={{ padding: 'var(--g-space-4)' }}>
                <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockEnd: 'var(--g-space-2)' }}>
                  <IconClock size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
                  <Text component="h3" style={{ ...subLabel, fontSize: 'var(--g-font-size-14)', margin: 0 }}>وقت معمول آشپزی در روزهای هفته</Text>
                </Box>
                <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                  {s.cooktimeOptions.map((option) => <Chip key={option.id} label={option.label} on={s.weekdayTimeBucket === option.id} onClick={() => s.setWeekdayTimeBucket(option.id)} disabled={s.profileAnswersBusy} />)}
                </Box>

                <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlock: 'var(--g-space-5) var(--g-space-2)' }}>
                  <IconUsers size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
                  <Text component="h3" style={{ ...subLabel, fontSize: 'var(--g-font-size-14)', margin: 0 }}>معمولاً برای چند نفر می‌پزی؟</Text>
                </Box>
                <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                  {s.cooksForOptions.map((option) => <Chip key={option.id} label={option.label} on={s.cooksForCount === option.id} onClick={() => s.setCooksForCount(option.id)} disabled={s.profileAnswersBusy} />)}
                </Box>

                <Text component="h3" style={{ ...subLabel, fontSize: 'var(--g-font-size-14)', margin: 'var(--g-space-5) 0 var(--g-space-2)' }}>قاعدهٔ غذایی</Text>
                <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                  {s.dietaryRuleOptions.map((option) => <Chip key={option.id} label={option.label} on={s.dietaryRules.includes(option.id)} onClick={() => s.toggleDietaryRule(option.id)} disabled={s.profileAnswersBusy} />)}
                </Box>

                {!s.pattern ? (
                  <Text role="alert" component="p" style={{ margin: 'var(--g-space-4) 0 0', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-state-warning-fg)' }}>برای ذخیره، اول الگوی غذایی را در بخش بالا انتخاب کن.</Text>
                ) : null}
                <UnstyledButton
                  type="button"
                  onClick={() => { void s.saveProfileAnswers(); }}
                  disabled={!s.profileAnswersDirty || !s.pattern || !s.weekdayTimeBucket || !s.cooksForCount || s.profileAnswersBusy}
                  style={{ inlineSize: '100%', minBlockSize: 48, marginBlockStart: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, opacity: !s.profileAnswersDirty || !s.pattern || !s.weekdayTimeBucket || !s.cooksForCount || s.profileAnswersBusy ? 0.48 : 1 }}
                >
                  {s.profileAnswersBusy ? 'در حال ذخیره…' : s.profileAnswersDirty ? 'ذخیرهٔ پاسخ‌ها' : 'پاسخ‌ها ذخیره‌اند'}
                </UnstyledButton>
              </Box>
              <UnstyledButton type="button" onClick={() => navigate('/food-dna')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 60, paddingInline: 'var(--g-space-4)', borderBlockStart: '1px solid var(--g-color-border-subtle)', textAlign: 'start' }}>
                <IconSparkles size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
                <Box style={{ flex: 1 }}>
                  <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>اصلاح ذائقه و دوست‌داشتنی‌ها</Text>
                  <Text component="span" style={{ display: 'block', marginBlockStart: 2, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>از سؤال‌های کوتاه و بازخوردهای قابل‌برگشت استفاده کن.</Text>
                </Box>
                <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
              </UnstyledButton>
            </Box>
          )}
        </Box>

        {/* consent */}
        <SectionHead icon={IconShieldLock}>حریم خصوصی و رضایت</SectionHead>
        <Box aria-busy={s.consentStatus === 'loading'} style={{ ...card, overflow: 'hidden' }}>
          <ToggleRow
            first
            label="ساختِ پروفایلِ ذائقه"
            sub={s.consent.personalization && !s.consentRuntimeAvailable?.personalization
              ? 'انتخاب ثبت شده؛ این قابلیت فعلاً غیرفعال است'
              : 'استفادهٔ اختیاری از انتخاب‌ها برای پیشنهاد بهتر'}
            on={s.consent.personalization}
            onClick={() => s.toggleConsent('personalization')}
            disabled={s.consentStatus !== 'ready' || s.consentBusy?.personalization}
          />
          <ToggleRow
            label="آمارِ استفادهٔ اختیاری"
            sub={s.consent.analytics && !s.consentRuntimeAvailable?.analytics
              ? 'انتخاب ثبت شده؛ جمع‌آوری فعلاً غیرفعال است'
              : 'رویدادهای متصل به حساب برای بهبود محصول'}
            on={s.consent.analytics}
            onClick={() => s.toggleConsent('analytics')}
            disabled={s.consentStatus !== 'ready' || s.consentBusy?.analytics}
          />
        </Box>
        {s.consentStatus === 'error' ? (
          <Box role="alert" style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', margin: 'var(--g-space-2) 2px 0', color: 'var(--g-color-state-danger-fg)' }}>
            <Text component="p" style={{ flex: 1, margin: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'inherit' }}>
              وضعیت رضایت تأیید نشد؛ گزینه‌های اختیاری خاموش و قفل مانده‌اند.
            </Text>
            <UnstyledButton type="button" onClick={s.refetch} aria-label="تلاش دوباره برای بارگذاری رضایت" style={{ minBlockSize: 44, paddingInline: 'var(--g-space-3)', color: 'inherit', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
              تلاش دوباره
            </UnstyledButton>
          </Box>
        ) : null}
        <Text component="p" style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', margin: 'var(--g-space-2) 2px 0', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>
          <IconInfoCircle size={13} stroke={1.8} aria-hidden="true" style={{ flexShrink: 0, marginBlockStart: 1 }} />این گزینه‌ها اختیاری و قابل‌لغو هستند؛ با خاموش‌کردن، ارسال رویدادهای اختیاری از این دستگاه فوراً متوقف می‌شود.
        </Text>

        {/* account */}
        <SectionHead icon={IconUserCircle}>حساب</SectionHead>
        <Box style={{ ...card, overflow: 'hidden' }}>
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)', minBlockSize: 52 }}>
            <IconDeviceMobile size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-secondary)' }} />
            <Text component="span" style={{ flex: 1, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>موبایل</Text>
            <Text component="span" dir="ltr" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>{s.account.phone || '—'}</Text>
          </Box>
          <UnstyledButton type="button" onClick={s.exportData} disabled={s.busy} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 52, paddingInline: 'var(--g-space-4)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
            <IconDownload size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-secondary)' }} />
            <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>خروجیِ داده‌هایم</Text>
            <IconChevronLeft size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
          </UnstyledButton>
          <UnstyledButton type="button" onClick={() => setDeleteOpen(true)} disabled={s.busy} aria-haspopup="dialog" style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 52, paddingInline: 'var(--g-space-4)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
            <IconTrash size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-danger-fg)' }} />
            <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-state-danger-fg)' }}>حذف حساب</Text>
            <IconChevronLeft size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-danger-fg)' }} />
          </UnstyledButton>
        </Box>

        {/* app */}
        <SectionHead icon={IconAdjustments}>برنامه</SectionHead>
        <Box style={{ ...card, padding: 'var(--g-space-4)' }}>
          <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 'var(--g-space-4)' }}>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>تم</Text>
            <Box style={{ display: 'inline-flex', background: 'var(--g-color-bg-canvas)', borderRadius: 'var(--g-radius-chip)', padding: 2 }}>
              <Seg active label="روشن" onClick={() => {}} />
              <Seg label="تیره" soon onClick={() => setToast({ message: 'تمِ تیره به‌زودی', Icon: IconInfoCircle })} />
            </Box>
          </Box>
          <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>زبان</Text>
            <Box style={{ display: 'inline-flex', background: 'var(--g-color-bg-canvas)', borderRadius: 'var(--g-radius-chip)', padding: 2 }}>
              <Seg active label="فارسی" onClick={() => {}} />
              <Seg label="English" soon onClick={() => setToast({ message: 'English coming soon', Icon: IconInfoCircle })} />
            </Box>
          </Box>
        </Box>
      </Box>

      <Modal
        opened={deleteOpen}
        onClose={closeDeleteDialog}
        closeOnClickOutside={!s.busy}
        closeOnEscape={!s.busy}
        centered
        title="حذف دائمی حساب"
        styles={{ title: { fontFamily: 'var(--g-font-fa)', fontWeight: 800 }, body: { fontFamily: 'var(--g-font-fa)' } }}
      >
        <Text id="delete-account-consequences" component="p" style={{ margin: '0 0 var(--g-space-4)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>
          این کار برگشت‌پذیر نیست. حساب و داده‌های متصل حذف می‌شوند؛ رکوردهای الزامی ممیزی فقط به‌شکل بی‌هویت باقی می‌مانند.
        </Text>
        {s.accountDeletionBlocker?.kind === 'household_owner_transfer_required' ? (
          <Box role="alert" style={{ padding: 'var(--g-space-3)', marginBlockEnd: 'var(--g-space-4)', border: '1px solid var(--g-color-brand-200)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-50)' }}>
            <Text component="p" style={{ margin: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' }}>{s.accountDeletionBlocker.message}</Text>
            <UnstyledButton type="button" onClick={s.openHouseholdOwnership} style={{ minBlockSize: 44, marginBlockStart: 'var(--g-space-2)', paddingInline: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800 }}>
              رفتن به اعضای خانه
            </UnstyledButton>
          </Box>
        ) : null}
        <Text component="label" htmlFor="delete-account-confirmation" style={{ display: 'block', marginBlockEnd: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>
          برای تأیید، عبارت «حذف حساب» را بنویس.
        </Text>
        <input
          id="delete-account-confirmation"
          value={deleteConfirmation}
          onChange={(event) => setDeleteConfirmation(event.target.value)}
          autoComplete="off"
          aria-describedby="delete-account-consequences"
          disabled={s.busy}
          style={{ inlineSize: '100%', minBlockSize: 44, paddingInline: 'var(--g-space-3)', border: '1px solid var(--g-color-border-strong)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)' }}
        />
        <Box style={{ display: 'flex', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-5)' }}>
          <UnstyledButton type="button" onClick={closeDeleteDialog} disabled={s.busy} style={{ flex: 1, minBlockSize: 44, border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-input)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontWeight: 700 }}>
            انصراف
          </UnstyledButton>
          <UnstyledButton
            type="button"
            onClick={() => { void s.deleteAccount(); }}
            disabled={deleteConfirmation.trim() !== 'حذف حساب' || s.busy}
            style={{ flex: 1, minBlockSize: 44, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-state-danger-fg)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontWeight: 800, opacity: deleteConfirmation.trim() !== 'حذف حساب' || s.busy ? 0.5 : 1 }}
          >
            حذف دائمی حساب
          </UnstyledButton>
        </Box>
      </Modal>

      <Toast toast={toast} />
    </Box>
  );
}
