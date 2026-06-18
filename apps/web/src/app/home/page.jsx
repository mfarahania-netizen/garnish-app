import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { MotionConfig, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  IconLeaf, IconFlame, IconUser, IconSparkles, IconFridge,
  IconSunrise, IconSun, IconMoon, IconCookie, IconCake,
  IconBowlSpoon, IconBurger, IconSalad, IconSoup, IconPlant2, IconCandy,
  IconBookmark, IconCalendarHeart,
} from '@tabler/icons-react';
import { useHomeData } from './lib/useHomeData';
import { useFoodDnaProjection } from '../food-dna/useFoodDna';
import { useFavoritesQuery } from '../../hooks/useFavoritesQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useImpressionObserver } from '../../hooks/useImpressionObserver';
import { toFaDigits } from '../../components/ges/format';
import FoodDnaRing from '../../components/ges/FoodDnaRing';
import AIWhisper from '../../components/ges/AIWhisper';
import RecipeCard from '../../components/ges/RecipeCard';
import RecipeRail from '../../components/ges/RecipeRail';
import GamificationStrip from '../../components/ges/GamificationStrip';
import SearchField from '../../components/ges/SearchField';
import OccasionCard from '../../components/ges/OccasionCard';
import ResumeCard from '../../components/ges/ResumeCard';
import PlatePlaceholder from '../../components/ges/PlatePlaceholder';
import EmptyState from '../../components/ges/EmptyState';
import ErrorState from '../../components/ges/ErrorState';
import Toast from '../../components/ges/Toast';
import { SkeletonLine, SkeletonCircle, SkeletonCard } from '../../components/ges/LoadingSkeleton';

const PAGE = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--g-space-4)',
  paddingInline: 'var(--g-space-4)',
  paddingBlockStart: 'var(--g-space-3)',
  paddingBlockEnd: 'var(--g-space-6)',
};

const MEAL_TYPES = [
  { label: 'صبحانه', Icon: IconSunrise },
  { label: 'ناهار', Icon: IconSun },
  { label: 'شام', Icon: IconMoon },
  { label: 'میان‌وعده', Icon: IconCookie },
  { label: 'دسر', Icon: IconCake },
];

const CUISINES = [
  { label: 'ایرانی', Icon: IconBowlSpoon, bg: 'var(--g-color-brand-50)', fg: 'var(--g-color-brand-700)' },
  { label: 'فست‌فود', Icon: IconBurger, bg: 'var(--g-color-state-info-bg)', fg: 'var(--g-color-text-secondary)' },
  { label: 'سالاد', Icon: IconSalad, bg: 'var(--g-color-state-success-bg)', fg: 'var(--g-color-state-success-fg)' },
  { label: 'سوپ و آش', Icon: IconSoup, bg: 'var(--g-color-state-warning-bg)', fg: 'var(--g-color-state-warning-fg)' },
  { label: 'گیاهی', Icon: IconPlant2, bg: 'var(--g-color-brand-50)', fg: 'var(--g-color-brand-700)' },
  { label: 'شیرینی', Icon: IconCandy, bg: 'var(--g-color-state-info-bg)', fg: 'var(--g-color-text-secondary)' },
];

const settle = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

