import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconRefresh, IconCheck, IconPlus, IconShoppingCart, IconWand, IconCloudOff, IconShieldCheck, IconTrash, IconPencil, IconX, IconHome, IconArchive, IconUsers, IconMinus } from '@tabler/icons-react';
import { useShopping } from './useShopping';
import { emojiFor } from './ingredient-emoji';
import { toFaDigits } from '../../components/ges/format';
import { SkeletonLine } from '../../components/ges/LoadingSkeleton';
import Toast from '../../components/ges/Toast';
import { isHouseholdV1Enabled } from '../household/feature';

const normalizeShoppingAmount = (value) =>
  String(value ?? '')
    .replace(/\bas needed\b/gi, 'به مقدار لازم')
    .replace(/\bto taste\b/gi, 'به مقدار لازم')
    .trim();

function GroceryRow({ item, checked, onToggle, onRemove, onUpdate, onPantry, aisle, first }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount || '');
  const border = first ? 'none' : '1px solid var(--g-color-border-subtle)';

  // EDIT MODE — name + amount inputs + save/cancel (founder: «چرا قابل ادیت نیست؟»), plus a «از قبل دارم» shortcut.
  if (editing) {
    const save = async () => { const n = name.trim(); if (!n) return; await onUpdate({ name: n, amount: amount.trim() }); setEditing(false); };
    return (
      <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-1)', borderBlockStart: border, paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-2)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          <Box component="input" value={name} onChange={(e) => setName(e.target.value)} aria-label="نام" style={{ flex: 2, minInlineSize: 0, blockSize: 40, paddingInline: 'var(--g-space-3)', border: '1px solid var(--g-color-border-strong)', borderRadius: 'var(--g-radius-input)', outline: 'none', background: 'var(--g-color-bg-surface)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 500, color: 'var(--g-color-text-primary)' }} />
          <Box component="input" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="مقدار" placeholder="مقدار" onKeyDown={(e) => { if (e.key === 'Enter') save(); }} style={{ flex: 1, minInlineSize: 0, blockSize: 40, paddingInline: 'var(--g-space-3)', border: '1px solid var(--g-color-border-strong)', borderRadius: 'var(--g-radius-input)', outline: 'none', background: 'var(--g-color-bg-surface)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }} />
          <UnstyledButton type="button" onClick={save} aria-label="ذخیره" style={{ flexShrink: 0, inlineSize: 40, blockSize: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)' }}><IconCheck size={17} stroke={2.2} /></UnstyledButton>
          <UnstyledButton type="button" onClick={() => setEditing(false)} aria-label="انصراف" style={{ flexShrink: 0, inlineSize: 40, blockSize: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-muted)' }}><IconX size={17} stroke={1.8} /></UnstyledButton>
        </Box>
        <UnstyledButton type="button" onClick={() => { setEditing(false); onPantry(); }} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, minBlockSize: 32, paddingInline: 'var(--g-space-2)', color: 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}><IconHome size={13} stroke={1.8} aria-hidden="true" />همیشه خونه دارمش، دیگه نخرش</UnstyledButton>
      </Box>
    );
  }

  return (
    <Box style={{ display: 'flex', alignItems: 'center', borderBlockStart: border, opacity: checked ? 0.55 : 1, transition: 'opacity 200ms ease' }}>
      {/* the row body toggles the no-shame checked state (accessible name = the item) */}
      <UnstyledButton type="button" onClick={onToggle} aria-pressed={checked} style={{ flex: 1, minInlineSize: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', minBlockSize: 48, paddingInlineStart: 'var(--g-space-4)', paddingInlineEnd: 'var(--g-space-2)', paddingBlock: 'var(--g-space-3)' }}>
        <Box aria-hidden="true" className={checked ? 'g-check-pop' : undefined} style={{ flexShrink: 0, inlineSize: 24, blockSize: 24, borderRadius: 'var(--g-radius-chip)', border: checked ? 'none' : '1.5px solid var(--g-color-border-strong)', background: checked ? 'var(--g-color-brand-600)' : 'transparent', color: 'var(--g-color-text-inverse)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background 140ms ease, border-color 140ms ease' }}>
          {checked ? <IconCheck size={14} stroke={2.4} /> : null}
        </Box>
        <Box component="span" aria-hidden="true" style={{ flexShrink: 0, fontSize: 18, lineHeight: 1, marginInlineStart: -2, opacity: checked ? 0.5 : 1 }}>{emojiFor(item.name, aisle)}</Box>
        <Text component="span" style={{ flex: 1, textAlign: 'start', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 500, color: checked ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)', textDecoration: checked ? 'line-through' : 'none' }}>{item.name}</Text>
        {checked ? (
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-state-success-fg)', whiteSpace: 'nowrap' }}>گرفتم</Text>
        ) : item.amount || item.unit ? (
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', whiteSpace: 'nowrap' }}>{toFaDigits([normalizeShoppingAmount(item.amount), normalizeShoppingAmount(item.unit)].filter(Boolean).join(' '))}</Text>
        ) : null}
      </UnstyledButton>
      {/* edit — inline name/amount */}
      <UnstyledButton type="button" onClick={() => { setName(item.name); setAmount(item.amount || ''); setEditing(true); }} aria-label="ویرایش" style={{ flexShrink: 0, inlineSize: 40, blockSize: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-muted)' }}>
        <IconPencil size={16} stroke={1.8} aria-hidden="true" />
      </UnstyledButton>
      {/* delete — removes the item from the real list (optimistic) */}
      <UnstyledButton type="button" onClick={onRemove} aria-label="حذف از لیست" style={{ flexShrink: 0, inlineSize: 44, blockSize: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-muted)' }}>
        <IconTrash size={18} stroke={1.8} aria-hidden="true" />
      </UnstyledButton>
    </Box>
  );
}

// the «for how many people» picker lives RIGHT HERE at the build moment — one place, self-explanatory; it scales the
// list's quantities (a recipe written for 4, built «for 8», buys double). No per-dish clutter on the plan.
function ServingsPick({ value, onChange }) {
  const v = value || 4;
  const btn = { flexShrink: 0, inlineSize: 28, blockSize: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--g-color-border-strong)', color: 'var(--g-color-text-secondary)' };
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-1)' }}>
      <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconUsers size={15} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} /><Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)' }}>برای چند نفر؟</Text></Box>
      <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
        <UnstyledButton type="button" onClick={() => onChange(Math.max(1, v - 1))} aria-label="نفرِ کمتر" style={btn}><IconMinus size={14} stroke={2.2} /></UnstyledButton>
        <Text component="span" aria-label={`${v} نفر`} style={{ minInlineSize: 44, textAlign: 'center', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 800, color: 'var(--g-color-text-primary)' }}>{toFaDigits(v)} نفر</Text>
        <UnstyledButton type="button" onClick={() => onChange(Math.min(20, v + 1))} aria-label="نفرِ بیشتر" style={btn}><IconPlus size={14} stroke={2.2} /></UnstyledButton>
      </Box>
    </Box>
  );
}

