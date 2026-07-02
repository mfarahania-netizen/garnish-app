import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconSparkles, IconWand, IconShoppingCart, IconChevronLeft, IconEyeCheck, IconCheck,
  IconCalendarPlus, IconCloudOff, IconRefresh, IconClock, IconTrash, IconPlus, IconX, IconSearch,
  IconArrowsExchange, IconFlame, IconChevronRight, IconCopy,
} from '@tabler/icons-react';
import { useMealPlan } from './useMealPlan';
import { faDuration, toFaDigits, recipeDurationMinutes } from '../../components/ges/format';
import { useAnalytics } from '../../hooks/useAnalytics';
import PlatePlaceholder from '../../components/ges/PlatePlaceholder';
import Toast from '../../components/ges/Toast';

const seed = (id) => { const s = String(id ?? ''); let h = 0; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const SHORT_DAY = ['شنبه', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'جمعه'];
// the meal the user most likely cares about right now (drives the "امروز" hero)
const nextMealKey = () => { const h = new Date().getHours(); if (h < 10) return 'breakfast'; if (h < 15) return 'lunch'; if (h < 18) return 'snack'; return 'dinner'; };
const weekLabel = (o) => (o === 0 ? 'این هفته' : o === 1 ? 'هفتهٔ بعد' : o === -1 ? 'هفتهٔ پیش' : '');

function Thumb({ title, size = 56 }) {
  return (
    <Box style={{ position: 'relative', flexShrink: 0, inlineSize: size, blockSize: size, borderRadius: 'var(--g-radius-input)', overflow: 'hidden' }}>
      <PlatePlaceholder label={title} seed={seed(title)} glyphSize={Math.round(size * 0.42)} />
    </Box>
  );
}

/**
 * SlotRow — a full-width meal slot for the single-day view. Three states: FILLED (dish + swap/remove, tap → recipe),
 * SUGGESTED (AI proposal: accept / یکی دیگه), EMPTY (an inviting «+ افزودن {meal}» that opens the picker).
 */
function SlotRow({ meal, slot, cooked, onOpen, onAccept, onSwap, onRemove, onAdd, onCook }) {
  if (slot?.kind === 'filled') {
    return (
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', background: cooked ? 'var(--g-color-state-success-bg, var(--g-color-brand-50))' : 'var(--g-color-bg-surface)', border: cooked ? '1px solid var(--g-color-state-success-fg)' : '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-2)', boxShadow: cooked ? 'none' : 'var(--g-shadow-1)', transition: 'background 200ms var(--g-ease-standard)' }}>
        {/* the «پختم» check — the signature moment (mirrors the shopping check-off the founder loved) */}
        <UnstyledButton type="button" onClick={onCook} aria-pressed={!!cooked} aria-label={cooked ? 'پخته شد — برگردان' : 'علامتِ پخته شد'} style={{ flexShrink: 0, inlineSize: 30, blockSize: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box aria-hidden="true" className={cooked ? 'g-check-pop' : undefined} style={{ inlineSize: 26, blockSize: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', border: cooked ? 'none' : '1.5px solid var(--g-color-border-strong)', background: cooked ? 'var(--g-color-brand-600)' : 'transparent', color: 'var(--g-color-text-inverse)', transition: 'background 140ms var(--g-ease-standard), border-color 140ms var(--g-ease-standard)' }}>{cooked ? <IconCheck size={15} stroke={2.6} /> : null}</Box>
        </UnstyledButton>
        <UnstyledButton type="button" onClick={onOpen} aria-label={`${slot.title} — مشاهدهٔ دستور`} style={{ flex: 1, minInlineSize: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', textAlign: 'start', opacity: cooked ? 0.62 : 1 }}>
          <Thumb title={slot.title} size={48} />
          <Box style={{ flex: 1, minInlineSize: 0 }}>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.7, textDecoration: cooked ? 'line-through' : 'none' }}>{slot.title}</Text>
            {cooked ? (
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-state-success-fg)', marginBlockStart: 2 }}>پخته شد ✓</Text>
            ) : slot.cookTimeText ? <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginBlockStart: 2, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}><IconClock size={12} stroke={1.8} aria-hidden="true" />{slot.cookTimeText}</Box> : null}
          </Box>
        </UnstyledButton>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 0, flexShrink: 0 }}>
          <UnstyledButton type="button" onClick={onAdd} aria-label="تغییرِ غذا" style={{ inlineSize: 34, blockSize: 34, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-muted)' }}><IconArrowsExchange size={15} stroke={1.8} /></UnstyledButton>
          <UnstyledButton type="button" onClick={onRemove} aria-label="حذف از برنامه" style={{ inlineSize: 34, blockSize: 34, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-muted)' }}><IconTrash size={15} stroke={1.7} /></UnstyledButton>
        </Box>
      </Box>
    );
  }
  if (slot?.kind === 'suggested') {
    return (
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-2)' }}>
        <UnstyledButton type="button" onClick={onOpen} aria-label={`${slot.title} — پیشنهاد`} style={{ flex: 1, minInlineSize: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', textAlign: 'start' }}>
          <Thumb title={slot.title} />
          <Box style={{ flex: 1, minInlineSize: 0 }}>
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconSparkles size={11} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} /><Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-brand-700)' }}>پیشنهادِ AI</Text></Box>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.7 }}>{slot.title}</Text>
          </Box>
        </UnstyledButton>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', flexShrink: 0 }}>
          <UnstyledButton type="button" onClick={onSwap} aria-label="یکی دیگه" style={{ inlineSize: 38, blockSize: 38, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-brand-700)' }}><IconRefresh size={16} stroke={1.8} /></UnstyledButton>
          <UnstyledButton type="button" onClick={onAccept} aria-label="بپذیر" style={{ inlineSize: 38, blockSize: 38, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)' }}><IconCheck size={17} stroke={2.2} /></UnstyledButton>
        </Box>
      </Box>
    );
  }
  // EMPTY — inviting, never a dead dash
  return (
    <UnstyledButton type="button" onClick={onAdd} aria-label={`افزودنِ ${meal.label}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 56, paddingInline: 'var(--g-space-4)', border: '1.5px dashed var(--g-color-border-strong)', borderRadius: 'var(--g-radius-card)', color: 'var(--g-color-text-muted)', background: 'transparent' }}>
      <Box aria-hidden="true" style={{ inlineSize: 26, blockSize: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)' }}><IconPlus size={16} stroke={2} /></Box>
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>{`افزودنِ ${meal.label}`}</Text>
    </UnstyledButton>
  );
}

/** The compressed 7-day RTL week strip (Sat rightmost). Density dots show which slots are filled — the glance layer. */
function WeekStrip({ days, meals, filled, suggested, selectedDay, onSelect }) {
  return (
    <Box className="g-glass-chrome" style={{ position: 'sticky', insetBlockStart: 0, zIndex: 5, display: 'flex', gap: 2, paddingInline: 'var(--g-space-2)', paddingBlock: 'var(--g-space-2)', background: 'var(--g-color-bg-surface-raised)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
      {days.map((day) => {
        const isSel = day.dayOfWeek === selectedDay;
        const dots = meals.map((m) => !!(filled[`${day.dayOfWeek}:${m.key}`] || suggested[`${day.dayOfWeek}:${m.key}`]));
        return (
          <UnstyledButton key={day.dayOfWeek} type="button" onClick={() => onSelect(day.dayOfWeek)} aria-label={day.label} aria-pressed={isSel} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingBlock: 'var(--g-space-2)', paddingInline: 1, borderRadius: 'var(--g-radius-input)', background: isSel ? 'var(--g-color-brand-50)' : 'transparent', border: isSel ? '1px solid var(--g-color-brand-200)' : '1px solid transparent', transition: 'background 160ms var(--g-ease-standard)' }}>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: day.isToday || isSel ? 800 : 600, color: day.isToday ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)' }}>{SHORT_DAY[day.dayOfWeek]}</Text>
            <Box aria-hidden="true" style={{ inlineSize: 26, blockSize: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: day.isToday ? 'var(--g-color-brand-600)' : 'transparent', color: day.isToday ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700 }}>{day.dayFa}</Box>
            <Box aria-hidden="true" style={{ display: 'flex', gap: 2, blockSize: 5 }}>
              {dots.map((on, i) => <Box key={i} style={{ inlineSize: 5, blockSize: 5, borderRadius: '50%', background: on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)', transition: 'background 150ms var(--g-ease-standard)' }} />)}
            </Box>
          </UnstyledButton>
        );
      })}
    </Box>
  );
}

/**
 * DishPicker — the manual add-a-dish-to-a-slot sheet. Opens for a (day, meal), shows safe + meal-appropriate suggestions
 * immediately, searches the whole corpus as you type. Allergy-gated server-side. Pick → POST /meal-plans/slots.
 */
function DishPicker({ open, day, meal, onClose, onPick, fetchOptions }) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { if (open) { setQ(''); setBusyId(null); } }, [open, day, meal]);
  useEffect(() => {
    if (!open || !meal) return undefined;
    let alive = true; setLoading(true);
    const t = setTimeout(async () => {
      const opts = await fetchOptions(meal.key, q);
      if (alive) { setOptions(opts); setLoading(false); }
    }, q ? 280 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [open, q, meal, fetchOptions]);

  if (!open) return null;
  return (
    <Box style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <Box onClick={onClose} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <Box role="dialog" aria-modal="true" aria-label="انتخاب غذا" style={{ position: 'relative', inlineSize: '100%', maxInlineSize: 480, marginInline: 'auto', background: 'var(--g-color-bg-surface-raised)', borderStartStartRadius: 'var(--g-radius-sheet)', borderStartEndRadius: 'var(--g-radius-sheet)', maxBlockSize: '82dvh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--g-shadow-3)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
          <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{`${meal?.label} ${day?.label}`}</Text>
          <UnstyledButton type="button" onClick={onClose} aria-label="بستن" style={{ flexShrink: 0, inlineSize: 36, blockSize: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: 'var(--g-color-text-muted)', background: 'var(--g-color-bg-surface)' }}><IconX size={18} stroke={1.8} /></UnstyledButton>
        </Box>
        <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-3)' }}>
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', blockSize: 46, paddingInline: 'var(--g-space-3)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-input)' }}>
            <IconSearch size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
            <Box component="input" type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی غذا… (مثلاً قورمه)" aria-label="جست‌وجوی غذا" autoFocus style={{ flex: 1, minInlineSize: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' }} />
          </Box>
        </Box>
        <Box style={{ flex: 1, overflowY: 'auto', paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'calc(var(--g-space-4) + env(safe-area-inset-bottom))' }}>
          {loading ? (
            [0, 1, 2, 3].map((i) => <Box key={i} className="g-skeleton" style={{ blockSize: 56, borderRadius: 'var(--g-radius-input)', marginBlockEnd: 'var(--g-space-2)' }} />)
          ) : options.length === 0 ? (
            <Text component="p" style={{ textAlign: 'center', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-muted)', paddingBlock: 'var(--g-space-6)' }}>{q ? 'غذایی پیدا نشد — یه اسمِ دیگه امتحان کن' : 'در حال آماده‌سازی…'}</Text>
          ) : options.map((o) => {
            const time = faDuration(recipeDurationMinutes(o));
            return (
              <UnstyledButton key={o.recipeId} type="button" disabled={!!busyId} onClick={async () => { setBusyId(o.recipeId); const ok = await onPick(o.recipeId); if (!ok) setBusyId(null); }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', textAlign: 'start', minBlockSize: 56, paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-2)', marginBlockEnd: 'var(--g-space-2)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-input)' }}>
                <Thumb title={o.title} size={40} />
                <Box style={{ flex: 1, minInlineSize: 0 }}>
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</Text>
                  {time ? <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginBlockStart: 2, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}><IconClock size={11} stroke={1.8} aria-hidden="true" />{time}</Box> : null}
                </Box>
                <Box aria-hidden="true" style={{ flexShrink: 0, inlineSize: 30, blockSize: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: busyId === o.recipeId ? 'var(--g-color-brand-200)' : 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)' }}>{busyId === o.recipeId ? <IconCheck size={16} stroke={2.2} /> : <IconPlus size={16} stroke={2} />}</Box>
              </UnstyledButton>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

function PlanLoading() {
  return (
    <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ padding: 'var(--g-space-4)' }}>
      <Box className="g-skeleton" style={{ blockSize: 56, borderRadius: 'var(--g-radius-input)', marginBlockEnd: 'var(--g-space-3)' }} />
      {[0, 1, 2, 3].map((i) => <Box key={i} className="g-skeleton" style={{ blockSize: 72, borderRadius: 'var(--g-radius-card)', marginBlockEnd: 'var(--g-space-2)' }} />)}
    </Box>
  );
}

function PlanError({ onRetry }) {
  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 56, blockSize: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', marginBlockEnd: 'var(--g-space-2)' }}><IconCloudOff size={26} stroke={1.6} /></Box>
      <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>برنامه بارگذاری نشد</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>برنامه‌ات امن ذخیره است.</Text>
      <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={16} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
    </Box>
  );
}

function EmptyWeek({ onPropose, proposing, onManual, onCopyPrev }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)', marginBlockEnd: 'var(--g-space-2)' }}><IconCalendarPlus size={28} stroke={1.6} /></Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>بیا هفته‌ات رو با هم بچینیم</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', maxInlineSize: 300, margin: 0 }}>با یک پیشنهادِ هماهنگ با ذائقه‌ات شروع کن.</Text>
      <UnstyledButton type="button" onClick={onPropose} disabled={proposing} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconWand size={16} stroke={1.8} aria-hidden="true" />{proposing ? 'در حال چیدن…' : 'پیشنهاد بده'}</UnstyledButton>
      <UnstyledButton type="button" onClick={onCopyPrev} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 40, paddingInline: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}><IconCopy size={15} stroke={1.8} aria-hidden="true" />کپیِ هفتهٔ قبل</UnstyledButton>
      <UnstyledButton type="button" onClick={onManual} style={{ marginBlockStart: 'var(--g-space-1)', minBlockSize: 40, paddingInline: 'var(--g-space-4)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}>یا خودم دستی می‌چینم</UnstyledButton>
    </Box>
  );
}

export default function PlanPage() {
  const navigate = useNavigate();
  const m = useMealPlan();
  const { trackEvent } = useAnalytics();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => { clearTimeout(toastTimer.current); setToast({ message, Icon }); toastTimer.current = setTimeout(() => setToast(null), 2200); }, []);
  const openRecipe = (id) => { if (id) navigate(`/recipe/${id}`); };

  const todayIdx = useMemo(() => { const i = m.week.days.findIndex((d) => d.isToday); return i >= 0 ? i : 0; }, [m.week.days]);
  const [selectedDay, setSelectedDay] = useState(todayIdx);
  useEffect(() => { setSelectedDay(todayIdx); }, [todayIdx]);
  const [picker, setPicker] = useState(null); // {day, meal} | null
  const [manualMode, setManualMode] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false); // 2-tap confirm for the destructive «clear week»

  const onPropose = async () => { const ok = await m.propose(); showToast(ok ? 'پیشنهاد آماده‌ست — بازبینی کن' : 'الان نشد — دوباره امتحان کن', ok ? IconWand : IconCloudOff); };
  const onAcceptAll = async () => { const r = await m.acceptAll(); showToast(r.ok ? 'برنامهٔ هفته ذخیره شد' : 'بخشی ذخیره نشد — دوباره امتحان کن', r.ok ? IconCheck : IconCloudOff); };
  const onAcceptSlot = async (s) => { const ok = await m.acceptSlot(s); showToast(ok ? 'به برنامه اضافه شد' : 'اضافه نشد — دوباره امتحان کن', ok ? IconCheck : IconCloudOff); };
  const onSwapSlot = async (s) => {
    const r = await m.swapSlot(s);
    if (r.ok) { showToast('یکی دیگه پیشنهاد شد', IconRefresh); trackEvent('recommendation_dismiss', { recipeId: r.swappedOut }); }
    else showToast(r.error ? 'نشد — دوباره امتحان کن' : 'گزینهٔ دیگه‌ای برای این وعده نمونده', r.error ? IconCloudOff : IconRefresh);
  };
  const onRemoveSlot = async (dayOfWeek, mealType, recipeId) => {
    const ok = await m.removeSlot(dayOfWeek, mealType);
    if (ok) { showToast('از برنامه حذف شد', IconTrash); trackEvent('mealplan_remove', { dayOfWeek, mealType, recipeId }); }
    else showToast('حذف نشد، دوباره تلاش کن', IconCloudOff);
  };
  const onPickDish = async (recipeId) => {
    if (!picker) return false;
    const ok = await m.addDish(picker.day.dayOfWeek, picker.meal.key, recipeId);
    if (ok) { setPicker(null); showToast('به برنامه اضافه شد', IconCheck); trackEvent('mealplan_add', { dayOfWeek: picker.day.dayOfWeek, mealType: picker.meal.key, recipeId }); }
    else showToast('اضافه نشد — دوباره امتحان کن', IconCloudOff);
    return ok;
  };
  const onCook = async (dayOfWeek, mealType, recipeId, nextCooked) => {
    const ok = await m.markCooked(dayOfWeek, mealType, nextCooked);
    if (ok && nextCooked) { showToast('نوش جان! 🍽', IconFlame); trackEvent('cook_complete', { dayOfWeek, mealType, recipeId, source: 'meal_plan' }); }
    else if (!ok) showToast('نشد — دوباره امتحان کن', IconCloudOff);
  };
  const onCopyPrev = async () => { const r = await m.copyPrevWeek(); showToast(r.ok ? 'هفتهٔ قبل کپی شد — حالا ویرایشش کن' : 'هفتهٔ قبل خالیه', r.ok ? IconCheck : IconCloudOff); };
  const onClearWeek = async () => {
    if (!confirmClear) { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); return; } // destructive → confirm
    setConfirmClear(false);
    const ok = await m.clearWeek();
    showToast(ok ? 'هفته پاک شد' : 'نشد — دوباره امتحان کن', ok ? IconTrash : IconCloudOff);
  };

  if (m.status === 'error') return <Box style={{ display: 'flex', flexDirection: 'column', minBlockSize: '60vh' }}><PlanError onRetry={m.refetch} /></Box>;

  const day = m.week.days[selectedDay] || m.week.days[0];
  const isTodaySelected = day?.isToday;
  // the "tonight/now" hero meal for today
  const heroMealKey = nextMealKey();
  const heroMeal = m.meals.find((x) => x.key === heroMealKey);
  const heroFilled = isTodaySelected && heroMeal ? m.filled[`${day.dayOfWeek}:${heroMeal.key}`] : null;
  // The day's nutrition. If only some filled dishes have nutrition, show the partial total with an explicit missing-data note.
  const dayNut = day ? m.meals.reduce((a, meal) => {
    const f = m.filled[`${day.dayOfWeek}:${meal.key}`];
    if (!f) return a;
    a.filled += 1;
    const n = f.nutrition;
    if (n && n.calories != null) { a.cal += Number(n.calories) || 0; a.pro += Number(n.protein) || 0; a.n += 1; }
    return a;
  }, { cal: 0, pro: 0, n: 0, filled: 0 }) : { cal: 0, pro: 0, n: 0, filled: 0 };
  const missingNut = Math.max(0, dayNut.filled - dayNut.n);
  const showNut = dayNut.n > 0;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)' }}>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>برنامهٔ هفته</Text>
        {/* multi-week nav — RTL: «قبل» (earlier) points right, «بعد» (later) points left */}
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-1)' }}>
          <UnstyledButton type="button" onClick={m.prevWeek} aria-label="هفتهٔ قبل" style={{ flexShrink: 0, inlineSize: 36, blockSize: 36, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-secondary)' }}><IconChevronRight size={18} stroke={1.8} /></UnstyledButton>
          <Box style={{ flex: 1, minInlineSize: 0, textAlign: 'center' }}>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{m.week.range}</Text>
            {weekLabel(m.weekOffset) ? (
              m.weekOffset === 0
                ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 1 }}>این هفته</Text>
                : <UnstyledButton type="button" onClick={m.goToToday} style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-brand-700)', marginBlockStart: 1 }}>{weekLabel(m.weekOffset)} · برگرد به این هفته</UnstyledButton>
            ) : (
              <UnstyledButton type="button" onClick={m.goToToday} style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-brand-700)', marginBlockStart: 1 }}>برگرد به این هفته</UnstyledButton>
            )}
          </Box>
          <UnstyledButton type="button" onClick={m.nextWeek} aria-label="هفتهٔ بعد" style={{ flexShrink: 0, inlineSize: 36, blockSize: 36, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--g-color-text-secondary)' }}><IconChevronLeft size={18} stroke={1.8} /></UnstyledButton>
        </Box>
      </Box>

      {m.status === 'loading' ? <PlanLoading /> : (!m.hasPlan && !m.proposalActive && !manualMode) ? <EmptyWeek onPropose={onPropose} proposing={m.proposing} onManual={() => setManualMode(true)} onCopyPrev={onCopyPrev} /> : (
        <>
          <WeekStrip days={m.week.days} meals={m.meals} filled={m.filled} suggested={m.suggested} selectedDay={selectedDay} onSelect={setSelectedDay} />

          <Box key={selectedDay} className="g-fade-up" style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)' }}>
            {/* selected-day header */}
            <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: showNut ? 0 : '0 0 var(--g-space-3)' }}>{isTodaySelected ? 'امروز' : day?.label} · {day?.dayFa} {day?.monthFa}</Text>
            {showNut ? (
              <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '2px 0 var(--g-space-3)' }}>≈ {toFaDigits(Math.round(dayNut.cal / 10) * 10)} کالری · پروتئین {toFaDigits(Math.round(dayNut.pro))}g{missingNut ? ` · ${toFaDigits(missingNut)} مورد داده ندارد` : ''}</Text>
            ) : null}

            {/* "now/tonight" hero — only for today: answers "what am I cooking now?" in one glance */}
            {isTodaySelected && heroMeal ? (
              heroFilled ? (
                <UnstyledButton type="button" onClick={() => openRecipe(heroFilled.recipeId)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', textAlign: 'start', background: 'linear-gradient(135deg, var(--g-color-brand-600), var(--g-color-brand-700))', color: 'var(--g-color-text-inverse)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-3)', marginBlockEnd: 'var(--g-space-4)', boxShadow: 'var(--g-shadow-2)' }}>
                  <Box style={{ flexShrink: 0, inlineSize: 30, blockSize: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.18)' }}><IconFlame size={17} stroke={1.8} /></Box>
                  <Box style={{ flex: 1, minInlineSize: 0 }}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, opacity: 0.9 }}>{`${heroMeal.label}ِ امروز`}</Text>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.7 }}>{heroFilled.title}</Text>
                  </Box>
                  <Text component="span" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700 }}>بپز<IconChevronLeft size={16} stroke={2} /></Text>
                </UnstyledButton>
              ) : (
                <UnstyledButton type="button" onClick={() => setPicker({ day, meal: heroMeal })} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', textAlign: 'start', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-3)', marginBlockEnd: 'var(--g-space-4)' }}>
                  <Box style={{ flexShrink: 0, inlineSize: 30, blockSize: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)' }}><IconFlame size={17} stroke={1.8} /></Box>
                  <Box style={{ flex: 1, minInlineSize: 0 }}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{`برای ${heroMeal.label}ِ امروز چی بپزیم؟`}</Text>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', marginBlockStart: 2 }}>یه غذا انتخاب کن</Text>
                  </Box>
                  <IconPlus size={18} stroke={2} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} />
                </UnstyledButton>
              )
            ) : null}

            {/* the day's meal rows */}
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
              {m.meals.map((meal) => {
                const key = `${day.dayOfWeek}:${meal.key}`;
                const filled = m.filled[key];
                const sugg = m.suggested[key];
                const slot = filled ? { kind: 'filled', ...filled } : sugg ? { kind: 'suggested', ...sugg } : null;
                return (
                  <Box key={meal.key}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-text-muted)', marginBlockEnd: 'var(--g-space-1)', marginInlineStart: 2 }}>{meal.label}</Text>
                    <SlotRow
                      meal={meal}
                      slot={slot}
                      cooked={!!filled?.cookedAt}
                      onOpen={() => openRecipe((filled || sugg)?.recipeId)}
                      onAccept={() => onAcceptSlot(sugg)}
                      onSwap={() => onSwapSlot(sugg)}
                      onRemove={() => onRemoveSlot(day.dayOfWeek, meal.key, filled?.recipeId)}
                      onAdd={() => setPicker({ day, meal })}
                      onCook={() => onCook(day.dayOfWeek, meal.key, filled?.recipeId, !filled?.cookedAt)}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* invite / to-shopping */}
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-5)', paddingBlockEnd: 'var(--g-space-6)' }}>
            {!m.proposalActive ? (
              <Box style={{ background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
                <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}><Box aria-hidden="true" style={{ inlineSize: 22, blockSize: 22, borderRadius: '50%', background: 'var(--g-color-ai-glow)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px var(--g-color-brand-200)' }}><IconSparkles size={12} stroke={1.8} /></Box><Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--g-color-brand-700)' }}>AI</Text></Box>
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, lineHeight: 'var(--g-leading-body)', margin: 'var(--g-space-2) 0 0', color: 'var(--g-color-text-primary)' }}>{m.hasPlan ? 'جاهای خالیِ هفته رو برات پیشنهاد بدم؟' : 'کلِ هفته رو برات پیشنهاد بدم؟'}</Text>
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-1) 0 0' }}>با ذائقه، حساسیت‌ها و موادِ موجودت هماهنگ — بعد می‌تونی بپذیری یا عوض کنی.</Text>
                <UnstyledButton type="button" onClick={onPropose} disabled={m.proposing} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', inlineSize: '100%', minBlockSize: 44, marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconWand size={16} stroke={1.8} aria-hidden="true" />{m.proposing ? 'در حال چیدن…' : 'برنامهٔ هفته رو بچین'}</UnstyledButton>
              </Box>
            ) : null}
            {!m.proposalActive && m.hasPlan ? (
              <UnstyledButton type="button" onClick={() => navigate('/shopping-list')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)', boxShadow: 'var(--g-shadow-1)' }}>
                <Box aria-hidden="true" style={{ inlineSize: 40, blockSize: 40, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center' }}><IconShoppingCart size={20} stroke={1.8} /></Box>
                <Box style={{ flex: 1, textAlign: 'start' }}>
                  <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>از این برنامه، لیست خرید بساز</Text>
                  <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>ادغام و دسته‌بندیِ خودکارِ مواد</Text>
                </Box>
                <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
              </UnstyledButton>
            ) : null}
            {!m.proposalActive && m.hasPlan ? (
              <UnstyledButton type="button" onClick={onClearWeek} style={{ alignSelf: 'center', minBlockSize: 40, paddingInline: 'var(--g-space-4)', color: confirmClear ? 'var(--g-color-state-danger-fg, #c0392b)' : 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}>{confirmClear ? 'مطمئنی؟ دوباره بزن' : 'پاک‌کردنِ این هفته'}</UnstyledButton>
            ) : null}
          </Box>
        </>
      )}

      {m.proposalActive ? (
        <Box style={{ position: 'sticky', insetBlockEnd: 0, background: 'var(--g-color-bg-surface-raised)', borderBlockStart: '1px solid var(--g-color-border-subtle)', boxShadow: 'var(--g-shadow-2)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-3) + env(safe-area-inset-bottom))' }}>
        <Text component="p" style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-secondary)', margin: '0 0 var(--g-space-2)' }}><IconEyeCheck size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />این یک پیشنهاد است — بازبینی کن و بپذیر</Text>
          <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
            <UnstyledButton type="button" onClick={m.clearProposal} style={{ flexShrink: 0, minBlockSize: 46, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>پاک کن</UnstyledButton>
            <UnstyledButton type="button" onClick={onAcceptAll} disabled={m.applying} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', minBlockSize: 46, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconCheck size={16} stroke={1.8} aria-hidden="true" />{m.applying ? 'در حال ذخیره…' : 'پذیرفتنِ برنامه'}</UnstyledButton>
          </Box>
        </Box>
      ) : null}

      <DishPicker open={!!picker} day={picker?.day} meal={picker?.meal} onClose={() => setPicker(null)} onPick={onPickDish} fetchOptions={m.fetchDishOptions} />
      <Toast toast={toast} />
    </Box>
  );
}
