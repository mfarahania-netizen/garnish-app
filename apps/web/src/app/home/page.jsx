// src/app/home/page.jsx
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Container, Title, Text, SimpleGrid, Skeleton,
  Group, Badge, Paper, Button, useMantineColorScheme,
  Popover, ScrollArea, ActionIcon, Box, Tooltip,
  Autocomplete, Alert, ThemeIcon
} from '@mantine/core';
import {
  IconSearch, IconRobot,
  IconStars, IconMicrophone, IconArrowUp,
  IconAlertCircle, IconSparkles,
  IconChefHat, IconArrowRight
} from '@tabler/icons-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules'; // فقط Autoplay نیاز داریم
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useRecipes } from '../../hooks/useRecipes';
import { useAnalytics } from '../../hooks/useAnalytics';
import apiClient from '../../lib/apiClient';
import RecipeCard from '../../components/RecipeCard';

// حذف import 'swiper/css/effect-fade' چون EffectFade را استفاده نمی‌کنیم

const bannerSlides = [
  {
    bg: 'linear-gradient(135deg, #FF6B35, #D84315)',
    title: 'با مواد ساده غذاهای عالی بپز',
    subtitle: 'مواد داخل یخچالت رو وارد کن تا معجزه ببینی',
    icon: '🥘',
    action: '/ai-chat'
  },
  {
    bg: 'linear-gradient(135deg, #1A237E, #3949AB)',
    title: 'دستور پخت‌های جدید هر هفته',
    subtitle: 'هر هفته ۱۰ رسپی جدید و خوشمزه',
    icon: '🔥',
    action: '/recipes'
  },
];

const FILTER_CHIPS = [
  { label: '⚡ سریع', key: 'isQuick' },
  { label: '💚 سالم', key: 'isHealthy' },
  { label: '🌿 گیاهی', key: 'vegetarian' },
  { label: '🇮🇷 ایرانی', key: 'persian' },
];

const TOP_CATEGORIES = ['کباب', 'خورشت', 'پلو', 'آش', 'دسر', 'سالاد', 'نوشیدنی', 'غذای ساده و فوری', 'دلمه'];

const CATEGORY_EMOJIS = {
  'کباب': '🍢', 'خورشت': '🥘', 'پلو': '🍚', 'آش': '🍜',
  'غذای ساده و فوری': '⚡', 'دلمه': '🫔', 'سالاد': '🥗',
  'دسر': '🍰', 'نوشیدنی': '🍹',
};

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' }
  })
};

