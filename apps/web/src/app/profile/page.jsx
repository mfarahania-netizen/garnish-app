import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Modal, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  IconChevronLeft, IconLeaf, IconTrendingUp, IconFlame, IconToolsKitchen2,
  IconAward, IconPlant2, IconAlertTriangle, IconBookmark, IconPencil,
  IconInfoCircle, IconLogout, IconSparkles, IconUsers,
} from '@tabler/icons-react';
import { useProfile } from './useProfile';
import { useAuth } from '../../context/AuthContext';
import { toFaDigits } from '../../components/ges/format';
import FoodDnaRing from '../../components/ges/FoodDnaRing';
import ErrorState from '../../components/ges/ErrorState';
import Toast from '../../components/ges/Toast';
import { SkeletonLine, SkeletonCircle } from '../../components/ges/LoadingSkeleton';
import apiClient from '../../lib/apiClient';
import { invalidateProfileDomain } from '../../lib/queryKeys';
import { useAnalytics } from '../../hooks/useAnalytics';
import { EventType } from '../../lib/eventTaxonomy';

const PAGE = { display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-6)' };
const sectionTitle = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', marginBlock: 'var(--g-space-6) var(--g-space-3)', marginInline: 2 };
const cardWrap = { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' };
const rowBtn = { display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 52, paddingInline: 'var(--g-space-4)' };

function StatCard({ icon: Icon, value, label, onClick }) {
  const inner = (
    <>
      <Icon size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, marginBlockStart: 4, color: 'var(--g-color-text-primary)' }}>{value}</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>{label}</Text>
    </>
  );
  const style = { ...cardWrap, paddingInline: 'var(--g-space-2)', paddingBlock: 'var(--g-space-4)', textAlign: 'center' };
  return onClick
    ? <UnstyledButton type="button" onClick={onClick} style={style}>{inner}</UnstyledButton>
    : <Box style={style}>{inner}</Box>;
}

function QuickRow({ icon: Icon, label, onClick, last }) {
  return (
    <UnstyledButton type="button" onClick={onClick} style={{ ...rowBtn, borderBlockStart: last ? '1px solid var(--g-color-border-subtle)' : 'none' }}>
      <Icon size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-secondary)' }} />
      <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{label}</Text>
      <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
    </UnstyledButton>
  );
}

function KnownRow({ icon: Icon, iconColor, children, onEdit, divider }) {
  // No row-level aria-label: the visible text (the known preference/allergen) IS the accessible
  // name; the button role + the (decorative) pencil convey it's editable. A label like "ویرایش"
  // would mask the actual content a screen-reader user needs to hear.
  return (
    <UnstyledButton type="button" onClick={onEdit} style={{ ...rowBtn, paddingBlock: 'var(--g-space-3)', borderBlockStart: divider ? '1px solid var(--g-color-border-subtle)' : 'none' }}>
      <Icon size={19} stroke={1.8} aria-hidden="true" style={{ color: iconColor, flexShrink: 0 }} />
      <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-primary)' }}>{children}</Text>
      <IconPencil size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
    </UnstyledButton>
  );
}

