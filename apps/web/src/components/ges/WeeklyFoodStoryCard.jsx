import { Box, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronLeft } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { riseIn, pressResponse, withReducedMotion } from '../../lib/motion';

/**
 * WeeklyFoodStoryCard (PL row 25) — a personal weekly recap entry on Home.
 *
 * Anatomy: a cover frame (a single stat or a dish photo) + title ("Your week") +
 * a view CTA. Frames are PERSONAL-only data — self-reflection, never social.
 *
 * Constitutional gate (PL row 25): NO public share affordance before C1 — the
 * share button is ABSENT, not a disabled teaser. This component intentionally
 * exposes no share prop.
 *
 * States: ready | empty (no week data ⇒ render nothing) | loading | error.
 * Self-comparison only — no FOMO copy, no auto-play takeover. Motion: settle +
 * pressResponse, reduced-motion safe. RTL-safe. Token-pure. Pure presentational.
 *
 * Props:
 *  - title: card title (default "Your week")
 *  - stat: the cover stat value (e.g. "5 meals cooked")
 *  - statLabel: small caption under/over the stat
 *  - onView: open the story viewer
 *  - state: 'ready' | 'empty' | 'loading' | 'error' (default 'ready')
 *  - viewLabel: CTA copy
 */
export function WeeklyFoodStoryCard({
  title = 'Your week',
  stat,
  statLabel,
  onView,
  state = 'ready',
  viewLabel = 'View your week',
}) {
  // Empty: no week data → the card does not appear at all.
  if (state === 'empty') return null;

  const frame = (inner) => (
    <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate" style={{ inlineSize: '100%' }}>
      <Box
        style={{
          inlineSize: '100%',
          borderRadius: 'var(--g-radius-card)',
          background: 'var(--g-color-bg-surface)',
          border: '1px solid var(--g-color-border-subtle)',
          boxShadow: 'var(--g-shadow-1)',
          overflow: 'hidden',
        }}
      >
        {inner}
      </Box>
    </motion.div>
  );

  if (state === 'loading') {
    return frame(
      <Stack style={{ gap: 'var(--g-space-3)', padding: 'var(--g-space-4)' }} role="status" aria-busy="true">
        <span className="g-sr-only">Loading your week</span>
        <Box className="g-skeleton" aria-hidden="true" style={{ inlineSize: '40%', blockSize: 'var(--g-space-4)' }} />
        <Box className="g-skeleton" aria-hidden="true" style={{ inlineSize: '100%', aspectRatio: '16 / 9', borderRadius: 'var(--g-radius-photo)' }} />
      </Stack>,
    );
  }

  if (state === 'error') {
    return frame(
      <Box style={{ padding: 'var(--g-space-4)' }} role="alert">
        <Text style={{ fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', textAlign: 'start' }}>
          Your week isn’t ready just now. Nothing was lost — check back soon.
        </Text>
      </Box>,
    );
  }

  // ready
  return frame(
    <Stack style={{ gap: 0 }}>
      {/* Cover frame — the stat as the hero (calm brand tint) */}
      <Stack
        align="center"
        justify="center"
        style={{
          inlineSize: '100%',
          aspectRatio: '16 / 9',
          background: 'var(--g-color-brand-50)',
          paddingInline: 'var(--g-space-5)',
          gap: 'var(--g-space-1)',
        }}
      >
        {stat != null && (
          <Text style={{ fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-34)', fontWeight: 700, color: 'var(--g-color-brand-700)', textAlign: 'center', lineHeight: 'var(--g-leading-heading)' }}>
            {stat}
          </Text>
        )}
        {statLabel && (
          <Text style={{ fontFamily: 'var(--g-font-text)', fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', textAlign: 'center' }}>
            {statLabel}
          </Text>
        )}
      </Stack>

      <Stack style={{ gap: 'var(--g-space-3)', padding: 'var(--g-space-4)' }}>
        <Text component="h3" style={{ fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-18)', fontWeight: 700, color: 'var(--g-color-text-primary)', textAlign: 'start' }}>
          {title}
        </Text>
        <UnstyledButton
          component={motion.button}
          type="button"
          onClick={onView}
          whileTap={pressResponse.whileTap}
          aria-label={viewLabel}
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            gap: 'var(--g-space-1)', minHeight: 44, paddingInline: 'var(--g-space-5)',
            borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-food-saffron)',
            color: 'var(--g-color-text-inverse)', fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-16)', fontWeight: 600, boxShadow: 'var(--g-shadow-1)',
          }}
        >
          {viewLabel}
          <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" />
        </UnstyledButton>
      </Stack>
    </Stack>,
  );
}

export default WeeklyFoodStoryCard;
