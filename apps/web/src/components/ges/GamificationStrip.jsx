import { Box, Group, Text } from '@mantine/core';
import { IconFlame, IconSnowflake, IconTrophy, IconSeeding } from '@tabler/icons-react';

/**
 * GamificationStrip — a small, private streak + achievement strip.
 *
 * Honest, anti-dark-pattern by construction (GES §21–22 / GAMIFY-L4-11):
 *  - PRIVATE: about the user's own progress. There is intentionally NO prop for
 *    rank, comparison, leaderboard, friends, or "others" — those are out of the
 *    component's surface by design, not toggled off.
 *  - KIND streak-break: a broken streak is a warm fresh-start (neutral/seedling
 *    tone), NEVER red shame, no loss-aversion countdown.
 *  - Streak freeze (1/week) is surfaced as a calm frozen state.
 *  - Small, not the hero (Guide: "streak UI small, not the hero"). Exit any loop
 *    in ≤1 tap is the caller's concern; this strip adds no FOMO mechanics.
 *
 * Pure presentational, no motion (Celebrate is event-gated elsewhere, ≤1/session).
 * RTL-safe (logical flow). Token-pure.
 *
 * Props:
 *  - streakDays: current streak count (number; default 0)
 *  - streakState: 'active' | 'frozen' | 'broken' (default 'active')
 *  - achievement: optional { label } — shown as a calm earned badge (omit = none)
 *  - streakLabelSingular / streakLabelPlural: copy ("day" / "days")
 *  - restartLabel / frozenLabel: copy overrides for broken / frozen states
 */
function Pill({ icon, children, fg, bg }) {
  return (
    <Box
      component="span"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--g-space-1)',
        paddingInline: 'var(--g-space-3)',
        paddingBlock: 'var(--g-space-1)',
        borderRadius: 'var(--g-radius-chip)',
        background: bg,
        color: fg,
        border: '1px solid var(--g-color-border-subtle)',
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-12)',
        fontWeight: 600,
        lineHeight: 'var(--g-leading-heading)',
        maxInlineSize: '100%',
      }}
    >
      {icon}
      <Box component="span" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </Box>
    </Box>
  );
}

export function GamificationStrip({
  streakDays = 0,
  streakState = 'active',
  achievement = null,
  streakLabelSingular = 'day streak',
  streakLabelPlural = 'day streak',
  restartLabel = 'Fresh start — pick up any time',
  frozenLabel = 'Streak frozen — resting this one',
}) {
  let streakPill;
  if (streakState === 'broken') {
    streakPill = (
      <Pill
        icon={<IconSeeding size={14} stroke={1.6} aria-hidden="true" style={{ color: 'var(--g-color-state-success-fg)' }} />}
        fg="var(--g-color-text-secondary)"
        bg="var(--g-color-state-info-bg)"
      >
        {restartLabel}
      </Pill>
    );
  } else if (streakState === 'frozen') {
    streakPill = (
      <Pill
        icon={<IconSnowflake size={14} stroke={1.6} aria-hidden="true" style={{ color: 'var(--g-color-state-info-fg)' }} />}
        fg="var(--g-color-text-secondary)"
        bg="var(--g-color-state-info-bg)"
      >
        {frozenLabel}
      </Pill>
    );
  } else {
    const unit = streakDays === 1 ? streakLabelSingular : streakLabelPlural;
    streakPill = (
      <Pill
        icon={<IconFlame size={14} stroke={1.6} aria-hidden="true" style={{ color: 'var(--g-color-food-saffron)' }} />}
        fg="var(--g-color-text-primary)"
        bg="var(--g-color-brand-50)"
      >
        {`${streakDays} ${unit}`}
      </Pill>
    );
  }

  return (
    <Group
      gap="var(--g-space-2)"
      wrap="wrap"
      role="group"
      aria-label="Your progress"
      style={{ rowGap: 'var(--g-space-1)' }}
    >
      {streakPill}
      {achievement?.label && (
        <Pill
          icon={<IconTrophy size={14} stroke={1.6} aria-hidden="true" style={{ color: 'var(--g-color-state-warning-fg)' }} />}
          fg="var(--g-color-text-primary)"
          bg="var(--g-color-state-warning-bg)"
        >
          {achievement.label}
        </Pill>
      )}
    </Group>
  );
}

export default GamificationStrip;
