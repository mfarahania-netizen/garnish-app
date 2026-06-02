import { useState, useMemo } from 'react';
import {
  Container, Title, Group, Text, Paper, Checkbox, ActionIcon,
  Stack, Skeleton, Alert, Button, Modal, TextInput, Badge,
  ScrollArea, Box, SimpleGrid, Select,
  useMantineColorScheme, Tooltip
} from '@mantine/core';
import {
  IconTrash, IconPlus, IconShoppingCart, IconSearch,
  IconCheck, IconCalendar, IconArrowUp, IconChevronDown,
  IconChevronUp, IconX
} from '@tabler/icons-react';
import { useShoppingListQuery } from '../../hooks/useShoppingListQuery';
import { useRecipes } from '../../hooks/useRecipes';
import { useMealPlannerQuery } from '../../hooks/useMealPlannerQuery';
import { useAnalytics } from '../../hooks/useAnalytics'; // 👈 جدید
import { motion, AnimatePresence } from 'framer-motion';
import { DAYS } from '../../features/meal-planner/services/planHelpers';

const COMMON_INGREDIENTS = [
  { name: 'پیاز', emoji: '🧅', unit: 'عدد' },
  { name: 'سیر', emoji: '🧄', unit: 'حبه' },
  { name: 'گوجه فرنگی', emoji: '🍅', unit: 'عدد' },
  { name: 'سیب‌زمینی', emoji: '🥔', unit: 'کیلوگرم' },
  { name: 'مرغ', emoji: '🍗', unit: 'کیلوگرم' },
  { name: 'گوشت چرخ کرده', emoji: '🥩', unit: 'گرم' },
  { name: 'برنج', emoji: '🍚', unit: 'کیلوگرم' },
  { name: 'نمک', emoji: '🧂', unit: 'گرم' },
  { name: 'فلفل سیاه', emoji: '🌶️', unit: 'گرم' },
  { name: 'زردچوبه', emoji: '🟡', unit: 'قاشق چای‌خوری' },
  { name: 'روغن', emoji: '🛢️', unit: 'لیتر' },
  { name: 'تخم‌مرغ', emoji: '🥚', unit: 'عدد' },
  { name: 'ماست', emoji: '🥛', unit: 'کیلوگرم' },
  { name: 'رب گوجه فرنگی', emoji: '🥫', unit: 'قوطی' },
  { name: 'عدس', emoji: '🫘', unit: 'پیمانه' },
  { name: 'لوبیا', emoji: '🫘', unit: 'پیمانه' },
  { name: 'نخود', emoji: '🫘', unit: 'پیمانه' },
  { name: 'ماهی', emoji: '🐟', unit: 'عدد' },
  { name: 'میگو', emoji: '🦐', unit: 'گرم' },
  { name: 'قارچ', emoji: '🍄', unit: 'گرم' },
  { name: 'پنیر', emoji: '🧀', unit: 'گرم' },
  { name: 'کره', emoji: '🧈', unit: 'گرم' },
  { name: 'زعفران', emoji: '🌸', unit: 'قاشق چای‌خوری' },
  { name: 'آرد', emoji: '🌾', unit: 'پیمانه' },
  { name: 'شکر', emoji: '🍬', unit: 'پیمانه' },
  { name: 'لیمو', emoji: '🍋', unit: 'عدد' },
  { name: 'سبزی خوردن', emoji: '🌿', unit: 'بسته' },
  { name: 'هویج', emoji: '🥕', unit: 'عدد' },
  { name: 'فلفل دلمه‌ای', emoji: '🫑', unit: 'عدد' },
  { name: 'کدو', emoji: '🥒', unit: 'عدد' },
  { name: 'بادمجان', emoji: '🍆', unit: 'عدد' },
  { name: 'آبلیمو', emoji: '🍋', unit: 'بطری' },
  { name: 'سرکه', emoji: '🍶', unit: 'بطری' },
  { name: 'نعنا', emoji: '🌿', unit: 'بسته' },
  { name: 'شوید', emoji: '🌿', unit: 'بسته' },
  { name: 'جعفری', emoji: '🌿', unit: 'بسته' },
  { name: 'گشنیز', emoji: '🌿', unit: 'بسته' },
];

const UNIT_OPTIONS = [
  'عدد', 'گرم', 'کیلوگرم', 'لیتر', 'پیمانه', 'قاشق غذاخوری', 'قاشق چای‌خوری', 'بسته', 'حبه', 'قوطی', 'بطری',
];

