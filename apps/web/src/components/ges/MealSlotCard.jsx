import { Box, Stack, Group, Text, UnstyledButton } from '@mantine/core';
import {
  IconPlus, IconSparkles, IconLock, IconCheck, IconAlertCircle, IconRefresh,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse, withReducedMotion, riseIn } from '../../lib/motion';
import { WhyChip } from './WhyChip';
import { StatusBadge } from './StatusBadge';

/**
 * MealSlotCard (PL row 21) — one planner slot (day + meal).
 *
 * States: empty | suggested | filled | locked | error.
 * The cardinal rule (E47 Annex): an AI suggestion is NEVER auto-committed. The
 * 'suggested' state is a distinct pending-confirm visual with explicit
 * Confirm / Decline buttons; only Confirm writes. Every AI fill shows a
 * confidence badge AND a Why chip (explainability) — uncertainty is never hidden.
 *
 * - empty:     invite affordance ("add or ask AI")
 * - suggested: pending-confirm (recipe + confidence badge + Why + confirm/decline)
 * - filled:    user-confirmed recipe (clearable)
 * - locked:    user-set, lock glyph
 * - error:     calm inline retry, keeps the pending suggestion visible
 *
 * Motion: settle on mount + pressResponse on controls (reduced-motion safe).
 * RTL-safe (logical spacing/order). Pure presentational — behavior via callbacks.
 *
 * Props:
 *  - dayLabel / mealLabel: slot identity (e.g. "Mon" / "Dinner")
 *  - state: 'empty' | 'suggested' | 'filled' | 'locked' | 'error' (default 'empty')
 *  - recipeTitle: the recipe in the slot (suggested/filled/locked)
 *  - confidence: 'high' | 'medium' (shown on AI suggestions only)
 *  - onAdd / onAskAi: empty-state affordances
 *  - onConfirm / onDecline: explicit suggestion confirm/decline (the write gate)
 *  - onClear: clear a filled slot (caller offers undo)
 *  - onWhy: open the Why sheet for the suggestion
 *  - onRetry: error-state retry
 */
const CONFIDENCE_COPY = { high: 'High confidence', medium: 'Medium confidence' };

