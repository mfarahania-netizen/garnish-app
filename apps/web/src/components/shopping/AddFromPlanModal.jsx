import { useState } from 'react';
import { Modal, Text, Group, Button, Checkbox, Divider } from '@mantine/core';
import { IconCalendarPlus, IconCheck } from '@tabler/icons-react';
import { useRecipeContext } from '../../context/RecipeContext';
import { useMantineColorScheme } from '@mantine/core';
import { getIngredientEmoji } from '../../data/commonIngredients';

export default function AddFromPlanModal({ opened, onClose, onAddSelected }) {
  const { recipes } = useRecipeContext();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const plan = JSON.parse(localStorage.getItem('weekly_plan') || '{}');
  const planRecipeIds = [...new Set(Object.values(plan))];

  // جمع‌آوری مواد از برنامه هفتگی
  const allPlanIngredients = [];
  const seen = new Set();
  planRecipeIds.forEach(id => {
    const recipe = recipes.find(r => r.id == id);
    if (recipe && recipe.ingredients) {
      recipe.ingredients.forEach(ing => {
        if (!seen.has(ing)) {
          seen.add(ing);
          allPlanIngredients.push({ name: ing, fromRecipe: recipe.title });
        }
      });
    }
  });

  const [selected, setSelected] = useState(new Set(allPlanIngredients.map((_, i) => i)));

  const toggleOne = (i) => {
    const next = new Set(selected);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelected(next);
  };

  const confirm = () => {
    const chosen = allPlanIngredients.filter((_, i) => selected.has(i));
    onAddSelected(chosen.map(c => c.name));
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="📅 مواد لازم برنامه هفتگی" centered size="sm"
      styles={{ title: { color: dark ? '#fff' : '#333' }, content: { backgroundColor: dark ? '#1e1e24' : '#fff' } }}>
      {allPlanIngredients.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">برنامه هفتگی شما خالی است.</Text>
      ) : (
        <>
          <Group justify="space-between" mb="md">
            <Button variant="subtle" size="xs" onClick={() => setSelected(new Set(allPlanIngredients.map((_, i) => i)))}>
              انتخاب همه
            </Button>
            <Button variant="subtle" size="xs" color="red" onClick={() => setSelected(new Set())}>
              حذف انتخاب
            </Button>
          </Group>
          {allPlanIngredients.map((ing, i) => (
            <div key={i}>
              <Group mb={6}>
                <Checkbox checked={selected.has(i)} onChange={() => toggleOne(i)} size="sm" />
                <Text size="sm" c={dark ? '#fff' : '#333'}>{ing.name}</Text>
                <Text size="xs" c="dimmed" ml="auto">از: {ing.fromRecipe}</Text>
              </Group>
              {i < allPlanIngredients.length - 1 && <Divider color="gray.1" />}
            </div>
          ))}
          <Button fullWidth mt="md" onClick={confirm} leftSection={<IconCheck size={16} />}>
            افزودن {selected.size} ماده انتخاب‌شده
          </Button>
        </>
      )}
    </Modal>
  );
}