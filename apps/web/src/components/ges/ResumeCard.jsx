import { Box, Text, UnstyledButton } from '@mantine/core';
import { IconPlayerPlayFilled } from '@tabler/icons-react';
import PlatePlaceholder from './PlatePlaceholder';

/**
 * ResumeCard — "ادامهٔ پخت": a thumbnail + the in-progress recipe + a step-progress bar,
 * tapping back into Cook Mode. The caller renders it ONLY when there's a real in-progress
 * cook (no fabrication). Token-pure.
 */
export default function ResumeCard({ title, seed = 4, stepLabel, progress = 0, onClick }) {
  const pct = Math.max(0, Math.min(1, Number(progress) || 0)) * 100;
  return (
    <UnstyledButton
      type="button"
      onClick={onClick}
      aria-label={`ادامهٔ پخت ${title}`}
      style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-3)', inlineSize: '100%', boxSizing: 'border-box', background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', padding: 'var(--g-space-3)', boxShadow: 'var(--g-shadow-1)' }}
    >
      <Box style={{ position: 'relative', inlineSize: 58, blockSize: 58, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
        <PlatePlaceholder label={title} seed={seed} />
      </Box>
      <Box style={{ flex: 1, minInlineSize: 0, textAlign: 'start' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-1)', color: 'var(--g-color-brand-700)' }}>
          <IconPlayerPlayFilled size={13} aria-hidden="true" />
          <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 700 }}>ادامهٔ پخت</Text>
        </Box>
        <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBlockStart: 2 }}>
          {title}
        </Text>
        <Box style={{ marginBlockStart: 'var(--g-space-2)', blockSize: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-border-subtle)', overflow: 'hidden' }}>
          <Box style={{ inlineSize: `${pct}%`, blockSize: '100%', background: 'var(--g-color-brand-500)' }} />
        </Box>
      </Box>
      {stepLabel ? (
        <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, color: 'var(--g-color-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {stepLabel}
        </Text>
      ) : null}
    </UnstyledButton>
  );
}