function ControlStrip({ control, known }) {
  const items = [
    {
      label: control?.allergyGuardActive ? 'پرچم ایمنی فعال' : 'حساسیت ثبت نشده',
      tone: control?.allergyGuardActive ? 'ok' : 'warn',
      value: control?.allergyGuardActive ? `${toFaDigits(known.allergens.length)} مورد` : 'نیازمند تکمیل',
    },
    {
      label: control?.personalizationGranted ? 'شخصی‌سازی روشن' : 'شخصی‌سازی خاموش',
      tone: control?.personalizationGranted ? 'ok' : 'muted',
      value: control?.personalizationGranted ? 'فعال' : 'کنترل در تنظیمات',
    },
    {
      label: 'شناختِ ذائقه',
      tone: control?.maturityTone || 'muted',
      value: control?.maturityLabel || 'در حال شکل‌گیری',
    },
  ];
  const colors = {
    ok: { bg: 'var(--g-color-state-success-bg)', fg: 'var(--g-color-state-success-fg)' },
    warn: { bg: 'var(--g-color-state-warning-bg)', fg: 'var(--g-color-state-warning-fg)' },
    muted: { bg: 'var(--g-color-bg-canvas)', fg: 'var(--g-color-text-secondary)' },
  };
  return (
    <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-5)' }}>
      {items.map((it) => {
        const c = colors[it.tone] || colors.muted;
        return (
          <Box key={it.label} style={{ ...cardWrap, padding: 'var(--g-space-3)', minBlockSize: 76, background: c.bg }}>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-11)', fontWeight: 700, color: c.fg, lineHeight: 1.5 }}>{it.label}</Text>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 800, color: 'var(--g-color-text-primary)', marginBlockStart: 5 }}>{it.value}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function HouseholdCard({ household, onOpen }) {
  if (!household || household.status === 'disabled') return null;

  const active = household.status === 'active';
  const description = household.status === 'loading'
    ? 'در حال دریافت وضعیت خانه…'
    : household.status === 'unavailable'
      ? 'وضعیت خانه فعلاً در دسترس نیست؛ داخل بخش دوباره تلاش کن.'
      : active
        ? `${toFaDigits(household.memberCount || 1)} عضو · لیست خرید مشترک`
        : 'یک خانه بساز یا دعوتت را قبول کن.';

  return (
    <UnstyledButton
      type="button"
      onClick={onOpen}
      aria-label="ورود به خرید باهم"
      style={{ ...cardWrap, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 76, marginBlockStart: 'var(--g-space-3)', padding: 'var(--g-space-4)', textAlign: 'start', boxShadow: 'var(--g-shadow-1)' }}
    >
      <Box aria-hidden="true" style={{ inlineSize: 42, blockSize: 42, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)' }}>
        <IconUsers size={21} stroke={1.8} />
      </Box>
      <Box style={{ flex: 1, minInlineSize: 0 }}>
        <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-text-primary)' }}>
          {active ? household.name || 'خرید باهم' : 'خرید باهم'}
        </Text>
        <Text component="span" role={household.status === 'unavailable' ? 'status' : undefined} style={{ display: 'block', marginBlockStart: 2, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: household.status === 'unavailable' ? 'var(--g-color-state-warning-fg)' : 'var(--g-color-text-muted)' }}>
          {description}
        </Text>
      </Box>
      <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
    </UnstyledButton>
  );
}

function ProfileEditModal({ opened, onClose, profile, onSaved, showToast }) {
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();
  const [name, setName] = useState(profile?.header?.name || '');
  const [file, setFile] = useState(null);

  useEffect(() => {
    if (opened) {
      setName(profile?.header?.name || '');
      setFile(null);
    }
  }, [opened, profile?.header?.name]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { name: name.trim() };
      if (file) {
        const form = new FormData();
        form.append('file', file);
        const uploaded = await apiClient.post('/upload/avatar', form).then((r) => r.data);
        if (uploaded?.avatarUrl) body.avatar = uploaded.avatarUrl;
      }
      return apiClient.patch('/users/me', body).then((r) => r.data);
    },
    onSuccess: () => {
      invalidateProfileDomain(queryClient);
      trackEvent(EventType.PROFILE_EDIT, { action: 'save' });
      showToast('پروفایل ذخیره شد', IconPencil);
      onSaved();
    },
    onError: () => {
      trackEvent(EventType.PROFILE_EDIT, { action: 'error' });
      showToast('ذخیره نشد؛ دوباره امتحان کن', IconAlertTriangle);
    },
  });

  const canSave = name.trim().length <= 80 && !mutation.isPending;

  return (
    <Modal opened={opened} onClose={onClose} centered withinPortal={false} title="ویرایش پروفایل" overlayProps={{ backgroundOpacity: 0.38, blur: 2 }} transitionProps={{ duration: 0 }} styles={{ title: { fontFamily: 'var(--g-font-fa)', fontWeight: 800 }, content: { borderRadius: 'var(--g-radius-card)' } }}>
      <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-4)' }}>
        <TextInput
          label="نام نمایشی"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          maxLength={80}
          styles={{ label: { fontFamily: 'var(--g-font-fa)', fontWeight: 700 }, input: { fontFamily: 'var(--g-font-fa)', textAlign: 'right' } }}
        />
        <Box>
          <Text component="label" htmlFor="profile-avatar-upload" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, marginBlockEnd: 'var(--g-space-2)', color: 'var(--g-color-text-primary)' }}>آواتار</Text>
          <input id="profile-avatar-upload" type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => setFile(e.currentTarget.files?.[0] || null)} />
          {file ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 6 }}>{file.name}</Text> : null}
        </Box>
        <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
          <UnstyledButton type="button" onClick={() => mutation.mutate()} disabled={!canSave} style={{ flex: 1, minBlockSize: 46, borderRadius: 'var(--g-radius-input)', background: canSave ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontWeight: 800 }}>
            {mutation.isPending ? 'در حال ذخیره...' : 'ذخیره'}
          </UnstyledButton>
          <UnstyledButton type="button" onClick={onClose} disabled={mutation.isPending} style={{ minInlineSize: 92, minBlockSize: 46, borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-subtle)', fontFamily: 'var(--g-font-fa)', fontWeight: 700, color: 'var(--g-color-text-secondary)' }}>انصراف</UnstyledButton>
        </Box>
      </Box>
    </Modal>
  );
}