function Greeting({ greeting, subtitle, showStreak }) {
  return (
    <Box component="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--g-space-3)', paddingBlock: 'var(--g-space-2)' }}>
      <Box style={{ flex: 1, minInlineSize: 0 }}>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 500, color: 'var(--g-color-text-muted)', margin: '0 0 var(--g-space-1)' }}>{greeting.line}</Text>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', color: 'var(--g-color-text-primary)', textWrap: 'balance', margin: 0 }}>
          {greeting.name ? `سلام ${greeting.name}،` : 'سلام،'}<br />{subtitle}
        </Text>
      </Box>
      <Box style={{ position: 'relative', flexShrink: 0 }}>
        <Box aria-hidden="true" style={{ display: 'grid', placeItems: 'center', inlineSize: 48, blockSize: 48, borderRadius: '50%', background: 'var(--g-color-brand-100)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-18)' }}>
          {greeting.initial || <IconUser size={22} stroke={1.8} />}
        </Box>
        {showStreak && greeting.streak ? (
          <Box aria-label={`${toFaDigits(greeting.streak)} هفته پیاپی`} style={{ position: 'absolute', insetBlockEnd: -4, insetInlineStart: -6, display: 'inline-flex', alignItems: 'center', gap: 2, paddingInline: 'var(--g-space-2)', paddingBlock: 2, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', boxShadow: '0 0 0 2px var(--g-color-bg-canvas)', fontFamily: 'var(--g-font-fa)', fontWeight: 800, fontSize: 'var(--g-font-size-12)' }}>
            <IconFlame size={12} stroke={2} aria-hidden="true" />{toFaDigits(greeting.streak)}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function FoodDnaCard({ dna, onOpen }) {
  return (
    <Box component={motion.div} variants={settle} initial="initial" animate="animate" transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}>
      <UnstyledButton type="button" onClick={onOpen} aria-label="شناسهٔ ذائقهٔ تو — مشاهده" style={{ display: 'block', inlineSize: '100%', textAlign: 'start', position: 'relative', overflow: 'hidden', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)', padding: 'var(--g-space-5)' }}>
        <Box aria-hidden="true" style={{ position: 'absolute', insetBlockStart: -40, insetInlineStart: -30, inlineSize: 150, blockSize: 150, borderRadius: '50%', background: 'radial-gradient(circle, var(--g-color-brand-50), transparent 70%)', pointerEvents: 'none' }} />
        <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', color: 'var(--g-color-brand-700)', marginBlockEnd: 'var(--g-space-4)' }}>
          <IconLeaf size={15} stroke={1.8} aria-hidden="true" />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>شناسهٔ ذائقهٔ تو</Text>
        </Box>
        <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--g-space-4)' }}>
          <FoodDnaRing value={dna.score} size={104} tone={dna.tone} caption="بلوغ ذائقه" />
          <Box style={{ flex: 1, minInlineSize: 0 }}>
            <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', color: 'var(--g-color-text-primary)', textWrap: 'balance', margin: 0 }}>{dna.headline}</Text>
            {dna.traits.length ? (
              <>
                <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-2) 0 0' }}>این‌طور می‌شناسیمت:</Text>
                <Box style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--g-space-1) var(--g-space-2)', marginBlockStart: 'var(--g-space-1)' }}>
                  {dna.traits.map((t, i) => (
                    <Box key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
                      {i > 0 ? <Text component="span" aria-hidden="true" style={{ color: 'var(--g-color-text-muted)' }}>·</Text> : null}
                      <Text component="b" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-brand-700)' }}>{t}</Text>
                    </Box>
                  ))}
                </Box>
              </>
            ) : null}
          </Box>
        </Box>
      </UnstyledButton>
    </Box>
  );
}

function SectionHeader({ children }) {
  return <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: '0 2px var(--g-space-3)' }}>{children}</Text>;
}

function MealTypeRow({ onPick }) {
  return (
    <Box component="section">
      <SectionHeader>دستهٔ وعده</SectionHeader>
      <Box className="g-norail" style={{ display: 'flex', gap: 'var(--g-space-2)', overflowX: 'auto', marginInline: 'calc(var(--g-space-4) * -1)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-1)' }}>
        {MEAL_TYPES.map(({ label, Icon }) => (
          <UnstyledButton key={label} type="button" onClick={onPick} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, color: 'var(--g-color-text-secondary)' }}>
            <Icon size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />{label}
          </UnstyledButton>
        ))}
      </Box>
    </Box>
  );
}

function CuisineRow({ onPick }) {
  return (
    <Box component="section">
      <SectionHeader>دستهٔ غذا</SectionHeader>
      <Box className="g-norail" style={{ display: 'flex', gap: 'var(--g-space-3)', overflowX: 'auto', marginInline: 'calc(var(--g-space-4) * -1)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-1)' }}>
        {CUISINES.map(({ label, Icon, bg, fg }) => (
          <UnstyledButton key={label} type="button" onClick={onPick} aria-label={label} style={{ flexShrink: 0, inlineSize: 78, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--g-space-2)' }}>
            <Box aria-hidden="true" style={{ display: 'grid', placeItems: 'center', inlineSize: 64, blockSize: 64, borderRadius: 18, background: bg, color: fg }}>
              <Icon size={28} stroke={1.6} />
            </Box>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-secondary)' }}>{label}</Text>
          </UnstyledButton>
        ))}
      </Box>
    </Box>
  );
}

