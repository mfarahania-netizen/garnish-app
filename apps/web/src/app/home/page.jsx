// src/app/home/page.jsx
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Container, Title, Text, SimpleGrid,
  Group, Box,
  Popover, ScrollArea, ActionIcon, Tooltip,
  Autocomplete
} from '@mantine/core';
import {
  IconSearch, IconRobot,
  IconMicrophone, IconArrowUp,
  IconSparkles, IconChefHat, IconArrowRight
} from '@tabler/icons-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useRecipes } from '../../hooks/useRecipes';
import { useAnalytics } from '../../hooks/useAnalytics';
import apiClient from '../../lib/apiClient';
import RecipeCard from '../../components/RecipeCard';
import {
  CardShell, SectionHeader, Button,
  LoadingSkeleton, ErrorState, EmptyState,
  FoodDnaRing, GamificationStrip, AIWhisper, Chip,
} from '../../components/ges';
import { riseIn, gentleFade, pressResponse, withReducedMotion } from '../../lib/motion';

// GES hero banners use a soft saffron-ramp gradient (light stops) with dark
// brand-900 foreground text. The brand ramp is theme-independent, so pairing it
// with the (theme-flipping) --g-color-text-inverse token would fail WCAG AA in
// light mode; brand-900 on brand-100→300 stays ≥5.6:1 in BOTH light and dark.
const bannerSlides = [
  {
    bg: 'linear-gradient(135deg, var(--g-color-brand-100), var(--g-color-brand-300))',
    title: 'با مواد ساده غذاهای عالی بپز',
    subtitle: 'مواد داخل یخچالت رو وارد کن تا معجزه ببینی',
    icon: '🥘',
    action: '/ai-chat'
  },
  {
    bg: 'linear-gradient(135deg, var(--g-color-brand-200), var(--g-color-brand-300))',
    title: 'دستور پخت‌های جدید هر هفته',
    subtitle: 'هر هفته ۱۰ رسپی جدید و خوشمزه',
    icon: '🔥',
    action: '/recipes'
  },
];

const FILTER_CHIPS = [
  { label: 'سریع', key: 'isQuick' },
  { label: 'سالم', key: 'isHealthy' },
  { label: 'گیاهی', key: 'vegetarian' },
  { label: 'ایرانی', key: 'persian' },
];

