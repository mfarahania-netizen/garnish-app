import { Container, Title, Stack, Text, Skeleton, Box, Group, ActionIcon, Alert, Button, Paper } from '@mantine/core';
import { useFavoritesQuery } from '../../hooks/useFavoritesQuery';
import { useShoppingListQuery } from '../../hooks/useShoppingListQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import RecipeCard from '../../components/RecipeCard';
import { useNavigate } from 'react-router-dom';
import { IconHeart, IconArrowUp, IconMoodSad, IconShoppingCart, IconTrash } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { EventType } from '../../lib/eventTaxonomy';

export default function FavoritesPage() {
  const { favorites, isLoading, removeFavorite } = useFavoritesQuery();
  const { addItems } = useShoppingListQuery();
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();

  const handleAddToShoppingList = (recipe) => {
    if (!recipe?.ingredients) return;
    const items = recipe.ingredients.map(ing => ({
      name: ing.name,
      amount: ing.amount || '',
      unit: ing.unit || ''
    }));
    // فرض می‌کنیم addItems آرایه‌ای از آیتم‌ها را مستقیماً می‌گیرد
    if (typeof addItems === 'function') {
      addItems(items);
      trackEvent(EventType.SHOPPING_ADD_FROM_FAV, { recipeId: recipe.id, title: recipe.title });
    }
  };

  const handleRecipeClick = (fav) => {
    trackEvent(EventType.FAVORITE_VIEW, { recipeId: fav.recipeId, title: fav.recipe?.title });
    navigate(`/recipe/${fav.recipeId}`);
  };

  const handleRemoveFavorite = (recipeId) => {
    if (removeFavorite) {
      removeFavorite(recipeId);
      trackEvent(EventType.FAVORITE_REMOVE, { recipeId });
    }
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
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 100px' }}>
      <Paper
        p="md"
        radius="xl"
        mb="lg"
        mt="md"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,107,53,0.2)',
        }}
      >
        <Group gap="xs" align="center">
          <IconHeart size={32} style={{ color: '#FF6B35' }} />
          <div>
            <Title order={3} style={{ color: '#1A237E' }}>علاقه‌مندی‌ها</Title>
            <Text size="xs" c="dimmed">رسپی‌هایی که دوست داشته‌اید</Text>
          </div>
        </Group>
      </Paper>

      {favorites.length === 0 ? (
        <Alert color="orange" radius="lg" mb="md" icon={<IconMoodSad size={20} />}>
          <Text size="sm" fw={500}>هنوز هیچ رسپی را نپسندیده‌اید</Text>
          <Text size="xs">می‌توانید از صفحه رسپی‌ها، غذاهای مورد علاقه خود را ذخیره کنید.</Text>
        </Alert>
      ) : (
        <Stack gap="md">
          {favorites.map((fav, index) => (
            <motion.div
              key={fav.recipeId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <Paper
                radius="lg"
                p={0}
                style={{
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(0,0,0,0.05)',
                }}
              >
                <RecipeCard
                  recipe={fav.recipe}
                  onClick={() => handleRecipeClick(fav)}
                />
                <Group p="sm" justify="space-between">
                  <Button
                    variant="light"
                    color="orange"
                    size="xs"
                    radius="xl"
                    leftSection={<IconShoppingCart size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToShoppingList(fav.recipe);
                    }}
                  >
                    افزودن به لیست خرید
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFavorite(fav.recipeId);
                    }}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Paper>
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