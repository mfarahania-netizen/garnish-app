import { Box, Text, UnstyledButton } from '@mantine/core';
import {
  IconClock, IconChartBar, IconUsers, IconBookmark, IconBookmarkFilled, IconHeartCheck,
  IconInfoCircle, IconClockExclamation, IconAlertTriangle,
} from '@tabler/icons-react';
import PlatePlaceholder from './PlatePlaceholder';
import WhyChip from './WhyChip';

/**
 * RecipeCard — pick/rail card. Media is always the branded PlatePlaceholder at 16:9
 * (no food photos exist; never a gray gradient/empty box/giant glyph). Honest fit: the
 * saffron "عالی برای تو" badge shows only when earned. `compact` (rails) renders just
 * media + save + title + meta; the full card (picks) adds the why row + caution/allergen
 * banners (allergen never hidden). Token-pure, RTL, ≥44px controls.
 */
function Meta({ cookTimeText, difficultyText, servingsText }) {
  if (!cookTimeText && !difficultyText && !servingsText) return null;
  const item = (Icon, txt) => (
    <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
      <Icon size={13} stroke={1.8} aria-hidden="true" />
      <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500 }}>{txt}</Text>
    </Box>
  );
  return (
    <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-2)', color: 'var(--g-color-text-muted)' }}>
      {cookTimeText ? item(IconClock, cookTimeText) : null}
      {difficultyText ? item(IconChartBar, difficultyText) : null}
      {servingsText ? item(IconUsers, servingsText) : null}
    </Box>
  );
}

export default function RecipeCard({
  title,
  placeholderSeed = 0,
  fit = null,
  fitLabel = 'عالی برای تو',
  cookTimeText = '',
  difficultyText = '',
  servingsText = '',
  reasonText = '',
  reasons = [],
  caution = null,
  allergen = null,
  saved = false,
  onSave,
  onOpen,
  compact = false,
}) {
  const SaveIcon = saved ? IconBookmarkFilled : IconBookmark;
  return (
    <Box
      style={{
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        borderRadius: 'var(--g-radius-card)',
        boxShadow: 'var(--g-shadow-1)',
        overflow: 'hidden',
        blockSize: '100%',
      }}
    >
      {/* Bulletproof 16:9 — padding-top (56.25%) gives the height from the width in EVERY engine/cache
          state, so the media is always short+wide (never near-square) regardless of `aspect-ratio` support.
          The placeholder + overlays fill it via position:absolute inset:0. */}
      <Box style={{ position: 'relative', inlineSize: '100%', blockSize: 0, paddingBlockStart: '56.25%', overflow: 'hidden' }}>
        <PlatePlaceholder label={title} seed={placeholderSeed} glyphSize={compact ? 34 : 44} />

        <UnstyledButton
          type="button"
          onClick={onOpen}
          aria-label={`${title} — مشاهدهٔ دستور`}
          style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'transparent' }}
        />

        {allergen ? (
          <Box aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'color-mix(in srgb, var(--g-color-text-primary) 6%, transparent)', zIndex: 1 }} />
        ) : null}

        {fit === 'great' ? (
          <Box
            style={{
              position: 'absolute', insetBlockStart: 10, insetInlineStart: 10, zIndex: 2,
              display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)',
              paddingInline: 'var(--g-space-3)', paddingBlock: 5, borderRadius: 'var(--g-radius-chip)',
              background: 'var(--g-color-state-success-bg)', color: 'var(--g-color-state-success-fg)',
              boxShadow: 'var(--g-shadow-1)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700,
            }}
          >
            <IconHeartCheck size={13} stroke={1.8} aria-hidden="true" />
            {fitLabel}
          </Box>
        ) : null}

        {!allergen && onSave ? (
          <UnstyledButton
            type="button"
            onClick={onSave}
            aria-label={saved ? `برداشتن «${title}» از ذخیره‌ها` : `ذخیرهٔ «${title}»`}
            aria-pressed={saved}
            style={{
              position: 'absolute', insetBlockStart: 6, insetInlineEnd: 6, zIndex: 2,
              display: 'grid', placeItems: 'center', inlineSize: 44, blockSize: 44, background: 'transparent',
            }}
          >
            <Box
              aria-hidden="true"
              style={{
                display: 'grid', placeItems: 'center', inlineSize: 36, blockSize: 36, borderRadius: '50%',
                background: 'color-mix(in srgb, var(--g-color-text-inverse) 92%, transparent)',
                color: 'var(--g-color-brand-600)', boxShadow: 'var(--g-shadow-1)',
              }}
            >
              <SaveIcon size={18} stroke={1.8} />
            </Box>
          </UnstyledButton>
        ) : null}
      </Box>

      <Box style={{ padding: compact ? 'var(--g-space-3)' : 'var(--g-space-4)' }}>
        <Text
          component="h3"
          style={{
            fontFamily: 'var(--g-font-fa)', fontSize: compact ? 'var(--g-font-size-14)' : 'var(--g-font-size-16)',
            fontWeight: 700, lineHeight: 'var(--g-leading-heading)', color: 'var(--g-color-text-primary)',
            textWrap: 'balance', margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {title}
        </Text>

        <Meta cookTimeText={cookTimeText} difficultyText={difficultyText} servingsText={servingsText} />

        {!compact && caution ? (
          <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-state-warning-bg)' }}>
            <IconClockExclamation size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-warning-fg)', flexShrink: 0, marginBlockStart: 1 }} />
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-state-warning-fg)', margin: 0 }}>{caution}</Text>
          </Box>
        ) : null}

        {!compact && allergen ? (
          <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-allergen-bg)' }}>
            <IconAlertTriangle size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-allergen-fg)', flexShrink: 0, marginBlockStart: 1 }} />
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-allergen-fg)', margin: 0 }}>
              {allergen.name ? <>حاوی <b>{allergen.name}</b> </> : null}
              {allergen.text}
            </Text>
          </Box>
        ) : null}

        {!compact && !caution && !allergen && (reasonText || reasons.length) ? (
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)', paddingBlockStart: 'var(--g-space-3)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
            {reasonText ? (
              <>
                <IconInfoCircle size={15} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} />
                <Text component="p" style={{ flex: 1, minInlineSize: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 0 }}>
                  {reasonText}
                </Text>
              </>
            ) : (
              <Box style={{ flex: 1 }} />
            )}
            <WhyChip reasons={reasons} />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
