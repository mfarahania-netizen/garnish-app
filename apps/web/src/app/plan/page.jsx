import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconSparkles, IconWand, IconShoppingCart, IconChevronLeft, IconEyeCheck, IconCheck,
  IconCalendarPlus, IconCloudOff, IconRefresh, IconClock, IconTrash,
} from '@tabler/icons-react';
import { useMealPlan } from './useMealPlan';
import { useAnalytics } from '../../hooks/useAnalytics';
import PlatePlaceholder from '../../components/ges/PlatePlaceholder';
import Toast from '../../components/ges/Toast';

const seed = (id) => { const s = String(id ?? ''); let h = 0; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

function Tile({ title }) {
  return (
    <Box style={{ position: 'relative', blockSize: 52, borderRadius: 'var(--g-radius-input)', overflow: 'hidden' }}>
      <PlatePlaceholder label={title} seed={seed(title)} glyphSize={22} />
    </Box>
  );
}

function SlotCard({ slot, onOpen, onAccept, onSwap, onRemove }) {
  // FILLED — a real, saved dish. One clean state: show the dish + a working remove (no dead "اضافه شد" state).
  if (slot?.kind === 'filled') {
    return (
      <Box style={{ position: 'relative' }}>
        <UnstyledButton type="button" onClick={onOpen} aria-label={`${slot.title} — مشاهدهٔ دستور`} style={{ display: 'block', inlineSize: '100%', textAlign: 'start', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-input)', overflow: 'hidden', boxShadow: 'var(--g-shadow-1)' }}>
          <Tile title={slot.title} />
          <Box style={{ padding: 'var(--g-space-2)' }}>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.title}</Text>
            {slot.cookTimeText ? (
              <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginBlockStart: 4, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}><IconClock size={11} stroke={1.8} aria-hidden="true" />{slot.cookTimeText}</Box>
            ) : null}
          </Box>
        </UnstyledButton>
        {onRemove ? (
          <UnstyledButton type="button" onClick={onRemove} aria-label="حذف از برنامه" style={{ position: 'absolute', insetBlockStart: 6, insetInlineEnd: 6, inlineSize: 28, blockSize: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--g-color-bg-surface) 88%, transparent)', color: 'var(--g-color-text-muted)' }}>
            <IconTrash size={14} stroke={1.6} />
          </UnstyledButton>
        ) : null}
      </Box>
    );
  }
  // SUGGESTED — AI proposal. Accept (primary) or «یکی دیگه» (swap for the next-best). No always-"high" chip.
  if (slot?.kind === 'suggested') {
    return (
      <Box style={{ background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-input)', overflow: 'hidden' }}>
        <UnstyledButton type="button" onClick={onOpen} aria-label={`${slot.title} — پیشنهاد، مشاهدهٔ دستور`} style={{ display: 'block', inlineSize: '100%', textAlign: 'start' }}>
          <Tile title={slot.title} />
          <Box style={{ paddingInline: 'var(--g-space-2)', paddingBlockStart: 'var(--g-space-2)' }}>
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconSparkles size={11} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} /><Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--g-color-brand-700)' }}>پیشنهادِ AI</Text></Box>
            <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBlockStart: 3 }}>{slot.title}</Text>
          </Box>
        </UnstyledButton>
        <Box style={{ display: 'flex', gap: 1, marginBlockStart: 'var(--g-space-2)' }}>
          <UnstyledButton type="button" onClick={onSwap} aria-label={`یکی دیگه به‌جای «${slot.title}»`} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3, minBlockSize: 44, paddingInline: 'var(--g-space-2)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}><IconRefresh size={13} stroke={1.8} aria-hidden="true" />یکی دیگه</UnstyledButton>
          <UnstyledButton type="button" onClick={onAccept} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, minBlockSize: 44, background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}><IconCheck size={13} stroke={2} aria-hidden="true" />بپذیر</UnstyledButton>
        </Box>
      </Box>
    );
  }
  // EMPTY — non-interactive placeholder (manual-add removed; no stub button ships). Fill via «بچین» / accept.
  return (
    <Box aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', inlineSize: '100%', minBlockSize: 92, border: '1.5px dashed var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-input)', color: 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)' }}>—</Box>
  );
}