function applyChipFilters(recipes, activeChips) {
  if (!recipes) return [];
  let items = recipes;
  if (activeChips.includes('isQuick')) {
    items = items.filter(r => {
      const cookTime = parseInt(r.cook_time, 10) || parseInt(r.cookingTime, 10);
      return !isNaN(cookTime) && cookTime <= 30;
    });
  }
  if (activeChips.includes('isHealthy')) {
    items = items.filter(r => {
      const dietHealthy = r.diet === 'vegetarian' || r.diet === 'vegan';
      const cats = Array.isArray(r.categories) ? r.categories : [];
      const hasHealthyTag = cats.includes('سالم') || cats.includes('رژیمی');
      return dietHealthy || hasHealthyTag;
    });
  }
  if (activeChips.includes('vegetarian')) {
    items = items.filter(r => r.diet === 'vegetarian' || r.diet === 'vegan');
  }
  if (activeChips.includes('persian')) {
    items = items.filter(r => r.region === 'persian');
  }
  return items;
}

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeChips, setActiveChips] = useState([]);
  const [_isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [_isSearching, setIsSearching] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recsLoading, setRecsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const scrollEventFired = useRef(false);
  const searchTimer = useRef(null);

  const { recipes, loading, error, total } = useRecipes();
  const { trackEvent } = useAnalytics();
  const isLoading = loading;
  const isError = !!error;

  const navigate = useNavigate();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const handleWindowScroll = useCallback(() => {
    if (scrollEventFired.current) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    if (scrollTop + windowHeight >= documentHeight * 0.8) {
      trackEvent('home_scroll_to_bottom');
      scrollEventFired.current = true;
    }
  }, [trackEvent]);

  useEffect(() => {
    trackEvent('page_view', { page: '/home' });
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [handleWindowScroll, trackEvent]);

  // دریافت پیشنهادهای شخصی‌سازی‌شده (فقط در صورت وجود توکن)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setRecsLoading(false);
      return;
    }
    const fetchRecommendations = async () => {
      try {
        const { data } = await apiClient.get('/recommendations?limit=6');
        setRecommendations(data);
        trackEvent('recommendation_impression', {
          count: data.length,
          recipeIds: data.map((item) => item.recipeId || item.id).filter(Boolean),
        });
      } catch (e) {
        console.error('Recs error:', e);
      } finally {
        setRecsLoading(false);
      }
    };
    fetchRecommendations();
  }, [trackEvent]);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get(`/recipes/search?q=${encodeURIComponent(value)}&limit=5`);
        setSearchResults(data);
        setSearchOpen(true);
        trackEvent('search_query', { query: value, resultCount: data.length });
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [trackEvent]);

  const handleVoiceSearch = () => {
    if (!voiceSupported) return;
    trackEvent('voice_search_start');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'fa-IR';
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript;
      setSearch(t);
      handleSearchChange(t);
      setIsListening(false);
      trackEvent('voice_search_success', { transcript: t });
    };
    recognition.onerror = (e) => {
      setIsListening(false);
      trackEvent('voice_search_error', { error: e.error });
    };
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const handleFilterToggle = (chipKey, isActive) => {
    setActiveChips(prev =>
      prev.includes(chipKey) ? prev.filter(c => c !== chipKey) : [...prev, chipKey]
    );
    if (!isActive) trackEvent('filter_use', { filter: chipKey });
  };

  const filteredRecipes = useMemo(() => {
    return applyChipFilters(recipes, activeChips);
  }, [recipes, activeChips]);

  const filteredSearchResults = useMemo(() => {
    return applyChipFilters(searchResults, activeChips);
  }, [searchResults, activeChips]);

  const todaySpecial = useMemo(() => {
    if (!recipes?.length) return null;
    const dayKey = new Date().toISOString().slice(0, 10);
    const seed = [...dayKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return recipes[seed % recipes.length];
  }, [recipes]);

  const textColor = dark ? '#ffffff' : '#1A237E';
  const mutedText = dark ? '#a0a0b0' : '#555';
  // ⚡ مطمئن شو پس‌زمینه کارت‌ها در dark mode کاملاً opaque دیده شود
  const cardBg = dark ? 'rgba(30,30,40,1)' : 'rgba(255,255,255,0.9)';
  const cardShadow = dark ? '0 4px 12px rgba(0,0,0,0.6)' : '0 4px 20px rgba(0,0,0,0.05)';
  const borderColor = dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)';
  const accent = '#FF6B35';
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // آماده‌سازی داده‌های تب‌ها
  const quickRecipes = useMemo(() => recipes?.filter(r => {
    const ct = parseInt(r.cook_time, 10) || parseInt(r.cookingTime, 10);
    return !isNaN(ct) && ct <= 30;
  }) || [], [recipes]);

  const popularRecipes = useMemo(() => recipes?.filter(r => r.isPopular) || recipes?.slice(0, 8) || [], [recipes]);

  const tabRecipes = useMemo(() => {
    if (activeTab === 'quick') return quickRecipes;
    if (activeTab === 'popular') return popularRecipes;
    return filteredRecipes;
  }, [activeTab, quickRecipes, popularRecipes, filteredRecipes]);

  if (isLoading) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
        <Skeleton height={200} radius="xl" mb="md" />
        <Skeleton height={30} width="60%" mb="sm" />
        <SimpleGrid cols={1} spacing="sm">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={180} radius="xl" />)}
        </SimpleGrid>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
        <Alert icon={<IconAlertCircle size={16} />} title="خطا در بارگذاری" color="red" radius="lg">
          {error?.message || 'متأسفانه در دریافت رسپی‌ها مشکلی پیش اومد.'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 120px' }}>
      {/* هدر ساده و مدرن */}
      <motion.div initial="hidden" animate="visible" variants={fadeInUp} custom={0} style={{ marginBottom: 20, marginTop: 8 }}>
        <Group justify="space-between" align="center">
          <div>
            <Group gap={8}>
              <IconChefHat size={28} color={accent} />
              <Title order={3} c={textColor} style={{ fontWeight: 800, letterSpacing: '-0.5px' }}>Garnish OS</Title>
            </Group>
            <Text size="sm" c={mutedText}>دستیار هوشمند تغذیه و آشپزی شما</Text>
          </div>
        </Group>
      </motion.div>

      {/* بنر اسلایدر (بدون EffectFade و loop) */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box mb={24} style={{ borderRadius: 24, overflow: 'hidden', boxShadow: cardShadow }}>
          <Swiper
            modules={[Autoplay]}
            autoplay={{ delay: 5000 }}
            style={{ borderRadius: 24, backgroundColor: dark ? '#1e1e2f' : '#fff' }}
          >
            {bannerSlides.map((slide) => (
              <SwiperSlide key={slide.action}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { navigate(slide.action); trackEvent('banner_click', { action: slide.action }); }}
                  style={{
                    background: slide.bg,
                    height: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    textAlign: 'center',
                    padding: '16px 24px',
                    cursor: 'pointer'
                  }}
                >
                  <Text size={48} mb={12}>{slide.icon}</Text>
                  <Text size={20} fw={800} mb={6}>{slide.title}</Text>
                  <Text size={14} opacity={0.9}>{slide.subtitle}</Text>
                </motion.div>
              </SwiperSlide>
            ))}
          </Swiper>
        </Box>
      </motion.div>

      {/* جستجوی سرور-محور */}
      <motion.div variants={fadeInUp} custom={1} initial="hidden" animate="visible">
        <Group gap="xs" mb="md">
          <Popover opened={searchOpen} onChange={setSearchOpen} width="target" position="bottom" shadow="md" style={{ flex: 1 }}>
            <Popover.Target>
              <Autocomplete
                placeholder="چی دوست داری بپزی؟"
                leftSection={<IconSearch size={20} />}
                radius="xl"
                size="md"
                value={search}
                onChange={handleSearchChange}
                onFocus={() => search.trim().length >= 2 && setSearchOpen(true)}
                styles={{
                  input: {
                    textAlign: 'right',
                    backgroundColor: dark ? 'rgba(30,30,40,0.9)' : 'rgba(255,255,255,0.9)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${borderColor}`,
                    height: 52,
                    fontSize: 16,
                    borderRadius: 26,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    '&:focus': { borderColor: accent, boxShadow: `0 0 0 3px ${accent}30` },
                  },
                }}
              />
            </Popover.Target>
            {filteredSearchResults.length > 0 && (
              <Popover.Dropdown p={0} style={{ borderRadius: 16, overflow: 'hidden' }}>
                <ScrollArea.Autosize mah={250}>
                  {filteredSearchResults.map((recipe) => (
                    <motion.div key={recipe.id}
                      whileHover={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,107,53,0.06)' }}
                      onClick={() => {
                        navigate(`/recipe/${recipe.id}`);
                        setSearchOpen(false);
                        setSearch('');
                        trackEvent('search_result_click', { recipeId: recipe.id });
                      }}
                      style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <Text size="xl">🍽️</Text>
                      <div style={{ flex: 1 }}>
                        <Text size="sm" fw={600}>{recipe.title}</Text>
                        <Text size="xs" c="dimmed">
                          {(recipe.ingredients || []).slice(0, 2).map(i => i.name).join('، ')}
                        </Text>
                      </div>
                      <Badge variant="light" color="orange" size="sm" radius="xl">{recipe.cookingTime ? `${recipe.cookingTime} دقیقه` : ''}</Badge>
                    </motion.div>
                  ))}
                </ScrollArea.Autosize>
              </Popover.Dropdown>
            )}
          </Popover>
          <Tooltip label={voiceSupported ? 'جستجوی صوتی' : 'مرورگر شما پشتیبانی نمی‌کند'}>
            <ActionIcon variant="light" color="gray" size={52} radius="xl"
              onClick={handleVoiceSearch} disabled={!voiceSupported}
              style={{ border: `1px solid ${borderColor}` }}
            >
              <IconMicrophone size={22} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </motion.div>

      {/* فیلتر چیپس */}
      <motion.div variants={fadeInUp} custom={2} initial="hidden" animate="visible">
        <ScrollArea type="never" mb="lg">
          <Group gap="xs" wrap="nowrap">
            {FILTER_CHIPS.map(chip => {
              const isActive = activeChips.includes(chip.key);
              return (
                <motion.div key={chip.key} whileTap={{ scale: 0.95 }}>
                  <Badge
                    variant={isActive ? 'filled' : 'outline'}
                    color={isActive ? 'orange' : 'gray'}
                    size="lg"
                    radius="xl"
                    style={{
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                      padding: '8px 18px',
                      fontWeight: 500,
                      backgroundColor: isActive ? accent : 'transparent',
                      color: isActive ? 'white' : mutedText,
                      border: `1px solid ${isActive ? accent : borderColor}`
                    }}
                    onClick={() => handleFilterToggle(chip.key, isActive)}
                  >
                    {chip.label}
                  </Badge>
                </motion.div>
              );
            })}
          </Group>
        </ScrollArea>
      </motion.div>

      {/* غذای ویژه امروز (کارت بزرگ) */}
      {todaySpecial && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} whileHover={{ y: -4 }}>
          <Paper
            p="lg"
            radius="xl"
            mb="lg"
            style={{
              background: dark
                ? 'linear-gradient(135deg, #2c2c3a, #1e1e2f)'
                : 'linear-gradient(135deg, #fff5f0, #ffffff)',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              border: `1px solid ${accent}40`,
              boxShadow: `0 8px 24px ${accent}20`,
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onClick={() => { navigate(`/recipe/${todaySpecial.id}`); trackEvent('today_special_click', { recipeId: todaySpecial.id }); }}
          >
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div>
                <Badge
                  variant="gradient"
                  gradient={{ from: 'orange', to: 'red' }}
                  size="sm"
                  mb="xs"
                  leftSection={<IconStars size={14} />}
                  radius="xl"
                >
                  پیشنهاد سرآشپز امروز
                </Badge>
                <Title order={3} c={dark ? '#fff' : '#1A237E'} mb="xs">{todaySpecial.title}</Title>
                <Text size="xs" c={mutedText} mb="md">
                  {todaySpecial.cook_time ? `⏱ ${todaySpecial.cook_time}` : ''}
                  {todaySpecial.difficulty ? `  •  📊 ${todaySpecial.difficulty}` : ''}
                </Text>
                <Button
                  variant="outline"
                  color="orange"
                  radius="xl"
                  size="sm"
                  rightSection={<IconArrowRight size={16} />}
                  onClick={(e) => { e.stopPropagation(); navigate(`/recipe/${todaySpecial.id}`); }}
                >
                  دیدن رسپی
                </Button>
              </div>
              <Text style={{ fontSize: 80, opacity: 0.08, transform: 'rotate(15deg)', position: 'absolute', top: 10, right: 20, pointerEvents: 'none' }}>
                🍽️
              </Text>
            </Group>
          </Paper>
        </motion.div>
      )}

      {/* پیشنهادهای ویژه برای شما (در صورت وجود توکن) */}
      {!recsLoading && recommendations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Paper
            p="md"
            radius="xl"
            mb="lg"
            style={{
              background: dark
                ? 'linear-gradient(135deg, #2c2c3a, #1e1e2f)'
                : 'linear-gradient(135deg, #f0f4ff, #ffffff)',
              border: `1px solid ${accent}30`,
              boxShadow: cardShadow,
            }}
          >
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <ThemeIcon variant="gradient" gradient={{ from: 'violet', to: 'blue' }} size={28} radius="md">
                  <IconSparkles size={16} />
                </ThemeIcon>
                <Title order={5} c={textColor}>پیشنهادهای ویژه برای شما</Title>
              </Group>
              <Badge variant="light" color="violet" size="sm" radius="xl">شخصی‌سازی شده</Badge>
            </Group>
            <SimpleGrid cols={1} spacing="sm">
              {recommendations.slice(0, 4).map(rec => {
                const adaptedRecipe = { ...rec, id: rec.recipeId || rec.id };
                return (
                  <RecipeCard
                    key={adaptedRecipe.id}
                    recipe={adaptedRecipe}
                    onClick={() => {
                      navigate(`/recipe/${adaptedRecipe.id}`);
                      trackEvent('recommendation_click', { recipeId: adaptedRecipe.id });
                    }}
                  />
                );
              })}
            </SimpleGrid>
          </Paper>
        </motion.div>
      )}

      {/* دسته‌بندی‌ها – اصلاح شده برای دیده شدن قطعی */}
      <motion.div variants={fadeInUp} custom={3} initial="hidden" animate="visible">
        <Box mb="xl">
          <Title order={5} c={textColor} mb="sm">📂 دسته‌بندی‌ها</Title>
          <SimpleGrid cols={3} spacing="sm" style={{ alignItems: 'start', visibility: 'visible' }}>
            {TOP_CATEGORIES.map((cat) => (
              <motion.div
                key={cat}
                whileHover={{ y: -5, boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => { navigate(`/category/${cat}`); trackEvent('category_click', { category: cat }); }}
                style={{
                  background: cardBg,
                  backdropFilter: 'blur(12px)',
                  borderRadius: 18,
                  padding: '16px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  boxShadow: cardShadow,
                  border: `1px solid ${borderColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  minHeight: 80,              // تضمین ارتفاع قابل مشاهده
                  position: 'relative',
                  zIndex: 1,
                  visibility: 'visible'       // احتیاط اضافی
                }}
              >
                <Text size={30} style={{ lineHeight: 1.2 }}>{CATEGORY_EMOJIS[cat] || '🍽️'}</Text>
                <Text size="xs" fw={600} c={dark ? 'gray.3' : 'dark.7'} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {cat}
                </Text>
              </motion.div>
            ))}
          </SimpleGrid>
        </Box>
      </motion.div>

      {/* هوش مصنوعی */}
      <motion.div
        whileHover={{ scale: 1.02, boxShadow: '0 8px 25px rgba(255,107,53,0.4)' }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Paper
          shadow="md"
          p="lg"
          radius="xl"
          mb="xl"
          style={{
            background: 'linear-gradient(135deg, #1A237E, #3949AB)',
            color: 'white',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={() => { navigate('/ai-chat'); trackEvent('ai_chat_button_click'); }}
        >
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
          <Group justify="space-between" wrap="nowrap" style={{ position: 'relative', zIndex: 1 }}>
            <div>
              <Group gap="xs" mb={6}>
                <IconSparkles size={24} color="#FFD166" />
                <Text fw={700} size="lg">با مواد یخچال چی بپزم؟</Text>
              </Group>
              <Text size="sm" opacity={0.9}>از دستیار هوش مصنوعی بپرس…</Text>
            </div>
            <IconRobot size={56} opacity={0.9} />
          </Group>
        </Paper>
      </motion.div>

      {/* تب‌ها برای رسپی‌ها */}
      <motion.div variants={fadeInUp} custom={4} initial="hidden" animate="visible">
        <Group mb="md" style={{ gap: 4 }}>
          {[
            { key: 'all', label: 'همه رسپی‌ها' },
            { key: 'quick', label: 'سریع و آسان' },
            { key: 'popular', label: 'پرطرفدارها' },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'filled' : 'outline'}
              color={activeTab === tab.key ? 'orange' : 'gray'}
              size="sm"
              radius="xl"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </Group>
        <SimpleGrid cols={1} spacing="sm" mb="lg">
          {tabRecipes.slice(0, 4).map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} onClick={() => { navigate(`/recipe/${recipe.id}`); trackEvent('recipe_view', { recipeId: recipe.id }); }} />
          ))}
        </SimpleGrid>
        {total > 4 && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="gradient"
              gradient={{ from: 'orange', to: 'red' }}
              fullWidth
              size="lg"
              radius="xl"
              onClick={() => { navigate('/recipes'); trackEvent('view_all_recipes_click'); }}
              rightSection={<IconArrowRight size={20} />}
              styles={{
                root: { height: 52, fontSize: 16, boxShadow: '0 6px 15px rgba(255,107,53,0.4)' }
              }}
            >
              مشاهده همه رسپی‌ها ({total} رسپی)
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* دکمه اسکرول به بالا */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          style={{ position: 'fixed', bottom: 100, right: 16, zIndex: 50 }}
        >
          <ActionIcon
            variant="filled"
            color="orange"
            size="xl"
            radius="xl"
            style={{ boxShadow: '0 6px 16px rgba(255,107,53,0.5)' }}
            onClick={scrollToTop}
          >
            <IconArrowUp size={22} />
          </ActionIcon>
        </motion.div>
      </AnimatePresence>
    </Container>
  );
}
