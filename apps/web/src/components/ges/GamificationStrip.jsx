import { Box, Text } from '@mantine/core';
import { IconFlame, IconAward } from '@tabler/icons-react';

/**
 * GamificationStrip — slim PRIVATE motivation card (no leaderboard, no comparison, no
 * shame). A flame tile + a kind streak headline + a soft progress line toward the next
 * mastery level. Driven by real /gamification/me data; the caller hides it when there's
 * nothing to celebrate yet. Token-pure.
 */
export default function GamificationStrip({ headline, progressLabel, progress = 0 }) {
  const pct = Math.max(0, Math.min(1, Number(progress) || 0)) * 100;
  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--g-space-4)',
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        borderRadius: 'var(--g-radius-card)',
        boxShadow: 'var(--g-shadow-1)',
        padding: 'var(--g-space-4)',
      }}
    >
      <Box
        aria-hidden="true"
        style={{ flexShrink: 0, inlineSize: 44, blockSize: 44, borderRadius: 14, background: 'var(--g-color-brand-50)', color: 'var(--g-color-brand-600)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <IconFlame size={23} stroke={1.8} />
      </Box>
      <Box style={{ flex: 1, minInlineSize: 0 }}>
        <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-14)', fontWeight: 700, color: 'var(--g-color-text-primary)' }}>
          {headline}
        </Text>
        {progressLabel ? (
          <Box style={{ display: 'flex', alignItems: 'center', gap: 'var(--g-space-2)', marginBlockStart: 'var(--g-space-2)' }}>
            <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: 'var(--g-font-size-12)', fontWeight: 500, color: 'var(--g-color-text-muted)', whiteSpace: 'nowrap' }}>
              {progressLabel}
            </Text>
            <Box style={{ flex: 1, blockSize: 5, borderRadius: 'var(--g-radius-chip)', background: 'var(--g-color-border-subtle)', overflow: 'hidden' }}>
              <Box style={{ inlineSize: `${pct}%`, blockSize: '100%', background: 'var(--g-color-brand-500)' }} />
            </Box>
          </Box>
        ) : null}
      </Box>
      <IconAward size={20} stroke={1.8} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
    </Box>
  );
}
