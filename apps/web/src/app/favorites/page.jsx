import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconBookmark, IconBookmarkOff, IconBookmarkPlus, IconCompass, IconCloudOff, IconRefresh } from '@tabler/icons-react';
import { useFavorites } from './useFavorites';
import { toFaDigits } from '../../components/ges/format';
import RecipeCard from '../../components/ges/RecipeCard';
import { useDismissRecommendation } from '../../hooks/useDismissRecommendation';
import { SkeletonCard } from '../../components/ges/LoadingSkeleton';
import Toast from '../../components/ges/Toast';

const PAGE = { display: 'flex', flexDirection: 'column', minBlockSize: '70dvh' };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--g-space-3)' };

function FavLoading() {
  return (
    <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ padding: 'var(--g-space-4)' }}>
      <Box style={grid2}><SkeletonCard /><SkeletonCard /></Box>
    </Box>
  );
}

function FavError({ onRetry }) {
  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', paddingInline: 'var(--g-space-6)', paddingBlock: 'var(--g-space-8)', gap: 'var(--g-space-2)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 56, blockSize: 56, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-state-info-bg)', color: 'var(--g-color-text-secondary)', marginBlockEnd: 'var(--g-space-2)' }}><IconCloudOff size={26} stroke={1.6} /></Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>ذخیره‌ها بارگذاری نشد</Text>
      <UnstyledButton type="button" onClick={onRetry} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 44, paddingInline: 'var(--g-space-5)', marginBlockStart: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700 }}><IconRefresh size={16} stroke={1.8} aria-hidden="true" />تلاش دوباره</UnstyledButton>
    </Box>
  );
}

function FavEmpty({ suggestions, onOpen, onSave, onDiscover }) {
  const { dismissed, dismiss } = useDismissRecommendation();
  return (
    <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-6)' }}>
      <Box style={{ textAlign: 'center' }}>
        <Box aria-hidden="true" style={{ inlineSize: 76, blockSize: 76, margin: '0 auto', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)' }}><IconBookmark size={34} stroke={1.6} /></Box>
        <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 'var(--g-space-4) 0 0' }}>هنوز چیزی ذخیره نکردی</Text>
        <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', margin: 'var(--g-space-2) 0 0' }}>{suggestions.length ? 'با این پیشنهادها شروع کن.' : 'بریم چند دستور کشف کنیم.'}</Text>
      </Box>
      {suggestions.length ? (
        <Box style={{ ...grid2, marginBlockStart: 'var(--g-space-5)' }}>
          {suggestions.filter((r) => !dismissed.has(r.recipeId)).map((r) => (
            <RecipeCard key={r.recipeId} compact title={r.title} placeholderSeed={r.seed} saved={false} onSave={() => onSave(r.recipeId)} onOpen={() => onOpen(r.recipeId)} onDismiss={() => dismiss(r.recipeId)} />
          ))}
        </Box>
      ) : null}
      <Box style={{ display: 'flex', justifyContent: 'center', marginBlockStart: 'var(--g-space-6)' }}>
        <UnstyledButton type="button" onClick={onDiscover} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', minBlockSize: 46, paddingInline: 'var(--g-space-5)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-brand-600)', color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-15)', fontWeight: 600 }}><IconCompass size={18} stroke={1.8} aria-hidden="true" />کشفِ دستورها</UnstyledButton>
      </Box>
    </Box>
  );
}

export default function FavoritesPage() {
  const navigate = useNavigate();
  const f = useFavorites();
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const showToast = useCallback((message, Icon) => { clearTimeout(toastTimer.current); setToast({ message, Icon }); toastTimer.current = setTimeout(() => setToast(null), 2000); }, []);
  const openRecipe = (id) => { if (id) navigate(`/recipe/${id}`); };
  const onUnsave = async (id) => { const ok = await f.unsave(id); showToast(ok ? 'از ذخیره‌ها برداشته شد' : 'برداشته نشد — دوباره امتحان کن', ok ? IconBookmarkOff : IconBookmark); };
  const onSaveSuggestion = async (id) => { const ok = await f.save(id); showToast(ok ? 'ذخیره شد' : 'ذخیره نشد — دوباره امتحان کن', IconBookmarkPlus); };

  return (
    <Box style={PAGE}>
      <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)', borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
        <Text component="h1" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-22)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>علاقه‌مندی‌ها</Text>
      </Box>

      {f.status === 'loading' ? <FavLoading />
        : f.status === 'error' ? <FavError onRetry={f.refetch} />
          : f.status === 'empty' ? <FavEmpty suggestions={f.suggestions} onOpen={openRecipe} onSave={onSaveSuggestion} onDiscover={() => navigate('/discover')} />
            : (
              <Box style={{ paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-6)' }}>
                <Box style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--g-space-2)', marginInline: 2, marginBlockEnd: 'var(--g-space-3)' }}>
                  <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>ذخیره‌شده‌ها</Text>
                  <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>{toFaDigits(f.saved.length)} مورد</Text>
                </Box>
                <Box style={grid2}>
                  {f.saved.map((r) => (
                    <RecipeCard key={r.recipeId} compact title={r.title} placeholderSeed={r.seed} cookTimeText={r.cookTimeText} difficultyText={r.difficultyText} saved onSave={() => onUnsave(r.recipeId)} onOpen={() => openRecipe(r.recipeId)} />
                  ))}
                </Box>
              </Box>
            )}

      <Toast toast={toast} />
    </Box>
  );
}