function PlanLoading() {
  return (
    <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ padding: 'var(--g-space-4)' }}>
      <Box style={{ display: 'flex', gap: 'var(--g-space-3)', overflow: 'hidden' }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} style={{ flex: '0 0 140px' }}>
            <Box className="g-skeleton" style={{ blockSize: 14, inlineSize: '60%', margin: '0 auto var(--g-space-3)' }} />
            <Box className="g-skeleton" style={{ blockSize: 74, borderRadius: 'var(--g-radius-input)', marginBlockEnd: 'var(--g-space-2)' }} />
            <Box className="g-skeleton" style={{ blockSize: 74, borderRadius: 'var(--g-radius-input)' }} />
          </Box>
        ))}
      </Box>
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

function EmptyWeek({ onPropose, proposing }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)', marginBlockEnd: 'var(--g-space-2)' }}><IconCalendarPlus size={28} stroke={1.6} /></Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>بیا هفته‌ات رو با هم بچینیم</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', maxInlineSize: 300, margin: 0 }}>با یک پیشنهادِ هماهنگ با ذائقه‌ات شروع کن.</Text>
      <UnstyledButton type="button" onClick={onPropose} disabled={proposing} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconWand size={16} stroke={1.8} aria-hidden="true" />{proposing ? 'در حال چیدن…' : 'پیشنهاد بده'}</UnstyledButton>
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

  const onPropose = async () => { const ok = await m.propose(); showToast(ok ? 'پیشنهاد آماده‌ست — بازبینی کن' : 'الان نشد — دوباره امتحان کن', ok ? IconWand : IconCloudOff); };
  const onAcceptAll = async () => { const r = await m.acceptAll(); showToast(r.ok ? 'برنامهٔ هفته ذخیره شد' : 'بخشی ذخیره نشد — دوباره امتحان کن', r.ok ? IconCheck : IconCloudOff); };
  const onAcceptSlot = async (s) => { const ok = await m.acceptSlot(s); showToast(ok ? 'به برنامه اضافه شد' : 'اضافه نشد — دوباره امتحان کن', ok ? IconCheck : IconCloudOff); };
  // FI-STEP-1.3: «یکی دیگه» — swap THIS slot for the next-best safe pick; record the swapped-out as declined
  // (recommendation_dismiss) so it down-weights + won't return in the next propose.
  const onSwapSlot = async (s) => {
    const r = await m.swapSlot(s);
    if (r.ok) { showToast('یکی دیگه پیشنهاد شد', IconRefresh); trackEvent('recommendation_dismiss', { recipeId: r.swappedOut }); }
    else showToast(r.error ? 'نشد — دوباره امتحان کن' : 'گزینهٔ دیگه‌ای برای این وعده نمونده', r.error ? IconCloudOff : IconRefresh);
  };
  // real delete: honest toast + the mealplan_remove signal fire ONLY on a successful DELETE
  const onRemoveSlot = async (dayOfWeek, mealType, recipeId) => {
    const ok = await m.removeSlot(dayOfWeek, mealType);
    if (ok) { showToast('از برنامه حذف شد', IconTrash); trackEvent('mealplan_remove', { dayOfWeek, mealType, recipeId }); }
    else showToast('حذف نشد، دوباره تلاش کن', IconCloudOff);
  };

  if (m.status === 'error') return <Box style={{ display: 'flex', flexDirection: 'column', minBlockSize: '60vh' }}><PlanError onRetry={m.refetch} /></Box>;

  return (
    <Box style={{ display: 'flex', flexDirection: 'column' }}>
      {/* header — single clear plan-generation entry point lives below («برنامهٔ هفته رو بچین»);
          the redundant dead "دستیار" button was removed (FE-PLAN-AND-MODALS FIX 4). */}
      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>برنامهٔ هفته</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '2px 0 0' }}>{m.week.range}</Text>
      </Box>

      {m.status === 'loading' ? <PlanLoading /> : (!m.hasPlan && !m.proposalActive) ? <EmptyWeek onPropose={onPropose} proposing={m.proposing} /> : (
        <>
          {/* week columns (RTL: first day at the inline-start/right). g-weekscroll = thin visible
              scrollbar so all 7 days are reachable with a mouse on desktop (FE-PLAN-AND-MODALS FIX 3). */}
          <Box className="g-weekscroll" style={{ display: 'flex', gap: 'var(--g-space-3)', overflowX: 'auto', paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', alignItems: 'flex-start' }}>
            {m.week.days.map((day) => (
              <Box key={day.dayOfWeek} style={{ flex: '0 0 140px' }}>
                <Box style={{ textAlign: 'center', marginBlockEnd: 'var(--g-space-3)' }}>
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: day.isToday ? 'var(--g-color-brand-700)' : 'var(--g-color-text-primary)' }}>{day.label}</Text>
                  {day.isToday ? (
                    <Box style={{ display: 'inline-block', marginBlockStart: 3, paddingInline: 8, paddingBlock: 1, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>امروز</Box>
                  ) : (
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 3 }}>{day.monthFa} {day.dayFa}</Text>
                  )}
                </Box>
                <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                  {m.meals.map((meal) => {
                    const key = `${day.dayOfWeek}:${meal.key}`;
                    const filled = m.filled[key];
                    const sugg = m.suggested[key];
                    const slot = filled ? { kind: 'filled', ...filled } : sugg ? { kind: 'suggested', ...sugg } : null;
                    return (
                      <Box key={meal.key}>
                        <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)', marginBlockEnd: 4 }}>{meal.label}</Text>
                        <SlotCard
                          slot={slot}
                          onOpen={() => openRecipe((filled || sugg)?.recipeId)}
                          onAccept={() => onAcceptSlot(sugg)}
                          onSwap={() => onSwapSlot(sugg)}
                          onRemove={filled ? () => onRemoveSlot(day.dayOfWeek, meal.key, filled.recipeId) : undefined}
                        />
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>

          {/* invite / to-shopping */}
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-2)', paddingBlockEnd: 'var(--g-space-6)' }}>
            {!m.proposalActive ? (
              <Box style={{ background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
                <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}><Box aria-hidden="true" style={{ inlineSize: 22, blockSize: 22, borderRadius: '50%', background: 'var(--g-color-ai-glow)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px var(--g-color-brand-200)' }}><IconSparkles size={12} stroke={1.8} /></Box><Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--g-color-brand-700)' }}>AI</Text></Box>
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, lineHeight: 'var(--g-leading-body)', margin: 'var(--g-space-2) 0 0', color: 'var(--g-color-text-primary)' }}>بقیهٔ هفته رو برات پیشنهاد بدم؟</Text>
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
          </Box>
        </>
      )}

      {/* review bar — proposes-not-auto */}
      {m.proposalActive ? (
        <Box style={{ position: 'sticky', insetBlockEnd: 0, background: 'var(--g-color-bg-surface-raised)', borderBlockStart: '1px solid var(--g-color-border-subtle)', boxShadow: 'var(--g-shadow-2)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-3) + env(safe-area-inset-bottom))' }}>
        <Text component="p" style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-secondary)', margin: '0 0 var(--g-space-2)' }}><IconEyeCheck size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />این یک پیشنهاد است — بازبینی کن و بپذیر</Text>
          <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
            <UnstyledButton type="button" onClick={m.clearProposal} style={{ flexShrink: 0, minBlockSize: 46, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>پاک کن</UnstyledButton>
            <UnstyledButton type="button" onClick={onAcceptAll} disabled={m.applying} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', minBlockSize: 46, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconCheck size={16} stroke={1.8} aria-hidden="true" />{m.applying ? 'در حال ذخیره…' : 'پذیرفتنِ برنامه'}</UnstyledButton>
          </Box>
        </Box>
      ) : null}

      <Toast toast={toast} />
    </Box>
  );
}
