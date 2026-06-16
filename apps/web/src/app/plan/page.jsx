import { useState, useMemo } from 'react';
import {
  Container, Title, Group, Text, Paper, ActionIcon,
  Tooltip, Tabs, Button, Modal,
  Stack, Center, ScrollArea, Loader, Box,
} from '@mantine/core';
import {
  IconTrash, IconCalendar, IconSparkles,
  IconArrowUp, IconCheck, IconChefHat,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { DAYS, MEALS, getTodayIndex } from '../../features/meal-planner/services/planHelpers';
import { useMealPlannerQuery } from '../../hooks/useMealPlannerQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import ProposePlanPanel from './components/ProposePlanPanel';
import {
  MealSlotCard, SectionHeader, Button as GesButton, TextField, EmptyState, ErrorState, LoadingSkeleton,
} from '../../components/ges';
import Fuse from 'fuse.js';

export default function WeeklyPlanPage() {
  const { plan, loading, addMeal, removeMeal, generateSmartPlan, clearPlan } = useMealPlannerQuery();
  const { trackEvent } = useAnalytics();

  const [view, setView] = useState('today');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState({ day: '', meal: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const todayIdx = getTodayIndex();
  const today = DAYS[todayIdx];
  const allSlots = plan?.slots || [];
  const todaySlots = allSlots.filter(s => s.dayOfWeek === todayIdx);

  const { data: allRecipes = [], isFetching: recipesLoading, isError: recipesError } = useQuery({
    queryKey: ['allRecipes'],
    queryFn: async () => {
      const { data } = await apiClient.get('/recipes?page=1&limit=200');
      return data?.data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const fuse = useMemo(() => {
    if (!allRecipes.length) return null;
    return new Fuse(allRecipes, { keys: ['title', 'ingredients.name'], threshold: 0.4, minMatchCharLength: 1 });
  }, [allRecipes]);

  const searchedRecipes = useMemo(() => {
    if (!searchQuery.trim()) return allRecipes;
    if (!fuse) return allRecipes;
    return fuse.search(searchQuery).map(r => r.item);
  }, [searchQuery, allRecipes, fuse]);

  const handleOpenPicker = (day, meal) => {
    setSelectedSlot({ day, meal });
    setSearchQuery('');
    setModalOpen(true);
  };

  const handleSelectRecipe = (recipeId, title) => {
    addMeal(selectedSlot.day, selectedSlot.meal, recipeId);
    trackEvent('mealplan_add', { recipeId, title, day: selectedSlot.day, meal: selectedSlot.meal });
    setModalOpen(false);
  };

  const handleRemoveMeal = (day, mealType) => {
    removeMeal(day, mealType);
    trackEvent('mealplan_remove', { day, meal: mealType });
  };

  // Apply a PROPOSED slot — explicit user confirm only (the propose endpoint never writes the plan).
  const handleApplyProposal = (faMeal, recipeId, title) => {
    if (!recipeId) { handleOpenPicker(today, faMeal); return; }
    addMeal(today, faMeal, recipeId);
    trackEvent('mealplan_add', { recipeId, title, day: today, meal: faMeal, source: 'proposal' });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const renderSlot = (day, meal, slot) => {
    const title = slot?.recipe?.title;
    return title
      ? <MealSlotCard key={meal} mealLabel={meal} state="filled" recipeTitle={title} onClear={() => handleRemoveMeal(day, meal)} />
      : <MealSlotCard key={meal} mealLabel={meal} state="empty" onAdd={() => handleOpenPicker(day, meal)} />;
  };

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 120px' }}>
      {/* PLANNER-L4-09: intelligent weekly plan PROPOSAL (proposes — never auto-applies) */}
      <ProposePlanPanel onApply={handleApplyProposal} />

      {/* هدر */}
      <Paper p="lg" radius="xl" mb="xl" style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)' }}>
        <Group justify="space-between" align="center" mb="md">
          <Group gap="xs">
            <IconCalendar size={32} color="var(--g-color-food-saffron)" aria-hidden="true" />
            <div>
              <Title order={3} c="var(--g-color-text-primary)">برنامه غذایی</Title>
              <Text size="xs" c="var(--g-color-text-secondary)">
                {allSlots.length > 0 ? `${allSlots.length} وعده برنامه‌ریزی شده` : 'امروز چی دوست داری بپزی؟'}
              </Text>
            </div>
          </Group>
          {allSlots.length > 0 && (
            <Tooltip label="پاک کردن همه وعده‌ها">
              <ActionIcon variant="subtle" color="red" size="lg" onClick={() => { clearPlan(); trackEvent('mealplan_clear'); }} aria-label="پاک کردن همه وعده‌ها">
                <IconTrash size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        <GesButton fullWidth loading={loading} leftIcon={<IconSparkles size={20} />} onClick={() => { generateSmartPlan(); trackEvent('mealplan_generate'); }}>
          برنامه هوشمند هفتگی
        </GesButton>
        <Text ta="center" size="xs" c="var(--g-color-text-secondary)" mt={6}>
          با یک کلیک برنامه این هفته‌ات رو بر اساس ذائقه‌ات بچین (پیشنهاد است — تأیید با توست)
        </Text>
      </Paper>

      <Tabs value={view} onChange={(val) => setView(val)} mb="lg" variant="pills" radius="xl" color="saffron" styles={{ tab: { fontWeight: 600, fontSize: 14 } }}>
        <Tabs.List grow>
          <Tabs.Tab value="today" leftSection={<IconCalendar size={16} />}>امروز</Tabs.Tab>
          <Tabs.Tab value="week" leftSection={<IconCalendar size={16} />}>هفتگی</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* ── 4 states for the plan data ── */}
      {recipesError ? (
        <ErrorState title="خطا در بارگذاری" message="مشکلی در دریافت اطلاعات پیش آمد. چیزی از دست نرفت." retryLabel="تلاش دوباره" onRetry={() => window.location.reload()} />
      ) : loading ? (
        <LoadingSkeleton shape="list" lines={3} label="در حال بارگذاری برنامه" />
      ) : view === 'today' ? (
        <Stack gap="md">
          {todaySlots.length === 0 ? (
            <EmptyState title="برای امروز وعده‌ای نداری" message="اولین وعده‌ات رو اضافه کن یا برنامهٔ هوشمند بگیر." actionLabel="افزودن وعده" onAction={() => handleOpenPicker(today, 'ناهار')} />
          ) : (
            ['صبحانه', 'ناهار', 'شام'].map(meal => renderSlot(today, meal, todaySlots.find(s => s.mealType === meal)))
          )}
        </Stack>
      ) : (
        <Tabs defaultValue={today} variant="pills" radius="xl" color="saffron" mb="md">
          <Tabs.List grow>
            {DAYS.map((day, idx) => {
              const isToday = idx === todayIdx;
              const daySlots = allSlots.filter(s => s.dayOfWeek === idx);
              return (
                <Tooltip key={day} label={`${daySlots.length} وعده`} openDelay={500}>
                  <Tabs.Tab value={day} style={{ fontWeight: isToday ? 800 : 400, fontSize: 13 }}>{day.charAt(0)}</Tabs.Tab>
                </Tooltip>
              );
            })}
          </Tabs.List>

          {DAYS.map((day, idx) => {
            const daySlots = allSlots.filter(s => s.dayOfWeek === idx);
            return (
              <Tabs.Panel key={day} value={day} pt="md">
                <Stack gap="sm">
                  {MEALS.map(meal => renderSlot(day, meal, daySlots.find(s => s.mealType === meal)))}
                </Stack>
              </Tabs.Panel>
            );
          })}
        </Tabs>
      )}

      {/* مودال انتخاب غذا (اعمال دستی) */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text ta="center" fw={700} size="lg">{selectedSlot.meal} {selectedSlot.day}</Text>}
        size="lg"
        radius="xl"
        styles={{ body: { padding: '8px' }, title: { width: '100%' } }}
      >
        <Box mb="md">
          <TextField type="search" ariaLabel="جستجوی رسپی" placeholder="جستجوی سریع در رسپی‌ها..." value={searchQuery} onChange={setSearchQuery} />
        </Box>
        <ScrollArea h="60vh" offsetScrollbars>
          {recipesLoading ? (
            <Center py="xl"><Loader color="saffron" /></Center>
          ) : searchedRecipes.length === 0 ? (
            <Text c="var(--g-color-text-secondary)" ta="center" py="xl">هیچ رسپی‌ای یافت نشد.</Text>
          ) : (
            searchedRecipes.map(recipe => (
              <motion.div key={recipe.id} whileTap={{ scale: 0.98 }}>
                <Paper
                  p="sm" mb="sm" radius="md"
                  style={{ cursor: 'pointer', borderInlineStart: '4px solid var(--g-color-food-saffron)', border: '1px solid var(--g-color-border-subtle)' }}
                  onClick={() => handleSelectRecipe(recipe.id, recipe.title)}
                >
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={600} c="var(--g-color-text-primary)">{recipe.title}</Text>
                      <Text size="xs" c="var(--g-color-text-secondary)">
                        {recipe.cookingTime ? `${recipe.cookingTime} دقیقه` : ''}{recipe.difficulty ? ` · ${recipe.difficulty}` : ''}
                      </Text>
                    </div>
                    <IconCheck size={18} color="var(--g-color-food-saffron)" aria-hidden="true" />
                  </Group>
                </Paper>
              </motion.div>
            ))
          )}
        </ScrollArea>
      </Modal>

      <ActionIcon variant="filled" color="saffron" size="xl" radius="xl" style={{ position: 'fixed', bottom: 90, right: 16, zIndex: 'var(--g-z-sticky)', boxShadow: 'var(--g-shadow-2)' }} onClick={scrollToTop} aria-label="برگشت به بالا">
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