// Two category rows (the approved Home structure): dish-type + lighter fare.
const CATEGORY_ROW_PRIMARY = ['کباب', 'خورشت', 'پلو', 'آش', 'دلمه'];
const CATEGORY_ROW_SECONDARY = ['سالاد', 'دسر', 'نوشیدنی', 'غذای ساده و فوری'];

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
  // GES Home: real personal signals (token-gated, honest-null if absent)
  const [dnaBand, setDnaBand] = useState(null);          // profile.maturity.band
  const [gami, setGami] = useState(null);                // /gamification/me
  const [whisperDismissed, setWhisperDismissed] = useState(false);
  const scrollEventFired = useRef(false);
  const searchTimer = useRef(null);

  const { recipes, loading, error, total } = useRecipes();
  const { trackEvent } = useAnalytics();
  const isLoading = loading;
  const isError = !!error;

  const navigate = useNavigate();

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

  // دریافت پیشنهادهای شخصی‌سازی‌شده + سیگنال‌های شخصی (فقط در صورت وجود توکن)
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
    // Food DNA maturity (real band) + private gamification progress — both best-effort.
    const fetchProfileBand = async () => {
      try {
        const { data } = await apiClient.get('/profile');
        setDnaBand(data?.maturity?.band ?? null);
      } catch { /* honest-null: section hidden when unavailable */ }
    };
    const fetchGamification = async () => {
      try {
        const { data } = await apiClient.get('/gamification/me');
        setGami(data ?? null);
      } catch { /* honest-null */ }
    };
    fetchRecommendations();
    fetchProfileBand();
    fetchGamification();
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

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const onKeyActivate = (fn) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
  };

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

  // The top personal pick surfaced as an honest in-context AI whisper (disclosed).
  const whisperPick = useMemo(() => {
    if (!recommendations?.length) return null;
    const r = recommendations[0];
    return { ...r, id: r.recipeId || r.id, reason: r.why || r.reason || '' };
  }, [recommendations]);

  // ── State: loading ──
  if (isLoading) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
        <Box mb="md"><LoadingSkeleton shape="media" label="در حال بارگذاری" /></Box>
        <LoadingSkeleton shape="list" lines={3} label="در حال بارگذاری رسپی‌ها" />
      </Container>
    );
  }

  // ── State: error ──
  if (isError) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
        <ErrorState
          variant="section"
          title="خطا در بارگذاری"
          message={error?.message || 'متأسفانه در دریافت رسپی‌ها مشکلی پیش اومد.'}
          retryLabel="تلاش دوباره"
          onRetry={() => window.location.reload()}
        />
      </Container>
    );
  }

  // ── State: empty (no recipes at all) ──
  if (!recipes || recipes.length === 0) {
    return (
      <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
        <EmptyState
          title="هنوز رسپی‌ای نیست"
          message="به‌زودی رسپی‌های تازه اینجا ظاهر می‌شوند. می‌توانی از دستیار هوش مصنوعی شروع کنی."
          actionLabel="پرسیدن از دستیار"
          onAction={() => navigate('/ai-chat')}
        />
      </Container>
    );
  }

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 120px' }}>
      {/* هدر + سلام */}
      <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate" style={{ marginBottom: 'var(--g-space-5)', marginTop: 'var(--g-space-2)' }}>
        <Group justify="space-between" align="center">
          <div>
            <Group gap={8}>
              <IconChefHat size={28} color="var(--g-color-brand-600)" />
              <Title order={3} c="var(--g-color-text-primary)" style={{ fontWeight: 800, letterSpacing: '-0.5px' }}>Garnish OS</Title>
            </Group>
            <Text size="sm" c="var(--g-color-text-secondary)">امروز چی دوست داری بپزی؟</Text>
          </div>
        </Group>
      </motion.div>

      {/* Food DNA + پیشرفت شخصی (داده‌های واقعی، فقط برای کاربر واردشده) */}
      {(dnaBand || gami) && (
        <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate" style={{ marginBottom: 'var(--g-space-5)' }}>
          <CardShell>
            <Group justify="space-between" align="center" wrap="nowrap" style={{ gap: 'var(--g-space-4)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <SectionHeader as="h2" title="ذائقهٔ غذایی تو" subtitle="هرچه بیشتر بپزی و انتخاب کنی، پیشنهادها دقیق‌تر می‌شوند." />
                {gami && (
                  <Box mt="var(--g-space-3)">
                    <GamificationStrip
                      streakDays={gami?.streak?.currentWeeks ?? 0}
                      streakState={(gami?.streak?.currentWeeks ?? 0) > 0 ? 'active' : 'broken'}
                      streakLabelSingular="هفته پشت‌سرهم"
                      streakLabelPlural="هفته پشت‌سرهم"
                      restartLabel="شروع تازه — هر وقت خواستی"
                      achievement={gami?.achievements?.allEarned?.[0]?.title ? { label: gami.achievements.allEarned[0].title } : null}
                    />
                  </Box>
                )}
              </div>
              {dnaBand && <FoodDnaRing band={dnaBand} size={108} label="ذائقهٔ تو" />}
            </Group>
          </CardShell>
        </motion.div>
      )}

      {/* بنر اسلایدر */}
      <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate">
        <Box mb={24} style={{ borderRadius: 'var(--g-radius-card)', overflow: 'hidden', boxShadow: 'var(--g-shadow-2)' }}>
          <Swiper
            modules={[Autoplay]}
            autoplay={{ delay: 5000 }}
            style={{ borderRadius: 'var(--g-radius-card)', backgroundColor: 'var(--g-color-bg-surface)' }}
          >
            {bannerSlides.map((slide) => (
              <SwiperSlide key={slide.action}>
                <motion.div
                  {...pressResponse}
                  role="button"
                  tabIndex={0}
                  aria-label={slide.title}
                  onClick={() => { navigate(slide.action); trackEvent('banner_click', { action: slide.action }); }}
                  onKeyDown={onKeyActivate(() => { navigate(slide.action); trackEvent('banner_click', { action: slide.action }); })}
                  style={{
                    background: slide.bg,
                    height: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--g-color-brand-900)',
                    textAlign: 'center',
                    padding: '16px 24px',
                    cursor: 'pointer'
                  }}
                >
                  <Text size={48} mb={12}>{slide.icon}</Text>
                  <Text size={20} fw={800} mb={6}>{slide.title}</Text>
                  <Text size={14}>{slide.subtitle}</Text>
                </motion.div>
              </SwiperSlide>
            ))}
          </Swiper>
        </Box>
      </motion.div>

      {/* جستجوی سرور-محور */}
      <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate">
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
                    backgroundColor: 'var(--g-color-bg-surface)',
                    border: '1px solid var(--g-color-border-subtle)',
                    height: 52,
                    fontSize: 16,
                    borderRadius: 'var(--g-radius-chip)',
                    '&:focus': { borderColor: 'var(--g-color-brand-600)', boxShadow: 'var(--g-focus-ring)' },
                  },
                }}
              />
            </Popover.Target>
            {filteredSearchResults.length > 0 && (
              <Popover.Dropdown p={0} style={{ borderRadius: 'var(--g-radius-card)', overflow: 'hidden' }}>
                <ScrollArea.Autosize mah={250}>
                  {filteredSearchResults.map((recipe) => (
                    <motion.div key={recipe.id}
                      {...pressResponse}
                      onClick={() => {
                        navigate(`/recipe/${recipe.id}`);
                        setSearchOpen(false);
                        setSearch('');
                        trackEvent('search_result_click', { recipeId: recipe.id });
                      }}
                      style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                    >
                      <IconChefHat size={18} color="var(--g-color-food-saffron)" aria-hidden="true" />
                      <div style={{ flex: 1 }}>
                        <Text size="sm" fw={600}>{recipe.title}</Text>
                        <Text size="xs" c="var(--g-color-text-muted)">
                          {(recipe._search?.matchedTerms || []).slice(0, 3).join('، ')}
                        </Text>
                      </div>
                    </motion.div>
                  ))}
                </ScrollArea.Autosize>
              </Popover.Dropdown>
            )}
          </Popover>
          <Tooltip label={voiceSupported ? 'جستجوی صوتی' : 'مرورگر شما پشتیبانی نمی‌کند'}>
            <ActionIcon variant="light" color="gray" size={52} radius="xl"
              onClick={handleVoiceSearch} disabled={!voiceSupported}
              style={{ border: '1px solid var(--g-color-border-subtle)' }}
            >
              <IconMicrophone size={22} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </motion.div>

      {/* فیلتر چیپس — از کیت GES */}
      <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate">
        <ScrollArea type="never" mb="lg">
          <Group gap="xs" wrap="nowrap">
            {FILTER_CHIPS.map(chip => {
              const isActive = activeChips.includes(chip.key);
              return (
                <Chip
                  key={chip.key}
                  label={chip.label}
                  selected={isActive}
                  onClick={() => handleFilterToggle(chip.key, isActive)}
                />
              );
            })}
          </Group>
        </ScrollArea>
      </motion.div>

      {/* پیشنهاد هوش مصنوعی برای امشب — AI Whisper (افشای شفاف) */}
      {whisperPick && !whisperDismissed && (
        <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate" style={{ marginBottom: 'var(--g-space-5)' }}>
          <AIWhisper
            text={`برای امشب: ${whisperPick.title || 'یک پیشنهاد تازه'}`}
            reason={whisperPick.reason || 'بر اساس انتخاب‌های اخیر تو'}
            acceptLabel="ببین"
            dismissLabel="نه الان"
            onAccept={() => { navigate(`/recipe/${whisperPick.id}`); trackEvent('recommendation_click', { recipeId: whisperPick.id, surface: 'home_whisper' }); }}
            onDismiss={() => { setWhisperDismissed(true); trackEvent('whisper_dismissed', { surface: 'home' }); }}
          />
        </motion.div>
      )}

      {/* غذای ویژه امروز */}
      {todaySpecial && (
        <motion.div
          variants={withReducedMotion(riseIn)} initial="initial" animate="animate" {...pressResponse}
          onClick={() => { navigate(`/recipe/${todaySpecial.id}`); trackEvent('today_special_click', { recipeId: todaySpecial.id }); }}
          style={{ marginBottom: 'var(--g-space-5)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
        >
          <CardShell>
            <SectionHeader as="h2" title="پیشنهاد سرآشپز امروز" subtitle={todaySpecial.title} />
            <Group mt="var(--g-space-3)" gap="var(--g-space-3)" align="center">
              <Text size="xs" c="var(--g-color-text-secondary)">
                {todaySpecial.cook_time ? `⏱ ${todaySpecial.cook_time}` : ''}
                {todaySpecial.difficulty ? `  •  ${todaySpecial.difficulty}` : ''}
              </Text>
              <Button
                variant="secondary"
                leftIcon={<IconArrowRight size={16} />}
                onClick={(e) => { e.stopPropagation(); navigate(`/recipe/${todaySpecial.id}`); }}
              >
                دیدن رسپی
              </Button>
            </Group>
          </CardShell>
        </motion.div>
      )}

      {/* برای تو امشب — پیشنهادهای شخصی‌سازی‌شده */}
      {!recsLoading && recommendations.length > 0 && (
        <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate" style={{ marginBottom: 'var(--g-space-5)' }}>
          <SectionHeader as="h2" title="برای تو امشب" />
          <SimpleGrid cols={1} spacing="sm" mt="var(--g-space-3)">
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
        </motion.div>
      )}

      {/* دو ردیف دسته‌بندی (Chip) */}
      <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate">
        <Box mb="xl">
          <SectionHeader as="h2" title="دسته‌بندی غذاها" />
          <ScrollArea type="never" mt="var(--g-space-3)" mb="var(--g-space-2)">
            <Group gap="xs" wrap="nowrap">
              {CATEGORY_ROW_PRIMARY.map((cat) => (
                <Chip key={cat} variant="category" label={cat}
                  onClick={() => { navigate(`/category/${cat}`); trackEvent('category_click', { category: cat }); }} />
              ))}
            </Group>
          </ScrollArea>
          <ScrollArea type="never">
            <Group gap="xs" wrap="nowrap">
              {CATEGORY_ROW_SECONDARY.map((cat) => (
                <Chip key={cat} variant="category" label={cat}
                  onClick={() => { navigate(`/category/${cat}`); trackEvent('category_click', { category: cat }); }} />
              ))}
            </Group>
          </ScrollArea>
        </Box>
      </motion.div>

      {/* هوش مصنوعی — ورودی گفتگو */}
      <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate" {...pressResponse}>
        <Box
          mb="xl"
          role="button"
          tabIndex={0}
          aria-label="با مواد یخچال چی بپزم؟ — دستیار هوش مصنوعی"
          onClick={() => { navigate('/ai-chat'); trackEvent('ai_chat_button_click'); }}
          onKeyDown={onKeyActivate(() => { navigate('/ai-chat'); trackEvent('ai_chat_button_click'); })}
          style={{
            background: 'var(--g-color-ai-surface)',
            border: 'var(--g-border-ai)',
            borderRadius: 'var(--g-radius-card)',
            boxShadow: 'var(--g-shadow-1)',
            padding: 'var(--g-space-5)',
            cursor: 'pointer',
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <div>
              <Group gap="xs" mb={6}>
                <IconSparkles size={24} color="var(--g-color-brand-600)" />
                <Text fw={700} size="lg" c="var(--g-color-text-primary)">با مواد یخچال چی بپزم؟</Text>
              </Group>
              <Text size="sm" c="var(--g-color-text-secondary)">از دستیار هوش مصنوعی بپرس…</Text>
            </div>
            <IconRobot size={56} color="var(--g-color-brand-600)" opacity={0.9} />
          </Group>
        </Box>
      </motion.div>

      {/* ریل رسپی‌ها با تب */}
      <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate">
        <Group mb="md" gap="xs">
          {[
            { key: 'all', label: 'همه رسپی‌ها' },
            { key: 'quick', label: 'سریع و آسان' },
            { key: 'popular', label: 'پرطرفدارها' },
          ].map(tab => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? 'primary' : 'ghost'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </Group>
        {tabRecipes.length === 0 ? (
          <EmptyState
            title="رسپی‌ای پیدا نشد"
            message="با این فیلترها رسپی‌ای پیدا نشد. فیلترها را تغییر بده یا پاک کن."
            actionLabel="پاک کردن فیلترها"
            onAction={() => { setActiveChips([]); setActiveTab('all'); }}
          />
        ) : (
          <SimpleGrid cols={2} spacing="sm" mb="lg">
            {tabRecipes.slice(0, 6).map(recipe => (
              <RecipeCard key={recipe.id} recipe={recipe} onClick={() => { navigate(`/recipe/${recipe.id}`); trackEvent('recipe_view', { recipeId: recipe.id }); }} />
            ))}
          </SimpleGrid>
        )}
        {total > 6 && (
          <Button
            variant="primary"
            fullWidth
            leftIcon={<IconArrowRight size={20} />}
            onClick={() => { navigate('/recipes'); trackEvent('view_all_recipes_click'); }}
          >
            مشاهده همه رسپی‌ها ({total} رسپی)
          </Button>
        )}
      </motion.div>

      {/* دکمه اسکرول به بالا */}
      <AnimatePresence>
        <motion.div
          variants={withReducedMotion(gentleFade)}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ position: 'fixed', bottom: 100, right: 16, zIndex: 'var(--g-z-sticky)' }}
        >
          <ActionIcon
            variant="filled"
            color="saffron"
            size="xl"
            radius="xl"
            style={{ boxShadow: 'var(--g-shadow-2)' }}
            onClick={scrollToTop}
            aria-label="برگشت به بالا"
          >
            <IconArrowUp size={22} />
          </ActionIcon>
        </motion.div>
      </AnimatePresence>
    </Container>
  );
}
