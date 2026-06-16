import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IconChevronRight, IconChevronDown, IconBookmark, IconBookmarkFilled, IconShare2,
  IconClock, IconChartBar, IconUsers, IconHeartCheck, IconAlertTriangle, IconSparkles,
  IconChevronLeft, IconListNumbers, IconBulb, IconHelpCircle, IconFlame, IconCalendarPlus,
  IconInfoCircle, IconToolsKitchen2, IconCloudOff, IconRefresh,
} from '@tabler/icons-react';
import { useRecipeDetail } from './useRecipeDetail';
import { toFaDigits } from '../../../components/ges/format';
import PlatePlaceholder from '../../../components/ges/PlatePlaceholder';
import WhyChip from '../../../components/ges/WhyChip';
import NutritionBadge from '../../../components/ges/NutritionBadge';
import AISheet from '../../../components/ges/AISheet';
import Toast from '../../../components/ges/Toast';
import { SkeletonLine } from '../../../components/ges/LoadingSkeleton';

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
      <Box className="g-skeleton" style={{ blockSize: 200, borderRadius: 0 }} />
      <Box style={{ padding: 'var(--g-space-4)' }}>
        <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
          <SkeletonLine w="100%" h={56} /><SkeletonLine w="100%" h={56} /><SkeletonLine w="100%" h={56} />
        </Box>
        <SkeletonLine w="70%" h={20} style={{ marginBlockStart: 'var(--g-space-4)' }} />
        <SkeletonLine w="90%" h={12} style={{ marginBlockStart: 'var(--g-space-3)' }} />
        <SkeletonLine w="80%" h={12} style={{ marginBlockStart: 'var(--g-space-2)' }} />
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

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { status, recipe, nutrition, fit, refetch } = useRecipeDetail(id);
  const [saved, setSaved] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => {
    clearTimeout(toastTimer.current);
    setToast({ message, Icon });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);
  const back = () => navigate(-1);

  if (status === 'loading') return <RecipeLoading />;
  if (status === 'error' || status === 'empty' || !recipe) return <RecipeError onRetry={() => (status === 'empty' ? back() : refetch())} />;

  const isAllergen = fit?.recommendation === 'avoid_allergen';
  const isGreat = fit?.recommendation === 'great_fit';

  return (
    <Column>
      <Box component="main" style={{ flex: 1, overflowY: 'auto' }}>
        {/* HERO */}
        <Box style={{ position: 'relative', blockSize: 248 }}>
          <HeroMedia imageUrl={recipe.imageUrl} title={recipe.title} />
          <Box style={{ position: 'absolute', insetBlockStart: 0, insetInline: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 'var(--g-space-3)', paddingBlockEnd: 'var(--g-space-3)', paddingBlockStart: 'calc(var(--g-space-3) + env(safe-area-inset-top))' }}>
            <CircleBtn icon={IconChevronRight} label="بازگشت" onClick={back} />
            <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
              <CircleBtn icon={saved ? IconBookmarkFilled : IconBookmark} label={saved ? 'برداشتن از ذخیره‌ها' : 'ذخیره'} accent onClick={() => { setSaved((s) => !s); showToast('به ذخیره‌ها اضافه شد', IconBookmark); }} />
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
            <MetaCell icon={IconUsers} value={recipe.servingsText || '—'} label="برای" />
          </Box>

          {/* TITLE + category chips */}
          <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', textWrap: 'balance', color: 'var(--g-color-text-primary)', margin: 'var(--g-space-4) 0 0' }}>{recipe.title}</Text>
          {recipe.categories.length ? (
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-2)' }}>
              {recipe.categories.map((c) => (
                <Box key={c} style={{ paddingInline: 'var(--g-space-3)', paddingBlock: 4, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>{c}</Box>
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
                    <UnstyledButton type="button" onClick={() => showToast('پیشنهادِ جایگزین در دستیار', IconSparkles)} style={{ display: 'inline-flex', alignItems: 'center', minBlockSize: 44, paddingInline: 'var(--g-space-3)', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-brand-200)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>جایگزین؟</UnstyledButton>
                    {ing.amountText ? <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', whiteSpace: 'nowrap' }}>{ing.amountText}</Text> : null}
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

          {/* Method / tips / faq */}
          {(recipe.steps.length || recipe.tips.length || recipe.faq.length) ? (
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
                {recipe.tips.length ? (
                  <Accordion icon={IconBulb} title="نکته‌ها">
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-2)' }}>
                      {recipe.tips.map((t, i) => <Text key={i} component="p" style={{ ...stepText, margin: 0 }}>{t}</Text>)}
                    </Box>
                  </Accordion>
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
        <UnstyledButton type="button" aria-label="به برنامه" onClick={() => showToast('به برنامه به‌زودی', IconCalendarPlus)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', inlineSize: 46, blockSize: 46, flexShrink: 0, borderRadius: '50%', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)' }}>
          <IconCalendarPlus size={19} stroke={1.8} />
        </UnstyledButton>
        <UnstyledButton type="button" onClick={() => showToast('حالت پخت به‌زودی فعال می‌شود', IconToolsKitchen2)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-2)', minBlockSize: 52, borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700 }}>
          <IconFlame size={18} stroke={1.8} aria-hidden="true" />بپز
        </UnstyledButton>
      </Box>

      <AISheet opened={sheetOpen} onClose={() => setSheetOpen(false)} recipeTitle={recipe.title} onAsk={() => { setSheetOpen(false); showToast('دستیار هوش مصنوعی به‌زودی فعال می‌شود', IconSparkles); }} />
      <Toast toast={toast} />
    </Column>
  );
}
