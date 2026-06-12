import { Paper, Group, Text, ThemeIcon } from '@mantine/core';
import { IconShoppingCart, IconArrowRight } from '@tabler/icons-react';
import { useMealPlanner } from '../hooks/useMealPlanner';
import { loadFromStorage, saveToStorage } from '../../../data/shoppingConstants';

export default function ShoppingSyncButton({ dark }) {
  const { getPlannedIngredients } = useMealPlanner();

  const handleSync = () => {
    const ingredients = getPlannedIngredients();
    if (!ingredients.length) {
      alert('برنامه هفتگی خالی است. ابتدا وعده‌های غذایی را برنامه‌ریزی کنید.');
      return;
    }

    const currentItems = loadFromStorage('garnish_shopping_list', '[]');
    const existingNames = new Set(currentItems.map(i => i.name));
    const newItems = ingredients
      .filter(ing => !existingNames.has(ing))
      .map(ing => ({
        id: Date.now() + Math.random(),
        name: ing,
        qty: 1,
        unit: 'عدد',
        checked: false,
      }));

    if (newItems.length === 0) {
      alert('همه مواد لازم برای وعده‌های برنامه‌ریزی‌شده، از قبل در لیست خرید شما وجود دارند.');
      return;
    }

    saveToStorage('garnish_shopping_list', [...currentItems, ...newItems]);
    alert(`${newItems.length} ماده غذایی جدید به لیست خرید شما اضافه شد.`);
  };

  return (
    <Paper
      p="sm"
      radius="lg"
      mb="md"
      withBorder
      style={{
        backgroundColor: dark ? 'rgba(34,139,34,0.1)' : 'rgba(34,139,34,0.05)',
        borderColor: dark ? '#2d6a2d' : '#a3d9a3',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={handleSync}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon size="md" radius="md" color="green" variant="light">
            <IconShoppingCart size={18} />
          </ThemeIcon>
          <div>
            <Text size="sm" fw={500} c={dark ? '#fff' : '#333'}>
              همگام‌سازی با لیست خرید
            </Text>
            <Text size="xs" c="dimmed">
              مواد لازم برای وعده‌های برنامه‌ریزی‌شده را به لیست خرید اضافه کنید
            </Text>
          </div>
        </Group>
        <IconArrowRight size={18} color="green" />
      </Group>
    </Paper>
  );
}
