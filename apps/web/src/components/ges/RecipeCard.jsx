import { Box, Text, UnstyledButton } from '@mantine/core';
import {
  IconClock, IconChartBar, IconBookmark, IconBookmarkFilled, IconHeartCheck,
  IconInfoCircle, IconClockExclamation, IconAlertTriangle,
} from '@tabler/icons-react';
import PlatePlaceholder from './PlatePlaceholder';
import WhyChip from './WhyChip';

/**
 * RecipeCard — canonical pick card. Media is always the branded PlatePlaceholder (no food
 * photos exist; never a gray gradient/empty box). Honest fit: the saffron "عالی برای تو" badge
 * shows only when earned (great). Optional caution / allergen banners are data-driven and never
 * fabricated; the allergen safety flag is never hidden when present. The "why" row pairs a calm
 * plain-language reason with the WhyChip. Token-pure, RTL (logical props), ≥44px controls.
 */
export default function RecipeCard({
  title,
  placeholderSeed = 0,
  fit = null,
  fitLabel = 'عالی برای تو',
  cookTimeText = '',
  difficultyText = '',
  reasonText = '',
  reasons = [],
  caution = null,
  allergen = null,
  saved = false,
  onSave,
  onOpen,
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
      }}
    >
      <Box style={{ position: 'relative', aspectRatio: '16 / 9' }}>
        <PlatePlaceholder label={title} seed={placeholderSeed} />

        {/* open affordance (covers the media) */}
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
              position: 'absolute',
              insetBlockStart: 10,
              insetInlineStart: 10,
              zIndex: 2,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--g-space-1)',
              paddingInline: 'var(--g-space-3)',
              paddingBlock: 5,
              borderRadius: 'var(--g-radius-chip)',
              background: 'var(--g-color-state-success-bg)',
              color: 'var(--g-color-state-success-fg)',
              boxShadow: 'var(--g-shadow-1)',
              fontFamily: 'var(--g-font-fa)',
              fontSize: 'var(--g-font-size-12)',
              fontWeight: 700,
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
            aria-label={saved ? 'برداشتن از ذخیره‌ها' : 'ذخیره'}
            aria-pressed={saved}
            style={{
              position: 'absolute',
              insetBlockStart: 10,
              insetInlineEnd: 10,
              zIndex: 2,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              inlineSize: 36,
              blockSize: 36,
              borderRadius: '50%',
              background: 'var(--g-color-bg-surface)',
              color: 'var(--g-color-brand-600)',
              boxShadow: 'var(--g-shadow-1)',
            }}
          >
            <SaveIcon size={18} stroke={1.8} />
          </UnstyledButton>
        ) : null}
      </Box>

      <Box style={{ padding: 'var(--g-space-4)' }}>
        <Text component="h3" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-16)', fontWeight: 700, lineHeight: 'var(--g-leading-heading)', color: 'var(--g-color-text-primary)', textWrap: 'balance', margin: 0 }}>
          {title}
        </Text>

        {(cookTimeText || difficultyText) ? (
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-4)', marginBlockStart: 'var(--g-space-2)', color: 'var(--g-color-text-muted)' }}>
            {cookTimeText ? (
              <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
                <IconClock size={14} stroke={1.8} aria-hidden="true" />
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500 }}>{cookTimeText}</Text>
              </Box>
            ) : null}
            {difficultyText ? (
              <Box style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)' }}>
                <IconChartBar size={14} stroke={1.8} aria-hidden="true" />
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500 }}>{difficultyText}</Text>
              </Box>
            ) : null}
          </Box>
        ) : null}

        {caution ? (
          <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-state-warning-bg)' }}>
            <IconClockExclamation size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-state-warning-fg)', flexShrink: 0, marginBlockStart: 1 }} />
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-state-warning-fg)', margin: 0 }}>{caution}</Text>
          </Box>
        ) : null}

        {allergen ? (
          <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-allergen-bg)' }}>
            <IconAlertTriangle size={16} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-allergen-fg)', flexShrink: 0, marginBlockStart: 1 }} />
            <Text component="p" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-allergen-fg)', margin: 0 }}>
              {allergen.name ? <>حاوی <b>{allergen.name}</b> </> : null}
              {allergen.text}
            </Text>
          </Box>
        ) : null}

        {!caution && !allergen && (reasonText || reasons.length) ? (
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-3)', paddingBlockStart: 'var(--g-space-3)', borderBlockStart: '1px solid var(--g-color-border-subtle)' }}>
            <IconInfoCircle size={15} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} />
            <Text component="p" style={{ flex: 1, minInlineSize: 0, fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', margin: 0 }}>
              {reasonText || 'بر اساس ذائقه‌ات'}
            </Text>
            <WhyChip reasons={reasons} />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
