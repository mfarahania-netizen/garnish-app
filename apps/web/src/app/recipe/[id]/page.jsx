import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton, Drawer } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconChevronRight, IconChevronDown, IconBookmark, IconBookmarkFilled, IconShare2,
  IconClock, IconChartBar, IconUsers, IconHeartCheck, IconAlertTriangle, IconSparkles,
  IconChevronLeft, IconBulb, IconHelpCircle, IconFlame, IconCalendarPlus,
  IconInfoCircle, IconCloudOff, IconRefresh, IconToolsKitchen2, IconArrowsExchange, IconCircleCheck, IconChefHat,
  IconTrash, IconArrowBackUp,
} from '@tabler/icons-react';
import { useRecipeDetail } from './useRecipeDetail';
import GrisRecipe from './GrisRecipe';
import { useFavoritesQuery } from '../../../hooks/useFavoritesQuery';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { usePersonalization } from '../../../hooks/usePersonalization';
import { usePersonalizedCascade } from '../../../hooks/usePersonalizedCascade';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/apiClient';
import { toFaDigits } from '../../../components/ges/format';
import { getRecipeAction, RecipeInteractionMode } from './recipeInteractionMode';
import { extractBaseServings, scaleAmountText } from '../../../components/ges/scaling';
import { fetchSubstitutions, qualityOf as subQualityOf } from '../../../components/ges/substitution';
import { isStructural } from '../../../components/ges/ingredientRoles';
import { personalizationSummary } from '../../../components/ges/personalize';
import { getIngredientEditGuard } from './ingredientEditGuard';
import { presentIngredientSectionsV3 } from './ingredientDisplayPresenterV3';
import IngredientListSection from './IngredientListSection.jsx';
import { filterSafeSubstitutions } from './substitutionSafety';
import PlatePlaceholder from '../../../components/ges/PlatePlaceholder';
import WhyChip from '../../../components/ges/WhyChip';
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

function CircleBtn({ icon: Icon, label, onClick, accent, disabled = false }) {
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 44, blockSize: 44,
        borderRadius: '50%', background: 'color-mix(in srgb, var(--g-color-text-inverse) 92%, transparent)',
        color: accent ? 'var(--g-color-brand-600)' : 'var(--g-color-text-primary)', boxShadow: 'var(--g-shadow-1)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon size={20} stroke={1.8} />
    </UnstyledButton>
  );
}

function MetaCell({ icon: Icon, value, label }) {
  return (
    <Box style={{ flex: 1, textAlign: 'center', paddingInline: 'var(--g-space-1)', paddingBlock: 'var(--g-space-2)' }}>
      <Icon size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 800, marginBlockStart: 2, color: 'var(--g-color-text-primary)' }}>{value}</Text>
      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-11)', color: 'var(--g-color-text-muted)' }}>{label}</Text>
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

const stepInstruction = (step) => (typeof step === 'string' ? step : step?.instruction || step?.text || step?.description || '');