function ShoppingEmpty({ onFromPlan, busy, servings, onServings }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)', marginBlockEnd: 'var(--g-space-2)' }}><IconShoppingCart size={28} stroke={1.6} /></Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>لیستت خالیه</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>از روی برنامهٔ هفته بسازش؟ مقدارها برای تعدادِ نفری که می‌گی حساب می‌شه.</Text>
      <ServingsPick value={servings} onChange={onServings} />
      <UnstyledButton type="button" onClick={onFromPlan} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconWand size={16} stroke={1.8} aria-hidden="true" />{busy ? 'در حال ساختن…' : 'ساختن از برنامه'}</UnstyledButton>
    </Box>
  );
}

function ShoppingError({ onRetry }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-1)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 56, blockSize: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', marginBlockEnd: 'var(--g-space-2)' }}><IconCloudOff size={26} stroke={1.6} /></Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>یه مشکلی پیش اومد</Text>
      <Text component="p" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-state-success-fg)', margin: 'var(--g-space-1) 0 0' }}><IconShieldCheck size={13} stroke={1.8} aria-hidden="true" />لیستت روی حسابت محفوظه</Text>
      <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={16} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
    </Box>
  );
}

function PlanBuildSummary({ summary }) {
  if (!summary) return null;
  const parts = [
    `${toFaDigits(summary.added)} قلم تازه`,
    summary.merged ? `${toFaDigits(summary.merged)} ادغام` : null,
    summary.removedPlan ? `${toFaDigits(summary.removedPlan)} ردیف قبلیِ برنامه پاک شد` : null,
  ].filter(Boolean);
  return (
    <Box role="status" style={{ margin: 'var(--g-space-4) var(--g-space-4) 0', padding: 'var(--g-space-3) var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-brand-50)', border: '1px solid var(--g-color-brand-200)' }}>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-brand-700)' }}>خلاصهٔ ساخت از برنامه{summary.servings ? ` · برای ${toFaDigits(summary.servings)} نفر` : ''}</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-1) 0 0' }}>{parts.join(' · ')}</Text>
      {summary.flagged ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-state-warning-fg)', margin: 'var(--g-space-1) 0 0' }}>{toFaDigits(summary.flagged)} مقدار یا واحد نیازمند بررسی است.</Text> : null}
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-1) 0 0' }}>این جمع‌بندی برای کل لیست است؛ دادهٔ فعلی منبع هر قلم را به یک غذای مشخص وصل نمی‌کند.</Text>
    </Box>
  );
}

