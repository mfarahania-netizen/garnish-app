import { useState, useMemo } from 'react';
import {
  Container, Title, Group, Text, Paper, Checkbox, ActionIcon,
  Stack, Modal, Box, SimpleGrid, Select,
  ThemeIcon, ScrollArea,
} from '@mantine/core';
import {
  IconTrash, IconPlus, IconShoppingCart,
  IconCalendar, IconArrowUp, IconChevronDown,
  IconChevronUp, IconX, IconCircleCheck,
} from '@tabler/icons-react';
import { useShoppingListQuery } from '../../hooks/useShoppingListQuery';
import BuildFromPlanButton from './components/BuildFromPlanButton';
import { useRecipes } from '../../hooks/useRecipes';
import { useMealPlannerQuery } from '../../hooks/useMealPlannerQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import { EventType } from '../../lib/eventTaxonomy';
import { motion, AnimatePresence } from 'framer-motion';
import { DAYS } from '../../features/meal-planner/services/planHelpers';
import {
  GroceryRow, MergeChip, SectionHeader, Button as GesButton, TextField,
  EmptyState, ErrorState, LoadingSkeleton,
} from '../../components/ges';

const COMMON_INGREDIENTS = [
  { name: 'پیاز', emoji: '🧅', unit: 'عدد' }, { name: 'سیر', emoji: '🧄', unit: 'حبه' },
  { name: 'گوجه فرنگی', emoji: '🍅', unit: 'عدد' }, { name: 'سیب‌زمینی', emoji: '🥔', unit: 'کیلوگرم' },
  { name: 'مرغ', emoji: '🍗', unit: 'کیلوگرم' }, { name: 'گوشت چرخ کرده', emoji: '🥩', unit: 'گرم' },
  { name: 'برنج', emoji: '🍚', unit: 'کیلوگرم' }, { name: 'نمک', emoji: '🧂', unit: 'گرم' },
  { name: 'فلفل سیاه', emoji: '🌶️', unit: 'گرم' }, { name: 'زردچوبه', emoji: '🟡', unit: 'قاشق چای‌خوری' },
  { name: 'روغن', emoji: '🛢️', unit: 'لیتر' }, { name: 'تخم‌مرغ', emoji: '🥚', unit: 'عدد' },
  { name: 'ماست', emoji: '🥛', unit: 'کیلوگرم' }, { name: 'رب گوجه فرنگی', emoji: '🥫', unit: 'قوطی' },
  { name: 'عدس', emoji: '🫘', unit: 'پیمانه' }, { name: 'لوبیا', emoji: '🫘', unit: 'پیمانه' },
  { name: 'نخود', emoji: '🫘', unit: 'پیمانه' }, { name: 'ماهی', emoji: '🐟', unit: 'عدد' },
  { name: 'میگو', emoji: '🦐', unit: 'گرم' }, { name: 'قارچ', emoji: '🍄', unit: 'گرم' },
  { name: 'پنیر', emoji: '🧀', unit: 'گرم' }, { name: 'کره', emoji: '🧈', unit: 'گرم' },
  { name: 'زعفران', emoji: '🌸', unit: 'قاشق چای‌خوری' }, { name: 'آرد', emoji: '🌾', unit: 'پیمانه' },
  { name: 'شکر', emoji: '🍬', unit: 'پیمانه' }, { name: 'لیمو', emoji: '🍋', unit: 'عدد' },
  { name: 'سبزی خوردن', emoji: '🌿', unit: 'بسته' }, { name: 'هویج', emoji: '🥕', unit: 'عدد' },
  { name: 'فلفل دلمه‌ای', emoji: '🫑', unit: 'عدد' }, { name: 'کدو', emoji: '🥒', unit: 'عدد' },
  { name: 'بادمجان', emoji: '🍆', unit: 'عدد' }, { name: 'نعنا', emoji: '🌿', unit: 'بسته' },
  { name: 'جعفری', emoji: '🌿', unit: 'بسته' }, { name: 'گشنیز', emoji: '🌿', unit: 'بسته' },
];