function CookingStepsSection({ steps = [], title = 'روش پخت', compact = false }) {
  const normalized = (Array.isArray(steps) ? steps : [])
    .map((step, index) => {
      const instruction = stepInstruction(step).trim();
      if (!instruction) return null;
      const order = typeof step === 'object' && Number.isFinite(Number(step.order)) ? Number(step.order) : index + 1;
      return {
        order,
        title: typeof step === 'object' ? (step.title || '') : '',
        instruction,
        durationText: typeof step === 'object' ? (step.durationText || '') : '',
        imageUrl: typeof step === 'object' ? (step.imageUrl || '') : '',
        tip: typeof step === 'object' ? (step.tip || '') : '',
      };
    })
    .filter(Boolean);

  if (!normalized.length) {
    return (
      <Box style={{ marginBlockStart: 'var(--g-space-6)', padding: 'var(--g-space-4)', borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-state-info-bg)', border: '1px solid var(--g-color-border-subtle)' }}>
        <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{title}</Text>
        <Text component="p" style={{ ...stepText, margin: 'var(--g-space-2) 0 0' }}>مراحل این دستور هنوز ثبت نشده‌اند. برای پخت دقیق، فعلاً از این دستور استفاده نکن.</Text>
      </Box>
    );
  }

  return (
    <>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>{title}</Text>
      <Box component="ol" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
        {normalized.map((step) => (
          <Box component="li" key={`${step.order}-${step.instruction}`} style={{ display: 'flex', gap: 'var(--g-space-3)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-card)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)' }}>
            <Box aria-hidden="true" style={{ display: 'grid', placeItems: 'center', inlineSize: 30, blockSize: 30, borderRadius: '50%', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 800, flexShrink: 0 }}>{toFaDigits(step.order)}</Box>
            <Box style={{ minInlineSize: 0, flex: 1 }}>
              {step.imageUrl ? <img src={step.imageUrl} alt={step.title || `مرحله ${toFaDigits(step.order)}`} loading="lazy" decoding="async" style={{ inlineSize: '100%', aspectRatio: '16 / 9', objectFit: 'cover', borderRadius: 'var(--g-radius-input)', marginBlockEnd: 'var(--g-space-2)' }} /> : null}
              <Box style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--g-space-2)', flexWrap: 'wrap' }}>
                {step.title ? <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 800, color: 'var(--g-color-text-primary)' }}>{step.title}</Text> : null}
                {step.durationText ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-brand-700)' }}>{step.durationText}</Text> : null}
              </Box>
              <Text component="p" style={{ ...stepText, margin: step.title || step.durationText ? '2px 0 0' : 0, color: compact ? 'var(--g-color-text-primary)' : 'var(--g-color-text-secondary)' }}>{step.instruction}</Text>
              {step.tip ? <Text component="p" style={{ ...stepText, fontSize: 'var(--g-font-size-12)', margin: '2px 0 0', color: 'var(--g-color-text-muted)' }}>{step.tip}</Text> : null}
            </Box>
          </Box>
        ))}
      </Box>
    </>
  );
}

// a single honest line summarizing everything the user personalized (servings · swaps · removes),
// shown above the recipe body so the changes are never silent.
function PersonalizationBanner({ items }) {
  if (!items.length) return null;
  return (
    <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-4)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-50)', border: '1px solid var(--g-color-brand-200)' }}>
      <IconSparkles size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0, marginBlockStart: 1 }} />
      <Box style={{ minInlineSize: 0 }}>
        <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-brand-700)' }}>این نسخه برای تو تنظیم شده</Text>
        <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', marginBlockStart: 2 }}>{items.join(' · ')}</Text>
      </Box>
    </Box>
  );
}

// Unified, QUIET nutrition — one default-closed accordion holding the qualitative GRIS attributes + the
// per-serving numbers (recomputed source-locked cascade when personalized, else the legacy single calorie
// figure) + the non-medical disclaimer. Numbers render small (font-16 / weight-700, never 28/800) so calories
// never dominate the page. Renders nothing when there is no nutrition data at all (graceful omission).
function NutritionSection({ gris, cascade, nutrition }) {
  const nour = gris?.nourishment || null;
  const per = cascade?.nutrition?.perServing || null;
  const attrs = Array.isArray(nour?.attributes) ? nour.attributes.filter(Boolean) : [];
  const cells = per
    ? [['کالری', per.calories, ''], ['پروتئین', per.protein, 'g'], ['کربو', per.carbs, 'g'], ['چربی', per.fat, 'g'], ['فیبر', per.fiber, 'g']].map(([l, v, u]) => [l, toFaDigits(Math.round(Number(v) || 0)), u])
    : (nutrition?.calories ? [['کالری', nutrition.calories, '']] : []);
  if (!attrs.length && !nour?.note && !cells.length) return null;
  const partial = per && cascade?.nutrition?.coverage === 'partial';
  const tinyMuted = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: 'var(--g-space-2) 0 0' };
  return (
    <Box style={{ marginBlockStart: 'var(--g-space-2)' }}>
      <Accordion icon={IconInfoCircle} title="ارزشِ غذایی">
        {attrs.length ? (
          <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockEnd: cells.length || nour?.note ? 'var(--g-space-3)' : 0 }}>
            {attrs.map((a, i) => <Box key={i} style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{a}</Box>)}
          </Box>
        ) : null}
        {nour?.note ? <Text component="p" style={{ ...stepText, margin: cells.length ? '0 0 var(--g-space-3)' : 0 }}>{nour.note}</Text> : null}
        {cells.length ? (
          <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
            {cells.map(([label, val, unit]) => (
              <Box key={label} style={{ flex: '1 1 72px', textAlign: 'center', padding: 'var(--g-space-2)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-bg-canvas)' }}>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{val}{unit}</Text>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, color: 'var(--g-color-text-muted)' }}>{label}</Text>
              </Box>
            ))}
          </Box>
        ) : null}
        {partial ? <Text component="p" style={tinyMuted}>(تخمینی)</Text> : null}
        {(cascade?.notes || []).map((note, i) => <Text key={i} component="p" style={tinyMuted}>⚠️ {note}</Text>)}
        <Text component="p" style={tinyMuted}>{nour?.disclaimer || 'ارزش غذایی تقریبی است و جای توصیهٔ پزشکی را نمی‌گیرد.'}</Text>
      </Accordion>
    </Box>
  );
}