/* ── Profile view ── */
function ProfileView({ p, onEdit, navigate, trackEvent, onLogout }) {
  const { header, dna, progress, known, control, household, refetch } = p;
  const deferNavigate = useCallback((to) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => navigate(to));
    } else {
      setTimeout(() => navigate(to), 0);
    }
  }, [navigate]);
  const go = useCallback((to, source) => {
    trackEvent(EventType.PROFILE_NAVIGATE, { destination: to, source });
    deferNavigate(to);
  }, [deferNavigate, trackEvent]);
  return (
    <Box style={PAGE}>
      {/* header */}
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
        <Box style={{ position: 'relative', flexShrink: 0 }}>
          {header.avatar ? (
            <Box component="img" src={header.avatar} alt="" aria-hidden="true" style={{ inlineSize: 64, blockSize: 64, borderRadius: '50%', objectFit: 'cover', background: 'var(--g-color-brand-100)' }} />
          ) : (
            <Box aria-hidden="true" style={{ inlineSize: 64, blockSize: 64, borderRadius: '50%', background: 'var(--g-color-brand-100)', color: 'var(--g-color-brand-700)', display: 'grid', placeItems: 'center', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-22)' }}>{header.initial}</Box>
          )}
          {header.streakWeeks > 0 ? (
            <Box aria-label={`${toFaDigits(header.streakWeeks)} هفته پیاپی`} style={{ position: 'absolute', insetBlockEnd: -2, insetInlineStart: -4, display: 'inline-flex', alignItems: 'center', gap: 2, paddingInline: 'var(--g-space-2)', paddingBlock: 2, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', boxShadow: '0 0 0 2px var(--g-color-bg-canvas)', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-12)' }}>
              <IconFlame size={11} stroke={2} aria-hidden="true" />{toFaDigits(header.streakWeeks)}
            </Box>
          ) : null}
        </Box>
        <Box style={{ flex: 1, minInlineSize: 0 }}>
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{header.name}</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '3px 0 0' }}>
            {[header.isGuest ? 'حساب مهمان' : '', header.since ? `عضو از ${header.since}` : '', header.cooksText].filter(Boolean).join(' · ')}
          </Text>
        </Box>
        <UnstyledButton type="button" onClick={onEdit} aria-label="ویرایش پروفایل" style={{ flexShrink: 0, inlineSize: 44, blockSize: 44, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconPencil size={18} stroke={1.8} />
        </UnstyledButton>
      </Box>

      <ControlStrip control={control} known={known} />

      {/* DNA summary card → DNA view */}
      <UnstyledButton type="button" onClick={() => go('/food-dna', 'dna-card')} aria-label="شناسهٔ ذائقه — دیدن جزئیات و دقیق‌ترکردن" style={{ ...cardWrap, position: 'relative', overflow: 'hidden', boxShadow: 'var(--g-shadow-1)', padding: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-5)', textAlign: 'start' }}>
        <Box aria-hidden="true" style={{ position: 'absolute', insetBlockStart: -40, insetInlineStart: -30, inlineSize: 150, blockSize: 150, borderRadius: '50%', background: 'radial-gradient(circle, var(--g-color-brand-50), transparent 70%)' }} />
        <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', color: 'var(--g-color-brand-700)', marginBlockEnd: 'var(--g-space-4)' }}>
          <IconLeaf size={15} stroke={1.8} aria-hidden="true" />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800 }}>شناسهٔ ذائقهٔ تو</Text>
        </Box>
        <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--g-space-4)' }}>
          <FoodDnaRing size={96} tone={dna.forming ? 'forming' : 'mature'} caption="بلوغ" showValue={false} displayMode="qualitative" />
          <Box style={{ flex: 1, minInlineSize: 0 }}>
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 4, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>
              <IconTrendingUp size={12} stroke={1.8} aria-hidden="true" />{dna.bandLabel}
            </Box>
            {dna.traits.length ? (
              <Box style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '5px 7px', marginBlockStart: 'var(--g-space-3)' }}>
                {dna.traits.map((t, i) => (
                  <Box key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px 7px' }}>
                    {i > 0 ? <Text component="span" aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }}>·</Text> : null}
                    <Text component="b" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-brand-700)' }}>{t}</Text>
                  </Box>
                ))}
              </Box>
            ) : (
              <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-2) 0 0' }}>
                با انتخاب‌ها و آشپزی‌های بعدی، این تصویر دقیق‌تر می‌شود.
              </Text>
            )}
          </Box>
        </Box>
        <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', borderBlockStart: '1px solid var(--g-color-border-subtle)', color: 'var(--g-color-brand-700)' }}>
          <Text component="span" style={{ flex: 1, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}>دیدن جزئیات و دقیق‌ترکردن</Text>
          <IconChevronLeft size={18} stroke={1.9} aria-hidden="true" />
        </Box>
      </UnstyledButton>

      {/* پیشرفتِ تو — honest "unavailable" note when gamification is down, never zeroed cards */}
      <Text component="h2" style={sectionTitle}>پیشرفتِ تو</Text>
      {progress ? (
        <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--g-space-2)' }}>
          <StatCard icon={IconFlame} value={toFaDigits(progress.streakWeeks)} label="هفته پیاپی" />
          <StatCard icon={IconToolsKitchen2} value={toFaDigits(progress.totalCooks)} label="پخته‌شده" />
          <StatCard icon={IconAward} value={toFaDigits(progress.badges)} label="نشان" onClick={() => navigate('/achievements')} />
        </Box>
      ) : (
        <Box style={{ ...cardWrap, padding: 'var(--g-space-4)', display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>پیشرفتت این لحظه در دسترس نیست — کمی بعد دوباره سر بزن.</Text>
        </Box>
      )}

      {/* آنچه از تو می‌دانیم */}
      <Text component="h2" style={sectionTitle}>آنچه از تو می‌دانیم</Text>
      <Box style={cardWrap}>
        {known.status === 'unavailable' ? (
          <Box role="status" style={{ ...rowBtn, minBlockSize: 68, paddingBlock: 'var(--g-space-3)' }}>
            <IconInfoCircle size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-warning-fg)', flexShrink: 0 }} />
            <Box style={{ flex: 1, minInlineSize: 0 }}>
              <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>وضعیت الگوی غذایی و حساسیت‌ها مشخص نیست</Text>
              <Text component="span" style={{ display: 'block', marginBlockStart: 2, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>اطلاعات فعلی بارگذاری نشد؛ این یعنی «نامشخص»، نه «ثبت‌نشده».</Text>
            </Box>
            <UnstyledButton type="button" onClick={refetch} style={{ minBlockSize: 44, paddingInline: 'var(--g-space-2)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 800 }}>تلاش دوباره</UnstyledButton>
          </Box>
        ) : known.status === 'loading' ? (
          <Box role="status" aria-live="polite" style={{ ...rowBtn, paddingBlock: 'var(--g-space-3)' }}>
            <IconInfoCircle size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
            <Text component="span" style={{ flex: 1, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)' }}>در حال دریافت الگوی غذایی و حساسیت‌ها…</Text>
          </Box>
        ) : null}
        {known.status === 'ready' && known.dietLabel ? (
          <KnownRow icon={IconPlant2} iconColor="var(--g-color-brand-600)" onEdit={() => deferNavigate('/settings#food-profile')}>
            بیشتر غذای <b>{known.dietLabel}</b> را دوست داری
          </KnownRow>
        ) : null}
        {known.status === 'ready' ? known.allergens.map((a, i) => (
          <KnownRow key={a} icon={IconAlertTriangle} iconColor="var(--g-color-allergen-fg)" divider={i > 0 || !!known.dietLabel} onEdit={() => deferNavigate('/settings#allergies')}>
            حساسیت به <b>{a}</b> — پرچمِ ایمنی فعال است
          </KnownRow>
        )) : null}
        {known.status === 'ready' && !known.dietLabel && !known.allergens.length ? (
          <Box style={{ ...rowBtn, paddingBlock: 'var(--g-space-3)' }}>
            <IconLeaf size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
            <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' }}>هنوز الگوی غذایی یا حساسیتی ثبت نکرده‌ای.</Text>
          </Box>
        ) : null}
      </Box>

      <UnstyledButton
        type="button"
        onClick={() => go('/settings#personalization-profile', 'personalization-answers')}
        aria-label="ویرایش پاسخ‌های شخصی‌سازی"
        style={{ ...cardWrap, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', minBlockSize: 68, marginBlockStart: 'var(--g-space-3)', padding: 'var(--g-space-4)', textAlign: 'start', boxShadow: 'var(--g-shadow-1)' }}
      >
        <Box aria-hidden="true" style={{ inlineSize: 40, blockSize: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)' }}>
          <IconSparkles size={20} stroke={1.8} />
        </Box>
        <Box style={{ flex: 1, minInlineSize: 0 }}>
          <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-text-primary)' }}>ویرایش پاسخ‌های شخصی‌سازی</Text>
          <Text component="span" style={{ display: 'block', marginBlockStart: 2, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>غذا، ایمنی، زمان، تعداد نفرات و ذائقه</Text>
          {control?.personalizationStatus === 'unavailable' ? (
            <Text component="span" style={{ display: 'block', marginBlockStart: 3, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-state-warning-fg)' }}>وضعیت یادگیری اختیاری فعلاً مشخص نیست</Text>
          ) : null}
        </Box>
        <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
      </UnstyledButton>

      <HouseholdCard household={household} onOpen={() => go('/household', 'household-card')} />

      {/* دسترسی سریع */}
      <Text component="h2" style={sectionTitle}>دسترسی سریع</Text>
      <Box style={cardWrap}>
        <QuickRow icon={IconBookmark} label="علاقه‌مندی‌ها" onClick={() => go('/favorites', 'favorites')} />
        <QuickRow icon={IconAward} label="دستاوردها" onClick={() => go('/achievements', 'achievements')} last />
      </Box>

      {/* logout */}
      <UnstyledButton type="button" onClick={onLogout} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 52, marginBlockStart: 'var(--g-space-6)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-state-danger-fg)', background: 'var(--g-color-state-danger-bg)', color: 'var(--g-color-state-danger-fg)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700 }}>
        <IconLogout size={18} stroke={1.8} aria-hidden="true" />خروج از حساب
      </UnstyledButton>
    </Box>
  );
}

function ProfileLoading() {
  return (
    <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={PAGE}>
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)' }}>
        <SkeletonCircle size={64} />
        <Box style={{ flex: 1 }}><SkeletonLine w="55%" h={16} /><SkeletonLine w="38%" h={12} style={{ marginBlockStart: 'var(--g-space-2)' }} /></Box>
      </Box>
      <Box className="g-skeleton" style={{ blockSize: 140, borderRadius: 'var(--g-radius-card)', marginBlockStart: 'var(--g-space-5)' }} />
      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-5)' }}>
        <Box className="g-skeleton" style={{ blockSize: 84, borderRadius: 'var(--g-radius-card)' }} />
        <Box className="g-skeleton" style={{ blockSize: 84, borderRadius: 'var(--g-radius-card)' }} />
        <Box className="g-skeleton" style={{ blockSize: 84, borderRadius: 'var(--g-radius-card)' }} />
      </Box>
    </Box>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { trackEvent } = useAnalytics();
  const p = useProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => { trackEvent(EventType.PROFILE_VIEW, { surface: 'profile' }); }, [trackEvent]);
  const showToast = useCallback((message, Icon) => {
    clearTimeout(toastTimer.current);
    setToast({ message, Icon });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  const onLogout = useCallback(() => { logout(); navigate('/login', { replace: true }); }, [logout, navigate]);
  const openEdit = useCallback(() => {
    trackEvent(EventType.PROFILE_EDIT, { action: 'open' });
    setEditOpen(true);
  }, [trackEvent]);

  if (p.status === 'loading') return <ProfileLoading />;
  if (p.status === 'error') return <ErrorState title="پروفایل بارگذاری نشد" body="یک اتصال کوتاه قطع شد. چیزی از دست نرفته." reassurance="اطلاعاتت امن ذخیره است" onRetry={p.refetch} />;

  return (
    <>
      <ProfileView p={p} onEdit={openEdit} navigate={navigate} trackEvent={trackEvent} onLogout={onLogout} />
      <ProfileEditModal opened={editOpen} onClose={() => setEditOpen(false)} profile={p} onSaved={() => setEditOpen(false)} showToast={showToast} />
      <Toast toast={toast} />
    </>
  );
}
