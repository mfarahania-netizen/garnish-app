// src/app/recipe/[id]/page.jsx
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container, Title, Text, Skeleton, Alert, Group, Badge, Paper,
  Accordion, Box, Stack, SimpleGrid, ThemeIcon,
  useMantineTheme, rem, ActionIcon, Tooltip, Center,
  Button, ScrollArea, UnstyledButton
} from '@mantine/core';
import { useRecipes } from '../../../hooks/useRecipes';
import { useFavoritesQuery } from '../../../hooks/useFavoritesQuery';
import { useAnalytics } from '../../../hooks/useAnalytics';
import {
  IconToolsKitchen, IconChefHat, IconClock, IconUsers,
  IconBulb, IconQuestionMark, IconTools,
  IconFlame, IconClockHour4, IconAlertTriangle, IconCircleCheck,
  IconShare, IconArrowRight,
  IconBookmark, IconStarFilled, IconPrinter,
  IconSun, IconMoon, IconSunset, IconLeaf, IconFlameFilled,
  IconCoin, IconCalendarEvent, IconExclamationCircle,
  IconArrowUp, IconArrowDown, IconHeart, IconInfoCircle
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

// ========== توابع کمکی (بدون تغییر) ==========
const getIngredientEmoji = (name) => {
  if (!name) return '🍽️';
  const clean = name.trim().toLowerCase();
  if (clean.includes('مرغ') || clean.includes('جوجه')) return '🍗';
  if (clean.includes('گوشت')) return '🥩';
  if (clean.includes('پیاز')) return '🧅';
  if (clean.includes('سیر')) return '🧄';
  if (clean.includes('گوجه')) return '🍅';
  if (clean.includes('تخم‌مرغ') || clean.includes('تخم مرغ')) return '🥚';
  if (clean.includes('رب')) return '🥫';
  if (clean.includes('برنج')) return '🍚';
  if (clean.includes('ماست')) return '🥛';
  if (clean.includes('کره') || clean.includes('روغن')) return '🧈';
  if (clean.includes('پنیر')) return '🧀';
  if (clean.includes('سبزی') || clean.includes('نعنا') || clean.includes('جعفری') || clean.includes('گشنیز') || clean.includes('شوید') || clean.includes('تره')) return '🌿';
  if (clean.includes('فلفل')) return '🌶️';
  if (clean.includes('زردچوبه') || clean.includes('زعفران') || clean.includes('نمک') || clean.includes('ادویه') || clean.includes('فلفل سیاه')) return '🧂';
  if (clean.includes('قارچ')) return '🍄';
  if (clean.includes('لیمو')) return '🍋';
  if (clean.includes('سیب‌زمینی') || clean.includes('سیب زمینی')) return '🥔';
  if (clean.includes('هویج')) return '🥕';
  if (clean.includes('لوبیا') || clean.includes('عدس') || clean.includes('نخود') || clean.includes('لپه')) return '🫘';
  if (clean.includes('ماهی') || clean.includes('میگو')) return '🐟';
  if (clean.includes('گردو') || clean.includes('بادام') || clean.includes('پسته')) return '🥜';
  if (clean.includes('شکر') || clean.includes('عسل')) return '🍯';
  if (clean.includes('آرد') || clean.includes('آرد‌')) return '🌾';
  if (clean.includes('خیار')) return '🥒';
  if (clean.includes('شیر')) return '🥛';
  if (clean.includes('خرما')) return '🌴';
  if (clean.includes('گلاب') || clean.includes('بهار نارنج')) return '🌸';
  if (clean.includes('سرکه')) return '🍶';
  if (clean.includes('اسفناج')) return '🥬';
  if (clean.includes('آلو')) return '🫐';
  return '🍽️';
};

const getToolEmoji = (name) => {
  if (!name) return '🔧';
  const clean = name.trim().toLowerCase();
  if (clean.includes('سیخ') || clean.includes('توری')) return '🥢';
  if (clean.includes('کاسه')) return '🥣';
  if (clean.includes('برس')) return '🖌️';
  if (clean.includes('منقل') || clean.includes('تابه') || clean.includes('گریل') || clean.includes('قابلمه') || clean.includes('دیگ')) return '🍳';
  if (clean.includes('کفگیر') || clean.includes('قاشق') || clean.includes('ملاقه')) return '🥄';
  if (clean.includes('رنده') || clean.includes('غذاساز')) return '🔪';
  if (clean.includes('فر')) return '🔥';
  if (clean.includes('چاقو') || clean.includes('تخته')) return '🔪';
  if (clean.includes('پارچ') || clean.includes('بطری')) return '🏺';
  if (clean.includes('لیوان')) return '🥃';
  if (clean.includes('سینی') || clean.includes('قالب')) return '📦';
  if (clean.includes('صافی')) return '🫗';
  if (clean.includes('کاغذ')) return '📄';
  if (clean.includes('پیمانه')) return '⚖️';
  if (clean.includes('پوست‌کن') || clean.includes('پوست کن')) return '🔪';
  if (clean.includes('دماسنج')) return '🌡️';
  if (clean.includes('دستمال')) return '🧻';
  return '🔧';
};

const difficultyColor = (diff) => {
  const map = { 'آسان': 'green', 'متوسط': 'yellow', 'سخت': 'red' };
  return map[diff] || 'gray';
};

const parseMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const num = parseInt(timeStr, 10);
  return isNaN(num) ? 0 : num;
};

