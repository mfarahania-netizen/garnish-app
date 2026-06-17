import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconChevronRight, IconChevronLeft, IconChefHat } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import { faDuration, faDifficulty, toFaDigits } from '../../components/ges/format';
import RecipeCard from '../../components/ges/RecipeCard';
import ErrorState from '../../components/ges/ErrorState';
import EmptyState from '../../components/ges/EmptyState';

/**
 * RecipesPage — «رسپی‌ها»: the full recipe catalogue (GET /recipes), paginated. A simple 2-col grid of
 * compact RecipeCards that open the recipe detail. Server-paged via the endpoint's real page/limit params
 * (next is offered while a full page comes back; honest — no fabricated total). Renders inside the app
 * shell (TopBar back + BottomNav). Token-pure, RTL.
 */
const PAGE_SIZE = 24;
const stableSeed = (id) => { let s = 0; for (const c of String(id ?? '')) s += c.charCodeAt(0); return s % 6; };

export default function RecipesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['recipes', 'all', page],
    queryFn: () => apiClient.get('/recipes', { params: { page, limit: PAGE_SIZE } }).then((r) => r.data),
  });

  const list = Array.isArray(q.data?.data) ? q.data.data : Array.isArray(q.data) ? q.data : [];
  const hasNext = list.length >= PAGE_SIZE; // a full page → there may be more
  const openRecipe = (id) => { if (id) navigate(`/recipe/${id}`); };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-6)' }}>
      <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>رسپی‌ها</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '2px 0 var(--g-space-4)' }}>همهٔ دستورها</Text>

      {q.isLoading ? (
        <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--g-space-3)' }}>
          {Array.from({ length: 6 }).map((_, i) => <Box key={i} className="g-skeleton" style={{ blockSize: 184, borderRadius: 'var(--g-radius-card)' }} />)}
        </Box>
      ) : q.isError ? (
        <ErrorState title="رسپی‌ها بارگذاری نشد" body="یک اتصال کوتاه قطع شد. دوباره تلاش کن." reassurance="چیزی از دست نرفته" onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={IconChefHat} title="فعلاً دستوری نیست" body="به‌زودی دستورهای بیشتری اضافه می‌شود." />
      ) : (
        <>
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--g-space-3)' }}>
            {list.map((r) => (
              <RecipeCard
                key={r.id}
                compact
                title={r.title}
                placeholderSeed={stableSeed(r.id)}
                cookTimeText={faDuration(r.cookingTime)}
                difficultyText={faDifficulty(r.difficulty)}
                onOpen={() => openRecipe(r.id)}
              />
            ))}
          </Box>

          {(page > 1 || hasNext) ? (
            <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-5)' }}>
              <UnstyledButton type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="صفحهٔ قبل" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: page === 1 ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>
                <IconChevronRight size={16} stroke={1.8} aria-hidden="true" />قبلی
              </UnstyledButton>
              <Text component="span" style={{ minInlineSize: 64, textAlign: 'center', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-secondary)' }}>صفحهٔ {toFaDigits(page)}</Text>
              <UnstyledButton type="button" onClick={() => setPage((p) => p + 1)} disabled={!hasNext} aria-label="صفحهٔ بعد" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-input)', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: !hasNext ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600 }}>
                بعدی<IconChevronLeft size={16} stroke={1.8} aria-hidden="true" />
              </UnstyledButton>
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}