function StarterCard({ label, seed }) {
  return (
    <Box style={{ flex: 1, background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)', overflow: 'hidden' }}>
      <Box style={{ position: 'relative', blockSize: 140, overflow: 'hidden' }}><PlatePlaceholder label={label} seed={seed} /></Box>
      <Text component="div" style={{ padding: 'var(--g-space-2) var(--g-space-3)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>{label}</Text>
    </Box>
  );
}

function HomeLoading() {
  return (
    <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={PAGE}>
      <SkeletonLine w="100%" h={50} radius="var(--g-radius-input)" />
      <Box component="header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--g-space-3)' }}>
        <Box style={{ flex: 1 }}><SkeletonLine w={90} h={12} /><SkeletonLine w={170} h={20} style={{ marginBlockStart: 'var(--g-space-2)' }} /></Box>
        <SkeletonCircle size={48} />
      </Box>
      <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-5)' }}>
        <SkeletonLine w={110} h={12} />
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-4)' }}>
          <SkeletonCircle size={104} />
          <Box style={{ flex: 1 }}><SkeletonLine w="100%" h={14} /><SkeletonLine w="60%" h={12} style={{ marginBlockStart: 'var(--g-space-2)' }} /></Box>
        </Box>
      </Box>
      <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
        <SkeletonLine w={84} h={36} radius="var(--g-radius-chip)" /><SkeletonLine w={70} h={36} radius="var(--g-radius-chip)" /><SkeletonLine w={78} h={36} radius="var(--g-radius-chip)" />
      </Box>
      <SkeletonCard />
    </Box>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { status, greeting, dna, gam, whisper, picks, rails, resume, refetch } = useHomeData();
  // S2: show the REAL (behavior-hydrated) maturity from GET /profile/dna when available; fall back to the
  // /profile maturity otherwise (keeps the card honest + consistent with the Food DNA screen it links to).
  const dnaProjection = useFoodDnaProjection();
  const dnaMaturity = dnaProjection.data?.maturity;
  const cardDna = dnaMaturity
    ? { ...dna, score: dnaMaturity.score, tone: dnaMaturity.band === 'developing' || dnaMaturity.band === 'mature' ? 'mature' : 'forming' }
    : dna;
  const [whisperDismissed, setWhisperDismissed] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  // server-truth favorites (no local fake state); honest favorite signal; viewport impression telemetry
  const { isFavorite, addFavorite, removeFavorite } = useFavoritesQuery();
  const { trackEvent } = useAnalytics();
  const { observe } = useImpressionObserver({ enabled: true, source: 'home' });

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = useCallback((message, Icon) => {
    clearTimeout(toastTimer.current);
    setToast({ message, Icon });
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const openRecipe = useCallback((id) => { if (id) navigate(`/recipe/${id}`); }, [navigate]);
  const goDiscover = useCallback(() => navigate('/discover'), [navigate]);
  // real favorites write: confirmation toast ONLY on a successful call; revert is automatic (server truth);
  // fire the explicit `favorite_add` signal once per successful add.
  const toggleSave = useCallback((id) => {
    if (!id) return;
    if (isFavorite(id)) {
      removeFavorite(id, {
        onSuccess: () => showToast('از ذخیره‌ها برداشته شد', IconBookmark),
        onError: () => showToast('انجام نشد، دوباره تلاش کن', IconBookmark),
      });
    } else {
      addFavorite(id, {
        onSuccess: () => { showToast('به ذخیره‌ها اضافه شد', IconBookmark); trackEvent('favorite_add', { recipeId: id }); },
        onError: () => showToast('ذخیره نشد، دوباره تلاش کن', IconBookmark),
      });
    }
  }, [isFavorite, addFavorite, removeFavorite, showToast, trackEvent]);

  if (status === 'loading') return <HomeLoading />;

  return (
    <MotionConfig reducedMotion="user">
      <Box style={PAGE}>
        <SearchField onClick={goDiscover} />

        <Greeting greeting={greeting} subtitle={status === 'empty' ? 'خوش اومدی' : 'امشب چی بپزیم؟'} showStreak={status === 'ready'} />

        {status === 'error' ? (
          <ErrorState title="یه مشکلی پیش اومد" body="نتونستیم پیشنهادِ امشب رو بیاریم. چیزی از دست نرفته." retryLabel="دوباره امتحان کن" onRetry={refetch} />
        ) : null}

        {status === 'empty' ? (
          <>
            <EmptyState icon={IconLeaf} title="بیا اول ذائقه‌ات رو بشناسیم" body="چند سؤال کوتاه می‌پرسیم تا پیشنهادها از همین امشب دقیق‌تر شوند." actionLabel="شروع شناختِ ذائقه" actionIcon={IconSparkles} onAction={goDiscover} />
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)', margin: 'var(--g-space-2) 2px 0' }}>یا از این‌جا شروع کن</Text>
            <Box style={{ display: 'flex', gap: 'var(--g-space-2)' }}>
              <StarterCard label="کوکو سبزی" seed={2} />
              <StarterCard label="عدس‌پلو" seed={3} />
            </Box>
          </>
        ) : null}

        {status === 'ready' ? (
          <>
            <FoodDnaCard dna={cardDna} onOpen={() => navigate('/food-dna')} />

            {gam.show ? <GamificationStrip headline={gam.headline} progressLabel={gam.progressLabel} progress={gam.progress} /> : null}

            {whisper && !whisperDismissed ? (
              <AIWhisper text={whisper.text} sub={whisper.sub} onAccept={() => openRecipe(whisper.recipeId)} onDismiss={() => setWhisperDismissed(true)} />
            ) : null}

            <MealTypeRow onPick={goDiscover} />
            <CuisineRow onPick={goDiscover} />

            <Box component="section">
              <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginInline: 2, marginBlockEnd: 'var(--g-space-3)' }}>
                <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>برای تو، امشب</Text>
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}>{`${toFaDigits(picks.length)} پیشنهاد`}</Text>
              </Box>
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
                {picks.map((p, i) => (
                  <Box key={p.recipeId} ref={observe(p.recipeId)} component={motion.div} variants={settle} initial="initial" animate="animate" transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1], delay: 0.05 + i * 0.05 }}>
                    <RecipeCard title={p.title} placeholderSeed={p.seed} fit={p.fit} cookTimeText={p.cookTimeText} difficultyText={p.difficultyText} servingsText={p.servingsText} reasons={p.reasons} reasonText={p.reasonText} saved={isFavorite(p.recipeId)} onSave={() => toggleSave(p.recipeId)} onOpen={() => openRecipe(p.recipeId)} />
                  </Box>
                ))}
              </Box>
            </Box>

            <RecipeRail title="بر اساس آشپزخونه‌ات" icon={IconFridge} items={rails.pantry} isSaved={isFavorite} registerImpression={observe} onSeeAll={goDiscover} onOpen={openRecipe} onSave={toggleSave} />
            <RecipeRail title="محبوب‌ها" icon={IconFlame} items={rails.popular} isSaved={isFavorite} registerImpression={observe} onSeeAll={goDiscover} onOpen={openRecipe} onSave={toggleSave} />
            <RecipeRail title="تازه‌ها" icon={IconSparkles} items={rails.fresh} isSaved={isFavorite} registerImpression={observe} onSeeAll={goDiscover} onOpen={openRecipe} onSave={toggleSave} />

            <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
              <OccasionCard title="حال‌وهوای شب یلدا" badge="مناسبتی" onClick={() => showToast('مجموعهٔ مناسبتی به‌زودی', IconCalendarHeart)} />
            </Box>

            {resume ? (
              <Box style={{ marginBlockStart: 'var(--g-space-5)' }}>
                <ResumeCard title={resume.title} seed={resume.seed} stepLabel={resume.stepLabel} progress={resume.progress} onClick={openRecipe} />
              </Box>
            ) : null}
          </>
        ) : null}
      </Box>
      <Toast toast={toast} />
    </MotionConfig>
  );
}
