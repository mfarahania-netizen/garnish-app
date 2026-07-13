import { useState, useRef, useEffect } from 'react';
import { Box, Modal, Text, UnstyledButton } from '@mantine/core';
import {
  IconSalad, IconShieldHalf, IconShieldLock, IconUserCircle, IconAdjustments,
  IconDeviceMobile, IconDownload, IconTrash, IconChevronLeft, IconAlertTriangle, IconPlus, IconCheck,
  IconInfoCircle, IconCloudOff, IconRefresh,
} from '@tabler/icons-react';
import { useSettings } from './useSettings';
import { SkeletonLine } from '../../components/ges/LoadingSkeleton';
import Toast from '../../components/ges/Toast';

const card = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' };
const SectionHead = ({ icon: Icon, children }) => (
  <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginInline: 2, marginBlock: 'var(--g-space-6) var(--g-space-3)' }}>
    <Icon size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
    <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{children}</Text>
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

function Chip({ label, on, onClick, danger, ariaLabel }) {
  const fg = danger ? 'var(--g-color-allergen-fg)' : on ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)';
  const bg = danger ? 'var(--g-color-allergen-bg)' : on ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)';
  const bd = danger ? 'var(--g-color-allergen-fg)' : on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)';
  return (
    <UnstyledButton type="button" onClick={onClick} aria-pressed={on} aria-label={ariaLabel || label} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', border: `1px solid ${on ? bd : 'var(--g-color-border-subtle)'}`, background: on ? bg : 'var(--g-color-bg-surface)', color: on ? fg : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}>
      {danger ? <IconAlertTriangle size={12} stroke={2} aria-hidden="true" style={{ opacity: on ? 1 : 0.6 }} /> : (on ? <IconCheck size={12} stroke={2.4} aria-hidden="true" /> : <IconPlus size={12} stroke={2} aria-hidden="true" />)}
      {label}
    </UnstyledButton>
  );
}

function Seg({ active, label, soon, onClick }) {
  return (
    <UnstyledButton type="button" onClick={onClick} aria-pressed={active} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', background: active ? 'var(--g-color-brand-600)' : 'transparent', color: active ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}>
      {label}{soon ? <Text component="span" style={{ fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}> · به‌زودی</Text> : null}
    </UnstyledButton>
  );
}

export default function SettingsPage() {
  const s = useSettings();
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
      </Box>

      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-8)' }}>
        {/* food profile */}
        <Box id="food-profile" style={{ scrollMarginBlockStart: 80 }} />
        <SectionHead icon={IconSalad}>پروفایل غذایی</SectionHead>
        <Box style={{ ...card, padding: 'var(--g-space-4)' }}>
          <Text component="div" style={{ ...subLabel, marginBlockEnd: 'var(--g-space-2)' }}>الگوی غذایی</Text>
          <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
            {s.patternOptions.map((p) => <Chip key={p.id} label={p.label} on={s.pattern === p.id} onClick={() => s.choosePattern(p.id)} />)}
          </Box>
          <Text component="div" style={{ ...subLabel, marginBlock: 'var(--g-space-5) var(--g-space-1)' }}>حساسیت‌ها</Text>
          <Box id="allergies" style={{ scrollMarginBlockStart: 80 }} />
          <Text component="p" style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', margin: '0 0 var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>
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
        <Text id="delete-account-consequences" component="p" style={{ margin: '0 0 var(--g-space-4)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>
          این کار برگشت‌پذیر نیست. حساب و داده‌های متصل حذف می‌شوند؛ رکوردهای الزامی ممیزی فقط به‌شکل بی‌هویت باقی می‌مانند.
        </Text>
        <Text component="label" htmlFor="delete-account-confirmation" style={{ display: 'block', marginBlockEnd: 'var(--g-space-2)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>
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