export function MealSlotCard({
  dayLabel = '',
  mealLabel = '',
  state = 'empty',
  recipeTitle = '',
  confidence = 'medium',
  onAdd,
  onAskAi,
  onConfirm,
  onDecline,
  onClear,
  onWhy,
  onRetry,
}) {
  const slotName = [dayLabel, mealLabel].filter(Boolean).join(' · ');

  const SlotLabel = (
    <Text
      style={{
        fontFamily: 'var(--g-font-text)',
        fontSize: 'var(--g-font-size-12)',
        fontWeight: 600,
        letterSpacing: '0.02em',
        color: 'var(--g-color-text-muted)',
        textAlign: 'start',
      }}
    >
      {slotName}
    </Text>
  );

  const shell = (children, extra = {}) => (
    <motion.div
      variants={withReducedMotion(riseIn)}
      initial="initial"
      animate="animate"
      data-state={state}
      style={{ inlineSize: '100%' }}
    >
      <Box
        style={{
          inlineSize: '100%',
          background: 'var(--g-color-bg-surface)',
          border: '1px solid var(--g-color-border-subtle)',
          borderRadius: 'var(--g-radius-card)',
          boxShadow: 'var(--g-shadow-1)',
          padding: 'var(--g-space-3)',
          ...extra,
        }}
      >
        <Stack style={{ gap: 'var(--g-space-2)' }}>
          {slotName && SlotLabel}
          {children}
        </Stack>
      </Box>
    </motion.div>
  );

  const recipeLine = (
    <Text
      style={{
        fontFamily: 'var(--g-font-display)',
        fontSize: 'var(--g-font-size-16)',
        fontWeight: 600,
        lineHeight: 'var(--g-leading-heading)',
        color: 'var(--g-color-text-primary)',
        textAlign: 'start',
      }}
    >
      {recipeTitle}
    </Text>
  );

  // ── empty ──
  if (state === 'empty') {
    return shell(
      <Group wrap="nowrap" style={{ gap: 'var(--g-space-2)' }}>
        <UnstyledButton
          component={motion.button}
          type="button"
          onClick={onAdd}
          whileTap={pressResponse.whileTap}
          aria-label={`Add a recipe to ${slotName || 'this slot'}`}
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--g-space-1)',
            minHeight: 44,
            borderRadius: 'var(--g-radius-input)',
            background: 'var(--g-color-bg-canvas)',
            border: '1px dashed var(--g-color-border-strong)',
            color: 'var(--g-color-text-secondary)',
            fontFamily: 'var(--g-font-text)',
            fontSize: 'var(--g-font-size-14)',
            fontWeight: 500,
          }}
        >
          <IconPlus size={16} stroke={1.6} aria-hidden="true" />
          Add
        </UnstyledButton>
        {onAskAi && (
          <UnstyledButton
            component={motion.button}
            type="button"
            onClick={onAskAi}
            whileTap={pressResponse.whileTap}
            aria-label={`Ask AI for ${slotName || 'this slot'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--g-space-1)',
              minHeight: 44,
              paddingInline: 'var(--g-space-3)',
              borderRadius: 'var(--g-radius-input)',
              background: 'var(--g-color-ai-surface)',
              border: 'var(--g-border-ai)',
              color: 'var(--g-color-text-secondary)',
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-14)',
              fontWeight: 500,
            }}
          >
            <IconSparkles size={16} stroke={1.5} aria-hidden="true" style={{ color: 'var(--g-color-food-saffron)' }} />
            Ask AI
          </UnstyledButton>
        )}
      </Group>,
    );
  }

  // ── suggested (pending-confirm) — AI fill, NOT committed ──
  if (state === 'suggested') {
    return shell(
      <>
        <Group wrap="nowrap" justify="space-between" align="center" style={{ gap: 'var(--g-space-2)' }}>
          <Group wrap="nowrap" style={{ gap: 'var(--g-space-1)' }} align="center">
            <IconSparkles size={16} stroke={1.5} aria-hidden="true" style={{ color: 'var(--g-color-food-saffron)', flexShrink: 0 }} />
            <Text style={{ fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-12)', fontWeight: 600, letterSpacing: '0.04em', color: 'var(--g-color-text-secondary)' }}>
              AI suggestion
            </Text>
          </Group>
          <StatusBadge tone="info">{CONFIDENCE_COPY[confidence] ?? CONFIDENCE_COPY.medium}</StatusBadge>
        </Group>
        {recipeLine}
        {onWhy && <Box><WhyChip label="Why this?" onOpen={onWhy} ariaLabel={`Why this? — ${recipeTitle}`} /></Box>}
        <Group wrap="nowrap" style={{ gap: 'var(--g-space-2)' }}>
          <UnstyledButton
            component={motion.button}
            type="button"
            onClick={onDecline}
            whileTap={pressResponse.whileTap}
            aria-label="Decline suggestion"
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 44, borderRadius: 'var(--g-radius-input)',
              background: 'transparent', border: '1px solid var(--g-color-border-strong)',
              color: 'var(--g-color-text-secondary)', fontFamily: 'var(--g-font-display)',
              fontSize: 'var(--g-font-size-14)', fontWeight: 500,
            }}
          >
            Not now
          </UnstyledButton>
          <UnstyledButton
            component={motion.button}
            type="button"
            onClick={onConfirm}
            whileTap={pressResponse.whileTap}
            aria-label="Confirm suggestion"
            style={{
              flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--g-space-1)', minHeight: 44, borderRadius: 'var(--g-radius-input)',
              background: 'var(--g-color-food-saffron)', color: 'var(--g-color-text-inverse)',
              fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-14)', fontWeight: 600,
              boxShadow: 'var(--g-shadow-1)',
            }}
          >
            <IconCheck size={16} stroke={1.6} aria-hidden="true" />
            Add to plan
          </UnstyledButton>
        </Group>
      </>,
    );
  }

  // ── filled (user-confirmed) ──
  if (state === 'filled') {
    return shell(
      <Group wrap="nowrap" justify="space-between" align="center" style={{ gap: 'var(--g-space-2)' }}>
        {recipeLine}
        {onClear && (
          <UnstyledButton
            type="button"
            onClick={onClear}
            aria-label={`Clear ${recipeTitle}`}
            style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minHeight: 44, minWidth: 44, color: 'var(--g-color-text-muted)', background: 'transparent',
            }}
          >
            <IconPlus size={18} stroke={1.6} aria-hidden="true" style={{ transform: 'rotate(45deg)' }} />
          </UnstyledButton>
        )}
      </Group>,
    );
  }

  // ── locked (user-set) ──
  if (state === 'locked') {
    return shell(
      <Group wrap="nowrap" align="center" style={{ gap: 'var(--g-space-2)' }}>
        <IconLock size={16} stroke={1.6} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
        {recipeLine}
      </Group>,
    );
  }

  // ── error ──
  return shell(
    <Stack style={{ gap: 'var(--g-space-2)' }} role="alert" aria-live="assertive">
      <Group wrap="nowrap" align="flex-start" style={{ gap: 'var(--g-space-2)' }}>
        <IconAlertCircle size={18} stroke={1.5} aria-hidden="true" style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }} />
        <Text style={{ fontSize: 'var(--g-font-size-14)', color: 'var(--g-color-text-secondary)', textAlign: 'start' }}>
          Couldn’t save this slot. Nothing changed — you can try again.
        </Text>
      </Group>
      {onRetry && (
        <UnstyledButton
          component={motion.button}
          type="button"
          onClick={onRetry}
          whileTap={pressResponse.whileTap}
          aria-label="Try again"
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 'var(--g-space-1)',
            minHeight: 44, paddingInline: 'var(--g-space-3)', color: 'var(--g-color-food-saffron)',
            fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-14)', fontWeight: 600,
          }}
        >
          <IconRefresh size={16} stroke={1.5} aria-hidden="true" />
          Try again
        </UnstyledButton>
      )}
    </Stack>,
  );
}

export default MealSlotCard;
