import { Container, Title, Stack, Text, Skeleton, Box, Group, ActionIcon, Alert, Button } from '@mantine/core';
import { useFavoritesQuery } from '../../hooks/useFavoritesQuery';
import { useShoppingListQuery } from '../../hooks/useShoppingListQuery'; // ✅ هوک جدید
import { useAnalytics } from '../../hooks/useAnalytics'; // ✅ ردیابی
import RecipeCard from '../../components/RecipeCard';
import { useNavigate } from 'react-router-dom';
import { IconHeart, IconArrowUp, IconMoodSad, IconShoppingCart } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export default function FavoritesPage() {
  const { favorites, isLoading } = useFavoritesQuery();
  const { addItems } = useShoppingListQuery(); // ✅ دیگر خطا نمی‌دهد
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();

  const handleAddToShoppingList = (recipe) => {
    if (!recipe?.ingredients) return;
    const items = recipe.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount || '',
      unit: ing.unit || ''
    }));
    addItems(items);
    trackEvent('shopping_add_from_fav', { recipeId: recipe.id, title: recipe.title });
  };

  const handleRecipeClick = (recipe) => {
    trackEvent('favorite_view', { recipeId: recipe.recipeId, title: recipe.recipe?.title });
    navigate(`/recipe/${recipe.recipeId}`);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  if (isLoading) {
    return (
      <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px' }}>
        <Skeleton height={40} width="60%" mb="lg" />
        <Skeleton height={200} radius="lg" mb="md" />
        <Skeleton height={200} radius="lg" />
      </Container>
    );
  }

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 40px' }}>
      <Box mb="lg" mt="md">
        <Group gap="xs" align="center">
          <IconHeart size={32} style={{ color: '#FF6B35' }} />
          <Title order={3} style={{ color: '#1A237E' }}>علاقه‌مندی‌ها</Title>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          رسپی‌هایی که دوست داشته‌اید
        </Text>
      </Box>

      {favorites.length === 0 ? (
        <Alert color="orange" radius="lg" mb="md" icon={<IconMoodSad size={20} />}>
          <Text size="sm" fw={500}>هنوز هیچ رسپی را نپسندیده‌اید</Text>
          <Text size="xs">می‌توانید از صفحه رسپی‌ها، غذاهای مورد علاقه خود را ذخیره کنید.</Text>
        </Alert>
      ) : (
        <Stack gap="sm">
          {favorites.map((fav, index) => (
            <motion.div
              key={fav.recipeId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <RecipeCard
                recipe={fav.recipe}
                onClick={() => handleRecipeClick(fav)}
              />
              <Button
                fullWidth
                mt="xs"
                variant="light"
                color="orange"
                size="xs"
                radius="xl"
                leftSection={<IconShoppingCart size={14} />}
                onClick={(e) => { e.stopPropagation(); handleAddToShoppingList(fav.recipe); }}
              >
                افزودن مواد به لیست خرید
              </Button>
            </motion.div>
          ))}
        </Stack>
      )}

      <ActionIcon
        variant="light" color="orange" size="xl" radius="xl"
        style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}