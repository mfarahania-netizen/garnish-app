import { Container, Title, SimpleGrid, Alert, Text, Skeleton, Box, Group, ActionIcon, Pagination, Center } from '@mantine/core';
import { useRecipes } from '../../hooks/useRecipes';
import RecipeCard from '../../components/RecipeCard';
import { IconAlertTriangle, IconArrowUp, IconChefHat } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export default function RecipesPage() {
  const { recipes, loading, total, currentPage, totalPages, changePage } = useRecipes();

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  if (loading) {
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

  if (!recipes || recipes.length === 0) {
    return (
      <Container size="xs" py="xl" style={{ maxWidth: 420, margin: '0 auto' }}>
        <Alert color="orange" title="رسپی‌ای یافت نشد" icon={<IconAlertTriangle size={20} />}>
          در حال حاضر هیچ رسپی‌ای موجود نیست.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 100px' }}>
      <Box mb="md" style={{ position: 'relative' }}>
        <Group gap="xs" align="center">
          <IconChefHat size={28} style={{ color: '#FF6B35' }} />
          <Title order={4} style={{ color: '#1A237E' }}>
            همه رسپی‌ها
          </Title>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          {total} رسپی · صفحه {currentPage} از {totalPages}
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
            <RecipeCard recipe={recipe} />
          </motion.div>
        ))}
      </SimpleGrid>

      {totalPages > 1 && (
        <Center mt="xl">
          <Pagination
            total={totalPages}
            value={currentPage}
            onChange={changePage}
            radius="xl"
            color="orange"
            size="sm"
            siblings={1}
          />
        </Center>
      )}

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