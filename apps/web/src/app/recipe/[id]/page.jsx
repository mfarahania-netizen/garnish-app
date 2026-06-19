import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton, Drawer } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconChevronRight, IconChevronDown, IconBookmark, IconBookmarkFilled, IconShare2,
  IconClock, IconChartBar, IconUsers, IconHeartCheck, IconAlertTriangle, IconSparkles,
  IconChevronLeft, IconListNumbers, IconBulb, IconHelpCircle, IconFlame, IconCalendarPlus,
  IconInfoCircle, IconCloudOff, IconRefresh, IconToolsKitchen2, IconArrowsExchange, IconCircleCheck, IconChefHat,
} from '@tabler/icons-react';
import { useRecipeDetail } from './useRecipeDetail';
import { useFavoritesQuery } from '../../../hooks/useFavoritesQuery';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/apiClient';
import { toFaDigits } from '../../../components/ges/format';
import PlatePlaceholder from '../../../components/ges/PlatePlaceholder';
import WhyChip from '../../../components/ges/WhyChip';
import NutritionBadge from '../../../components/ges/NutritionBadge';
import AISheet from '../../../components/ges/AISheet';
import Toast from '../../../components/ges/Toast';
import { SkeletonLine } from '../../../components/ges/LoadingSkeleton';
import { bottomSheetStyles } from '../../../components/ges/sheet';

const Column = ({ children }) => (
  <Box style={{ minBlockSize: '100dvh', display: 'flex', justifyContent: 'center', background: 'var(--g-color-bg-canvas)' }}>
    <Box style={{ position: 'relative', width: '100%', maxInlineSize: 480, minBlockSize: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--g-color-bg-canvas)', borderInline: '1px solid var(--g-color-border-subtle)' }}>
      {children}
    </Box>
  </Box>
);

function CircleBtn({ icon: Icon, label, onClick, accent }) {
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 42, blockSize: 42,
        borderRadius: '50%', background: 'color-mix(in srgb, var(--g-color-text-inverse) 92%, transparent)',
        color: accent ? 'var(--g-color-brand-600)' : 'var(--g-color-text-primary)', boxShadow: 'var(--g-shadow-1)',
      }}
    >
      <Icon size={20} stroke={1.8} />
    </UnstyledButton>
  );
}

function MetaCell({ icon: Icon, value, label }) {
  return (
    <Box style={{ flex: 1, textAlign: 'center', paddingInline: 'var(--g-space-1)', paddingBlock: 'var(--g-space-3)' }}>
      <Icon size={19} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, marginBlockStart: 4, color: 'var(--g-color-text-primary)' }}>{value}</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>{label}</Text>
    </Box>
  );
}

function Accordion({ icon: Icon, title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', overflow: 'hidden' }}>
      <UnstyledButton type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', inlineSize: '100%', minBlockSize: 48, paddingInline: 'var(--g-space-4)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          <Icon size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{title}</Text>
        </Box>
        <IconChevronDown size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </UnstyledButton>
      {open ? <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-4)' }}>{children}</Box> : null}
    </Box>
  );
}

const stepText = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)' };

// a plain bullet-free list of richness lines (chef tips / mistakes / serving / swaps)
function RichList({ items }) {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
      {items.map((t, i) => <Text key={i} component="p" style={{ ...stepText, margin: 0 }}>{t}</Text>)}
    </Box>
  );
}

function RecipeError({ onRetry }) {
  return (
    <Column>
      <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', gap: 'var(--g-space-2)' }}>
        <Box aria-hidden="true" style={{ display: 'grid', placeItems: 'center', inlineSize: 60, blockSize: 60, borderRadius: '50%', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', marginBlockEnd: 'var(--g-space-2)' }}>
          <IconCloudOff size={28} stroke={1.6} />
        </Box>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>دستور بارگذاری نشد</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 0 }}>اتصال کوتاه قطع شد. چیزی از دست نرفته.</Text>
        <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}>
          <IconRefresh size={16} stroke={1.8} aria-hidden="true" />تلاش دوباره
        </UnstyledButton>
      </Box>
    </Column>
  );
}