const mealIcons = {
  'صبحانه': '🌅', 'ناهار': '☀️', 'شام': '🌙',
};
const mealColors = {
  'صبحانه': 'yellow', 'ناهار': 'orange', 'شام': 'indigo',
};

export default function ShoppingListPage() {
  const { list, loading, addItems, toggleItem, removeItem } = useShoppingListQuery();
  const { recipes, loading: recipesLoading } = useRecipes();
  const { plan } = useMealPlannerQuery();
  const { trackEvent } = useAnalytics(); // 👈 جدید
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const [manualModal, setManualModal] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManual, setSelectedManual] = useState([]);
  const [selectedMealIngredients, setSelectedMealIngredients] = useState({});
  const [expandedRecipes, setExpandedRecipes] = useState({});

  const filtered = searchQuery.trim()
    ? COMMON_INGREDIENTS.filter(ing => ing.name.includes(searchQuery)).slice(0, 20)
    : [];

  const addToManualList = (ingredient) => {
    const already = selectedManual.find(i => i.name === ingredient.name);
    if (!already) {
      setSelectedManual(prev => [...prev, { name: ingredient.name, amount: '', unit: ingredient.unit || 'عدد' }]);
    }
  };

  const removeFromManual = (name) => {
    setSelectedManual(prev => prev.filter(i => i.name !== name));
  };

  const updateManualItem = (name, field, value) => {
    setSelectedManual(prev =>
      prev.map(i => i.name === name ? { ...i, [field]: value } : i)
    );
  };

  const handleAddManual = () => {
    if (selectedManual.length === 0) return;
    const items = selectedManual.map(item => ({
      name: item.name,
      amount: item.amount || '',
      unit: item.unit || '',
    }));
    addItems(items);
    // 👇 ردیابی افزودن دستی
    trackEvent('shopping_add_manual', { items: items.map(i => i.name) });
    setSelectedManual([]);
    setSearchQuery('');
    setManualModal(false);
  };

  const planMeals = useMemo(() => {
    if (!plan || !recipes || recipes.length === 0) return [];
    const slots = plan.slots || [];
    return slots
      .filter(s => s.recipeId)
      .map(s => {
        const fullRecipe = recipes.find(r => r.id == s.recipeId);
        return { ...s, recipe: fullRecipe || null };
      });
  }, [plan, recipes]);

  const togglePlanExpand = (recipeId) => {
    setExpandedRecipes(prev => {
      const newState = { ...prev, [recipeId]: !prev[recipeId] };
      if (newState[recipeId] && !selectedMealIngredients[recipeId]) {
        setSelectedMealIngredients(prevIng => ({ ...prevIng, [recipeId]: [] }));
      }
      return newState;
    });
  };

  const toggleIngredientInPlan = (recipeId, name) => {
    setSelectedMealIngredients(prev => {
      const current = prev[recipeId] || [];
      const updated = current.includes(name) ? current.filter(n => n !== name) : [...current, name];
      return { ...prev, [recipeId]: updated };
    });
  };

  const handleAddSelectedFromPlan = (recipeId, ingredients) => {
    const selected = selectedMealIngredients[recipeId] || [];
    if (selected.length === 0) return;
    const items = selected.map(name => {
      const ing = ingredients.find(i => i.name === name);
      return {
        name,
        amount: ing?.amount || '',
        unit: ing?.unit || '',
      };
    });
    addItems(items);
    // 👇 ردیابی افزودن از برنامه هفتگی
    trackEvent('shopping_add_from_plan', { recipeId, items: items.map(i => i.name) });
    setExpandedRecipes(prev => ({ ...prev, [recipeId]: false }));
    setSelectedMealIngredients(prev => ({ ...prev, [recipeId]: [] }));
  };

  const handleToggleItem = (itemId, itemName) => {
    toggleItem(itemId);
    // 👇 ردیابی تیک زدن آیتم
    trackEvent('shopping_toggle', { itemId, name: itemName });
  };

  const handleRemoveItem = (itemId, itemName) => {
    removeItem(itemId);
    // 👇 ردیابی حذف آیتم
    trackEvent('shopping_remove', { itemId, name: itemName });
  };

  const uncheckedItems = list?.items?.filter(i => !i.isChecked) || [];
  const checkedItems = list?.items?.filter(i => i.isChecked) || [];
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  if (loading || recipesLoading) {
    return (
      <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px' }}>
        <Skeleton height={40} width="70%" mb="lg" />
        <Skeleton height={50} radius="md" mb="sm" />
        <Skeleton height={50} radius="md" mb="sm" />
      </Container>
    );
  }

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 40px' }}>
      <Box mb="lg" mt="md">
        <Group gap="xs" align="center">
          <IconShoppingCart size={32} style={{ color: '#FF6B35' }} />
          <Title order={3} style={{ color: '#1A237E' }}>لیست خرید</Title>
        </Group>
        <Text size="xs" c="dimmed" mt={4}>
          مواد لازم را با مقدار و واحد اضافه کنید
        </Text>
      </Box>

      <Group mb="lg" grow>
        <Button variant="light" color="orange" leftSection={<IconPlus size={16} />} onClick={() => setManualModal(true)} radius="xl" size="md">
          افزودن دستی
        </Button>
        <Button variant="light" color="teal" leftSection={<IconCalendar size={16} />} onClick={() => setPlanModal(true)} radius="xl" size="md">
          از برنامه هفتگی
        </Button>
      </Group>

      {uncheckedItems.length === 0 && checkedItems.length === 0 ? (
        <Alert color="orange" radius="lg" mb="md">
          <Text size="sm" fw={500}>لیست خرید خالی است</Text>
          <Text size="xs">ماده‌ای را با مقدار و واحد اضافه کنید.</Text>
        </Alert>
      ) : (
        <Stack gap="sm">
          <AnimatePresence>
            {uncheckedItems.map(item => (
              <motion.div key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                <Paper p="sm" radius="md" style={{
                  borderRight: '4px solid #FF6B35',
                  background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(8px)',
                }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Checkbox
                      checked={item.isChecked}
                      onChange={() => handleToggleItem(item.id, item.name)} // 👈 تغییر یافت
                      label={
                        <Text size="sm" fw={500}>
                          {item.name}
                          {item.amount && (
                            <Text span size="xs" c="dimmed">
                              {' '}({item.amount} {item.unit})
                            </Text>
                          )}
                        </Text>
                      }
                    />
                    <ActionIcon variant="subtle" color="red" onClick={() => handleRemoveItem(item.id, item.name)}> {/* 👈 تغییر یافت */} 
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              </motion.div>
            ))}
          </AnimatePresence>

          {checkedItems.length > 0 && (
            <>
              <Title order={5} mt="xl" mb="sm" c="dimmed">✅ خریداری‌شده</Title>
              {checkedItems.map(item => (
                <Paper key={item.id} p="sm" radius="md" style={{
                  opacity: 0.6,
                  borderRight: '4px solid #4CAF50',
                  background: dark ? 'rgba(76,175,80,0.06)' : 'rgba(76,175,80,0.04)',
                }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Checkbox
                      checked={item.isChecked}
                      onChange={() => handleToggleItem(item.id, item.name)} // 👈 تغییر یافت
                      label={
                        <Text size="sm" style={{ textDecoration: 'line-through' }} c="dimmed">
                          {item.name}
                          {item.amount && ` (${item.amount} ${item.unit})`}
                        </Text>
                      }
                    />
                    <ActionIcon variant="subtle" color="red" onClick={() => handleRemoveItem(item.id, item.name)}> {/* 👈 تغییر یافت */} 
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </>
          )}
        </Stack>
      )}

      {/* مودال افزودن دستی */}
      <Modal opened={manualModal} onClose={() => { setManualModal(false); setSelectedManual([]); setSearchQuery(''); }} title="🔍 جستجوی ماده غذایی" size="lg" radius="lg" styles={{ title: { fontWeight: 700, textAlign: 'center' } }}>
        <TextInput placeholder="نام ماده را جستجو کنید..." value={searchQuery} onChange={(e) => setSearchQuery(e.currentTarget.value)} mb="md" radius="xl" size="md" rightSection={<IconSearch size={18} />} />

        {searchQuery.trim() && (
          <ScrollArea h={160} mb="md">
            <SimpleGrid cols={3} spacing="xs">
              {filtered.map(ing => (
                <motion.div key={ing.name} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Paper p="xs" radius="md" withBorder onClick={() => addToManualList(ing)} style={{
                    cursor: 'pointer', textAlign: 'center',
                    backgroundColor: selectedManual.find(i => i.name === ing.name) ? (dark ? 'rgba(255,107,53,0.2)' : 'rgba(255,107,53,0.1)') : 'transparent',
                    borderColor: selectedManual.find(i => i.name === ing.name) ? '#FF6B35' : undefined,
                    transition: '0.2s',
                  }}>
                    <Text size="xl">{ing.emoji}</Text>
                    <Text size="xs" fw={500}>{ing.name}</Text>
                  </Paper>
                </motion.div>
              ))}
            </SimpleGrid>
          </ScrollArea>
        )}

        {selectedManual.length > 0 && (
          <Box mb="md">
            <Text size="sm" fw={500} mb="xs">مواد انتخاب‌شده (مقدار و واحد را تنظیم کنید)</Text>
            <Stack gap="xs">
              {selectedManual.map(item => (
                <Paper key={item.name} p="sm" radius="md" withBorder style={{ borderColor: '#FF6B35' }}>
                  <Group justify="space-between" align="flex-end" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500}>{item.name}</Text>
                      <TextInput
                        placeholder="مقدار"
                        size="xs"
                        style={{ width: 80 }}
                        value={item.amount}
                        onChange={(e) => updateManualItem(item.name, 'amount', e.currentTarget.value)}
                      />
                      <Select
                        data={UNIT_OPTIONS}
                        size="xs"
                        style={{ width: 110 }}
                        value={item.unit}
                        onChange={(val) => updateManualItem(item.name, 'unit', val)}
                      />
                    </Group>
                    <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeFromManual(item.name)}>
                      <IconX size={14} />
                    </ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        <Button fullWidth onClick={handleAddManual} disabled={selectedManual.length === 0} leftSection={<IconPlus size={18} />} radius="xl" color="orange" size="md">
          افزودن {selectedManual.length > 0 ? `${selectedManual.length} ماده` : ''}
        </Button>
      </Modal>

      {/* مودال برنامه هفتگی با انیمیشن */}
      <Modal opened={planModal} onClose={() => setPlanModal(false)} title="📅 افزودن از برنامه هفتگی" size="lg" radius="lg" styles={{ title: { fontWeight: 700, textAlign: 'center' } }}>
        <ScrollArea h="70vh">
          {planMeals.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {recipesLoading ? 'در حال بارگذاری رسپی‌ها...' : 'برنامه هفتگی خالی است. ابتدا وعده‌ها را بچینید.'}
            </Text>
          ) : (
            <Stack gap="sm">
              {planMeals.map((meal, idx) => {
                const recipe = meal.recipe;
                if (!recipe) return null;
                const ingredients = recipe.ingredients || [];
                const expanded = expandedRecipes[recipe.id] || false;
                const dayName = DAYS[meal.dayOfWeek];
                const mealEmoji = mealIcons[meal.mealType] || '🍽️';

                return (
                  <Paper key={idx} p="sm" radius="md" withBorder style={{ overflow: 'hidden' }}>
                    <Group justify="space-between" mb={0}>
                      <div>
                        <Group gap="xs" mb={2}>
                          <Badge size="sm" color={mealColors[meal.mealType] || 'gray'} variant="filled" radius="sm">
                            {mealEmoji} {meal.mealType}
                          </Badge>
                          <Text size="xs" c="dimmed">{dayName}</Text>
                        </Group>
                        <Text size="sm" fw={600}>{recipe.title}</Text>
                      </div>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="gray"
                        rightSection={expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                        onClick={() => togglePlanExpand(recipe.id)}
                      >
                        انتخاب مواد
                      </Button>
                    </Group>

                    <AnimatePresence>
                      {expanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <Box mt="sm">
                            {ingredients.length === 0 ? (
                              <Text size="xs" c="dimmed">برای این رسپی مواد اولیه‌ای ثبت نشده است.</Text>
                            ) : (
                              <Stack gap="xs">
                                {ingredients.map(ing => (
                                  <Checkbox
                                    key={ing.name}
                                    label={`${ing.name}${ing.amount ? ` (${ing.amount}${ing.unit ? ` ${ing.unit}` : ''})` : ''}`}
                                    checked={(selectedMealIngredients[recipe.id] || []).includes(ing.name)}
                                    onChange={() => toggleIngredientInPlan(recipe.id, ing.name)}
                                    size="xs"
                                  />
                                ))}
                              </Stack>
                            )}
                            <Button
                              fullWidth
                              mt="sm"
                              size="xs"
                              variant="light"
                              color="teal"
                              disabled={(selectedMealIngredients[recipe.id] || []).length === 0}
                              onClick={() => handleAddSelectedFromPlan(recipe.id, ingredients)}
                            >
                              افزودن انتخاب‌شده‌ها
                            </Button>
                          </Box>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </ScrollArea>
      </Modal>

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