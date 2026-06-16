import { useParams, useNavigate } from 'react-router-dom';
import { Container, Skeleton, Button, Accordion, ActionIcon, Text, Paper, Group, Box } from '@mantine/core';
import { useRecipes } from '../../../hooks/useRecipes';
import { useFavoritesQuery } from '../../../hooks/useFavoritesQuery';
import { useAnalytics } from '../../../hooks/useAnalytics';
import apiClient from '../../../lib/apiClient';
import { EventType } from '../../../lib/eventTaxonomy';
import { IconChefHat, IconArrowRight, IconArrowUp, IconSparkles } from '@tabler/icons-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button as GesButton, WhyChip, WhySheet, AllergenMark, AISheet, StatusBadge, ErrorState,
} from '../../../components/ges';
import RecipeHero from './components/RecipeHero';
import RecipeByline from './components/RecipeByline';
import RecipeVideo from './components/RecipeVideo';
import SimilarRecipes from './components/SimilarRecipes';
import FeaturesCard from './components/FeaturesCard';
import TimingCard from './components/TimingCard';
import NutritionCard from './components/NutritionCard';
import IngredientsSection from './components/IngredientsSection';
import ToolsSection from './components/ToolsSection';
import StepsSection from './components/StepsSection';
import TipsSection from './components/TipsSection';
import FaqSection from './components/FaqSection';