const UNIT_OPTIONS = ['عدد', 'گرم', 'کیلوگرم', 'لیتر', 'پیمانه', 'قاشق غذاخوری', 'قاشق چای‌خوری', 'بسته', 'حبه', 'قوطی', 'بطری'];
const mealIcons = { 'صبحانه': '🌅', 'ناهار': '☀️', 'شام': '🌙' };

// Light aisle classifier — a display-only grouping (honest; no fabricated data).
const AISLES = [
  { key: 'سبزیجات و میوه', match: ['پیاز', 'سیر', 'گوجه', 'سیب', 'هویج', 'فلفل دلمه', 'کدو', 'بادمجان', 'قارچ', 'لیمو', 'سبزی', 'نعنا', 'شوید', 'جعفری', 'گشنیز', 'کاهو'] },
  { key: 'پروتئین', match: ['مرغ', 'گوشت', 'ماهی', 'میگو', 'تخم', 'عدس', 'لوبیا', 'نخود'] },
  { key: 'لبنیات', match: ['ماست', 'پنیر', 'کره', 'شیر', 'خامه'] },
  { key: 'خواربار', match: ['برنج', 'آرد', 'نمک', 'فلفل سیاه', 'زردچوبه', 'روغن', 'رب', 'شکر', 'سرکه', 'زعفران', 'ادویه'] },
];
const aisleOf = (name = '') => AISLES.find((a) => a.match.some((m) => name.includes(m)))?.key || 'سایر';

