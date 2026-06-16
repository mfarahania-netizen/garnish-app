import { useParams, useNavigate } from 'react-router-dom';
import { Container, SimpleGrid, Box, ActionIcon } from '@mantine/core';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../lib/apiClient';
import RecipeCard from '../../../components/RecipeCard';
import { SectionHeader, EmptyState, ErrorState, LoadingSkeleton } from '../../../components/ges';
import { IconArrowUp } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { withReducedMotion, riseIn } from '../../../lib/motion';
import { EventType } from '../../../lib/eventTaxonomy';

export default function CategoryPage() {
  const { keyword } = useParams();
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    trackEvent(EventType.CATEGORY_VIEW, { keyword });
  }, [keyword, trackEvent]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['categoryRecipes', keyword],
    queryFn: async () => {
      const { data } = await apiClient.get(`/recipes?category=${encodeURIComponent(keyword)}&limit=100`);
      return data;
    },
    enabled: !!keyword,
  });

  const recipes = data?.data || [];
  const total = data?.total || 0;
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  if (isLoading || !keyword) {
    return (
      <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 40px' }}>
        <Box mb="md"><LoadingSkeleton shape="text" lines={1} label="در حال بارگذاری" /></Box>
        <LoadingSkeleton shape="list" lines={6} label="در حال بارگذاری رسپی‌ها" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xs" py="xl" style={{ maxWidth: 420, margin: '0 auto' }}>
        <ErrorState title="خطا در بارگذاری" message="مشکلی در دریافت رسپی‌ها پیش آمد." retryLabel="تلاش دوباره" onRetry={() => window.location.reload()} />
      </Container>
    );
  }

  if (recipes.length === 0) {
    return (
      <Container size="xs" py="xl" style={{ maxWidth: 420, margin: '0 auto' }}>
        <EmptyState
          title={`در دستهٔ «${keyword}» چیزی نیست`}
          message="رسپی‌ای در این دسته پیدا نشد. دسته‌های دیگر را ببین."
          actionLabel="کاوش رسپی‌ها"
          onAction={() => navigate('/recipes')}
        />
      </Container>
    );
  }

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 40px' }}>
      <Box mb="md" mt="xs">
        <SectionHeader as="h1" title={keyword || 'همه غذاها'} subtitle={`${total} رسپی در این دسته`} />
      </Box>

      <SimpleGrid cols={2} spacing="sm">
        {recipes.map((recipe, index) => (
          <motion.div key={recipe.id} variants={withReducedMotion(riseIn)} initial="initial" animate="animate" transition={{ delay: Math.min(index, 6) * 0.04 }}>
            <RecipeCard
              recipe={recipe}
              onClick={() => {
                trackEvent(EventType.CATEGORY_RECIPE_CLICK, { recipeId: recipe.id, title: recipe.title, keyword });
                navigate(`/recipe/${recipe.id}`);
              }}
            />
          </motion.div>
        ))}
      </SimpleGrid>

      <ActionIcon variant="filled" color="saffron" size="xl" radius="xl"
        style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 'var(--g-z-sticky)', boxShadow: 'var(--g-shadow-2)' }}
        onClick={scrollToTop} aria-label="برگشت به بالا">
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
