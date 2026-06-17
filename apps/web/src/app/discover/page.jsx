import { Box, Text, UnstyledButton } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { IconSearch, IconX, IconFlame, IconFridge, IconSearchOff, IconCheck, IconShieldHalf, IconAdjustmentsHorizontal } from '@tabler/icons-react';
import { useDiscovery } from './useDiscovery';
import { MEAL_CHIPS, FOOD_TILES, UNMET_SUGGESTIONS, QUICK_FILTERS } from './categories';
import RecipeCard from '../../components/ges/RecipeCard';
import RecipeRail from '../../components/ges/RecipeRail';
import ErrorState from '../../components/ges/ErrorState';
import { SkeletonCard, SkeletonLine } from '../../components/ges/LoadingSkeleton';

const PAGE = { display: 'flex', flexDirection: 'column', paddingInline: 'var(--g-space-4)', paddingBlockStart: 'var(--g-space-3)', paddingBlockEnd: 'var(--g-space-6)' };
const railHead = { display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginInline: 2, marginBlockEnd: 'var(--g-space-3)' };
const railTitle = { fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 };

function SearchBar({ input, active, onChange, onClear }) {
  return (
    <Box
      style={{
        display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', blockSize: 50, paddingInline: 'var(--g-space-4)',
        background: 'var(--g-color-bg-surface)', borderRadius: 'var(--g-radius-input)', boxShadow: 'var(--g-shadow-1)',
        border: `1px solid ${active ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}`,
      }}
    >
      <IconSearch size={19} stroke={1.8} aria-hidden="true" style={{ color: active ? 'var(--g-color-brand-600)' : 'var(--g-color-text-muted)', flexShrink: 0 }} />
      <Box
        component="input"
        type="search"
        value={input}
        onChange={(e) => onChange(e.target.value)}
        placeholder="جستجوی غذا، ماده، یا دستور…"
        aria-label="جستجو"
        style={{ flex: 1, minInlineSize: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-primary)' }}
      />
      {input ? (
        <UnstyledButton type="button" onClick={onClear} aria-label="پاک‌کردن" style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--g-color-text-muted)' }}>
          <IconX size={18} stroke={1.8} />
        </UnstyledButton>
      ) : null}
    </Box>
  );
}

function Browse({ d, openRecipe }) {
  return (
    <Box style={{ marginBlockStart: 'var(--g-space-4)' }}>
      {/* دستهٔ وعده */}
      <Text component="h2" style={{ ...railTitle, marginInline: 2, marginBlockEnd: 'var(--g-space-3)' }}>دستهٔ وعده</Text>
      <Box className="g-norail" style={{ display: 'flex', gap: 'var(--g-space-2)', overflowX: 'auto', marginInline: 'calc(var(--g-space-4) * -1)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-1)' }}>
        {MEAL_CHIPS.map((c) => (
          <UnstyledButton key={c.label} type="button" onClick={() => d.setQueryNow(c.term)} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-2)', minBlockSize: 44, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}>
            <c.Icon size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} />{c.label}
          </UnstyledButton>
        ))}
      </Box>

      {/* دستهٔ غذا */}
      <Text component="h2" style={{ ...railTitle, marginInline: 2, margin: 'var(--g-space-5) 2px var(--g-space-3)' }}>دستهٔ غذا</Text>
      <Box className="g-norail" style={{ display: 'flex', gap: 'var(--g-space-3)', overflowX: 'auto', marginInline: 'calc(var(--g-space-4) * -1)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-1)' }}>
        {FOOD_TILES.map((t) => (
          <UnstyledButton key={t.label} type="button" onClick={() => d.setQueryNow(t.term)} style={{ flexShrink: 0, inlineSize: 74, textAlign: 'center' }}>
            <Box aria-hidden="true" style={{ inlineSize: 60, blockSize: 60, margin: '0 auto', borderRadius: 'var(--g-radius-card)', display: 'grid', placeItems: 'center', background: t.bg, color: t.fg }}>
              <t.Icon size={26} stroke={1.8} />
            </Box>
            <Text component="span" style={{ display: 'block', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-secondary)', marginBlockStart: 'var(--g-space-2)' }}>{t.label}</Text>
          </UnstyledButton>
        ))}
      </Box>

      <RecipeRail title="محبوب‌ها" icon={IconFlame} items={d.popular} onOpen={openRecipe} />
      <RecipeRail title="بر اساس آشپزخونه‌ات" icon={IconFridge} items={d.forYou} onOpen={openRecipe} />

      <UnstyledButton type="button" onClick={() => d.setQueryNow('سوشی')} style={{ display: 'block', margin: 'var(--g-space-5) auto 0', minBlockSize: 44, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600, color: 'var(--g-color-brand-700)' }}>
        نمونهٔ بی‌نتیجه: جستجوی «سوشی» →
      </UnstyledButton>
    </Box>
  );
}