function RecipeIngredientList({ recipe, scaleFactor = 1, perso = null, askSub = null, toggleRemove = null }) {
  const sections = presentIngredientSectionsV3(recipe.ingredients || [], { recipe }).sections;
  if (!sections.length) return null;

  return (
    <IngredientListSection
      sections={sections}
      renderItemProps={(item) => {
        const ing = item.source || {};
        const display = item.titleFa;
        const rawAmount = ing.amountText || (item.amountLabel || '').replace(/^مقدار:\s*/, '');
        const scaledAmount = rawAmount ? scaleAmountText(rawAmount, scaleFactor) : '';
        const sw = perso?.swapFor?.(display) || null;
        const removed = Boolean(perso?.isRemoved?.(display));
        return {
          amountLabelOverride: scaledAmount ? `مقدار: ${scaledAmount}` : item.amountLabel,
          applied: sw,
          gone: removed,
          canAskSwap: Boolean(askSub && !removed && item.canSubstitute),
          canRemove: item.canRemove,
          onAskSwap: askSub && !removed && item.canSubstitute ? () => askSub(display) : null,
          onToggleRemove: toggleRemove && (removed || item.canRemove) ? () => toggleRemove(display) : null,
        };
      }}
    />
  );
}

function LiteRecipeBody({ recipe, scaled, servedFor, scaleFactor }) {
  const steps = (recipe.steps || []).slice(0, 4);
  return (
    <>
      {recipe.ingredients.length ? (
        <>
          <Box style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--g-space-2)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>
            <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>مواد لازم</Text>
            {scaled ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-brand-700)' }}>تنظیم‌شده برای {toFaDigits(servedFor)} نفر</Text> : null}
          </Box>
          <RecipeIngredientList recipe={recipe} scaleFactor={scaleFactor} />
        </>
      ) : null}

      {steps.length ? <CookingStepsSection steps={steps} title="روش سریع" compact /> : null}

      <Box style={{ display: 'flex', gap: 'var(--g-space-2)', alignItems: 'flex-start', marginBlockStart: 'var(--g-space-5)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-state-info-bg)' }}>
        <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0, marginBlockStart: 1 }} />
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 0 }}>اگر ماده‌ای با حساسیت یا محدودیت غذایی تو ناسازگار است، همان ماده را حذف یا با گزینه امن خودت عوض کن. آیتم‌های تازه را همان روز مصرف کن و باقی‌مانده را در ظرف دربسته و سرد نگه دار.</Text>
      </Box>
    </>
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
 * The real image is meaningful, so it carries the recipe title as alt text; the generated
 * placeholder remains decorative.
 */
