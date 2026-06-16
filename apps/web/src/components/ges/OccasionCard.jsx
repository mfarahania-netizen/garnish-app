import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconCalendarHeart, IconChevronLeft } from '@tabler/icons-react';

/**
 * OccasionCard — a themed/seasonal collection entry. Per GES, content surfaces are flat warm
 * neutrals (no decorative gradients) — so this is a WARM, LIGHT, inviting card (saffron-50 tint,
 * dark readable title, a saffron glyph tile + «مناسبتی» pill), NOT a dark scrim/gradient block.
 * Token-pure; tapping opens the collection.
 */
export default function OccasionCard({ title, badge = 'مناسبتی', onClick }) {
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      aria-label={`${badge}: ${title}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--g-space-3)',
        inlineSize: '100%',
        boxSizing: 'border-box',
        background: 'var(--g-color-brand-50)',
        border: '1px solid var(--g-color-brand-200)',
        borderRadius: 'var(--g-radius-card)',
        padding: 'var(--g-space-4)',
        boxShadow: 'var(--g-shadow-1)',
      }}
    >
      <Box
        aria-hidden="true"
        style={{ flexShrink: 0, inlineSize: 48, blockSize: 48, borderRadius: 14, background: 'var(--g-color-bg-surface)', color: 'var(--g-color-brand-600)', display: 'grid', placeItems: 'center', boxShadow: 'var(--g-shadow-1)' }}
      >
        <IconCalendarHeart size={24} stroke={1.7} />
      </Box>
      <Box style={{ flex: 1, minInlineSize: 0, textAlign: 'start' }}>
        <Box style={{ display: 'inline-flex', alignItems: 'center', paddingInline: 'var(--g-space-2)', paddingBlock: 2, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-brand-100)', color: 'var(--g-color-brand-700)', fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600 }}>
          {badge}
        </Box>
        <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, color: 'var(--g-color-text-primary)', marginBlockStart: 4 }}>
          {title}
        </Text>
      </Box>
      <IconChevronLeft size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-brand-600)', flexShrink: 0 }} />
    </UnstyledButton>
  );
}