function RecipeLoading() {
  return (
    <Column>
      <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…">
        <Box className="g-skeleton" style={{ blockSize: 200, borderRadius: 0 }} />
        <Box style={{ padding: 'var(--g-space-4)' }}>
          <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
            <SkeletonLine w="100%" h={56} /><SkeletonLine w="100%" h={56} /><SkeletonLine w="100%" h={56} />
          </Box>
          <SkeletonLine w="70%" h={20} style={{ marginBlockStart: 'var(--g-space-4)' }} />
          <SkeletonLine w="90%" h={12} style={{ marginBlockStart: 'var(--g-space-3)' }} />
          <SkeletonLine w="80%" h={12} style={{ marginBlockStart: 'var(--g-space-2)' }} />
        </Box>
      </Box>
    </Column>
  );
}

/**
 * HeroMedia — the recipe photo when it actually loads, else the branded placeholder.
 * A bad/relative imageUrl would otherwise render the browser's broken-image glyph + alt
 * text (the "۱:۲ … 📷" strip): onError swaps to the placeholder, and alt="" keeps the hero
 * decorative (the real title is a heading below) so no broken-alt text ever shows.
 */
function HeroMedia({ imageUrl, title }) {
  const [broken, setBroken] = useState(false);
  const showImg = !!imageUrl && !broken;
  return (
    <>
      {showImg ? (
        <img
          src={imageUrl}
          alt=""
          onError={() => setBroken(true)}
          style={{ position: 'absolute', inset: 0, inlineSize: '100%', blockSize: '100%', objectFit: 'cover' }}
        />
      ) : (
        <PlatePlaceholder label={title} seed={(title || '').length} glyphSize={56} />
      )}
      {showImg ? <Box aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--g-scrim-photo)' }} /> : null}
    </>
  );
}

// minimal, token-pure day/meal picker → POST /meal-plans/slots (dayOfWeek 0=Sat..6=Fri, like the planner)
const PLAN_DAYS = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
const PLAN_MEALS = [{ id: 'breakfast', label: 'صبحانه' }, { id: 'lunch', label: 'ناهار' }, { id: 'dinner', label: 'شام' }];
const todaySatIdx = () => (new Date().getDay() + 1) % 7;
function PlanPickerSheet({ opened, onClose, busy, onConfirm }) {
  const [day, setDay] = useState(todaySatIdx());
  const [meal, setMeal] = useState('dinner');
  useEffect(() => { if (opened) { setDay(todaySatIdx()); setMeal('dinner'); } }, [opened]);
  const chip = (active) => ({ minBlockSize: 44, paddingInline: 'var(--g-space-3)', display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--g-radius-chip)', border: `1px solid ${active ? 'var(--g-color-brand-600)' : 'var(--g-color-border-strong)'}`, background: active ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', color: active ? 'var(--g-color-brand-700)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 });
  const heading = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 700, color: 'var(--g-color-text-primary)' };
  return (
    <Drawer opened={opened} onClose={onClose} position="bottom" zIndex={400} withCloseButton closeButtonProps={{ 'aria-label': 'بستن', size: 'lg' }} title={<Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-16)', color: 'var(--g-color-text-primary)' }}>افزودن به برنامهٔ هفته</Text>} overlayProps={{ backgroundOpacity: 0.42, blur: 1 }} transitionProps={{ transition: 'slide-up', duration: 240 }} styles={bottomSheetStyles({ content: { height: 'auto', borderStartStartRadius: 'var(--g-radius-sheet)', borderStartEndRadius: 'var(--g-radius-sheet)', background: 'var(--g-color-bg-surface)' }, header: { background: 'var(--g-color-bg-surface)' }, body: { paddingInline: 'var(--g-space-5)', paddingBlockEnd: 'var(--g-space-6)' } })}>
      <Text component="p" style={{ ...heading, margin: 'var(--g-space-2) 0 var(--g-space-2)' }}>روز</Text>
      <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
        {PLAN_DAYS.map((d, i) => <UnstyledButton key={i} type="button" onClick={() => setDay(i)} aria-pressed={day === i} style={chip(day === i)}>{d}</UnstyledButton>)}
      </Box>
      <Text component="p" style={{ ...heading, margin: 'var(--g-space-4) 0 var(--g-space-2)' }}>وعده</Text>
      <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
        {PLAN_MEALS.map((m) => <UnstyledButton key={m.id} type="button" onClick={() => setMeal(m.id)} aria-pressed={meal === m.id} style={chip(meal === m.id)}>{m.label}</UnstyledButton>)}
      </Box>
      <UnstyledButton type="button" onClick={() => onConfirm(day, meal)} disabled={busy} aria-disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: '100%', minBlockSize: 48, marginBlockStart: 'var(--g-space-5)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 700, opacity: busy ? 0.6 : 1 }}>{busy ? 'در حال افزودن…' : 'افزودن به برنامه'}</UnstyledButton>
    </Drawer>
  );
}