export default function ShoppingListPage() {
  const { list, loading, addItems, toggleItem, removeItem } = useShoppingListQuery();
  const { recipes, loading: recipesLoading, error: recipesError } = useRecipes();
  const { plan } = useMealPlannerQuery();
  const { trackEvent } = useAnalytics();

  const [manualModal, setManualModal] = useState(false);
  const [planModal, setPlanModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedManual, setSelectedManual] = useState([]);
  const [selectedMealIngredients, setSelectedMealIngredients] = useState({});
  const [expandedRecipes, setExpandedRecipes] = useState({});
  const [mergeOpen, setMergeOpen] = useState({});

  const filtered = searchQuery.trim() ? COMMON_INGREDIENTS.filter(ing => ing.name.includes(searchQuery)).slice(0, 20) : [];

  const addToManualList = (ingredient) => {
    if (!selectedManual.find(i => i.name === ingredient.name)) {
      setSelectedManual(prev => [...prev, { name: ingredient.name, amount: '', unit: ingredient.unit || 'عدد' }]);
    }
  };
  const removeFromManual = (name) => setSelectedManual(prev => prev.filter(i => i.name !== name));
  const updateManualItem = (name, field, value) => setSelectedManual(prev => prev.map(i => i.name === name ? { ...i, [field]: value } : i));

  const handleAddManual = () => {
    if (selectedManual.length === 0) return;
    const items = selectedManual.map(item => ({ name: item.name, amount: item.amount || '', unit: item.unit || '' }));
    addItems(items);
    trackEvent(EventType.SHOPPING_ADD_MANUAL, { items: items.map(i => i.name) });
    setSelectedManual([]); setSearchQuery(''); setManualModal(false);
  };

  const planMeals = useMemo(() => {
    if (!plan || !recipes || recipes.length === 0) return [];
    return (plan.slots || []).filter(s => s.recipeId).map(s => ({ ...s, recipe: recipes.find(r => r.id == s.recipeId) || null }));
  }, [plan, recipes]);

  // Provenance: which plan recipes contain each ingredient name (drives the MergeChip "×N recipes").
  const provenanceByName = useMemo(() => {
    const map = {};
    planMeals.forEach((m) => {
      (m.recipe?.ingredients || []).forEach((ing) => {
        if (!ing?.name) return;
        if (!map[ing.name]) map[ing.name] = [];
        if (m.recipe?.title && !map[ing.name].some((x) => x.recipe === m.recipe.title)) {
          map[ing.name].push({ recipe: m.recipe.title, qty: ing.amount ? `${ing.amount}${ing.unit ? ` ${ing.unit}` : ''}` : '—' });
        }
      });
    });
    return map;
  }, [planMeals]);

  const togglePlanExpand = (recipeId) => setExpandedRecipes(prev => {
    const ns = { ...prev, [recipeId]: !prev[recipeId] };
    if (ns[recipeId] && !selectedMealIngredients[recipeId]) setSelectedMealIngredients(p => ({ ...p, [recipeId]: [] }));
    return ns;
  });
  const toggleIngredientInPlan = (recipeId, name) => setSelectedMealIngredients(prev => {
    const cur = prev[recipeId] || [];
    return { ...prev, [recipeId]: cur.includes(name) ? cur.filter(n => n !== name) : [...cur, name] };
  });
  const handleAddSelectedFromPlan = (recipeId, ingredients) => {
    const selected = selectedMealIngredients[recipeId] || [];
    if (selected.length === 0) return;
    const items = selected.map(name => { const ing = ingredients.find(i => i.name === name); return { name, amount: ing?.amount || '', unit: ing?.unit || '' }; });
    addItems(items);
    trackEvent(EventType.SHOPPING_ADD_FROM_PLAN, { recipeId, items: items.map(i => i.name) });
    setExpandedRecipes(prev => ({ ...prev, [recipeId]: false }));
    setSelectedMealIngredients(prev => ({ ...prev, [recipeId]: [] }));
  };

  const handleToggleItem = (itemId, itemName) => { toggleItem(itemId); trackEvent(EventType.SHOPPING_TOGGLE, { itemId, name: itemName }); };
  const handleRemoveItem = (itemId, itemName) => { removeItem(itemId); trackEvent(EventType.SHOPPING_REMOVE, { itemId, name: itemName }); };

  const uncheckedItems = list?.items?.filter(i => !i.isChecked) || [];
  const checkedItems = list?.items?.filter(i => i.isChecked) || [];
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Group unchecked items by aisle for a calm, scannable list.
  const grouped = useMemo(() => {
    const g = {};
    uncheckedItems.forEach((it) => { const a = aisleOf(it.name); (g[a] ||= []).push(it); });
    return g;
  }, [uncheckedItems]);

  const renderGroceryItem = (item) => {
    const sources = provenanceByName[item.name] || [];
    const mergeChip = sources.length > 1
      ? <MergeChip count={sources.length} sources={sources} expanded={!!mergeOpen[item.id]} onToggle={(v) => setMergeOpen(p => ({ ...p, [item.id]: v }))} />
      : null;
    return (
      <Group key={item.id} wrap="nowrap" align="center" style={{ gap: 'var(--g-space-1)' }}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <GroceryRow
            name={item.name}
            qty={[item.amount, item.unit].filter(Boolean).join(' ')}
            checked={item.isChecked}
            onToggle={() => handleToggleItem(item.id, item.name)}
            mergeChip={mergeChip}
          />
        </Box>
        <ActionIcon variant="subtle" color="red" onClick={() => handleRemoveItem(item.id, item.name)} aria-label={`حذف ${item.name}`}>
          <IconTrash size={16} />
        </ActionIcon>
      </Group>
    );
  };

  // ── States ──
  if (loading || recipesLoading) {
    return (
      <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px' }}>
        <LoadingSkeleton shape="list" lines={5} label="در حال بارگذاری لیست خرید" />
      </Container>
    );
  }
  if (recipesError) {
    return (
      <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px' }}>
        <ErrorState title="خطا در بارگذاری" message="مشکلی در دریافت اطلاعات پیش آمد. چیزی از دست نرفت." retryLabel="تلاش دوباره" onRetry={() => window.location.reload()} />
      </Container>
    );
  }

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 100px' }}>
      {/* PLANNER-L4-09: build the list from this week's meal plan (functional) */}
      <BuildFromPlanButton />

      <Paper p="md" radius="xl" mb="lg" mt="md" style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)' }}>
        <Group gap="xs" align="center">
          <ThemeIcon size={42} radius="xl" color="saffron" variant="light"><IconShoppingCart size={24} /></ThemeIcon>
          <div>
            <Title order={3} c="var(--g-color-text-primary)">لیست خرید</Title>
            <Text size="xs" c="var(--g-color-text-secondary)">مواد لازم را با مقدار و واحد اضافه کنید</Text>
          </div>
        </Group>
      </Paper>

      <Group mb="lg" grow>
        <GesButton variant="secondary" leftIcon={<IconPlus size={16} />} onClick={() => setManualModal(true)}>افزودن دستی</GesButton>
        <GesButton variant="secondary" leftIcon={<IconCalendar size={16} />} onClick={() => setPlanModal(true)}>از برنامه هفتگی</GesButton>
      </Group>

      {/* لیست */}
      {uncheckedItems.length === 0 && checkedItems.length === 0 ? (
        <EmptyState
          title="لیست خرید خالی است"
          message="می‌توانی مواد را به‌صورت دستی یا از برنامه هفتگی اضافه کنی."
          actionLabel="افزودن دستی"
          onAction={() => setManualModal(true)}
        />
      ) : (
        <Stack gap="lg">
          {Object.entries(grouped).map(([aisle, items]) => (
            <Box key={aisle}>
              <SectionHeader as="h2" title={aisle} />
              <Stack gap="xs" mt="var(--g-space-2)">
                <AnimatePresence>
                  {items.map(item => (
                    <motion.div key={item.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.18 }}>
                      {renderGroceryItem(item)}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Stack>
            </Box>
          ))}

          {/* خریداری‌شده — لحن مهربان، بدون شرمندگی */}
          {checkedItems.length > 0 && (
            <Box>
              <Group gap={8} align="center" mb="var(--g-space-2)">
                <IconCircleCheck size={20} color="var(--g-color-state-success-fg)" aria-hidden="true" />
                <Text size="sm" fw={600} c="var(--g-color-text-secondary)">گرفتم ({checkedItems.length})</Text>
              </Group>
              <Stack gap="xs">
                {checkedItems.map(item => (
                  <Group key={item.id} wrap="nowrap" align="center" style={{ gap: 'var(--g-space-1)' }}>
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <GroceryRow name={item.name} qty={[item.amount, item.unit].filter(Boolean).join(' ')} checked onToggle={() => handleToggleItem(item.id, item.name)} />
                    </Box>
                    <ActionIcon variant="subtle" color="red" onClick={() => handleRemoveItem(item.id, item.name)} aria-label={`حذف ${item.name}`}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      )}

      {/* مودال افزودن دستی */}
      <Modal opened={manualModal} onClose={() => { setManualModal(false); setSelectedManual([]); setSearchQuery(''); }} title="جستجوی ماده غذایی" size="lg" radius="xl" styles={{ title: { fontWeight: 700, textAlign: 'center', width: '100%' } }}>
        <Box mb="md"><TextField type="search" ariaLabel="جستجوی ماده غذایی" placeholder="نام ماده را جستجو کنید..." value={searchQuery} onChange={setSearchQuery} /></Box>
        {searchQuery.trim() && (
          <ScrollArea h={160} mb="md">
            <SimpleGrid cols={3} spacing="xs">
              {filtered.map(ing => {
                const sel = !!selectedManual.find(i => i.name === ing.name);
                return (
                  <motion.div key={ing.name} whileTap={{ scale: 0.97 }}>
                    <Paper p="xs" radius="md" onClick={() => addToManualList(ing)}
                      style={{ cursor: 'pointer', textAlign: 'center', background: sel ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)', border: `1px solid ${sel ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}` }}>
                      <Text size="xl">{ing.emoji}</Text>
                      <Text size="xs" fw={500} c="var(--g-color-text-primary)">{ing.name}</Text>
                    </Paper>
                  </motion.div>
                );
              })}
            </SimpleGrid>
          </ScrollArea>
        )}
        {selectedManual.length > 0 && (
          <Box mb="md">
            <Text size="sm" fw={500} mb="xs" c="var(--g-color-text-primary)">مواد انتخاب‌شده</Text>
            <Stack gap="xs">
              {selectedManual.map(item => (
                <Paper key={item.name} p="sm" radius="md" style={{ border: '1px solid var(--g-color-brand-600)' }}>
                  <Group justify="space-between" align="flex-end" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <Text size="sm" fw={500} c="var(--g-color-text-primary)">{item.name}</Text>
                      <Box style={{ width: 90 }}><TextField ariaLabel="مقدار" placeholder="مقدار" value={item.amount} onChange={(v) => updateManualItem(item.name, 'amount', v)} /></Box>
                      <Select data={UNIT_OPTIONS} size="xs" style={{ width: 110 }} value={item.unit} onChange={(val) => updateManualItem(item.name, 'unit', val)} />
                    </Group>
                    <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeFromManual(item.name)} aria-label="حذف"><IconX size={14} /></ActionIcon>
                  </Group>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}
        <GesButton fullWidth onClick={handleAddManual} disabled={selectedManual.length === 0} leftIcon={<IconPlus size={18} />}>
          افزودن {selectedManual.length > 0 ? `${selectedManual.length} ماده` : ''}
        </GesButton>
      </Modal>

      {/* مودال برنامه هفتگی */}
      <Modal opened={planModal} onClose={() => setPlanModal(false)} title="افزودن از برنامه هفتگی" size="lg" radius="xl" styles={{ title: { fontWeight: 700, textAlign: 'center', width: '100%' } }}>
        <ScrollArea h="70vh">
          {planMeals.length === 0 ? (
            <Text c="var(--g-color-text-secondary)" ta="center" py="xl">برنامه هفتگی خالی است. ابتدا وعده‌ها را بچینید.</Text>
          ) : (
            <Stack gap="sm">
              {planMeals.map((meal, idx) => {
                const recipe = meal.recipe;
                if (!recipe) return null;
                const ingredients = recipe.ingredients || [];
                const expanded = expandedRecipes[recipe.id] || false;
                const dayName = DAYS[meal.dayOfWeek];
                return (
                  <Paper key={idx} p="sm" radius="md" style={{ border: '1px solid var(--g-color-border-subtle)', overflow: 'hidden' }}>
                    <Group justify="space-between" mb={0}>
                      <div>
                        <Text size="xs" c="var(--g-color-text-muted)">{mealIcons[meal.mealType] || ''} {meal.mealType} · {dayName}</Text>
                        <Text size="sm" fw={600} c="var(--g-color-text-primary)">{recipe.title}</Text>
                      </div>
                      <GesButton variant="ghost" leftIcon={expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />} onClick={() => togglePlanExpand(recipe.id)}>
                        انتخاب مواد
                      </GesButton>
                    </Group>
                    <AnimatePresence>
                      {expanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                          <Box mt="sm">
                            {ingredients.length === 0 ? (
                              <Text size="xs" c="var(--g-color-text-muted)">برای این رسپی مواد اولیه‌ای ثبت نشده است.</Text>
                            ) : (
                              <Stack gap="xs">
                                {ingredients.map(ing => (
                                  <Checkbox key={ing.name} label={`${ing.name}${ing.amount ? ` (${ing.amount}${ing.unit ? ` ${ing.unit}` : ''})` : ''}`}
                                    checked={(selectedMealIngredients[recipe.id] || []).includes(ing.name)} onChange={() => toggleIngredientInPlan(recipe.id, ing.name)} size="xs" color="saffron" />
                                ))}
                              </Stack>
                            )}
                            <Box mt="sm">
                              <GesButton fullWidth disabled={(selectedMealIngredients[recipe.id] || []).length === 0} onClick={() => handleAddSelectedFromPlan(recipe.id, ingredients)}>
                                افزودن انتخاب‌شده‌ها
                              </GesButton>
                            </Box>
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

      <ActionIcon variant="filled" color="saffron" size="xl" radius="xl" style={{ position: 'fixed', bottom: 30, right: 20, zIndex: 'var(--g-z-sticky)', boxShadow: 'var(--g-shadow-2)' }} onClick={scrollToTop} aria-label="برگشت به بالا">
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
