import { useState } from 'react';
import { Modal, Text, Group, Button, Card, Title, Badge, Checkbox, Divider } from '@mantine/core';
import { IconHeartPlus, IconCheck } from '@tabler/icons-react';
import { useRecipeContext } from '../../context/RecipeContext';
import { useMantineColorScheme } from '@mantine/core';

export default function AddFromFavoritesModal({ opened, onClose, onAddSelected }) {
  const { recipes } = useRecipeContext();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const favIds = JSON.parse(localStorage.getItem('garnish_favorites') || '[]');
  const favRecipes = recipes.filter(r => favIds.includes(r.id));

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedIngredients, setSelectedIngredients] = useState(new Set());

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setSelectedIngredients(new Set((recipe.ingredients || []).map((_, i) => i)));
  };

  const toggleIngredient = (i) => {
    const next = new Set(selectedIngredients);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelectedIngredients(next);
  };

  const confirm = () => {
    if (selectedRecipe) {
      const ingredients = selectedRecipe.ingredients || [];
      const chosen = ingredients.filter((_, i) => selectedIngredients.has(i));
      onAddSelected(chosen);
    }
    setSelectedRecipe(null);
    onClose();
  };

  const handleClose = () => {
    setSelectedRecipe(null);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="📋 انتخاب از علاقه‌مندی‌ها" centered size="sm"
      styles={{ title: { color: dark ? '#fff' : '#333' }, content: { backgroundColor: dark ? '#1e1e24' : '#fff' } }}>
      {!selectedRecipe ? (
        favRecipes.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">❤️ هنوز هیچ غذایی را نپسندیده‌اید.</Text>
        ) : (
          favRecipes.map(recipe => (
            <Card key={recipe.id} shadow="xs" p="sm" radius="md" mb="sm" withBorder
              style={{ cursor: 'pointer', backgroundColor: dark ? '#25252b' : '#fff' }}
              onClick={() => handleRecipeClick(recipe)}>
              <Group justify="space-between" mb={4}>
                <Title order={6} c={dark ? '#fff' : '#1A237E'}>{recipe.title}</Title>
                <Button size="xs" variant="light" color="orange">انتخاب</Button>
              </Group>
              <Text size="xs" c="dimmed" lineClamp={2}>{(recipe.ingredients || []).join('، ')}</Text>
            </Card>
          ))
        )
      ) : (
        <>
          <Group justify="space-between" mb="md">
            <Text fw={500} c={dark ? '#fff' : '#333'}>{selectedRecipe.title}</Text>
            <Button variant="subtle" size="xs" onClick={() => setSelectedRecipe(null)}>بازگشت</Button>
          </Group>
          <Group justify="space-between" mb="sm">
            <Button variant="subtle" size="xs" onClick={() => setSelectedIngredients(new Set((selectedRecipe.ingredients || []).map((_, i) => i)))}>
              انتخاب همه
            </Button>
            <Button variant="subtle" size="xs" color="red" onClick={() => setSelectedIngredients(new Set())}>
              حذف همه
            </Button>
          </Group>
          {(selectedRecipe.ingredients || []).map((ing, i) => (
            <div key={i}>
              <Group mb={6}>
                <Checkbox checked={selectedIngredients.has(i)} onChange={() => toggleIngredient(i)} size="sm" />
                <Text size="sm" c={dark ? '#fff' : '#333'}>{ing}</Text>
              </Group>
              {i < selectedRecipe.ingredients.length - 1 && <Divider color="gray.1" />}
            </div>
          ))}
          <Button fullWidth mt="md" onClick={confirm} leftSection={<IconCheck size={16} />}>
            افزودن {selectedIngredients.size} ماده
          </Button>
        </>
      )}
    </Modal>
  );
}