// grounded substitution results for one ingredient (real POST /ai/substitutions). Honest: shows the
// same-role swaps from the corpus, an empty state when none, and the non-medical + allergy-safe note.
function SubSheet({ sub, onClose }) {
  return (
    <Drawer
      opened={!!sub}
      onClose={onClose}
      position="bottom"
      zIndex={400}
      withCloseButton
      closeButtonProps={{ 'aria-label': 'بستن', size: 'lg' }}
      title={<Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-16)', color: 'var(--g-color-text-primary)' }}>جایگزین برای {sub?.ingredient}</Text>}
      overlayProps={{ backgroundOpacity: 0.42, blur: 1 }}
      transitionProps={{ transition: 'slide-up', duration: 240 }}
      styles={bottomSheetStyles({ content: { height: 'auto', borderStartStartRadius: 'var(--g-radius-sheet)', borderStartEndRadius: 'var(--g-radius-sheet)', background: 'var(--g-color-bg-surface)' }, header: { background: 'var(--g-color-bg-surface)' }, body: { paddingInline: 'var(--g-space-5)', paddingBlockEnd: 'var(--g-space-6)' } })}
    >
      {sub?.loading ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', paddingBlock: 'var(--g-space-2)' }}>
          <SkeletonLine w="80%" h={18} /><SkeletonLine w="60%" h={18} />
        </Box>
      ) : sub?.items?.length ? (
        <>
          <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', paddingBlockStart: 'var(--g-space-2)' }}>
            {sub.items.map((it, i) => (
              <Box key={`${it}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-2)', borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>
                <IconArrowsExchange size={15} stroke={1.8} aria-hidden="true" />{it}
              </Box>
            ))}
          </Box>
          <Box style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', marginBlockStart: 'var(--g-space-3)' }}>
            <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0, marginBlockStart: 1 }} />
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>جای‌گزین‌های هم‌نقش از پایگاه مواد — راهنمایی آشپزی، نه توصیهٔ پزشکی. حساسیت‌های اعلام‌شده‌ات همیشه فیلتر می‌مانند.</Text>
          </Box>
        </>
      ) : (
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', paddingBlock: 'var(--g-space-2)', margin: 0 }}>برای این ماده جایگزینِ هم‌نقشی در پایگاه پیدا نشد.</Text>
      )}
    </Drawer>
  );
}

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, recipe, nutrition, fit, substitutions, integrity, refetch } = useRecipeDetail(id);
  const { token } = useAuth();
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesQuery();
  const { trackEvent } = useAnalytics();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [servedFor, setServedFor] = useState(null); // locally-applied serving target from the AI sheet
  const [sub, setSub] = useState(null); // { ingredient, loading, items } — grounded substitution sheet
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const viewedRef = useRef(false); // fire recipe_view at most once per recipe (StrictMode-safe)
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => {
    clearTimeout(toastTimer.current);
    setToast({ message, Icon });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  const back = () => navigate(-1);

  // honest telemetry: one recipe_view per loaded recipe, logged-in only
  useEffect(() => {
    if (status === 'ready' && recipe && id && token && !viewedRef.current) {
      viewedRef.current = true;
      trackEvent('recipe_view', { recipeId: id });
    }
  }, [status, recipe, id, token, trackEvent]);

  // real favorites write: confirmation toast ONLY on success; fire favorite_add once per successful add
  const toggleSave = useCallback(() => {
    if (!id) return;
    if (isFavorite(id)) {
      removeFavorite(id, { onSuccess: () => showToast('از ذخیره‌ها برداشته شد', IconBookmark), onError: () => showToast('انجام نشد، دوباره تلاش کن', IconBookmark) });
    } else {
      addFavorite(id, { onSuccess: () => { showToast('به ذخیره‌ها اضافه شد', IconBookmark); trackEvent('favorite_add', { recipeId: id }); }, onError: () => showToast('ذخیره نشد، دوباره تلاش کن', IconBookmark) });
    }
  }, [id, isFavorite, addFavorite, removeFavorite, showToast, trackEvent]);

  // real add-to-plan via the EXISTING POST /meal-plans/slots contract (same body the planner uses)
  const addToPlan = useCallback(async (dayOfWeek, mealType) => {
    setPlanBusy(true);
    try {
      await apiClient.post('/meal-plans/slots', { dayOfWeek, mealType, recipeId: id });
      setPlanOpen(false);
      showToast('به برنامه اضافه شد', IconCalendarPlus);
      trackEvent('mealplan_add', { recipeId: id });
    } catch {
      showToast('اضافه نشد، دوباره تلاش کن', IconCloudOff);
    } finally {
      setPlanBusy(false);
    }
  }, [id, showToast, trackEvent]);

  // real grounded substitution for one ingredient → POST /ai/substitutions (deterministic, no live LLM).
  // declared allergies stay a hard filter server-side; this only proposes same-role swaps from the corpus.
  const askSub = useCallback(async (name) => {
    if (!name) return;
    setSub({ ingredient: name, loading: true, items: null });
    try {
      const { data } = await apiClient.post('/ai/substitutions', { ingredient: name, limit: 5 });
      const items = Array.isArray(data?.substitutions)
        ? data.substitutions.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
        : [];
      setSub({ ingredient: name, loading: false, items });
    } catch {
      setSub({ ingredient: name, loading: false, items: [] });
    }
  }, []);

  const saved = isFavorite(id);

  if (status === 'loading') return <RecipeLoading />;
  if (status === 'error' || status === 'empty' || !recipe) return <RecipeError onRetry={() => (status === 'empty' ? back() : refetch())} />;

  const isAllergen = fit?.recommendation === 'avoid_allergen';
  const isGreat = fit?.recommendation === 'great_fit';
  const baseServings = (() => {
    const m = String(recipe.servingsText || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).match(/\d+/);
    return m ? Number(m[0]) : 4;
  })();

  return (
    <Column>
      <Box component="main" style={{ flex: 1, overflowY: 'auto' }}>
        {/* HERO */}
        <Box style={{ position: 'relative', blockSize: 248 }}>
          <HeroMedia imageUrl={recipe.imageUrl} title={recipe.title} />
          <Box style={{ position: 'absolute', insetBlockStart: 0, insetInline: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 'var(--g-space-3)', paddingBlockEnd: 'var(--g-space-3)', paddingBlockStart: 'calc(var(--g-space-3) + env(safe-area-inset-top))' }}>
            <CircleBtn icon={IconChevronRight} label="بازگشت" onClick={back} />
            <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
              <CircleBtn icon={saved ? IconBookmarkFilled : IconBookmark} label={saved ? 'برداشتن از ذخیره‌ها' : 'ذخیره'} accent onClick={toggleSave} />
              <CircleBtn icon={IconShare2} label="هم‌رسانی" onClick={() => showToast('هم‌رسانی به‌زودی', IconShare2)} />
            </Box>
          </Box>
        </Box>

        <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-6)' }}>
          {/* META row (overlaps hero) */}
          <Box style={{ display: 'flex', alignItems: 'stretch', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)', marginBlockStart: -30, position: 'relative' }}>
            <MetaCell icon={IconClock} value={recipe.cookTimeText || '—'} label="زمان" />
            <Box style={{ inlineSize: 1, background: 'var(--g-color-border-subtle)', marginBlock: 'var(--g-space-3)' }} />
            <MetaCell icon={IconChartBar} value={recipe.difficultyText || '—'} label="سختی" />
            <Box style={{ inlineSize: 1, background: 'var(--g-color-border-subtle)', marginBlock: 'var(--g-space-3)' }} />
            <MetaCell icon={IconUsers} value={servedFor ? `${toFaDigits(servedFor)} نفر` : (recipe.servingsText || '—')} label={servedFor ? 'تنظیم‌شده' : 'برای'} />
          </Box>

          {/* TITLE + category chips */}
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', textWrap: 'balance', color: 'var(--g-color-text-primary)', margin: 'var(--g-space-4) 0 0' }}>{recipe.title}</Text>
          {recipe.categories.length || recipe.mealTypes.length ? (
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-2)' }}>
              {recipe.categories.map((c) => (
                <Box key={c} style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 4, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{c}</Box>
              ))}
              {recipe.mealTypes.map((m) => (
                <Box key={m} style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 4, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-strong)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{m}</Box>
              ))}
            </Box>
          ) : null}

          {/* FIT + WhyChip (honest; allergen demoted-not-hidden) */}
          {fit ? (
            <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-4)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: isAllergen ? 'var(--g-color-allergen-bg)' : isGreat ? 'var(--g-color-state-success-bg)' : 'var(--g-color-state-info-bg)' }}>
              {isAllergen ? <IconAlertTriangle size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-allergen-fg)', flexShrink: 0 }} /> : <IconHeartCheck size={17} stroke={1.8} aria-hidden="true" style={{ color: isGreat ? 'var(--g-color-state-success-fg)' : 'var(--g-color-text-secondary)', flexShrink: 0 }} />}
              <Text component="span" style={{ flex: 1, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, lineHeight: 'var(--g-leading-body)', color: isAllergen ? 'var(--g-color-allergen-fg)' : isGreat ? 'var(--g-color-state-success-fg)' : 'var(--g-color-text-secondary)' }}>
                {isAllergen
                  ? <>حاوی {recipe && fit.allergens.length ? <b>{fit.allergens.join('، ')}</b> : 'مادهٔ حساسیت‌زا'} که جزو حساسیت‌های اعلام‌شده‌ی توست. برای ایمنی نشان داده شده — تضمین نیست.</>
                  : (fit.label || 'مناسبِ تو')}
              </Text>
              {!isAllergen ? <WhyChip reasons={fit.reasons} /> : null}
            </Box>
          ) : null}

          {recipe.description ? (
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-4) 0 0' }}>{recipe.description}</Text>
          ) : null}

          {/* AI Sheet entry */}
          <UnstyledButton type="button" onClick={() => setSheetOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', marginBlockStart: 'var(--g-space-4)', padding: 'var(--g-space-4)', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)' }}>
            <Box aria-hidden="true" style={{ flexShrink: 0, inlineSize: 40, blockSize: 40, borderRadius: '50%', background: 'var(--g-color-ai-glow)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px var(--g-color-brand-200)' }}>
              <IconSparkles size={20} stroke={1.8} />
            </Box>
            <Box style={{ flex: 1, minInlineSize: 0, textAlign: 'start' }}>
              <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>برای من تنظیمش کن</Text>
              <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>تعداد نفرات، جایگزینِ مواد، زمان</Text>
            </Box>
            <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
          </UnstyledButton>

          {/* Byline */}
          {recipe.author ? (
            <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-5)' }}>
              <Box aria-hidden="true" style={{ display: 'grid', placeItems: 'center', inlineSize: 34, blockSize: 34, borderRadius: '50%', background: 'var(--g-color-brand-100)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontWeight: 700, fontSize: 'var(--g-font-size-14)' }}>{recipe.author.trim().charAt(0)}</Box>
              <Box style={{ minInlineSize: 0 }}>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{recipe.author}</Text>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>نویسندهٔ دستور</Text>
              </Box>
            </Box>
          ) : null}

          {/* Ingredients */}
          {recipe.ingredients.length ? (
            <>
              <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>مواد لازم</Text>
              <Box component="ul" style={{ listStyle: 'none', margin: 0, padding: 0, background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' }}>
                {recipe.ingredients.map((ing, i) => (
                  <Box component="li" key={`${ing.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', padding: 'var(--g-space-3) var(--g-space-4)', borderBlockStart: i ? '1px solid var(--g-color-border-subtle)' : 'none' }}>
                    <Box aria-hidden="true" style={{ inlineSize: 7, blockSize: 7, borderRadius: '50%', background: 'var(--g-color-brand-300)', flexShrink: 0 }} />
                    <Text component="span" style={{ flex: 1, minInlineSize: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 500, color: 'var(--g-color-text-primary)' }}>{ing.name}</Text>
                    <UnstyledButton type="button" onClick={() => askSub(ing.name)} aria-label={`جایگزین برای ${ing.name}`} style={{ display: 'inline-flex', alignItems: 'center', minBlockSize: 44, paddingInline: 'var(--g-space-3)', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-brand-200)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>جایگزین؟</UnstyledButton>
                    {ing.amountText ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', whiteSpace: 'nowrap' }}>{ing.amountText}</Text> : null}
                  </Box>
                ))}
              </Box>
            </>
          ) : null}

          {/* Ingredient-resolution coverage (from the integrity report; honest, non-technical) */}
          {integrity ? (
            <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-2)' }}>
              <IconCircleCheck size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>
                {toFaDigits(integrity.resolved)} از {toFaDigits(integrity.total)} ماده در پایگاه شناخته‌شده
              </Text>
            </Box>
          ) : null}

          {/* Grounded substitutions — allergen/dislike swaps the /full read computes (was dropped by the UI) */}
          {substitutions?.length ? (
            <>
              <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>جایگزین برای حساسیت‌های تو</Text>
              <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)' }}>
                {substitutions.map((s, i) => (
                  <Box key={`${s.ingredient}-${i}`} style={{ padding: 'var(--g-space-3) var(--g-space-4)', borderBlockStart: i ? '1px solid var(--g-color-border-subtle)' : 'none' }}>
                    <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                      <IconArrowsExchange size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} />
                      <Text component="span" style={{ flex: 1, minInlineSize: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' }}>
                        به‌جای <b>{s.ingredient}</b> {s.reason === 'allergen' ? '(به‌خاطر حساسیت)' : '(به‌خاطر ذائقه)'}
                      </Text>
                    </Box>
                    <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-brand-700)', margin: 'var(--g-space-1) 0 0', paddingInlineStart: 'calc(16px + var(--g-space-2))' }}>{s.options.join('، ')}</Text>
                  </Box>
                ))}
                <Box style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', padding: 'var(--g-space-3) var(--g-space-4)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
                  <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0, marginBlockStart: 1 }} />
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>جای‌گزین‌های هم‌نقش از پایگاه مواد — راهنمایی آشپزی، نه توصیهٔ پزشکی.</Text>
                </Box>
              </Box>
            </>
          ) : null}

          {/* Tools — persisted + returned by the API but never rendered before */}
          {recipe.tools.length ? (
            <>
              <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>ابزار لازم</Text>
              <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                {recipe.tools.map((t, i) => (
                  <Box key={`${t}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-2)', borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', color: 'var(--g-color-text-secondary)' }}>
                    <IconToolsKitchen2 size={15} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />{t}
                  </Box>
                ))}
              </Box>
            </>
          ) : null}

          {/* Nutrition */}
          <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>ارزش غذایی</Text>
          <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-4)' }}>
            <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--g-space-3)' }}>
              {nutrition.calories ? (
                <Box>
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)' }}>هر وعده</Text>
                  <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-28)', fontWeight: 800, color: 'var(--g-color-text-primary)', marginBlockStart: 2 }}>{nutrition.calories} <Text component="span" style={{ fontSize: 'var(--g-font-size-14)', fontWeight: 500, color: 'var(--g-color-text-muted)' }}>کیلوکالری</Text></Text>
                </Box>
              ) : (
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}>عدد دقیقی موجود نیست</Text>
              )}
              <NutritionBadge state={nutrition.state} />
            </Box>
            <Box style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', marginBlockStart: 'var(--g-space-3)', paddingBlockStart: 'var(--g-space-3)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
              <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0, marginBlockStart: 1 }} />
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>اطلاعات عمومی، نه توصیهٔ پزشکی</Text>
            </Box>
          </Box>

          {/* Method / richness sections / faq */}
          {(recipe.steps.length || recipe.tips.length || recipe.faq.length || recipe.chefTips.length || recipe.commonMistakes.length || recipe.servingSuggestions.length || recipe.authoredSwaps.length) ? (
            <>
              <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>روش پخت</Text>
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                {recipe.steps.length ? (
                  <Accordion icon={IconListNumbers} title="مراحل پخت" defaultOpen>
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                      {recipe.steps.map((s, i) => (
                        <Box key={i} style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
                          <Box aria-hidden="true" style={{ flexShrink: 0, display: 'grid', placeItems: 'center', inlineSize: 26, blockSize: 26, borderRadius: '50%', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-12)' }}>{toFaDigits(i + 1)}</Box>
                          <Text component="span" style={stepText}>{s}</Text>
                        </Box>
                      ))}
                    </Box>
                  </Accordion>
                ) : null}
                {/* S3 Option-2: distinct premium sections when authored fields exist; else the merged tips fallback */}
                {(recipe.chefTips.length || recipe.commonMistakes.length || recipe.servingSuggestions.length || recipe.authoredSwaps.length) ? (
                  <>
                    {recipe.chefTips.length ? <Accordion icon={IconChefHat} title="نکات سرآشپز"><RichList items={recipe.chefTips} /></Accordion> : null}
                    {recipe.commonMistakes.length ? <Accordion icon={IconAlertTriangle} title="اشتباهات رایج"><RichList items={recipe.commonMistakes} /></Accordion> : null}
                    {recipe.servingSuggestions.length ? <Accordion icon={IconToolsKitchen2} title="پیشنهاد سرو"><RichList items={recipe.servingSuggestions} /></Accordion> : null}
                    {recipe.authoredSwaps.length ? <Accordion icon={IconArrowsExchange} title="جایگزین‌ها"><RichList items={recipe.authoredSwaps} /></Accordion> : null}
                  </>
                ) : recipe.tips.length ? (
                  <Accordion icon={IconBulb} title="نکته‌ها"><RichList items={recipe.tips} /></Accordion>
                ) : null}
                {recipe.faq.length ? (
                  <Accordion icon={IconHelpCircle} title="سؤال‌های پرتکرار">
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                      {recipe.faq.map((f, i) => (
                        <Box key={i}>
                          <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{f.q}</Text>
                          {f.a ? <Text component="div" style={{ ...stepText, marginBlockStart: 2 }}>{f.a}</Text> : null}
                        </Box>
                      ))}
                    </Box>
                  </Accordion>
                ) : null}
              </Box>
            </>
          ) : null}
        </Box>
      </Box>

      {/* ACTION SHELF */}
      <Box style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-3) + env(safe-area-inset-bottom))', background: 'var(--g-color-bg-surface-raised)', borderBlockStart: '1px solid var(--g-color-border-subtle)', boxShadow: 'var(--g-shadow-2)' }}>
        <UnstyledButton type="button" aria-label="به برنامه" onClick={() => setPlanOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 46, blockSize: 46, flexShrink: 0, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)' }}>
          <IconCalendarPlus size={19} stroke={1.8} />
        </UnstyledButton>
        <UnstyledButton type="button" onClick={() => navigate(`/cook/${id}`)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', minBlockSize: 52, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700 }}>
          <IconFlame size={18} stroke={1.8} aria-hidden="true" />بپز
        </UnstyledButton>
      </Box>

      <AISheet
        opened={sheetOpen}
        onClose={() => setSheetOpen(false)}
        recipeTitle={recipe.title}
        baseServings={servedFor ?? baseServings}
        ingredients={recipe.ingredients}
        onApplyServings={(n) => { setServedFor(n); showToast(`برای ${toFaDigits(n)} نفر تنظیم شد — مقدارها رو متناسب کن`, IconUsers); }}
      />
      <PlanPickerSheet opened={planOpen} onClose={() => setPlanOpen(false)} busy={planBusy} onConfirm={addToPlan} />
      <SubSheet sub={sub} onClose={() => setSub(null)} />
      <Toast toast={toast} />
    </Column>
  );
}