// Honest personalized fit treatment → calm tone (declared-allergy conflict is the loud, safety-critical one).
const FIT_META = {
  great_fit: { tone: 'success', label: 'مناسب ذائقهٔ تو' },
  ok: { tone: 'info', label: 'گزینهٔ خوبی برای تو' },
  caution: { tone: 'warning', label: 'با کمی احتیاط' },
  avoid_allergen: { tone: 'danger', label: 'هشدار حساسیت غذایی' },
};

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getRecipeById, loading } = useRecipes();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesQuery();
  const { trackEvent } = useAnalytics();
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const [directRecipe, setDirectRecipe] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [rich, setRich] = useState(null);       // /recipes/:id/full → personalized fit + safety (authed)
  const [whyOpen, setWhyOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const scrollTracked = useRef(false);
  const prevAccordionValue = useRef([]);
  const accordionTimers = useRef({});
  const recipe = getRecipeById(id);

  useEffect(() => {
    if (!recipe && id) {
      setDirectLoading(true);
      apiClient
        .get(`/recipes/${id}`)
        .then((res) => setDirectRecipe(res.data))
        .catch(() => setDirectRecipe(null))
        .finally(() => setDirectLoading(false));
    }
  }, [recipe, id]);

  const finalRecipe = recipe || directRecipe;
  const finalLoading = loading || directLoading;
  const favorite = finalRecipe ? isFavorite(finalRecipe.id) : false;

  // RECIPE-L4-07: consolidated rich read — personalized fit + safety (authed). Best-effort, additive.
  // Declared allergies stay a hard safety signal; we DEMOTE (calm flag), never hide the recipe.
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !id) return;
    apiClient
      .get(`/recipes/${id}/full`)
      .then((res) => setRich(res.data))
      .catch(() => setRich(null));
  }, [id]);

  const fit = rich?.fit || null;
  const conflictingAllergens = fit?.safety?.conflictingAllergens || [];

  useEffect(() => {
    if (finalRecipe) trackEvent(EventType.RECIPE_VIEW, { recipeId: finalRecipe.id, title: finalRecipe.title });
  }, [finalRecipe, trackEvent]);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollTracked.current) return;
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      if (scrollTop + windowHeight >= documentHeight * 0.8) {
        trackEvent(EventType.RECIPE_SCROLL_TO_BOTTOM, { recipeId: finalRecipe?.id });
        scrollTracked.current = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [finalRecipe?.id, trackEvent]);

  useEffect(() => {
    const timers = accordionTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const handleToggleFavorite = () => {
    if (!finalRecipe) return;
    if (favorite) {
      removeFavorite(finalRecipe.id);
      trackEvent(EventType.FAVORITE_REMOVE, { recipeId: finalRecipe.id });
    } else {
      addFavorite(finalRecipe.id);
      trackEvent(EventType.FAVORITE_ADD, { recipeId: finalRecipe.id });
    }
  };

  const handleShare = async () => {
    trackEvent(EventType.RECIPE_SHARE, { recipeId: finalRecipe.id });
    if (navigator.share) await navigator.share({ title: finalRecipe.title, url: window.location.href });
  };

  const handleAccordionChange = useCallback((values) => {
    const prev = prevAccordionValue.current;
    const opened = values.filter((value) => !prev.includes(value));
    const closed = prev.filter((value) => !values.includes(value));
    opened.forEach((value) => {
      trackEvent(`${value}_expand`, { recipeId: finalRecipe?.id });
      if (accordionTimers.current[value]) clearTimeout(accordionTimers.current[value]);
      accordionTimers.current[value] = setTimeout(() => {
        trackEvent(`${value}_read`, { recipeId: finalRecipe?.id });
        delete accordionTimers.current[value];
      }, 8000);
    });
    closed.forEach((value) => {
      trackEvent(`${value}_collapse`, { recipeId: finalRecipe?.id });
      if (accordionTimers.current[value]) {
        clearTimeout(accordionTimers.current[value]);
        delete accordionTimers.current[value];
      }
    });
    prevAccordionValue.current = values;
  }, [finalRecipe?.id, trackEvent]);

  if (finalLoading) {
    return (
      <Container size="sm" py="md" style={{ maxWidth: 480, margin: '0 auto' }}>
        <Skeleton height={300} radius="xl" mb="md" />
        <Skeleton height={24} width="60%" mb="sm" />
        <Skeleton height={20} width="80%" mb="lg" />
        <Skeleton height={300} radius="md" />
      </Container>
    );
  }

  if (!finalRecipe) {
    return (
      <Container size="sm" py="xl" style={{ maxWidth: 480, margin: '0 auto' }}>
        <ErrorState
          title="رسپی پیدا نشد"
          message="غذایی با این شناسه پیدا نشد. شاید حذف شده یا آدرس اشتباه است."
          retryLabel="همهٔ رسپی‌ها"
          onRetry={() => navigate('/recipes')}
        />
      </Container>
    );
  }

  const { ingredients = [], steps = [], tools = [], tips = [], faq = [] } = finalRecipe;
  const excerpt = finalRecipe.excerpt || finalRecipe.summary || finalRecipe.description;
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const fitMeta = fit ? FIT_META[fit.recommendation] : null;

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
      <RecipeHero recipe={finalRecipe} favorite={favorite} onToggleFavorite={handleToggleFavorite} onShare={handleShare} />
      <RecipeByline recipe={finalRecipe} />
      <RecipeVideo recipe={finalRecipe} />

      {/* Personalized fit treatment + safety (honest; allergy DEMOTED-not-hidden) + explainability */}
      {fit && (
        <Paper
          p="md"
          radius="lg"
          mb="lg"
          style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)' }}
        >
          <Group justify="space-between" align="center" wrap="nowrap" style={{ gap: 'var(--g-space-2)' }}>
            <Group gap="var(--g-space-2)" wrap="wrap" style={{ rowGap: 'var(--g-space-1)' }}>
              {fitMeta && <StatusBadge tone={fitMeta.tone}>{fitMeta.label}</StatusBadge>}
              {conflictingAllergens.length > 0 && (
                <AllergenMark allergen={conflictingAllergens.join('، ')} onOpen={() => navigate('/preferences')} />
              )}
            </Group>
            <WhyChip label="چرا این؟" onOpen={() => { setWhyOpen(true); trackEvent('why_open', { recipeId: finalRecipe.id, surface: 'recipe_detail' }); }} ariaLabel={`چرا این؟ — ${finalRecipe.title}`} />
          </Group>
          {fit.recommendation === 'avoid_allergen' && (
            <Text size="xs" mt="var(--g-space-2)" style={{ color: 'var(--g-color-state-danger-fg)', textAlign: 'start', lineHeight: 'var(--g-leading-body)' }}>
              این رسپی با حساسیت‌های اعلام‌شده‌ات هم‌خوانی ندارد. رسپی پنهان نشده تا خودت تصمیم بگیری — اما با احتیاط.
            </Text>
          )}
        </Paper>
      )}

      {/* AI Sheet entry — disclosed; opens an in-context assistant for this recipe */}
      <Box
        role="button"
        tabIndex={0}
        aria-label={`از دستیار دربارهٔ ${finalRecipe.title} بپرس`}
        onClick={() => { setAiOpen(true); trackEvent('ai_sheet_open', { recipeId: finalRecipe.id }); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAiOpen(true); } }}
        mb="lg"
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)',
          background: 'var(--g-color-ai-surface)', border: 'var(--g-border-ai)',
          borderRadius: 'var(--g-radius-card)', boxShadow: 'var(--g-shadow-1)',
          padding: 'var(--g-space-4)', cursor: 'pointer', marginBottom: 'var(--g-space-5)',
        }}
      >
        <IconSparkles size={20} color="var(--g-color-food-saffron)" aria-hidden="true" />
        <div style={{ flex: 1 }}>
          <Text fw={700} size="sm" c="var(--g-color-text-primary)">برای من تنظیمش کن</Text>
          <Text size="xs" c="var(--g-color-text-secondary)">سؤال بپرس یا بخواه ساده‌تر/سریع‌تر شود</Text>
        </div>
      </Box>

      {excerpt && (
        <Paper p="md" radius="lg" mb="lg" style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)' }}>
          <Text size="sm" c="dimmed" lineClamp={showFullExcerpt ? 0 : 3} style={{ lineHeight: 1.8 }}>{excerpt}</Text>
          {excerpt.length > 150 && (
            <Button
              variant="subtle"
              size="xs"
              color="saffron"
              mt={4}
              onClick={() => {
                setShowFullExcerpt(!showFullExcerpt);
                trackEvent(EventType.EXCERPT_TOGGLE, { recipeId: finalRecipe.id });
              }}
            >
              {showFullExcerpt ? 'بستن' : 'بیشتر بخوانید'}
            </Button>
          )}
        </Paper>
      )}
      <FeaturesCard recipe={finalRecipe} />
      <TimingCard recipe={finalRecipe} />
      <NutritionCard recipe={finalRecipe} />
      <Accordion
        multiple
        defaultValue={ingredients.length ? ['ingredients'] : (steps.length ? ['steps'] : [])}
        variant="separated"
        radius="lg"
        chevronPosition="right"
        onChange={handleAccordionChange}
        styles={{
          item: { background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
          control: { padding: '16px 20px' },
          panel: { padding: '0 20px 20px', background: 'transparent' },
          chevron: { color: 'var(--g-color-food-saffron)' },
        }}
      >
        <IngredientsSection ingredients={ingredients} />
        <ToolsSection tools={tools} />
        <StepsSection steps={steps} />
        <TipsSection tips={tips} />
        <FaqSection faq={faq} />
      </Accordion>
      {/* SEARCH-L4-08: deterministic "similar recipes" (nearest-neighbor, explainable) */}
      <SimilarRecipes recipeId={finalRecipe.id} />

      {/* بپز — CTA اصلی (توکن‌محور) */}
      <Box mt="var(--g-space-3)">
        <GesButton
          fullWidth
          leftIcon={<IconChefHat size={20} />}
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            trackEvent(EventType.START_COOKING_CLICK, { recipeId: finalRecipe.id });
          }}
        >
          بپز
        </GesButton>
      </Box>

      <ActionIcon variant="filled" color="saffron" size="xl" radius="xl" style={{ position: 'fixed', bottom: 90, right: 16, zIndex: 'var(--g-z-sticky)', boxShadow: 'var(--g-shadow-2)' }} onClick={scrollToTop} aria-label="برگشت به بالا">
        <IconArrowUp size={18} />
      </ActionIcon>

      {/* Why sheet — reasons strictly from the fit payload (never fabricated) */}
      <WhySheet
        opened={whyOpen}
        onClose={() => setWhyOpen(false)}
        title="چرا این؟"
        state={fit?.reasons?.length ? 'reasons' : 'empty-fallback'}
        reasons={fit?.reasons || []}
        emptyFallbackText="هنوز سیگنال شخصی کافی نداریم — این یک پیشنهاد عمومی است."
        corrections={[
          { id: 'not-for-me', label: 'مناسب من نیست' },
          { id: 'seen-enough', label: 'کافی دیدم' },
        ]}
        onCorrect={(opt) => { trackEvent('rec_correction', { recipeId: finalRecipe.id, type: opt.id }); setWhyOpen(false); }}
      />

      {/* AI Sheet — disclosed; guard-safe entry that hands off to the full assistant */}
      <AISheet
        opened={aiOpen}
        onClose={() => setAiOpen(false)}
        contextLabel={finalRecipe.title}
        title="دستیار رسپی"
        state="answer"
        confirmLabel="باز کردن گفتگو"
        declineLabel="بستن"
      >
        <Text>
          می‌تونم کمکت کنم این رسپی رو ساده‌تر، سریع‌تر یا متناسب با ذائقه‌ات کنم. برای گفتگوی کامل، دستیار رو باز کن.
        </Text>
        <Box mt="var(--g-space-3)">
          <GesButton onClick={() => { setAiOpen(false); navigate('/ai-chat'); trackEvent('ai_chat_button_click', { from: 'recipe_sheet', recipeId: finalRecipe.id }); }}>
            باز کردن دستیار
          </GesButton>
        </Box>
      </AISheet>
    </Container>
  );
}
