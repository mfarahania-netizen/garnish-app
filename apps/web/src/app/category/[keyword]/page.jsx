import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Title, SimpleGrid, Skeleton, Text,
  useMantineColorScheme, Box, Group, ActionIcon, Alert
} from '@mantine/core';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../../lib/apiClient';
import RecipeCard from '../../../components/RecipeCard';
import { IconAlertTriangle, IconArrowUp, IconCategory } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { EventType } from '../../../lib/eventTaxonomy';

export default function CategoryPage() {
  const { keyword } = useParams();
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

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
        <Skeleton height={36} width="70%" mb="md" />
        <SimpleGrid cols={2} spacing="sm">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={200} radius="lg" />
          ))}
        </SimpleGrid>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xs" py="xl" style={{ maxWidth: 420, margin: '0 auto' }}>
        <Alert color="red" title="خطا در بارگذاری" icon={<IconAlertTriangle size={20} />}>
          مشکلی در دریافت رسپی‌ها پیش آمده است.
        </Alert>
      </Container>
    );
  }

  if (recipes.length === 0) {
    return (
      <Container size="xs" py="xl" style={{ maxWidth: 420, margin: '0 auto' }}>
        <Alert color="orange" title="غذایی پیدا نشد" icon={<IconAlertTriangle size={20} />}>
          متأسفانه هیچ رسپی در دسته «{keyword}» یافت نشد.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 40px' }}>
      <Box mb="md">
        <Group gap="xs" align="center">
          <IconCategory size={28} style={{ color: '#FF6B35' }} />
          <Title order={4} c={dark ? 'white' : 'navy.9'}>
            🍽️ {keyword || 'همه غذاها'}
          </Title>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          {total} رسپی در این دسته
        </Text>
      </Box>

      <SimpleGrid cols={2} spacing="sm">
        {recipes.map((recipe, index) => (
          <motion.div
            key={recipe.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
          >
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

      <ActionIcon
        variant="light"
        color="orange"
        size="xl"
        radius="xl"
        style={{
          position: 'fixed',
          bottom: 80,
          right: 16,
          zIndex: 50,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
