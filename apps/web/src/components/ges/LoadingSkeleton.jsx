import { Box, Stack, Group } from '@mantine/core';

/**
 * LoadingSkeleton (PL row 13) — Calm structural loading.
 * Renders .g-skeleton blocks that mirror the final layout so there is zero
 * layout shift when real content swaps in. Shimmer comes from the single
 * sanctioned CSS keyframe (`g-shimmer` in base.css); reduced-motion renders
 * it static automatically via the global media query in base.css — no JS gate
 * needed because the shimmer is pure CSS.
 *
 * Props:
 *  - shape: 'text' | 'card' | 'list' | 'media' | 'avatar' — which layout twin to mirror
 *  - lines: number of text lines to render (text/card/list shapes)
 *  - label: SR-only description of what is loading
 */

const skeletonStyle = (extra = {}) => ({
  // .g-skeleton supplies background + shimmer; logical sizing only here.
  blockSize: 'var(--g-space-4)',
  borderRadius: 'var(--g-radius-input)',
  ...extra,
});

function TextLines({ lines = 3, lastWidth = '60%' }) {
  const count = Math.max(1, lines);
  return (
    <Stack style={{ gap: 'var(--g-space-2)', inlineSize: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Box
          key={i}
          className="g-skeleton"
          aria-hidden="true"
          style={skeletonStyle({
            inlineSize: i === count - 1 ? lastWidth : '100%',
          })}
        />
      ))}
    </Stack>
  );
}

export function LoadingSkeleton({
  shape = 'text',
  lines = 3,
  label = 'Loading',
}) {
  let body;

  if (shape === 'avatar') {
    body = (
      <Group style={{ gap: 'var(--g-space-3)', inlineSize: '100%' }} wrap="nowrap">
        <Box
          className="g-skeleton"
          aria-hidden="true"
          style={skeletonStyle({
            inlineSize: 44,
            blockSize: 44,
            borderRadius: 'var(--g-radius-chip)',
            flexShrink: 0,
          })}
        />
        <Box style={{ flex: 1 }}>
          <TextLines lines={Math.max(2, lines)} />
        </Box>
      </Group>
    );
  } else if (shape === 'media') {
    body = (
      <Box
        className="g-skeleton"
        aria-hidden="true"
        style={skeletonStyle({
          inlineSize: '100%',
          aspectRatio: '4 / 3',
          borderRadius: 'var(--g-radius-photo)',
        })}
      />
    );
  } else if (shape === 'card') {
    body = (
      <Stack
        style={{
          gap: 'var(--g-space-3)',
          padding: 'var(--g-space-3)',
          borderRadius: 'var(--g-radius-card)',
          border: '1px solid var(--g-color-border-subtle)',
          background: 'var(--g-color-bg-surface)',
          inlineSize: '100%',
        }}
      >
        <Box
          className="g-skeleton"
          aria-hidden="true"
          style={skeletonStyle({
            inlineSize: '100%',
            aspectRatio: '4 / 3',
            borderRadius: 'var(--g-radius-photo)',
          })}
        />
        <TextLines lines={lines} />
      </Stack>
    );
  } else if (shape === 'list') {
    const rows = Math.max(1, lines);
    body = (
      <Stack style={{ gap: 'var(--g-space-3)', inlineSize: '100%' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Group key={i} style={{ gap: 'var(--g-space-3)' }} wrap="nowrap">
            <Box
              className="g-skeleton"
              aria-hidden="true"
              style={skeletonStyle({
                inlineSize: 'var(--g-space-6)',
                blockSize: 'var(--g-space-6)',
                flexShrink: 0,
              })}
            />
            <Box
              className="g-skeleton"
              aria-hidden="true"
              style={skeletonStyle({ inlineSize: i % 2 === 0 ? '80%' : '65%' })}
            />
          </Group>
        ))}
      </Stack>
    );
  } else {
    // 'text'
    body = <TextLines lines={lines} />;
  }

  return (
    <Box
      role="status"
      aria-busy="true"
      aria-live="polite"
      data-shape={shape}
      style={{ inlineSize: '100%' }}
    >
      <span className="g-sr-only">{label}</span>
      {body}
    </Box>
  );
}

export default LoadingSkeleton;