function HeroMedia({ imageUrl, title }) {
  const [broken, setBroken] = useState(false);
  const showImg = !!imageUrl && !broken;
  return (
    <>
      {showImg ? (
        <img
          src={imageUrl}
          alt={title || 'دستور غذا'}
          loading="eager"
          decoding="async"
          sizes="(max-width: 480px) 100vw, 480px"
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

// one tappable substitution option (dish-authored or corpus). Tap to apply; tap the applied one to remove.
function SubOptionRow({ it, selected, applied, onSelect }) {
  const q = it.safety ? { label: it.safety.badge, rank: 0 } : subQualityOf(it.basis);
  return (
    <UnstyledButton
      type="button"
      aria-pressed={selected || applied}
      onClick={() => onSelect(it)}
      style={{ textAlign: 'start', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', border: `1px solid ${selected || applied ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}`, background: selected || applied ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)' }}
    >
      <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
        {selected || applied ? <IconCircleCheck size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} /> : <IconArrowsExchange size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} />}
        <Text component="span" style={{ flex: 1, minInlineSize: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: applied ? 'var(--g-color-brand-700)' : 'var(--g-color-text-primary)' }}>{it.name}</Text>
        <Box style={{ flexShrink: 0, paddingInline: 'var(--g-space-2)', paddingBlock: 2, borderRadius: 'var(--g-radius-chip)', background: it.basis === 'authored' ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', border: `1px solid ${it.basis === 'authored' ? 'var(--g-color-brand-200)' : 'var(--g-color-border-strong)'}`, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-11)', fontWeight: 600, color: it.basis === 'authored' ? 'var(--g-color-brand-700)' : 'var(--g-color-text-muted)' }}>{q.label}</Box>
      </Box>
      {(it.safety?.reason || it.reason) ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)', margin: '4px 0 0', paddingInlineStart: 'calc(16px + var(--g-space-2))' }}>{it.safety?.reason || it.reason}</Text> : null}
    </UnstyledButton>
  );
}

// substitution picker for one ingredient. The recipe's own DISH-AWARE swaps (GRIS v2.1) show first
// («پیشنهادِ این دستور» — e.g. potato in قیمه → بادمجان), then grounded same-role swaps from the corpus
// (POST /ai/substitutions). Tapping applies; declared allergies always stay filtered server-side.
function SubSheet({ sub, onClose, onApply, appliedTo, onRemoveSwap, onRetry }) {
  const [picked, setPicked] = useState(null);
  useEffect(() => setPicked(null), [sub?.ingredient]);
  const options = [...(sub?.authored || []), ...(sub?.items || [])];
  const applyPicked = () => {
    if (!picked?.safety?.canApply) return;
    onApply(sub.ingredient, picked.name, { basis: picked.basis, reason: picked.safety.reason || picked.reason });
  };
  return (
    <Drawer
      opened={!!sub}
      onClose={onClose}
      position="bottom"
      zIndex={400}
      withCloseButton
      closeButtonProps={{ 'aria-label': 'بستن', size: 'lg' }}
      title={<Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-16)', color: 'var(--g-color-text-primary)' }}>جایگزین امن برای {sub?.ingredient}</Text>}
      overlayProps={{ backgroundOpacity: 0.42, blur: 1 }}
      transitionProps={{ transition: 'slide-up', duration: 240 }}
      styles={bottomSheetStyles({ content: { height: 'auto', maxHeight: '85vh', borderStartStartRadius: 'var(--g-radius-sheet)', borderStartEndRadius: 'var(--g-radius-sheet)', background: 'var(--g-color-bg-surface)' }, header: { background: 'var(--g-color-bg-surface)' }, body: { paddingInline: 'var(--g-space-5)', paddingBlockEnd: 'var(--g-space-6)' } })}
    >
      {/* dish-aware authored swaps first (always, no fetch needed) */}
      {sub?.authored?.length ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', paddingBlockStart: 'var(--g-space-2)' }}>
          {sub.authored.map((it, i) => (
            <SubOptionRow key={`a-${it.name}-${i}`} it={it} selected={picked?.name === it.name} applied={appliedTo === it.name} onSelect={setPicked} />
          ))}
        </Box>
      ) : null}

      {/* corpus same-role swaps: loading / error / list / empty */}
      {sub?.loading ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', paddingBlock: 'var(--g-space-2)' }}>
          <SkeletonLine w="80%" h={18} /><SkeletonLine w="60%" h={18} />
        </Box>
      ) : sub?.error && !sub?.authored?.length ? (
        <Box style={{ paddingBlock: 'var(--g-space-2)' }}>
          <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 0 }}>الان نشد جایگزین‌ها را بیاورم — اتصال کوتاه قطع شد. چیزی عوض نشده.</Text>
          <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-brand-200)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={16} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
        </Box>
      ) : sub?.items?.length ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)', marginBlockStart: sub?.authored?.length ? 'var(--g-space-2)' : 0, paddingBlockStart: 'var(--g-space-2)' }}>
          {sub.items.map((it, i) => (
            <SubOptionRow key={`${it.name}-${i}`} it={it} selected={picked?.name === it.name} applied={appliedTo === it.name} onSelect={setPicked} />
          ))}
        </Box>
      ) : !sub?.authored?.length ? (
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', paddingBlock: 'var(--g-space-2)', margin: 0 }}>برای این ماده جایگزینِ هم‌نقشی در پایگاه پیدا نشد.</Text>
      ) : null}

      {(sub?.authored?.length || sub?.items?.length) ? (
        <Box style={{ marginBlockStart: 'var(--g-space-3)' }}>
          {picked ? <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: '0 0 var(--g-space-3)' }}>{sub.ingredient} با {picked.name} جایگزین می‌شود. ممکن است طعم یا بافت کمی تغییر کند.</Text> : null}
          <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
            <UnstyledButton type="button" onClick={onClose} style={{ flex: 1, minBlockSize: 48, borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>فعلاً تغییر نده</UnstyledButton>
            <UnstyledButton type="button" onClick={appliedTo ? () => onRemoveSwap(sub.ingredient) : applyPicked} disabled={!picked && !appliedTo} aria-disabled={!picked && !appliedTo} style={{ flex: 1, minBlockSize: 48, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', opacity: picked || appliedTo ? 1 : 0.5, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}>{appliedTo ? 'برداشتن جایگزین' : 'اعمال جایگزین'}</UnstyledButton>
          </Box>
          <Box style={{ display: 'flex', gap: 'var(--g-space-1)', alignItems: 'flex-start', marginBlockStart: 'var(--g-space-3)' }}>
            <IconInfoCircle size={14} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0, marginBlockStart: 1 }} />
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-muted)' }}>حساسیت‌های اعلام‌شده در فیلترهای گارنیش لحاظ می‌شوند، اما تضمین ایمنی نیست؛ مواد هر دستور را خودت بررسی کن.</Text>
          </Box>
        </Box>
      ) : null}
    </Drawer>
  );
}

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, recipe, nutrition, fit, substitutions, integrity, gris, refetch } = useRecipeDetail(id);
  const { token } = useAuth();
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesQuery();
  const { trackEvent } = useAnalytics();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  // shared session personalization {servedFor, swaps, removed} — also read by Cook Mode (Phase 0 layer)
  const baseServings = extractBaseServings(recipe?.servingsText, 4);
  const perso = usePersonalization(id, baseServings);
  const { servedFor, scaleFactor } = perso;
  // Phase-4 server cascade: grounded nutrition recompute + swap allergen re-gate (only when personalized)
  const cascade = usePersonalizedCascade(id, perso, !!token);
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
      removeFavorite(id, { onSuccess: () => { showToast('از ذخیره‌ها برداشته شد', IconBookmark); trackEvent('favorite_remove', { recipeId: id }); }, onError: () => showToast('انجام نشد، دوباره تلاش کن', IconBookmark) });
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

  const shareRecipe = useCallback(async () => {
    if (!recipe || typeof window === 'undefined') return;
    const url = window.location?.href || `/recipe/${id}`;
    const payload = { title: recipe.title, text: recipe.title, url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        trackEvent('recipe_share', { recipeId: id, method: 'native' });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('لینک دستور کپی شد', IconShare2);
        trackEvent('recipe_share', { recipeId: id, method: 'clipboard' });
      }
    } catch (error) {
      if (error?.name !== 'AbortError') showToast('هم‌رسانی انجام نشد', IconShare2);
    }
  }, [id, recipe, showToast, trackEvent]);

  // real grounded substitution for one ingredient → POST /ai/substitutions (deterministic, no live LLM).
  // declared allergies stay a hard filter server-side; this only proposes same-role swaps from the corpus.
  // AbortController cancels an in-flight lookup when the user taps another ingredient quickly (M10), and a
  // distinct `error` flag separates a temporary failure from an honest empty result (M7).
  const subAbort = useRef();
  // `authored` = the recipe's own dish-aware structured swaps (GRIS v2.1) — shown FIRST (e.g. potato in
  // قیمه → بادمجان), with the grounded same-role corpus swaps appended. Fixes the irrelevant-swap complaint.
  const askSub = useCallback(async (name, authored) => {
    if (!name) return;
    subAbort.current?.abort();
    const controller = new AbortController();
    subAbort.current = controller;
    const authoredItems = (Array.isArray(authored) ? authored : [])
      .filter((a) => a && a.name)
      .map((a) => ({ name: a.name, basis: 'authored', reason: a.note || 'پیشنهادِ این دستور', ingredientId: a.ingredientId || null }));
    const initialAuthored = filterSafeSubstitutions(name, authoredItems, recipe);
    const names = new Set(authoredItems.map((a) => a.name));
    setSub({ ingredient: name, loading: true, items: null, error: false, authored: initialAuthored });
    try {
      const safeAuthored = filterSafeSubstitutions(name, authoredItems, recipe);
      const { items } = await fetchSubstitutions(name, { limit: 8, signal: controller.signal });
      const safeItems = filterSafeSubstitutions(name, items.filter((it) => !names.has(it.name)), recipe);
      setSub({ ingredient: name, loading: false, items: safeItems, error: false, authored: safeAuthored });
    } catch {
      if (controller.signal.aborted) return; // superseded by a newer lookup
      const safeAuthored = filterSafeSubstitutions(name, authoredItems, recipe);
      setSub({ ingredient: name, loading: false, items: null, error: safeAuthored.length === 0, authored: safeAuthored });
    }
  }, [recipe]);
  useEffect(() => () => subAbort.current?.abort(), []);

  // apply / remove a swap on the shared personalization layer (the displayed recipe derives from it)
  const applySwap = useCallback((from, to, meta) => {
    perso.applySwap(from, to, meta);
    setSub(null);
    showToast(`جایگزین شد: ${from} ← ${to}`, IconArrowsExchange);
  }, [perso, showToast]);
  const removeSwap = useCallback((from) => {
    perso.clearSwap(from);
    setSub(null);
    showToast('جایگزین برداشته شد', IconArrowsExchange);
  }, [perso, showToast]);

  // remove / restore an ingredient (session-scoped). Removing a structural ingredient warns instead of
  // silently dropping it (H10/M6) — the user can still proceed, but is nudged toward a swap.
  const toggleRemove = useCallback((name, role = '') => {
    if (perso.isRemoved(name)) { perso.toggleRemoved(name); showToast(`${name} برگشت`, IconArrowBackUp); return; }
    const guard = getIngredientEditGuard({ name, role }, recipe);
    if (!guard.canRemoveDirectly) {
      showToast(guard.message, IconAlertTriangle);
      return;
    }
    perso.toggleRemoved(name);
    if (isStructural(name, role)) showToast(`${name} حذف شد — نقشِ ساختاری دارد؛ شاید جایگزین بهتر باشد`, IconAlertTriangle);
    else showToast(`${name} حذف شد`, IconTrash);
  }, [perso, recipe, showToast]);

  // stable handlers so the memoized AISheet doesn't re-render on unrelated page state (P1)
  const applyServings = useCallback((n) => { perso.setServedFor(n); showToast(`برای ${toFaDigits(n)} نفر تنظیم شد — مقدارها هم تنظیم شدند`, IconUsers); }, [perso, showToast]);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const saved = isFavorite(id);
  const canShareRecipe = typeof navigator !== 'undefined' && !!(navigator.share || navigator.clipboard?.writeText);

  if (status === 'loading') return <RecipeLoading />;
  if (status === 'error' || status === 'empty' || !recipe) return <RecipeError onRetry={() => (status === 'empty' ? back() : refetch())} />;

  const isAllergen = fit?.recommendation === 'avoid_allergen';
  const isGreat = fit?.recommendation === 'great_fit';
  const scaled = scaleFactor !== 1;
  // steps now live in guided mode — surface the count on the action CTA so the move is discoverable
  const stepCount = (Array.isArray(gris?.steps) ? gris.steps.length : 0) || (recipe.steps?.length || 0);
  const recipeAction = getRecipeAction({ ...recipe, gris });
  const ActionIcon = recipeAction.mode === RecipeInteractionMode.COOK ? IconFlame : IconToolsKitchen2;

  return (
    <Column>
      <Box component="main" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* HERO */}
        <Box style={{ position: 'relative', blockSize: 320 }}>
          <HeroMedia imageUrl={recipe.imageUrl} title={recipe.title} />
          <Box style={{ position: 'absolute', insetBlockStart: 0, insetInline: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 'var(--g-space-3)', paddingBlockEnd: 'var(--g-space-3)', paddingBlockStart: 'calc(var(--g-space-3) + env(safe-area-inset-top))' }}>
            <CircleBtn icon={IconChevronRight} label="بازگشت" onClick={back} />
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
              <CircleBtn icon={saved ? IconBookmarkFilled : IconBookmark} label={saved ? 'برداشتن از ذخیره‌ها' : 'ذخیره'} accent onClick={toggleSave} />
              <CircleBtn icon={IconShare2} label="هم‌رسانی" onClick={shareRecipe} disabled={!canShareRecipe} />
            </Box>
          </Box>
        </Box>

        <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-6)' }}>
          {/* META row (overlaps hero) */}
          <Box style={{ display: 'flex', alignItems: 'stretch', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)', marginBlockStart: -10, position: 'relative' }}>
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

          {(recipe.detailChips?.length || recipe.prepTimeText || recipe.totalTimeText || recipe.costText) ? (
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-2)' }}>
              {recipe.prepTimeText ? <Box style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-strong)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>آماده‌سازی: {recipe.prepTimeText}</Box> : null}
              {recipe.totalTimeText ? <Box style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-strong)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>کل زمان: {recipe.totalTimeText}</Box> : null}
              {recipe.costText ? <Box style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-strong)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>هزینه: {recipe.costText}</Box> : null}
              {(recipe.detailChips || []).map((chip) => (
                <Box key={chip} style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{chip}</Box>
              ))}
            </Box>
          ) : null}

          {/* FIT + WhyChip (honest; allergen demoted-not-hidden) */}
          {fit && (!recipe.isLiteFood || isAllergen) ? (
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

          {/* LEDE — only on the flat (non-GRIS) path. For GRIS the recipe.description is a technique line, so it
              is relocated into the «چرا این‌طوری؟» science accordion (passed as techniqueTip) and the «داستان»
              section's origin becomes the narrative intro — the intro is never a technique tip. */}
          {(!gris || recipe.isLiteFood) && recipe.description ? (
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-4) 0 0' }}>{recipe.description}</Text>
          ) : null}

          {/* AI Sheet entry */}
          {!recipe.isLiteFood ? <UnstyledButton type="button" onClick={() => setSheetOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', marginBlockStart: 'var(--g-space-4)', padding: 'var(--g-space-4)', background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)', borderRadius: 'var(--g-radius-card)' }}>
            <Box aria-hidden="true" style={{ flexShrink: 0, inlineSize: 40, blockSize: 40, borderRadius: '50%', background: 'var(--g-color-ai-glow)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px var(--g-color-brand-200)' }}>
              <IconSparkles size={20} stroke={1.8} />
            </Box>
            <Box style={{ flex: 1, minInlineSize: 0, textAlign: 'start' }}>
              <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>برای من تنظیمش کن</Text>
              <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', marginBlockStart: 2 }}>تعداد نفرات، جایگزینِ مواد، زمان</Text>
            </Box>
            <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }} />
          </UnstyledButton> : null}

          {/* Personalization summary (recomputed nutrition now lives in the unified «ارزشِ غذایی» accordion below) */}
          {!recipe.isLiteFood ? <PersonalizationBanner items={personalizationSummary(perso)} /> : null}

          {/* Byline */}
          {!recipe.isLiteFood && recipe.author ? (
            <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-5)' }}>
              <Box aria-hidden="true" style={{ display: 'grid', placeItems: 'center', inlineSize: 34, blockSize: 34, borderRadius: '50%', background: 'var(--g-color-brand-100)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontWeight: 700, fontSize: 'var(--g-font-size-14)' }}>{recipe.author.trim().charAt(0)}</Box>
              <Box style={{ minInlineSize: 0 }}>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{recipe.author}</Text>
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>نویسندهٔ دستور</Text>
              </Box>
            </Box>
          ) : null}

          {/* GRIS v2 — premium full recipe when present; otherwise the existing flat layout */}
          {recipe.isLiteFood ? <LiteRecipeBody recipe={recipe} scaled={scaled} servedFor={servedFor} scaleFactor={scaleFactor} /> : null}
          {!recipe.isLiteFood && gris ? <GrisRecipe gris={gris} recipe={recipe} scaleFactor={scaleFactor} servedFor={servedFor} swaps={perso.swaps} onAskSwap={askSub} removed={perso.removed} onToggleRemove={toggleRemove} techniqueTip={recipe.description || null} /> : null}
          {!recipe.isLiteFood && !gris ? (<>
          {/* Ingredients */}
          {recipe.ingredients.length ? (
            <>
              <Box style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--g-space-2)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>
                <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>مواد لازم</Text>
                {scaled ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-brand-700)' }}>تنظیم‌شده برای {toFaDigits(servedFor)} نفر</Text> : null}
              </Box>
              <RecipeIngredientList recipe={recipe} scaleFactor={scaleFactor} perso={perso} askSub={askSub} toggleRemove={toggleRemove} />
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

          {/* Tools — disclosed (was a loud always-on block) */}
          {recipe.tools.length ? (
            <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
              <Accordion icon={IconToolsKitchen2} title="ابزار لازم">
                <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)' }}>
                  {recipe.tools.map((t, i) => (
                    <Box key={`${t}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', paddingBlock: 'var(--g-space-2)', borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', color: 'var(--g-color-text-secondary)' }}>
                      <IconToolsKitchen2 size={15} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />{t}
                    </Box>
                  ))}
                </Box>
              </Accordion>
            </Box>
          ) : null}

          <CookingStepsSection steps={recipe.steps} title="روش پخت" />

          {/* Method richness */}
          {(recipe.tips.length || recipe.faq.length || recipe.chefTips.length || recipe.commonMistakes.length || recipe.servingSuggestions.length || recipe.authoredSwaps.length) ? (
            <>
              <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>بیشتر دربارهٔ این دستور</Text>
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
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
          </>) : null}

          {/* NUTRITION — unified + quiet, last in the disclosure stack, for BOTH layouts (qualitative + numbers) */}
          {!recipe.isLiteFood ? <NutritionSection gris={gris} cascade={cascade} nutrition={nutrition} /> : null}
        </Box>
      </Box>

      {/* ACTION SHELF */}
      <Box style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'calc(var(--g-space-3) + env(safe-area-inset-bottom))', background: 'var(--g-color-bg-surface-raised)', borderBlockStart: '1px solid var(--g-color-border-subtle)', boxShadow: 'var(--g-shadow-2)' }}>
        <UnstyledButton type="button" aria-label="به برنامه" onClick={() => setPlanOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 46, blockSize: 46, flexShrink: 0, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)' }}>
          <IconCalendarPlus size={19} stroke={1.8} />
        </UnstyledButton>
        {!recipeAction.shouldShowStickyCta ? (
          <Box style={{ flex: 1, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minBlockSize: 52, borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)' }}>
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconToolsKitchen2 size={18} stroke={1.8} aria-hidden="true" />{recipeAction.primaryLabel}</Box>
            {recipeAction.stepLabel ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, color: 'var(--g-color-text-muted)' }}>{recipeAction.stepLabel}</Text> : null}
          </Box>
        ) : (
          <UnstyledButton type="button" aria-label={recipeAction.primaryLabel} onClick={() => (recipeAction.shouldOpenGuidedMode ? navigate(`/cook/${id}`) : null)} style={{ flex: 1, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minBlockSize: 52, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700 }}>
            <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}><ActionIcon size={18} stroke={1.8} aria-hidden="true" />{recipeAction.primaryLabel}</Box>
            {recipeAction.stepLabel ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, color: 'var(--g-color-text-inverse)', opacity: 0.85 }}>{recipeAction.stepLabel}</Text> : null}
          </UnstyledButton>
        )}
      </Box>

      <AISheet
        opened={sheetOpen}
        onClose={closeSheet}
        recipeTitle={recipe.title}
        baseServings={servedFor ?? baseServings}
        ingredients={recipe.ingredients}
        swaps={perso.swaps}
        removed={perso.removed}
        onApplyServings={applyServings}
        onApplySwap={applySwap}
        onToggleRemove={toggleRemove}
      />
      <PlanPickerSheet opened={planOpen} onClose={() => setPlanOpen(false)} busy={planBusy} onConfirm={addToPlan} />
      <SubSheet
        sub={sub}
        onClose={() => setSub(null)}
        onApply={applySwap}
        onRemoveSwap={removeSwap}
        onRetry={() => sub && askSub(sub.ingredient)}
        appliedTo={sub ? (perso.swapFor(sub.ingredient)?.to || null) : null}
      />
      <Toast toast={toast} />
    </Column>
  );
}