export default function ShoppingListPage() {
  const s = useShopping();
  const [draft, setDraft] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [servings, setServings] = useState(4); // «for how many people» the build-from-plan scales the list to
  const [buildSummary, setBuildSummary] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => { clearTimeout(toastTimer.current); setToast({ message, Icon }); toastTimer.current = setTimeout(() => setToast(null), 2200); }, []);

  const onFromPlan = async () => {
    const r = await s.buildFromPlan(servings);
    if (!r.ok) { showToast('الان نشد — دوباره امتحان کن', IconCloudOff); return; }
    if (r.noPlan) {
      setBuildSummary(r.removedPlan ? r : null);
      showToast(
        r.removedPlan
          ? `${toFaDigits(r.removedPlan)} ردیف قدیمیِ برنامه پاک شد؛ برنامهٔ فعالی پیدا نشد`
          : 'برنامهٔ فعالی پیدا نشد؛ اول برنامهٔ هفته را بچین',
        IconWand,
      );
      return;
    }
    setBuildSummary(r);
    if (!r.added && !r.merged) { showToast('مورد تازه‌ای برای خرید لازم نبود', IconCheck); return; }
    const flag = r.flagged ? ` · ${toFaDigits(r.flagged)} نیاز به بررسی واحد` : '';
    showToast(`از برنامه ساخته شد · ${toFaDigits(r.added)} مورد${r.merged ? ` · ${toFaDigits(r.merged)} ادغام` : ''}${flag}`, IconWand);
  };
  const onAdd = async () => { const ok = await s.addManual(draft); if (ok) { setDraft(''); showToast('به لیست اضافه شد', IconPlus); } else showToast('اضافه نشد — دوباره امتحان کن', IconCloudOff); };
  const onClearChecked = async () => { const n = s.done; const ok = await s.clearChecked(); showToast(ok ? `${toFaDigits(n)} مورد پاک شد` : 'الان نشد — دوباره امتحان کن', ok ? IconCheck : IconCloudOff); };
  const onClearAll = async () => {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; } // 2-tap confirm (destructive)
    setConfirmClear(false);
    const ok = await s.clearAll();
    showToast(ok ? 'کلِ لیست پاک شد' : 'الان نشد — دوباره امتحان کن', ok ? IconTrash : IconCloudOff);
  };

  return (
    <Box style={{ flex: 1, minBlockSize: 0, display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Box>
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>لیست خرید</Text>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '2px 0 0' }}>
            {s.total > 0 ? `${toFaDigits(s.done)} از ${toFaDigits(s.total)} گرفته شد` : 'لیستِ خرید هفته'}
          </Text>
        </Box>
        <UnstyledButton type="button" onClick={onFromPlan} disabled={s.busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-3)', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-brand-200)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}><IconRefresh size={14} stroke={1.8} aria-hidden="true" />از روی برنامه</UnstyledButton>
      </Box>

      {isHouseholdV1Enabled() ? (
        <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)' }}>
          <UnstyledButton
            type="button"
            onClick={() => navigate('/household')}
            aria-label="باز کردن خرید باهم"
            style={{
              inlineSize: '100%',
              minBlockSize: 56,
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--g-space-3)',
              padding: 'var(--g-space-2) var(--g-space-3)',
              border: '1px solid var(--g-color-brand-200)',
              borderRadius: 'var(--g-radius-card)',
              background: 'var(--g-color-ai-surface)',
              textAlign: 'start',
            }}
          >
            <Box aria-hidden="true" style={{ inlineSize: 38, blockSize: 38, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)' }}>
              <IconUsers size={19} stroke={1.8} />
            </Box>
            <Box style={{ flex: 1, minInlineSize: 0 }}>
              <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-text-primary)' }}>خرید باهم</Text>
              <Text component="span" style={{ display: 'block', marginBlockStart: 2, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>لیست مشترک و تصمیم سریع برای ناموجودها</Text>
            </Box>
          </UnstyledButton>
        </Box>
      ) : null}

      <Box style={{ flex: 1, minBlockSize: 0, overflowY: 'auto' }}>
        <PlanBuildSummary summary={buildSummary} />
        {s.status === 'loading' ? (
          <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ padding: 'var(--g-space-4)' }}>
            <SkeletonLine w="40%" h={14} />
            <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', marginBlockStart: 'var(--g-space-3)' }}>
              {[0, 1, 2].map((i) => <Box key={i} style={{ minBlockSize: 48, borderBlockStart: i ? '1px solid var(--g-color-border-subtle)' : 'none', display: 'flex', alignItems: 'center', paddingInline: 'var(--g-space-4)' }}><SkeletonLine w="60%" h={12} /></Box>)}
            </Box>
          </Box>
        ) : s.status === 'error' ? <ShoppingError onRetry={s.refetch} />
          : s.status === 'empty' ? <ShoppingEmpty onFromPlan={onFromPlan} busy={s.busy} servings={servings} onServings={setServings} />
            : (
              <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-4)' }}>
                {/* trip progress: a completion moment when everything's got, else a quiet "clear what's got" affordance */}
                {s.done > 0 ? (
                  s.done === s.total ? (
                    <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-3)', padding: 'var(--g-space-3) var(--g-space-4)', marginBlockEnd: 'var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-state-success-bg, var(--g-color-brand-50))', border: '1px solid var(--g-color-state-success-fg)' }}>
                      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-state-success-fg)' }}>🎉 همه‌چیزو گرفتی!</Text>
                      <UnstyledButton type="button" onClick={onClearChecked} disabled={s.busy} style={{ flexShrink: 0, minBlockSize: 40, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700 }}>پاک کن و آماده شو</UnstyledButton>
                    </Box>
                  ) : (
                    <Box style={{ display: 'flex', justifyContent: 'flex-end', marginBlockEnd: 'var(--g-space-3)' }}>
                      <UnstyledButton type="button" onClick={onClearChecked} disabled={s.busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 36, paddingInline: 'var(--g-space-3)', borderRadius: 'var(--g-radius-chip)', color: 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}><IconTrash size={13} stroke={1.8} aria-hidden="true" />پاک‌کردنِ {toFaDigits(s.done)} گرفته‌شده</UnstyledButton>
                    </Box>
                  )
                ) : null}
                {s.groups.map((g) => (
                  <Box key={g.key} style={{ marginBlockEnd: 'var(--g-space-5)' }}>
                    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginInline: 2, marginBlockEnd: 'var(--g-space-2)' }}>
                      <g.Icon size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
                      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{g.label}</Text>
                    </Box>
                    <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', overflow: 'hidden' }}>
                      {g.items.map((it, i) => <GroceryRow key={it.id} item={it} checked={s.checkedOf(it)} onToggle={() => s.toggle(it)} onRemove={() => s.remove(it)} onUpdate={(patch) => s.updateItem(it, patch)} onPantry={() => s.addToPantry(it)} aisle={g.key} first={i === 0} />)}
                    </Box>
                  </Box>
                ))}
                {/* clear the WHOLE list — quiet, destructive, 2-tap confirm (founder: «پاک کردن کل لیست خرید نداره؟») */}
                <Box style={{ display: 'flex', justifyContent: 'center', marginBlockStart: 'var(--g-space-2)' }}>
                  <UnstyledButton type="button" onClick={onClearAll} disabled={s.busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 40, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', color: confirmClear ? 'var(--g-color-state-danger-fg, var(--g-color-brand-700))' : 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
                    <IconTrash size={13} stroke={1.8} aria-hidden="true" />{confirmClear ? 'مطمئنی؟ دوباره بزن' : 'پاک‌کردنِ کلِ لیست'}
                  </UnstyledButton>
                </Box>
                {/* PANTRY — "always have" staples; build-from-plan subtracts these. Seeded via a row's «از قبل دارم». */}
                {(s.pantryItems?.length ?? 0) > 0 ? (
                  <Box style={{ marginBlockStart: 'var(--g-space-6)', paddingBlockStart: 'var(--g-space-4)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
                    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockEnd: 'var(--g-space-1)' }}>
                      <IconArchive size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
                      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-text-secondary)', margin: 0 }}>چیزایی که همیشه خونه داری</Text>
                    </Box>
                    <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '0 0 var(--g-space-2)' }}>اینا همیشه تو خونه‌ان (مثلِ نمک و روغن). وقتی لیست رو از «برنامهٔ هفتگی» می‌سازیم، این‌ها رو دیگه اضافه نمی‌کنیم که الکی نخری.</Text>
                    <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                      {s.pantryItems.map((p) => (
                        <Box key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInlineStart: 'var(--g-space-2)', paddingInlineEnd: 2, paddingBlock: 3, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)' }}>
                          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-primary)' }}>{`${emojiFor(p.name)} ${p.name}`.trim()}</Text>
                          <UnstyledButton type="button" onClick={() => s.removeFromPantry(p)} aria-label={`حذفِ ${p.name} از موادِ همیشگی`} style={{ flexShrink: 0, inlineSize: 24, blockSize: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-muted)' }}><IconX size={13} stroke={1.8} aria-hidden="true" /></UnstyledButton>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : null}
              </Box>
            )}
      </Box>

      {/* manual add */}
      <Box style={{ position: 'sticky', insetBlockEnd: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-3) + env(safe-area-inset-bottom))', background: 'var(--g-color-bg-surface-raised)', borderBlockStart: '1px solid var(--g-color-border-subtle)', boxShadow: 'var(--g-shadow-2)' }}>
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', blockSize: 46, paddingInline: 'var(--g-space-4)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-input)' }}>
          <IconPlus size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
          <Box component="input" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !s.busy && draft.trim()) onAdd(); }} placeholder="مثلاً «گوجه ۲ کیلو»…" aria-label="افزودن آیتم (می‌تونی مقدار رو هم بنویسی)" style={{ flex: 1, minInlineSize: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' }} />
        </Box>
        <UnstyledButton type="button" onClick={onAdd} aria-label="افزودن" disabled={s.busy || !draft.trim()} style={{ inlineSize: 46, blockSize: 46, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--g-radius-input)', background: draft.trim() ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)', color: 'var(--g-color-text-inverse)' }}><IconPlus size={20} stroke={1.8} /></UnstyledButton>
      </Box>

      <Toast toast={toast} />
    </Box>
  );
}
