import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconCalendarHeart } from '@tabler/icons-react';
import PlatePlaceholder from './PlatePlaceholder';

/**
 * OccasionCard — a themed/seasonal collection entry: a short banner with a scrim, a small
 * "مناسبتی" pill and the occasion title in inverse text. Tapping opens the collection.
 * Token-pure (scrim + glass pill via tokens / color-mix).
 */
export default function OccasionCard({ title, badge = 'مناسبتی', seed = 3, label, onClick }) {
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      aria-label={`${badge}: ${title}`}
      style={{ display: 'block', inlineSize: '100%', position: 'relative', borderRadius: 'var(--g-radius-card)', overflow: 'hidden', border: '1px solid var(--g-color-border-subtle)', boxShadow: 'var(--g-shadow-1)' }}
    >
      <Box style={{ position: 'relative', blockSize: 96 }}>
        <PlatePlaceholder label={label || title} seed={seed} />
        <Box aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'var(--g-scrim-photo)' }} />
      </Box>
      <Box style={{ position: 'absolute', insetBlockEnd: 12, insetInlineStart: 16, color: 'var(--g-color-text-inverse)', textAlign: 'start' }}>
        <Box
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)',
            fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 600,
            background: 'color-mix(in srgb, var(--g-color-text-inverse) 20%, transparent)',
            paddingInline: 'var(--g-space-2)', paddingBlock: 3, borderRadius: 'var(--g-radius-chip)', backdropFilter: 'blur(4px)',
          }}
        >
          <IconCalendarHeart size={12} stroke={1.8} aria-hidden="true" />
          {badge}
        </Box>
        <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-18)', fontWeight: 800, marginBlockStart: 6 }}>
          {title}
        </Text>
      </Box>
    </UnstyledButton>
  );
}