function Results({ d, openRecipe }) {
  const { safe, flagged, total } = d.results;
  return (
    <Box style={{ marginBlockStart: 'var(--g-space-4)' }}>
      {/* quick filters */}
      <Box className="g-norail" style={{ display: 'flex', gap: 'var(--g-space-2)', overflowX: 'auto', marginInline: 'calc(var(--g-space-4) * -1)', paddingInline: 'var(--g-space-4)', paddingBlockEnd: 'var(--g-space-3)' }}>
        <Box aria-hidden="true" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', paddingInline: 'var(--g-space-3)', minBlockSize: 38, color: 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
          <IconAdjustmentsHorizontal size={15} stroke={1.8} />فیلتر
        </Box>
        {QUICK_FILTERS.map((f) => {
          const on = !!d.filters[f.id];
          return (
            <UnstyledButton key={f.id} type="button" onClick={() => d.toggleFilter(f.id)} aria-pressed={on} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', minBlockSize: 38, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', border: `1px solid ${on ? 'var(--g-color-brand-600)' : 'var(--g-color-border-subtle)'}`, background: on ? 'var(--g-color-brand-600)' : 'var(--g-color-bg-surface)', color: on ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
              {f.label}{on ? <IconX size={13} stroke={2} aria-hidden="true" /> : null}
            </UnstyledButton>
          );
        })}
      </Box>

      <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)', margin: '0 2px var(--g-space-3)' }}>{toFa(total)} نتیجه</Text>

      <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
        {safe.map((r) => (
          <RecipeCard key={r.id} title={r.title} placeholderSeed={r.seed} cookTimeText={r.cookTimeText} difficultyText={r.difficultyText} reasons={r.reasons} onOpen={() => openRecipe(r.id)} />
        ))}
      </Box>

      {flagged.length ? (
        <>
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', margin: 'var(--g-space-4) 2px var(--g-space-3)' }}>
            <Box aria-hidden="true" style={{ flex: 1, blockSize: 1, background: 'var(--g-color-border-subtle)' }} />
            <Text component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}>
              <IconShieldHalf size={13} stroke={1.8} aria-hidden="true" />برای ایمنی پایین‌تر
            </Text>
            <Box aria-hidden="true" style={{ flex: 1, blockSize: 1, background: 'var(--g-color-border-subtle)' }} />
          </Box>
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)' }}>
            {flagged.map((r) => (
              <RecipeCard key={r.id} title={r.title} placeholderSeed={r.seed} cookTimeText={r.cookTimeText} difficultyText={r.difficultyText} allergen={{ name: r.allergen, text: '— حساسیتِ اعلام‌شده‌ات' }} onOpen={() => openRecipe(r.id)} />
            ))}
          </Box>
        </>
      ) : null}
    </Box>
  );
}

function UnmetSearch({ query, onPick }) {
  return (
    <Box style={{ textAlign: 'center', paddingInline: 'var(--g-space-5)', paddingBlock: 'var(--g-space-8)' }}>
      <Box aria-hidden="true" style={{ inlineSize: 76, blockSize: 76, margin: '0 auto', borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', border: '1.5px solid var(--g-color-brand-200)' }}>
        <IconSearchOff size={34} stroke={1.6} />
      </Box>
      <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, lineHeight: 'var(--g-leading-heading)', textWrap: 'balance', margin: 'var(--g-space-4) 0 0', color: 'var(--g-color-text-primary)' }}>«{query}» رو پیدا نکردیم</Text>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', maxInlineSize: 320, margin: 'var(--g-space-2) auto 0' }}>ولی این جستجو رو ثبت کردیم تا بهش اضافه‌اش کنیم. به‌محضِ اینکه آماده شد خبرت می‌کنیم.</Text>
      <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)', marginBlockStart: 'var(--g-space-3)', paddingInline: 'var(--g-space-3)', paddingBlock: 6, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-state-success-bg)', color: 'var(--g-color-state-success-fg)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
        <IconCheck size={13} stroke={2} aria-hidden="true" />درخواستت ثبت شد
      </Box>
      <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)', margin: 'var(--g-space-6) 0 var(--g-space-3)' }}>شاید این‌ها رو دوست داشته باشی</Text>
      <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-2)', justifyContent: 'center' }}>
        {UNMET_SUGGESTIONS.map((s) => (
          <UnstyledButton key={s} type="button" onClick={() => onPick(s)} style={{ minBlockSize: 38, paddingInline: 'var(--g-space-4)', borderRadius: 'var(--g-radius-chip)', border: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-13)', fontWeight: 600 }}>{s}</UnstyledButton>
        ))}
      </Box>
    </Box>
  );
}

function ResultsLoading() {
  return (
    <Box role="status" aria-busy="true" aria-label="در حال بارگذاری…" style={{ marginBlockStart: 'var(--g-space-4)' }}>
      <SkeletonLine w="35%" h={14} />
      <Box style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-4)' }}>
        <SkeletonCard /><SkeletonCard />
      </Box>
    </Box>
  );
}

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toFa = (n) => String(n ?? '').replace(/[0-9]/g, (x) => FA[+x]);

export default function DiscoveryPage() {
  const navigate = useNavigate();
  const d = useDiscovery();
  const openRecipe = (id) => { if (id) navigate(`/recipe/${id}`); };

  return (
    <Box style={PAGE}>
      <SearchBar input={d.input} active={d.active} onChange={d.setInput} onClear={d.clear} />

      {d.status === 'browse' ? <Browse d={d} openRecipe={openRecipe} /> : null}
      {d.status === 'loading' ? <ResultsLoading /> : null}
      {d.status === 'error' ? <ErrorState title="جستجو در دسترس نیست" body="یه لحظه دیگه دوباره امتحان کن." reassurance="جستجوهای قبلیت محفوظ‌اند" onRetry={d.refetch} /> : null}
      {d.status === 'noresults' ? <UnmetSearch query={d.query} onPick={d.setQueryNow} /> : null}
      {d.status === 'results' ? <Results d={d} openRecipe={openRecipe} /> : null}
    </Box>
  );
}
