import { Box } from '@mantine/core';

/**
 * Loading skeletons — calm placeholders, never a spinner. Use the single approved CSS
 * keyframe (the g-skeleton shimmer from base.css, reduced-motion safe). Token-pure.
 */
export function SkeletonLine({ w = '100%', h = 12, radius = 'var(--g-radius-input)', style }) {
  return <Box className="g-skeleton" style={{ inlineSize: w, blockSize: h, borderRadius: radius, ...style }} />;
}

export function SkeletonCircle({ size = 48 }) {
  return <Box className="g-skeleton" style={{ inlineSize: size, blockSize: size, borderRadius: '50%', flexShrink: 0 }} />;
}

export function SkeletonCard() {
  return (
    <Box style={{ background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', overflow: 'hidden' }}>
      <Box className="g-skeleton" style={{ aspectRatio: '16 / 9', borderRadius: 0 }} />
      <Box style={{ padding: 'var(--g-space-4)' }}>
        <SkeletonLine w="70%" h={16} />
        <Box style={{ display: 'flex', gap: 'var(--g-space-3)', marginBlockStart: 'var(--g-space-3)' }}>
          <SkeletonLine w={64} h={12} />
          <SkeletonLine w={44} h={12} />
        </Box>
      </Box>
    </Box>
  );
}