const formatTime = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const hrs = Math.floor(value / 60);
  const mins = value % 60;
  if (hrs === 0) return `${mins} دقیقه`;
  if (mins === 0) return `${hrs} ساعت`;
  return `${hrs} ساعت و ${mins} دقیقه`;
};

const regionLabel = (region) => {
  const map = {
    'persian': '🇮🇷 ایرانی',
    'north': '🌿 شمال',
    'south': '🌊 جنوب',
    'west': '🏔️ غرب',
    'central': '🏜️ مرکز',
    'international': '🌍 بین‌الملل',
  };
  return map[region] || region;
};

const mealTypeLabel = (mealTypeStr) => {
  if (!mealTypeStr) return [];
  const types = mealTypeStr.split(',').map(t => t.trim());
  const map = {
    'breakfast': { label: 'صبحانه', icon: IconSun, color: 'yellow' },
    'lunch': { label: 'ناهار', icon: IconSunset, color: 'orange' },
    'dinner': { label: 'شام', icon: IconMoon, color: 'indigo' },
    'snack': { label: 'میان‌وعده', icon: null, color: 'grape' },
  };
  return types.map(t => map[t] || { label: t, icon: null, color: 'gray' });
};

const costColor = (cost) => {
  const map = { 'گران': 'red', 'متوسط': 'yellow', 'کم‌هزینه': 'green' };
  return map[cost] || 'gray';
};

