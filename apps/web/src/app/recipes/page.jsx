import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IconChevronRight, IconChevronLeft, IconChefHat } from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import { faDuration, faDifficulty, recipeDurationMinutes, toFaDigits } from '../../components/ges/format';
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

function pageWindow(page, totalPages) {
  const pages = [];
  const start = Math.max(1, page - 1);
  const end = Math.min(totalPages, page + 1);
  if (start > 1) pages.push(1);
  if (start > 2) pages.push('gap-start');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < totalPages - 1) pages.push('gap-end');
  if (end < totalPages) pages.push(totalPages);
  return pages;
}

export default function RecipesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const meal = searchParams.get('meal') || '';
  const category = searchParams.get('category') || '';
  const title = searchParams.get('title') || '';
  const q = useQuery({
    queryKey: ['recipes', 'all', page, meal, category],
    queryFn: () => apiClient.get('/recipes', { params: { page, limit: PAGE_SIZE, meal: meal || undefined, category: category || undefined } }).then((r) => r.data),
  });

  const list = Array.isArray(q.data?.data) ? q.data.data : Array.isArray(q.data) ? q.data : [];
  const total = Number.isFinite(Number(q.data?.total)) ? Number(q.data.total) : null;
  const totalPages = total ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : page;
  const hasNext = total ? page < totalPages : list.length >= PAGE_SIZE; // a full page → there may be more
  const pages = useMemo(() => pageWindow(page, totalPages), [page, totalPages]);
  const from = total && list.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = total && list.length ? Math.min(total, (page - 1) * PAGE_SIZE + list.length) : list.length;
  const openRecipe = (id) => { if (id) navigate(`/recipe/${id}`); };

  useEffect(() => {
    if (total && page > totalPages) setPage(totalPages);
  }, [page, total, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [meal, category]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) return;
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // jsdom does not implement scrollTo; browsers do.
    }
  }, [page]);

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-6)' }}>
      <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>{title || 'رسپی‌ها'}</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '2px 0 var(--g-space-4)' }}>{total ? `نمایش ${toFaDigits(from)} تا ${toFaDigits(to)} از ${toFaDigits(total)} دستور` : 'همهٔ دستورها، مرتب‌شده بر پایهٔ محبوبیت و استفاده'}</Text>

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
          <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--g-space-3)', opacity: q.isFetching ? 0.72 : 1, transition: 'opacity 160ms var(--g-ease-standard)' }}>
            {list.map((r) => (
              <RecipeCard
                key={r.id}
                compact
                title={r.title}
                imageUrl={r.imageUrl}
                placeholderSeed={stableSeed(r.id)}
                cookTimeText={faDuration(recipeDurationMinutes(r))}
                difficultyText={faDifficulty(r.difficulty)}
                onOpen={() => openRecipe(r.id)}
              />
            ))}
          </Box>

          {(page > 1 || hasNext) ? (
            <Box aria-label="صفحه‌بندی رسپی‌ها" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-5)' }}>
              <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-1)', inlineSize: '100%' }}>
                <UnstyledButton type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || q.isFetching} aria-label="صفحهٔ قبل" style={{ flexShrink: 0, inlineSize: 42, blockSize: 42, borderRadius: '50%', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: page === 1 ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconChevronRight size={18} stroke={1.8} aria-hidden="true" />
                </UnstyledButton>
                <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minInlineSize: 0 }}>
                  {pages.map((p) => (typeof p === 'string' ? (
                    <Text key={p} component="span" style={{ inlineSize: 24, textAlign: 'center', color: 'var(--g-color-text-muted)', fontWeight: 800 }}>…</Text>
                  ) : (
                    <UnstyledButton key={p} type="button" onClick={() => setPage(p)} disabled={q.isFetching || p === page} aria-label={`صفحهٔ ${toFaDigits(p)}`} aria-current={p === page ? 'page' : undefined} style={{ inlineSize: 36, blockSize: 36, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: p === page ? '1px solid var(--g-color-brand-600)' : '1px solid var(--g-color-border-subtle)', background: p === page ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-surface)', color: p === page ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-primary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 800 }}>
                      {toFaDigits(p)}
                    </UnstyledButton>
                  )))}
                </Box>
                <UnstyledButton type="button" onClick={() => setPage((p) => p + 1)} disabled={!hasNext || q.isFetching} aria-label="صفحهٔ بعد" style={{ flexShrink: 0, inlineSize: 42, blockSize: 42, borderRadius: '50%', border: '1px solid var(--g-color-border-strong)', background: 'var(--g-color-bg-surface)', color: !hasNext ? 'var(--g-color-text-muted)' : 'var(--g-color-text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" />
                </UnstyledButton>
              </Box>
              <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700, color: 'var(--g-color-text-muted)' }}>
                صفحهٔ {toFaDigits(page)}{total ? ` از ${toFaDigits(totalPages)}` : ''}
              </Text>
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}
