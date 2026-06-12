import { useParams, useNavigate } from 'react-router-dom';
import { Container, Skeleton, Alert, Button, Accordion, ActionIcon, Text, Paper } from '@mantine/core';
import { useRecipes } from '../../../hooks/useRecipes';
import { useFavoritesQuery } from '../../../hooks/useFavoritesQuery';
import { useAnalytics } from '../../../hooks/useAnalytics';
import apiClient from '../../../lib/apiClient';
import { EventType } from '../../../lib/eventTaxonomy';
import { IconAlertTriangle, IconChefHat, IconArrowRight, IconArrowUp } from '@tabler/icons-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import RecipeHero from './components/RecipeHero';
import FeaturesCard from './components/FeaturesCard';
import TimingCard from './components/TimingCard';
import NutritionCard from './components/NutritionCard';
import IngredientsSection from './components/IngredientsSection';
import ToolsSection from './components/ToolsSection';
import StepsSection from './components/StepsSection';
import TipsSection from './components/TipsSection';
import FaqSection from './components/FaqSection';

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getRecipeById, loading } = useRecipes();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesQuery();
  const { trackEvent } = useAnalytics();
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const [directRecipe, setDirectRecipe] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);
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

  useEffect(() => {
    if (finalRecipe) trackEvent(EventType.RECIPE_VIEW, { recipeId: finalRecipe.id, title: finalRecipe.title });
  }, [finalRecipe?.id]);

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
    return () => Object.values(accordionTimers.current).forEach(clearTimeout);
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
        <Alert color="red" title="رسپی پیدا نشد" icon={<IconAlertTriangle size={20} />}>
          غذایی با این شناسه در پایگاه داده یافت نشد.
        </Alert>
      </Container>
    );
  }

  const { ingredients = [], steps = [], tools = [], tips = [], faq = [] } = finalRecipe;
  const excerpt = finalRecipe.excerpt || finalRecipe.summary || finalRecipe.description;
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
      <RecipeHero recipe={finalRecipe} favorite={favorite} onToggleFavorite={handleToggleFavorite} onShare={handleShare} />
      {excerpt && (
        <Paper p="md" radius="lg" mb="lg" style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,107,53,0.2)' }}>
          <Text size="sm" c="dimmed" lineClamp={showFullExcerpt ? 0 : 3} style={{ lineHeight: 1.8 }}>{excerpt}</Text>
          {excerpt.length > 150 && (
            <Button
              variant="subtle"
              size="xs"
              color="orange"
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
          item: { background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.05)', borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
          control: { padding: '16px 20px', '&:hover': { backgroundColor: 'rgba(255,107,53,0.05)' } },
          panel: { padding: '0 20px 20px', background: 'transparent' },
          chevron: { color: '#FF6B35' },
        }}
      >
        <IngredientsSection ingredients={ingredients} />
        <ToolsSection tools={tools} />
        <StepsSection steps={steps} />
        <TipsSection tips={tips} />
        <FaqSection faq={faq} />
      </Accordion>
      <Button
        fullWidth
        size="lg"
        radius="xl"
        variant="gradient"
        gradient={{ from: '#FF6B35', to: '#1A237E' }}
        leftSection={<IconChefHat size={20} />}
        rightSection={<IconArrowRight size={20} />}
        style={{ boxShadow: '0 6px 20px rgba(255,107,53,0.4)', marginTop: 8 }}
        onClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          trackEvent(EventType.START_COOKING_CLICK, { recipeId: finalRecipe.id });
        }}
      >
        شروع پخت
      </Button>
      <ActionIcon variant="filled" color="orange" size="xl" radius="xl" style={{ position: 'fixed', bottom: 90, right: 16, zIndex: 50, boxShadow: '0 4px 12px rgba(255,107,53,0.4)' }} onClick={scrollToTop}>
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
