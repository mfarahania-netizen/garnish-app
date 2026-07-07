import { Box, Text, UnstyledButton } from '@mantine/core';
import RecipeCard from './RecipeCard';

/**
 * RecipeRail — a titled, horizontal-scroll (RTL) rail of compact RecipeCards.
 * Header = optional saffron icon + title + a "دیدن همه" link. Cards are 188px wide,
 * smaller than the picks. The caller omits the whole rail when data is thin. Token-pure;
 * scrollbar hidden via .g-norail; edge-bleed so cards scroll under the page padding.
 */
export default function RecipeRail({ title, icon: Icon, items = [], onSeeAll, onOpen, onSave, isSaved, registerImpression }) {
  if (!items || items.length === 0) return null;
  return (
    <Box component="section" style={{ marginBlockStart: 'var(--g-space-6)' }}>
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginInline: 2, marginBlockEnd: 'var(--g-space-3)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)' }}>
          {Icon ? <Icon size={17} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)' }} /> : null}
          <Text component="h2" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 800, color: 'var(--g-color-text-primary)', margin: 0 }}>
            {title}
          </Text>
        </Box>
        <UnstyledButton
          type="button"
          onClick={onSeeAll}
          style={{ display: 'inline-flex', alignItems: 'center', minBlockSize: 44, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, color: 'var(--g-color-text-muted)' }}
        >
          دیدن همه
        </UnstyledButton>
      </Box>
      <Box
        className="g-norail"
        style={{ display: 'flex', gap: 'var(--g-space-3)', overflowX: 'auto', marginInline: 'calc(var(--g-space-4) * -1)', paddingInline: 'var(--g-space-4)', paddingBlock: 'var(--g-space-1)' }}
      >
        {items.map((it) => (
          <Box key={it.recipeId} ref={registerImpression ? registerImpression(it.recipeId, it.requestId) : undefined} style={{ inlineSize: 188, flexShrink: 0 }}>
            <RecipeCard
              compact
              title={it.title}
              imageUrl={it.imageUrl}
              placeholderSeed={it.seed}
              cookTimeText={it.cookTimeText}
              difficultyText={it.difficultyText}
              saved={isSaved ? isSaved(it.recipeId) : false}
              onSave={onSave ? () => onSave(it.recipeId, it.requestId) : undefined}
              onOpen={() => onOpen?.(it.recipeId, it.requestId)}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
