import { useState, useMemo } from 'react';
import {
  Container, Title, Group, Text, Paper, ActionIcon,
  Tooltip, Tabs, ThemeIcon, Button, Modal, TextInput,
  Stack, Center, useMantineColorScheme, ScrollArea, Loader
} from '@mantine/core';
import {
  IconTrash, IconSun, IconSunset, IconMoonStars,
  IconCalendar, IconSparkles, IconSearch,
  IconArrowUp, IconPlus, IconCheck, IconX, IconChefHat
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { DAYS, MEALS, getTodayIndex } from '../../features/meal-planner/services/planHelpers';
import { useMealPlannerQuery } from '../../hooks/useMealPlannerQuery';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/apiClient';
import Fuse from 'fuse.js';

const mealMeta = {
  'صبحانه': { icon: <IconSun size={20} />, color: '#FFA726' },
  'ناهار': { icon: <IconSunset size={20} />, color: '#FF7043' },
  'شام': { icon: <IconMoonStars size={20} />, color: '#5C6BC0' },
};

export default function WeeklyPlanPage() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
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

  const { data: allRecipes = [], isFetching: recipesLoading } = useQuery({
    queryKey: ['allRecipes'],
    queryFn: async () => {
      const { data } = await apiClient.get('/recipes?page=1&limit=200');
      return data?.data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const fuse = useMemo(() => {
    if (!allRecipes.length) return null;
    return new Fuse(allRecipes, {
      keys: ['title', 'ingredients.name'],
      threshold: 0.4,
      minMatchCharLength: 1,
    });
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

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const textColor = dark ? '#f1f1f1' : '#1A237E';
  const cardBg = dark ? '#25262B' : '#FFFFFF';
  const dimmedText = dark ? '#a0a0b0' : '#6c757d';

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 120px' }}>
      
      {/* هدر */}
      <Paper
        p="lg"
        radius="xl"
        mb="xl"
        style={{
          background: dark ? 'rgba(26,35,126,0.1)' : 'rgba(255,245,240,0.6)',
          border: dark ? '1px solid #333' : '1px solid #FFE0D0',
        }}
      >
        <Group justify="space-between" align="center" mb="md">
          <Group gap="xs">
            <IconCalendar size={34} style={{ color: '#FF6B35' }} />
            <div>
              <Title order={3} style={{ color: '#1A237E' }}>برنامه غذایی</Title>
              <Text size="xs" c="dimmed">
                {allSlots.length > 0 
                  ? `${allSlots.length} وعده برنامه‌ریزی شده` 
                  : 'امروز چی دوست داری بپزی؟'}
              </Text>
            </div>
          </Group>
          <Group gap="xs">
            {allSlots.length > 0 && (
              <Tooltip label="پاک کردن همه وعده‌ها">
                <ActionIcon variant="subtle" color="red" size="lg" onClick={() => { clearPlan(); trackEvent('mealplan_clear'); }}>
                  <IconTrash size={18} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        <Button
          fullWidth
          variant="gradient"
          gradient={{ from: '#FF6B35', to: '#1A237E' }}
          size="md"
          radius="xl"
          leftSection={<IconSparkles size={20} />}
          onClick={() => { generateSmartPlan(); trackEvent('mealplan_generate'); }}
          loading={loading}
          styles={{ root: { height: 48, fontSize: 16, boxShadow: '0 4px 15px rgba(255,107,53,0.4)' } }}
        >
          برنامه هوشمند هفتگی
        </Button>
        <Text ta="center" size="xs" c="dimmed" mt={6}>
          با یک کلیک برنامه این هفته‌ات رو بر اساس ذائقه‌ات بچین
        </Text>
      </Paper>

      {/* تب‌های نما */}
      <Tabs
        value={view}
        onChange={(val) => setView(val)}
        mb="lg"
        variant="pills"
        radius="xl"
        styles={{ tab: { fontWeight: 600, fontSize: 14 } }}
      >
        <Tabs.List grow>
          <Tabs.Tab value="today" leftSection={<IconSun size={16} />}>
            امروز
          </Tabs.Tab>
          <Tabs.Tab value="week" leftSection={<IconCalendar size={16} />}>
            هفتگی
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* نمای امروز */}
      {view === 'today' && (
        <Stack gap="md">
          {todaySlots.length === 0 ? (
            <Paper p="xl" radius="xl" ta="center" bg={cardBg} withBorder style={{ borderColor: '#FF6B35' }}>
              <IconChefHat size={48} color="#FF6B35" style={{ opacity: 0.5 }} />
              <Text mt="md" c={dimmedText} size="sm">
                هنوز برای امروز وعده‌ای ثبت نکردی.
              </Text>
              <Button
                mt="md"
                variant="outline"
                color="orange"
                radius="xl"
                onClick={() => handleOpenPicker(today, 'ناهار')}
              >
                اضافه کردن اولین وعده
              </Button>
            </Paper>
          ) : (
            ['صبحانه', 'ناهار', 'شام'].map(meal => {
              const slot = todaySlots.find(s => s.mealType === meal);
              const title = slot?.recipe?.title;
              const meta = mealMeta[meal];
              // رفع تداخل border shorthand با borderLeft
              const borderColor = title ? meta.color : '#ccc';
              const borderStyle = title ? 'solid' : 'dashed';
              const borderWidth = title ? '2px' : '1px';
              const leftBorderWidth = '6px';
              const leftBorderColor = meta.color;

              return (
                <motion.div key={meal} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}>
                  <Paper
                    p="md"
                    radius="lg"
                    style={{
                      backgroundColor: cardBg,
                      borderTopWidth: borderWidth,
                      borderRightWidth: borderWidth,
                      borderBottomWidth: borderWidth,
                      borderTopStyle: borderStyle,
                      borderRightStyle: borderStyle,
                      borderBottomStyle: borderStyle,
                      borderTopColor: borderColor,
                      borderRightColor: borderColor,
                      borderBottomColor: borderColor,
                      borderLeftWidth: leftBorderWidth,
                      borderLeftStyle: 'solid',
                      borderLeftColor: leftBorderColor,
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleOpenPicker(today, meal)}
                  >
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Group gap="sm" wrap="nowrap" style={{ flex: 1 }}>
                        <ThemeIcon size="lg" radius="xl" color={meta.color} variant="light">
                          {meta.icon}
                        </ThemeIcon>
                        <div style={{ flex: 1 }}>
                          <Text size="sm" fw={700} c={textColor}>{meal}</Text>
                          {title ? (
                            <Text size="sm" c="dimmed" lineClamp={1}>{title}</Text>
                          ) : (
                            <Text size="xs" c="dimmed">برای افزودن غذا کلیک کنید</Text>
                          )}
                        </div>
                      </Group>
                      {title && (
                        <ActionIcon
                          size="sm"
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveMeal(today, meal);
                          }}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                    <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: meta.color, opacity: 0.05 }} />
                  </Paper>
                </motion.div>
              );
            })
          )}
        </Stack>
      )}

      {/* نمای هفته */}
      {view === 'week' && (
        <Tabs defaultValue={today} variant="pills" radius="xl" mb="md">
          <Tabs.List grow>
            {DAYS.map((day, idx) => {
              const isToday = idx === todayIdx;
              const daySlots = allSlots.filter(s => s.dayOfWeek === idx);
              return (
                <Tooltip key={day} label={`${daySlots.length} وعده`} openDelay={500}>
                  <Tabs.Tab value={day} style={{ fontWeight: isToday ? 800 : 400, fontSize: 13 }}>
                    {day.charAt(0)}
                  </Tabs.Tab>
                </Tooltip>
              );
            })}
          </Tabs.List>

          {DAYS.map((day, idx) => {
            const daySlots = allSlots.filter(s => s.dayOfWeek === idx);
            return (
              <Tabs.Panel key={day} value={day} pt="md">
                <Stack gap="sm">
                  {MEALS.map(meal => {
                    const slot = daySlots.find(s => s.mealType === meal);
                    const title = slot?.recipe?.title;
                    const meta = mealMeta[meal];
                    // رفع تداخل shorthand border با borderColor/borderStyle
                    const borderColor = title ? meta.color : dark ? '#444' : '#ddd';
                    const borderStyle = title ? 'solid' : 'dashed';

                    return (
                      <Paper
                        key={meal}
                        p="sm"
                        radius="md"
                        style={{
                          backgroundColor: title ? cardBg : 'transparent',
                          borderWidth: '1px',
                          borderStyle: borderStyle,
                          borderColor: borderColor,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleOpenPicker(day, meal)}
                      >
                        <Group justify="space-between" align="center" wrap="nowrap">
                          <Group gap="xs" wrap="nowrap" style={{ flex: 1 }}>
                            <ThemeIcon size="md" radius="md" color={meta.color} variant="light">
                              {meta.icon}
                            </ThemeIcon>
                            <div style={{ flex: 1 }}>
                              <Text size="xs" fw={600} c={textColor}>{meal}</Text>
                              {title ? (
                                <Text size="xs" c="dimmed" lineClamp={1}>{title}</Text>
                              ) : (
                                <Text size="xs" c="dimmed">خالی</Text>
                              )}
                            </div>
                          </Group>
                          {title ? (
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              color="red"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveMeal(day, meal);
                              }}
                            >
                              <IconX size={14} />
                            </ActionIcon>
                          ) : (
                            <ActionIcon size="sm" variant="light" color="gray" radius="xl">
                              <IconPlus size={14} />
                            </ActionIcon>
                          )}
                        </Group>
                      </Paper>
                    );
                  })}
                </Stack>
              </Tabs.Panel>
            );
          })}
        </Tabs>
      )}

      {/* مودال انتخاب غذا */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={<Text ta="center" fw={700} size="lg">{selectedSlot.meal} {selectedSlot.day} 🍽️</Text>}
        size="lg"
        radius="xl"
        styles={{ body: { padding: '8px' }, title: { width: '100%' } }}
      >
        <TextInput
          placeholder="جستجوی سریع در رسپی‌ها..."
          leftSection={<IconSearch size={18} />}
          radius="xl"
          mb="md"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          styles={{ input: { textAlign: 'right' } }}
        />
        <ScrollArea h="60vh" offsetScrollbars>
          {recipesLoading ? (
            <Center py="xl"><Loader color="orange" /></Center>
          ) : searchedRecipes.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">هیچ رسپی‌ای یافت نشد.</Text>
          ) : (
            searchedRecipes.map(recipe => (
              <motion.div key={recipe.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Paper
                  p="sm"
                  mb="sm"
                  radius="md"
                  withBorder
                  style={{ cursor: 'pointer', borderRight: '4px solid #FF6B35' }}
                  onClick={() => handleSelectRecipe(recipe.id, recipe.title)}
                >
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={600}>{recipe.title}</Text>
                      <Text size="xs" c="dimmed">
                        ⏱ {recipe.cookingTime || '?'} دقیقه | {recipe.difficulty || 'متوسط'}
                      </Text>
                    </div>
                    <IconCheck size={18} color="#FF6B35" />
                  </Group>
                </Paper>
              </motion.div>
            ))
          )}
        </ScrollArea>
      </Modal>

      {/* دکمهٔ برگشت به بالا */}
      <ActionIcon
        variant="filled"
        color="orange"
        size="xl"
        radius="xl"
        style={{ position: 'fixed', bottom: 90, right: 16, zIndex: 50, boxShadow: '0 4px 12px rgba(255,107,53,0.4)' }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
