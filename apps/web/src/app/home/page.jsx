// src/app/home/page.jsx
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Container, Title, Text, SimpleGrid, Skeleton,
  Group, Badge, Paper, Button, useMantineColorScheme,
  Popover, ScrollArea, ActionIcon, Box, Tooltip,
  Autocomplete, Alert, Notification, rem, Flex, Stack, ThemeIcon, Divider
} from '@mantine/core';
import {
  IconSearch, IconRobot, IconChevronLeft,
  IconStars, IconMicrophone, IconArrowUp,
  IconAlertCircle, IconEye, IconSparkles,
  IconChefHat, IconBook, IconCategory, IconArrowRight
} from '@tabler/icons-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade } from 'swiper/modules';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { useRecipes } from '../../hooks/useRecipes';
import { useAnalytics } from '../../hooks/useAnalytics';
import SectionSlider from '../../components/SectionSlider';
import RecipeCard from '../../components/RecipeCard';
import 'swiper/css/effect-fade';

const bannerSlides = [
  { bg: 'linear-gradient(135deg, #FF6B35, #D84315)', title: 'آشپزی هوشمند با گارنیش', subtitle: 'با هوش مصنوعی غذای مورد علاقه‌ات رو پیدا کن', icon: '🤖', action: '/ai-chat' },
  { bg: 'linear-gradient(135deg, #1A237E, #3949AB)', title: 'با مواد ساده غذاهای عالی بپز', subtitle: 'مواد داخل یخچالت رو وارد کن تا معجزه ببینی', icon: '🥘', action: '/ai-chat' },
  { bg: 'linear-gradient(135deg, #FF6B35, #1A237E)', title: 'دستور پخت‌های جدید هر هفته', subtitle: 'هر هفته ۱۰ رسپی جدید و خوشمزه', icon: '🔥', action: '/recipes' },
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

// ---- انیمیشن‌های عمومی ----
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' }
  })
};

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeChips, setActiveChips] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const scrollEventFired = useRef(false);

  // اکنون total (تعداد کل رسپی‌ها) را نیز دریافت می‌کنیم
  const { recipes, loading, error, total } = useRecipes();
  const { trackEvent } = useAnalytics();
  const isLoading = loading;
  const isError = !!error;

  const navigate = useNavigate();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  // ردیابی اسکرول به انتهای صفحه
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
  }, [handleWindowScroll]);

  const fuse = useMemo(() => {
    if (!recipes || !recipes.length) return null;
    return new Fuse(recipes, {
      keys: ['title', 'ingredients.name', 'searchableTerms', 'excerpt'],
      threshold: 0.4, minMatchCharLength: 2,
    });
  }, [recipes]);

  const handleSearchChange = (value) => {
    setSearch(value);
    if (value.trim().length > 0 && fuse) {
      const results = fuse.search(value, { limit: 5 }).map(r => r.item);
      setSearchResults(results);
      setSearchOpen(true);
      trackEvent('search_query', { query: value, resultCount: results.length });
    } else {
      setSearchResults([]);
      setSearchOpen(false);
    }
  };

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
    if (!recipes) return [];
    let items = search && fuse ? fuse.search(search).map(r => r.item) : recipes;
    if (activeChips.includes('isQuick')) items = items.filter(r => r.isQuick);
    if (activeChips.includes('isHealthy')) items = items.filter(r => r.isHealthy);
    if (activeChips.includes('vegetarian')) items = items.filter(r => r.diet === 'vegetarian' || r.diet === 'vegan');
    if (activeChips.includes('persian')) items = items.filter(r => r.region === 'persian');
    return items;
  }, [search, recipes, activeChips, fuse]);

  const todaySpecial = useMemo(() => recipes && recipes.length ? recipes[Math.floor(Math.random() * recipes.length)] : null, [recipes]);

  // رنگ‌ها و سبک‌های واکنش‌گرا
  const textColor = dark ? '#ffffff' : '#1A237E';
  const bgGlass = dark ? 'rgba(40,40,45,0.65)' : 'rgba(255,255,255,0.65)';
  const cardShadow = dark ? '0 4px 12px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.06)';
  const accent = '#FF6B35';
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // تعداد دسته‌بندی‌های یکتا برای نمایش در آمار
  const uniqueCategoriesCount = useMemo(() => {
    if (!recipes) return 0;
    const cats = recipes.flatMap(r => r.categories || []);
    return new Set(cats).size;
  }, [recipes]);

  if (isLoading) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
        <Skeleton height={200} radius="xl" mb="md" />
        <Skeleton height={30} width="60%" mb="sm" />
        <SimpleGrid cols={2} spacing="sm">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height={200} radius="xl" />)}
        </SimpleGrid>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
        <Alert icon={<IconAlertCircle size={16} />} title="خطا در بارگذاری" color="red" radius="lg">
          {error?.message || 'متأسفانه در دریافت رسپی‌ها مشکلی پیش اومد. لطفاً صفحه رو دوباره بارگذاری کن.'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 120px' }}>
      {/* ===== هدر با آمار جذاب ===== */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        custom={0}
      >
        <Paper
          p="lg"
          radius="xl"
          mb="lg"
          style={{
            background: dark
              ? 'linear-gradient(135deg, #1e1e2f, #2a2a3c)'
              : 'linear-gradient(135deg, #ffffff, #f8f9ff)',
            boxShadow: cardShadow,
            border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'}`
          }}
        >
          <Group justify="space-between" align="center" mb="sm">
            <div>
              <Group gap="xs">
                <ThemeIcon variant="gradient" gradient={{ from: 'orange', to: 'red' }} size={36} radius="md">
                  <IconChefHat size={20} />
                </ThemeIcon>
                <Title order={4} c={textColor}>Garnish OS</Title>
              </Group>
              <Text size="xs" c="dimmed" mt={4}>دستیار هوشمند تغذیه و آشپزی شما</Text>
            </div>
            <Group gap="md">
              <div style={{ textAlign: 'center' }}>
                <Text fw={700} c={accent} size="lg">{total || 0}</Text>
                <Text size="xs" c="dimmed">رسپی</Text>
              </div>
              <div style={{ textAlign: 'center' }}>
                <Text fw={700} c="#1A237E" size="lg">{uniqueCategoriesCount}</Text>
                <Text size="xs" c="dimmed">دسته‌بندی</Text>
              </div>
            </Group>
          </Group>
        </Paper>
      </motion.div>

      {/* ===== اسلایدر بنر ===== */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Box mb={24} style={{ borderRadius: 20, overflow: 'hidden', boxShadow: cardShadow }}>
          <Swiper
            modules={[Autoplay, EffectFade]}
            effect="fade"
            autoplay={{ delay: 5000 }}
            loop
            style={{ borderRadius: 20 }}
            pagination={false}
          >
            {bannerSlides.map((slide, i) => (
              <SwiperSlide key={i}>
                <motion.div
                  whileHover={{ scale: 1.03 }}
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
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Text size={40} mb={8}>{slide.icon}</Text>
                  <Text size={18} fw={700} mb={4}>{slide.title}</Text>
                  <Text size={13} opacity={0.9}>{slide.subtitle}</Text>
                </motion.div>
              </SwiperSlide>
            ))}
          </Swiper>
        </Box>
      </motion.div>

      {/* ===== جستجوی هوشمند ===== */}
      <motion.div variants={fadeInUp} custom={1} initial="hidden" animate="visible">
        <Group gap="xs" mb="md">
          <Popover opened={searchOpen} onChange={setSearchOpen} width="target" position="bottom" shadow="md" style={{ flex: 1 }}>
            <Popover.Target>
              <Autocomplete
                placeholder="🔍  چی دوست داری بپزی؟"
                leftSection={<IconSearch size={18} />}
                radius="xl"
                size="md"
                value={search}
                onChange={handleSearchChange}
                onFocus={() => search.trim() && setSearchOpen(true)}
                styles={{
                  input: {
                    textAlign: 'right',
                    backgroundColor: dark ? 'rgba(30,30,40,0.8)' : 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`,
                    height: 48,
                    fontSize: 15,
                    borderRadius: 24,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    '&:focus': { borderColor: accent, boxShadow: `0 0 0 3px ${accent}40` },
                  },
                }}
              />
            </Popover.Target>
            {searchResults.length > 0 && (
              <Popover.Dropdown p={0}>
                <ScrollArea.Autosize mah={250}>
                  {searchResults.map((recipe) => (
                    <motion.div
                      key={recipe.id}
                      whileHover={{ backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,107,53,0.06)' }}
                      onClick={() => {
                        navigate(`/recipe/${recipe.id}`);
                        setSearchOpen(false);
                        setSearch('');
                        trackEvent('search_result_click', { recipeId: recipe.id });
                      }}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f0'
                      }}
                    >
                      <Text size="lg">🍽️</Text>
                      <div style={{ flex: 1 }}>
                        <Text size="sm" fw={500}>{recipe.title}</Text>
                        <Text size="xs" c="dimmed">
                          {(recipe.ingredients || []).slice(0, 2).map(i => typeof i === 'string' ? i : i.name || '').join('، ')}
                        </Text>
                      </div>
                      <Badge variant="light" color="orange" size="xs" radius="xl">{recipe.cook_time || ''}</Badge>
                    </motion.div>
                  ))}
                </ScrollArea.Autosize>
              </Popover.Dropdown>
            )}
          </Popover>
          <Tooltip label={voiceSupported ? 'جستجوی صوتی' : 'مرورگر شما پشتیبانی نمی‌کند'}>
            <ActionIcon
              variant={isListening ? 'filled' : 'light'}
              color={isListening ? 'red' : 'gray'}
              size={44} radius="xl"
              onClick={handleVoiceSearch}
              disabled={!voiceSupported}
              style={{ animation: isListening ? 'pulse 1.5s infinite' : 'none' }}
            >
              <IconMicrophone size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </motion.div>

      {/* ===== فیلتر چیپس ===== */}
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
                    style={{ cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s', padding: '6px 14px' }}
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

      {/* ===== غذای ویژه امروز ===== */}
      {todaySpecial && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          whileHover={{ y: -5 }}
        >
          <Paper
            shadow="md"
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
              border: `2px solid ${dark ? '#555' : accent}80`,
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
                  leftSection={<IconStars size={12} />}
                  radius="xl"
                >
                  پیشنهاد سرآشپز امروز
                </Badge>
                <Title order={3} c={dark ? '#fff' : '#1A237E'} mb="xs">{todaySpecial.title}</Title>
                <Text size="xs" c="dimmed" mb="md">
                  {todaySpecial.cook_time ? `⏱ ${todaySpecial.cook_time}` : ''}
                  {todaySpecial.difficulty ? `  •  📊 ${todaySpecial.difficulty}` : ''}
                </Text>
                <Button
                  variant="outline"
                  color="orange"
                  radius="xl"
                  size="sm"
                  rightSection={<IconArrowRight size={14} />}
                  onClick={(e) => { e.stopPropagation(); navigate(`/recipe/${todaySpecial.id}`); }}
                >
                  دیدن رسپی
                </Button>
              </div>
              <Text style={{ fontSize: 80, opacity: 0.08, transform: 'rotate(15deg)', position: 'absolute', top: 10, right: 20, pointerEvents: 'none' }}>🍽️</Text>
            </Group>
          </Paper>
        </motion.div>
      )}

      {/* ===== دسته‌بندی‌ها ===== */}
      <motion.div variants={fadeInUp} custom={3} initial="hidden" animate="visible">
        <Box mb="xl">
          <Group justify="space-between" mb="sm">
            <Title order={5} c={textColor}>📂 دسته‌بندی‌ها</Title>
          </Group>
          <SimpleGrid cols={3} spacing="sm" style={{ alignItems: 'start' }}>
            {TOP_CATEGORIES.map((cat, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5, boxShadow: '0 8px 20px rgba(0,0,0,0.12)' }}
                whileTap={{ scale: 0.96 }}
                onClick={() => { navigate(`/category/${cat}`); trackEvent('category_click', { category: cat }); }}
                style={{
                  background: dark ? 'rgba(30,30,40,0.7)' : 'rgba(255,255,255,0.75)',
                  backdropFilter: 'blur(12px)',
                  borderRadius: 18,
                  padding: '16px 4px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  boxShadow: cardShadow,
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
              >
                <Text size={30} style={{ lineHeight: 1.2 }}>{CATEGORY_EMOJIS[cat] || '🍽️'}</Text>
                <Text size="xs" fw={600} c={dark ? 'gray.3' : 'dark.7'}
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {cat}
                </Text>
              </motion.div>
            ))}
          </SimpleGrid>
        </Box>
      </motion.div>

      {/* ===== دستیار هوش مصنوعی ===== */}
      <motion.div
        whileHover={{ scale: 1.02, boxShadow: '0 8px 25px rgba(255,107,53,0.4)' }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
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
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
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

      {/* ===== بخش رسپی‌های منتخب ===== */}
      <motion.div variants={fadeInUp} custom={4} initial="hidden" animate="visible">
        <Title order={5} mb="sm" c={textColor}>🍽️ امروز چی بپزم؟</Title>
        <SimpleGrid cols={2} spacing="sm" mb="xl">
          {recipes.slice(0, 4).map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </SimpleGrid>
      </motion.div>

      <SectionSlider title="🔥 پرطرفدارها" recipes={recipes.slice(0, 8)} />
      <SectionSlider title="⚡ سریع و آسان" recipes={recipes.filter(r => r.isQuick).slice(0, 8)} />
      <SectionSlider title="🇮🇷 ایرانی اصیل" recipes={recipes.filter(r => r.region === 'persian').slice(0, 8)} />

      {/* ===== مشاهده همه رسپی‌ها ===== */}
      <motion.div variants={fadeInUp} custom={5} initial="hidden" animate="visible">
        <Group justify="space-between" mb="sm" mt="xl">
          <Title order={5} c={textColor}>📋 همه رسپی‌ها</Title>
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconChevronLeft size={14} />}
            onClick={() => { navigate('/recipes'); trackEvent('view_all_recipes_click'); }}
          >
            مشاهده همه
          </Button>
        </Group>
        <SimpleGrid cols={2} spacing="sm" mb="lg">
          {filteredRecipes.slice(0, 6).map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </SimpleGrid>

        {/* دکمه بزرگ با تعداد کل رسپی‌ها (اصلاح شده) */}
        {total > 6 && (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="gradient"
              gradient={{ from: 'orange', to: 'red' }}
              fullWidth
              size="lg"
              radius="xl"
              onClick={() => { navigate('/recipes'); trackEvent('view_all_recipes_click'); }}
              rightSection={<IconArrowRight size={20} />}
              styles={{ root: { height: 52, fontSize: 16, boxShadow: '0 6px 15px rgba(255,107,53,0.4)' } }}
            >
              مشاهده همه رسپی‌ها ({total} رسپی)
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* دکمه بازگشت به بالا */}
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