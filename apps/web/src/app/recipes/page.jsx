import { useState, useRef, useCallback } from 'react';
import { Container, Title, SimpleGrid, Text, Box, Group, ActionIcon, Pagination, Center, ScrollArea } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useRecipes } from '../../hooks/useRecipes';
import { useAnalytics } from '../../hooks/useAnalytics';
import apiClient from '../../lib/apiClient';
import RecipeCard from '../../components/RecipeCard';
import {
  TextField, Chip, SectionHeader, EmptyState, ErrorState, LoadingSkeleton, Button,
} from '../../components/ges';
import { IconArrowUp, IconChefHat, IconSparkles } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { withReducedMotion, riseIn } from '../../lib/motion';

const BROWSE_CATEGORIES = ['کباب', 'خورشت', 'پلو', 'آش', 'سالاد', 'دسر', 'نوشیدنی', 'غذای ساده و فوری'];

// Adapt a raw /recipes/search result to the RecipeCard display shape.
const toCard = (r) => ({
  ...r,
  foodType: r.foodType || r.category || '',
  cook_time: r.cook_time || (r.cookingTime ? String(r.cookingTime) : ''),
});

export default function RecipesPage() {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { recipes, loading, error, total, currentPage, totalPages, changePage } = useRecipes();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);     // null = browse mode; [] = searched (maybe empty)
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const timer = useRef(null);

  const runSearch = useCallback((value) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setResults(null);
      setSearchError(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const { data } = await apiClient.get(`/recipes/search?q=${encodeURIComponent(q)}&limit=24`);
        setResults(Array.isArray(data) ? data : []);
        setSearchError(false);
        trackEvent('search_query', { query: q, resultCount: Array.isArray(data) ? data.length : 0, surface: 'discovery' });
      } catch {
        setSearchError(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [trackEvent]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const isSearchMode = results !== null;
  const hasQuery = query.trim().length >= 2;

  return (
    <Container size="sm" style={{ maxWidth: 480, margin: '0 auto', padding: '0 12px 100px' }}>
      <Box mb="md" mt="xs">
        <Group gap="xs" align="center">
          <IconChefHat size={26} color="var(--g-color-food-saffron)" aria-hidden="true" />
          <Title order={4} c="var(--g-color-text-primary)">کاوش رسپی‌ها</Title>
        </Group>
      </Box>

      {/* جستجو — کیت GES */}
      <Box mb="lg">
        <TextField
          type="search"
          ariaLabel="جستجوی رسپی"
          placeholder="دنبال چی می‌گردی؟ (مثلاً «خورش سریع»)"
          value={query}
          onChange={runSearch}
        />
      </Box>

      {/* ── حالت کاوش (بدون جستجو): ردیف دسته‌بندی + ریل ── */}
      {!isSearchMode && (
        <>
          <Box mb="lg">
            <SectionHeader as="h2" title="دسته‌بندی‌ها" />
            <ScrollArea type="never" mt="var(--g-space-3)">
              <Group gap="xs" wrap="nowrap">
                {BROWSE_CATEGORIES.map((cat) => (
                  <Chip key={cat} variant="category" label={cat}
                    onClick={() => { navigate(`/category/${cat}`); trackEvent('category_click', { category: cat, surface: 'discovery' }); }} />
                ))}
              </Group>
            </ScrollArea>
          </Box>

          {loading ? (
            <LoadingSkeleton shape="list" lines={4} label="در حال بارگذاری رسپی‌ها" />
          ) : error ? (
            <ErrorState title="خطا در بارگذاری" message="مشکلی در دریافت رسپی‌ها پیش آمد." retryLabel="تلاش دوباره" onRetry={() => window.location.reload()} />
          ) : !recipes || recipes.length === 0 ? (
            <EmptyState title="هنوز رسپی‌ای نیست" message="به‌زودی رسپی‌های تازه اینجا ظاهر می‌شوند." actionLabel="پرسیدن از دستیار" onAction={() => navigate('/ai-chat')} />
          ) : (
            <>
              <SectionHeader as="h2" title="همهٔ رسپی‌ها" subtitle={`${total} رسپی · صفحه ${currentPage} از ${totalPages}`} />
              <SimpleGrid cols={2} spacing="sm" mt="var(--g-space-3)">
                {recipes.map((recipe, index) => (
                  <motion.div key={recipe.id} variants={withReducedMotion(riseIn)} initial="initial" animate="animate" transition={{ delay: Math.min(index, 6) * 0.04 }}>
                    <RecipeCard recipe={recipe} onClick={() => { trackEvent('recipe_view', { recipeId: recipe.id, surface: 'discovery' }); navigate(`/recipe/${recipe.id}`); }} />
                  </motion.div>
                ))}
              </SimpleGrid>
              {totalPages > 1 && (
                <Center mt="xl">
                  <Pagination total={totalPages} value={currentPage} onChange={changePage} radius="xl" color="saffron" size="sm" siblings={1} />
                </Center>
              )}
            </>
          )}
        </>
      )}

      {/* ── حالت جستجو ── */}
      {isSearchMode && (
        <>
          {searching ? (
            <LoadingSkeleton shape="list" lines={4} label="در حال جستجو" />
          ) : searchError ? (
            <ErrorState title="خطا در جستجو" message="جستجو با مشکل مواجه شد. چیزی از دست نرفت — دوباره امتحان کن." retryLabel="تلاش دوباره" onRetry={() => runSearch(query)} />
          ) : results.length === 0 && hasQuery ? (
            // unmetSearch — captured-intent moment (honest, no fabrication)
            <EmptyState
              icon={<IconSparkles size={28} stroke={1.5} aria-hidden="true" />}
              title={`«${query.trim()}» را پیدا نکردیم`}
              message="هنوز رسپی‌ای برای این جستجو نداریم. می‌تونی از دستیار بخوای، یا دسته‌بندی‌ها رو ببینی."
              actionLabel="از دستیار بپرس"
              onAction={() => { trackEvent('unmet_search_to_ai', { query: query.trim() }); navigate('/ai-chat'); }}
            />
          ) : (
            <>
              <SectionHeader as="h2" title="نتایج جستجو" subtitle={`${results.length} رسپی برای «${query.trim()}»`} />
              <SimpleGrid cols={2} spacing="sm" mt="var(--g-space-3)">
                {results.map((raw) => {
                  const recipe = toCard(raw);
                  const why = (raw._search?.matchedTerms || []).slice(0, 3).join('، ');
                  return (
                    <Box key={recipe.id}>
                      <RecipeCard recipe={recipe} onClick={() => { trackEvent('search_result_click', { recipeId: recipe.id, surface: 'discovery' }); navigate(`/recipe/${recipe.id}`); }} />
                      {why && (
                        <Text size="xs" mt={4} style={{ color: 'var(--g-color-text-muted)', textAlign: 'start', lineHeight: 'var(--g-leading-body)' }}>
                          چون: {why}
                        </Text>
                      )}
                    </Box>
                  );
                })}
              </SimpleGrid>
              <Center mt="lg">
                <Button variant="ghost" onClick={() => { setQuery(''); setResults(null); }}>پاک کردن جستجو</Button>
              </Center>
            </>
          )}
        </>
      )}

      <ActionIcon variant="filled" color="saffron" size="xl" radius="xl"
        style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 'var(--g-z-sticky)', boxShadow: 'var(--g-shadow-2)' }}
        onClick={scrollToTop} aria-label="برگشت به بالا">
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