// ========== کامپوننت اصلی ==========
export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getRecipeById, loading } = useRecipes();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesQuery();
  const { trackEvent } = useAnalytics();
  const theme = useMantineTheme();
  const [showFullExcerpt, setShowFullExcerpt] = useState(false);
  const [directRecipe, setDirectRecipe] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);

  // حالت‌های باز/بسته برای کارت‌های تعاملی
  const [timingOpen, setTimingOpen] = useState(false);
  const [nutritionOpen, setNutritionOpen] = useState(false);
  const [featuresOpen, setFeaturesOpen] = useState(false);

  // تایمرهای read برای کارت‌ها
  const timingReadTimer = useRef(null);
  const nutritionReadTimer = useRef(null);
  const featuresReadTimer = useRef(null);

  // ردیابی اسکرول به پایین
  const scrollTracked = useRef(false);

  // ردیابی آکاردئون‌ها
  const prevAccordionValue = useRef([]);
  const accordionTimers = useRef({}); // نگهداری تایمرهای read به ازای هر value

  const recipe = getRecipeById(id);

  useEffect(() => {
    if (!recipe && id) {
      setDirectLoading(true);
      axios.get(`http://localhost:3000/recipes/${id}`)
        .then(res => setDirectRecipe(res.data))
        .catch(() => setDirectRecipe(null))
        .finally(() => setDirectLoading(false));
    }
  }, [recipe, id]);

  const finalRecipe = recipe || directRecipe;
  const finalLoading = loading || directLoading;
  const favorite = finalRecipe ? isFavorite(finalRecipe.id) : false;

  useEffect(() => {
    if (finalRecipe) {
      trackEvent('recipe_view', { recipeId: finalRecipe.id, title: finalRecipe.title });
    }
  }, [finalRecipe?.id]);

  // اسکرول به پایین
  useEffect(() => {
    const handleScroll = () => {
      if (scrollTracked.current) return;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      if (scrollTop + windowHeight >= documentHeight * 0.8) {
        trackEvent('recipe_scroll_to_bottom', { recipeId: finalRecipe?.id });
        scrollTracked.current = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [finalRecipe?.id, trackEvent]);

  // پاکسازی تایمرها
  useEffect(() => {
    return () => {
      clearTimeout(timingReadTimer.current);
      clearTimeout(nutritionReadTimer.current);
      clearTimeout(featuresReadTimer.current);
      Object.values(accordionTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleToggleFavorite = () => {
    if (!finalRecipe) return;
    if (favorite) {
      removeFavorite(finalRecipe.id);
      trackEvent('favorite_remove', { recipeId: finalRecipe.id });
    } else {
      addFavorite(finalRecipe.id);
      trackEvent('favorite_add', { recipeId: finalRecipe.id });
    }
  };

  const toggleTiming = () => {
    if (!timingOpen) {
      trackEvent('timing_expand', { recipeId: finalRecipe?.id });
      clearTimeout(timingReadTimer.current);
      timingReadTimer.current = setTimeout(() => {
        trackEvent('timing_read', { recipeId: finalRecipe?.id });
      }, 8000);
    } else {
      clearTimeout(timingReadTimer.current);
      trackEvent('timing_collapse', { recipeId: finalRecipe?.id });
    }
    setTimingOpen(prev => !prev);
  };

  const toggleNutrition = () => {
    if (!nutritionOpen) {
      trackEvent('nutrition_expand', { recipeId: finalRecipe?.id });
      clearTimeout(nutritionReadTimer.current);
      nutritionReadTimer.current = setTimeout(() => {
        trackEvent('nutrition_read', { recipeId: finalRecipe?.id });
      }, 8000);
    } else {
      clearTimeout(nutritionReadTimer.current);
      trackEvent('nutrition_collapse', { recipeId: finalRecipe?.id });
    }
    setNutritionOpen(prev => !prev);
  };

  const toggleFeatures = () => {
    if (!featuresOpen) {
      trackEvent('features_expand', { recipeId: finalRecipe?.id });
      clearTimeout(featuresReadTimer.current);
      featuresReadTimer.current = setTimeout(() => {
        trackEvent('features_read', { recipeId: finalRecipe?.id });
      }, 8000);
    } else {
      clearTimeout(featuresReadTimer.current);
      trackEvent('features_collapse', { recipeId: finalRecipe?.id });
    }
    setFeaturesOpen(prev => !prev);
  };

  // مدیریت آکاردئون‌ها با expand/collapse/read
  const handleAccordionChange = useCallback((values) => {
    const prev = prevAccordionValue.current;
    const opened = values.filter(v => !prev.includes(v));
    const closed = prev.filter(v => !values.includes(v));

    // ثبت expand و شروع تایمر read
    opened.forEach(value => {
      trackEvent(`${value}_expand`, { recipeId: finalRecipe?.id });
      // اگر قبلاً تایمری بود پاک کن
      if (accordionTimers.current[value]) clearTimeout(accordionTimers.current[value]);
      accordionTimers.current[value] = setTimeout(() => {
        trackEvent(`${value}_read`, { recipeId: finalRecipe?.id });
        delete accordionTimers.current[value];
      }, 8000);
    });

    // ثبت collapse و پاک کردن تایمر read
    closed.forEach(value => {
      trackEvent(`${value}_collapse`, { recipeId: finalRecipe?.id });
      if (accordionTimers.current[value]) {
        clearTimeout(accordionTimers.current[value]);
        delete accordionTimers.current[value];
      }
    });

    prevAccordionValue.current = values;
  }, [finalRecipe?.id, trackEvent]);

  if (finalLoading) {
    return (
      <Container size="sm" py="md" style={{ maxWidth: 480, margin: '0 auto' }}>
        <Skeleton height={300} radius="xl" mb="md" />
        <Skeleton height={24} width="60%" mb="sm" />
        <Skeleton height={20} width="80%" mb="lg" />
        <Skeleton height={300} radius="md" />
      </Container>
    );
  }

  if (!finalRecipe) {
    return (
      <Container size="sm" py="xl" style={{ maxWidth: 480, margin: '0 auto' }}>
        <Alert color="red" title="رسپی پیدا نشد" icon={<IconAlertTriangle size={20} />}>
          غذایی با این شناسه در پایگاه داده یافت نشد.
        </Alert>
      </Container>
    );
  }

  const {
    title, excerpt, category, difficulty, cook_time,
    prep_time, total_time, servings, nutrition,
    ingredients = [], steps = [], tools = [], tips = [], faq = [],
    region, mealType, diet, occasion = [], cost, allergens = []
  } = finalRecipe;

  const extractNum = (str) => { const n = parseInt(str, 10); return isNaN(n) ? 0 : n; };
  const calVal = nutrition?.کالری ? extractNum(nutrition.کالری) : 0;
  const protVal = nutrition?.پروتئین ? extractNum(nutrition.پروتئین) : 0;
  const fatVal = nutrition?.چربی ? extractNum(nutrition.چربی) : 0;
  const carbVal = nutrition?.کربوهیدرات ? extractNum(nutrition.کربوهیدرات) : 0;

  const handleShare = async () => {
    trackEvent('recipe_share', { recipeId: finalRecipe.id });
    if (navigator.share) await navigator.share({ title, url: window.location.href });
  };

  const mealTypes = mealTypeLabel(mealType);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
      {/* ===== کارت اصلی تصویر و عنوان ===== */}
      <Paper
        radius="xl"
        style={{
          background: 'linear-gradient(135deg, #1A237E, #FF6B35)',
          padding: 0,
          overflow: 'hidden',
          marginBottom: 24,
          boxShadow: '0 12px 30px rgba(26,35,126,0.3)',
          position: 'relative',
        }}
      >
        <Box
          style={{
            height: 240,
            background: 'url(https://garnish-os.ir/default-recipe-bg.jpg) center/cover no-repeat',
            opacity: 0.2,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <Box style={{ position: 'relative', zIndex: 2, padding: '32px 20px 20px', color: 'white' }}>
          <Group justify="space-between" align="flex-start">
            <div style={{ flex: 1 }}>
              <Title order={2} style={{ color: 'white', fontSize: rem(28), fontWeight: 800, lineHeight: 1.3 }}>
                {title}
              </Title>
              {category && (
                <Badge
                  variant="filled"
                  color="orange"
                  size="lg"
                  radius="xl"
                  mt="sm"
                  leftSection={<IconStarFilled size={12} />}
                >
                  {category}
                </Badge>
              )}
            </div>
            <Group gap="xs">
              <Tooltip label={favorite ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'}>
                <ActionIcon
                  variant="filled"
                  color={favorite ? 'red' : 'dark'}
                  size="lg"
                  radius="xl"
                  onClick={handleToggleFavorite}
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}
                >
                  <IconHeart size={18} fill={favorite ? 'white' : 'none'} color="white" />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="اشتراک‌گذاری">
                <ActionIcon
                  variant="filled"
                  size="lg"
                  radius="xl"
                  onClick={handleShare}
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}
                >
                  <IconShare size={18} color="white" />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Box>
      </Paper>

      {/* ===== توضیح ===== */}
      {excerpt && (
        <Paper p="md" radius="lg" mb="lg" style={{
          background: 'rgba(255,255,255,0.65)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,107,53,0.2)',
        }}>
          <Text size="sm" c="dimmed" lineClamp={showFullExcerpt ? 0 : 3} style={{ lineHeight: 1.8 }}>
            {excerpt}
          </Text>
          {excerpt.length > 150 && (
            <Button
              variant="subtle" size="xs" color="orange" mt={4}
              onClick={() => { setShowFullExcerpt(!showFullExcerpt); trackEvent('excerpt_toggle', { recipeId: finalRecipe.id }); }}
            >
              {showFullExcerpt ? 'بستن ▲' : 'بیشتر بخوانید ▼'}
            </Button>
          )}
        </Paper>
      )}

      {/* ===== کارت ویژگی‌ها ===== */}
      <UnstyledButton onClick={toggleFeatures} style={{ width: '100%', marginBottom: 16 }}>
        <Paper
          p="md"
          radius="lg"
          style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0,0,0,0.05)',
            transition: 'border-color 0.2s, background 0.2s',
            cursor: 'pointer',
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconInfoCircle size={20} color="#FF6B35" />
              <Text size="sm" fw={600} c="#1A237E">ویژگی‌های غذا</Text>
            </Group>
            <motion.div
              animate={{ rotate: featuresOpen ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <ActionIcon variant="light" color="gray" size="sm" radius="xl">
                <IconArrowDown size={14} />
              </ActionIcon>
            </motion.div>
          </Group>
        </Paper>
      </UnstyledButton>
      <AnimatePresence initial={false}>
        {featuresOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <Paper
              p="md"
              radius="lg"
              mb="lg"
              mt={-8}
              pt={20}
              style={{
                background: 'rgba(255,255,255,0.5)',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              }}
            >
              <SimpleGrid cols={2} spacing="sm">
                {region && (
                  <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" radius="md" color="teal" variant="light">
                        <IconInfoCircle size={12} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">منطقه</Text>
                        <Text size="xs" fw={500}>{regionLabel(region)}</Text>
                      </div>
                    </Group>
                  </Paper>
                )}
                {difficulty && (
                  <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" radius="md" color={difficultyColor(difficulty)} variant="light">
                        <IconFlame size={12} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">سطح سختی</Text>
                        <Text size="xs" fw={500}>{difficulty}</Text>
                      </div>
                    </Group>
                  </Paper>
                )}
                {diet && (
                  <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" radius="md" color={diet === 'vegetarian' ? 'green' : 'blue'} variant="light">
                        {diet === 'vegetarian' ? <IconLeaf size={12} /> : <IconFlameFilled size={12} />}
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">رژیم</Text>
                        <Text size="xs" fw={500}>{diet === 'vegetarian' ? 'گیاهی' : diet}</Text>
                      </div>
                    </Group>
                  </Paper>
                )}
                {cost && (
                  <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" radius="md" color={costColor(cost)} variant="light">
                        <IconCoin size={12} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">هزینه</Text>
                        <Text size="xs" fw={500}>{cost}</Text>
                      </div>
                    </Group>
                  </Paper>
                )}
                {mealTypes.map((m, idx) => (
                  <Paper key={idx} p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" radius="md" color={m.color} variant="light">
                        {m.icon ? <m.icon size={12} /> : <IconInfoCircle size={12} />}
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">وعده</Text>
                        <Text size="xs" fw={500}>{m.label}</Text>
                      </div>
                    </Group>
                  </Paper>
                ))}
                {occasion.map((occ, idx) => (
                  <Paper key={idx} p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" radius="md" color="violet" variant="light">
                        <IconCalendarEvent size={12} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">مناسبت</Text>
                        <Text size="xs" fw={500}>{occ}</Text>
                      </div>
                    </Group>
                  </Paper>
                ))}
                {allergens.map((a, idx) => (
                  <Paper key={idx} p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                    <Group gap="xs" wrap="nowrap">
                      <ThemeIcon size="sm" radius="md" color="red" variant="light">
                        <IconExclamationCircle size={12} />
                      </ThemeIcon>
                      <div>
                        <Text size="xs" c="dimmed">آلرژن</Text>
                        <Text size="xs" fw={500}>{a}</Text>
                      </div>
                    </Group>
                  </Paper>
                ))}
              </SimpleGrid>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== کارت زمان‌بندی ===== */}
      <UnstyledButton onClick={toggleTiming} style={{ width: '100%', marginBottom: 16 }}>
        <Paper
          p="md"
          radius="lg"
          style={{
            background: 'rgba(255,255,255,0.65)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,107,53,0.15)',
            transition: 'border-color 0.2s, background 0.2s',
            cursor: 'pointer',
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <IconClockHour4 size={20} color="#FF6B35" />
              <Text size="sm" fw={600} c="#1A237E">زمان‌بندی</Text>
            </Group>
            <Group gap="xs">
              {total_time && <Text size="xs" c="dimmed">{formatTime(total_time)}</Text>}
              <motion.div
                animate={{ rotate: timingOpen ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              >
                <ActionIcon variant="light" color="gray" size="sm" radius="xl">
                  <IconArrowDown size={14} />
                </ActionIcon>
              </motion.div>
            </Group>
          </Group>
        </Paper>
      </UnstyledButton>
      <AnimatePresence initial={false}>
        {timingOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <Paper
              p="md"
              radius="lg"
              mb="lg"
              mt={-8}
              pt={20}
              style={{
                background: 'rgba(255,255,255,0.5)',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              }}
            >
              <Stack gap="xs">
                {prep_time && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">آماده‌سازی</Text>
                    <Text size="xs" fw={500}>{formatTime(prep_time)}</Text>
                  </Group>
                )}
                {cook_time && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">پخت</Text>
                    <Text size="xs" fw={500}>{formatTime(cook_time)}</Text>
                  </Group>
                )}
                {total_time && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">کل</Text>
                    <Text size="xs" fw={500}>{formatTime(total_time)}</Text>
                  </Group>
                )}
                {servings && (
                  <Group justify="space-between">
                    <Text size="xs" c="dimmed">تعداد</Text>
                    <Text size="xs" fw={500}>{servings} نفر</Text>
                  </Group>
                )}
              </Stack>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== کارت ارزش غذایی ===== */}
      {nutrition && (calVal || protVal || fatVal || carbVal) ? (
        <>
          <UnstyledButton onClick={toggleNutrition} style={{ width: '100%', marginBottom: 16 }}>
            <Paper
              p="md"
              radius="lg"
              style={{
                background: 'rgba(255,255,255,0.65)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(76,175,80,0.2)',
                transition: 'border-color 0.2s, background 0.2s',
                cursor: 'pointer',
              }}
            >
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <IconChefHat size={20} color="#4CAF50" />
                  <Text size="sm" fw={600} c="#1A237E">ارزش غذایی</Text>
                </Group>
                <motion.div
                  animate={{ rotate: nutritionOpen ? 180 : 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                >
                  <ActionIcon variant="light" color="gray" size="sm" radius="xl">
                    <IconArrowDown size={14} />
                  </ActionIcon>
                </motion.div>
              </Group>
            </Paper>
          </UnstyledButton>
          <AnimatePresence initial={false}>
            {nutritionOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <Paper
                  p="md"
                  radius="lg"
                  mb="lg"
                  mt={-8}
                  pt={20}
                  style={{
                    background: 'rgba(255,255,255,0.5)',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                  }}
                >
                  <SimpleGrid cols={2} spacing="xs">
                    {calVal > 0 && (
                      <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                        <Text size="xs" c="dimmed">🔥 کالری</Text>
                        <Text size="sm" fw={700} c="#FF6B35">{calVal} کیلوکالری</Text>
                      </Paper>
                    )}
                    {protVal > 0 && (
                      <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                        <Text size="xs" c="dimmed">🥩 پروتئین</Text>
                        <Text size="sm" fw={700} c="#1A237E">{protVal} گرم</Text>
                      </Paper>
                    )}
                    {fatVal > 0 && (
                      <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                        <Text size="xs" c="dimmed">🧈 چربی</Text>
                        <Text size="sm" fw={700} c="#1A237E">{fatVal} گرم</Text>
                      </Paper>
                    )}
                    {carbVal > 0 && (
                      <Paper p="xs" radius="md" withBorder style={{ borderColor: '#eee' }}>
                        <Text size="xs" c="dimmed">🍚 کربوهیدرات</Text>
                        <Text size="sm" fw={700} c="#1A237E">{carbVal} گرم</Text>
                      </Paper>
                    )}
                  </SimpleGrid>
                </Paper>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : null}

      {/* ===== آکاردئون‌های اصلی با سیستم ردیابی کامل ===== */}
      <Accordion
        multiple
        defaultValue={ingredients.length ? ['ingredients'] : (steps.length ? ['steps'] : [])}
        variant="separated"
        radius="lg"
        chevronPosition="right"
        onChange={handleAccordionChange}
        styles={{
          item: {
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.05)',
            borderRadius: 16,
            marginBottom: 12,
            overflow: 'hidden',
          },
          control: { padding: '16px 20px', '&:hover': { backgroundColor: 'rgba(255,107,53,0.05)' } },
          panel: { padding: '0 20px 20px', background: 'transparent' },
          chevron: { color: '#FF6B35' },
        }}
      >
        {ingredients.length > 0 && (
          <Accordion.Item value="ingredients">
            <Accordion.Control>
              <Group justify="space-between" style={{ width: '100%' }}>
                <Group gap="xs">
                  <IconToolsKitchen size={20} color="#FF6B35" />
                  <Text fw={600} size="sm">مواد اولیه</Text>
                </Group>
                <Badge variant="light" color="orange" size="sm">{ingredients.length} قلم</Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {ingredients.map((ing, idx) => (
                  <Paper key={idx} p="sm" radius="md" style={{
                    borderRight: '4px solid #FF6B35',
                    background: 'rgba(255,255,255,0.8)',
                    backdropFilter: 'blur(4px)',
                  }}>
                    <Group gap={12} wrap="nowrap">
                      <Text style={{ fontSize: '1.8rem' }}>{getIngredientEmoji(ing.name)}</Text>
                      <Box style={{ flex: 1 }}>
                        <Text size="sm" fw={600}>{ing.name}</Text>
                        {ing.amount && <Text size="xs" c="dimmed" mt={2}>{ing.amount}</Text>}
                        {ing.notes && <Text size="xs" fs="italic" c="gray.5" mt={2}>{ing.notes}</Text>}
                      </Box>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {tools.length > 0 && (
          <Accordion.Item value="tools">
            <Accordion.Control>
              <Group justify="space-between" style={{ width: '100%' }}>
                <Group gap="xs">
                  <IconTools size={20} color="#FF6B35" />
                  <Text fw={600} size="sm">ابزارها</Text>
                </Group>
                <Badge variant="light" color="orange" size="sm">{tools.length} عدد</Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Group gap="sm">
                {tools.map((tool, idx) => (
                  <Paper key={idx} p="xs" radius="md" withBorder style={{ background: 'rgba(255,255,255,0.7)' }}>
                    <Group gap={4}>
                      <Text>{getToolEmoji(tool)}</Text>
                      <Text size="xs">{tool}</Text>
                    </Group>
                  </Paper>
                ))}
              </Group>
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {steps.length > 0 && (
          <Accordion.Item value="steps">
            <Accordion.Control>
              <Group justify="space-between" style={{ width: '100%' }}>
                <Group gap="xs">
                  <IconChefHat size={20} color="#FF6B35" />
                  <Text fw={600} size="sm">مراحل پخت</Text>
                </Group>
                <Badge variant="light" color="orange" size="sm">{steps.length} مرحله</Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Box style={{ position: 'relative', paddingRight: 36 }}>
                <div style={{ position: 'absolute', top: 10, right: 16, bottom: 10, width: 2, background: 'linear-gradient(to bottom, #FF6B35, #1A237E)' }} />
                <Stack gap="xl">
                  {steps.map((step, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
                      <Box style={{ position: 'relative' }}>
                        <ThemeIcon
                          size={28}
                          radius="xl"
                          variant="gradient"
                          gradient={{ from: 'orange', to: 'red' }}
                          style={{ position: 'absolute', right: -36, top: 0 }}
                        >
                          <Text size="xs" fw={800}>{idx + 1}</Text>
                        </ThemeIcon>
                        <Text size="sm" style={{ lineHeight: 1.8 }}>{step}</Text>
                      </Box>
                    </motion.div>
                  ))}
                </Stack>
              </Box>
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {tips.length > 0 && (
          <Accordion.Item value="tips">
            <Accordion.Control>
              <Group justify="space-between" style={{ width: '100%' }}>
                <Group gap="xs">
                  <IconBulb size={20} color="#FF6B35" />
                  <Text fw={600} size="sm">نکات</Text>
                </Group>
                <Badge variant="light" color="orange" size="sm">{tips.length} نکته</Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {tips.map((tip, idx) => (
                  <Paper key={idx} p="sm" radius="md" style={{ borderRight: '4px solid #4CAF50', background: 'rgba(76,175,80,0.05)' }}>
                    <Group gap={10} align="flex-start" wrap="nowrap">
                      <IconCircleCheck size={18} color="#4CAF50" style={{ marginTop: 2 }} />
                      <Text size="sm" style={{ lineHeight: 1.6 }}>{tip}</Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        )}

        {faq.length > 0 && (
          <Accordion.Item value="faq">
            <Accordion.Control>
              <Group justify="space-between" style={{ width: '100%' }}>
                <Group gap="xs">
                  <IconQuestionMark size={20} color="#FF6B35" />
                  <Text fw={600} size="sm">سوالات متداول</Text>
                </Group>
                <Badge variant="light" color="orange" size="sm">{faq.length} پرسش</Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {faq.map((faqItem, idx) => (
                  <Paper key={idx} p="sm" radius="md" withBorder style={{ background: 'rgba(255,255,255,0.7)' }}>
                    <Group gap={6} align="flex-start" wrap="nowrap" mb={6}>
                      <Text style={{ fontSize: '1.2rem' }}>❓</Text>
                      <Text size="sm" fw={600} style={{ lineHeight: 1.4 }}>{faqItem.question}</Text>
                    </Group>
                    {faqItem.answer && <Text size="xs" c="dimmed" style={{ lineHeight: 1.6, paddingRight: 30 }}>{faqItem.answer}</Text>}
                  </Paper>
                ))}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        )}
      </Accordion>

      {/* دکمه شروع پخت */}
      <Button
        fullWidth
        size="lg"
        radius="xl"
        variant="gradient"
        gradient={{ from: '#FF6B35', to: '#1A237E' }}
        leftSection={<IconChefHat size={20} />}
        rightSection={<IconArrowRight size={20} />}
        style={{ boxShadow: '0 6px 20px rgba(255,107,53,0.4)', marginTop: 8 }}
        onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); trackEvent('start_cooking_click', { recipeId: finalRecipe.id }); }}
      >
        شروع پخت
      </Button>

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