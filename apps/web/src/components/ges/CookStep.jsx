import { Box, Stack, Group, Text, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconCheck } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { riseIn, pressResponse, withReducedMotion } from '../../lib/motion';

/**
 * CookStep (PL row 17) — one distraction-free step of Cook Mode.
 *
 * Anatomy: step-index dots + large instruction text (>=22px, <=2 lines) +
 * optional media + inline ingredient refs + an optional timer slot + giant
 * (>=56px) prev/next controls anchored at the bottom by logical start/end.
 * States: active | done | upcoming (and "with-timer" when a timer node is given).
 *
 * Beginner-clear, food-specific copy is the caller's responsibility; this shell
 * guarantees the legibility + reach contract (text scalable, controls big and
 * bottom-anchored, never mid-screen). One step per screen — no recipe scroller.
 *
 * Motion: a single settle (riseIn) on mount, reduced-motion safe. No looping.
 * Celebrate (done) is the caller's concern (≤1/session) — not fired here.
 *
 * RTL-safe: prev points to logical start, next to logical end; icons chosen for
 * the RTL-first layout (LTR icon mirroring is handled in S24). Pure presentational.
 *
 * Props:
 *  - stepNumber: 1-based index of this step (default 1)
 *  - totalSteps: total step count (drives the dots; default 1)
 *  - children / text: the instruction (children wins; >=22px, 2-line clamp)
 *  - media: optional ReactNode (image/illustration) rendered above the text
 *  - ingredientRefs: [{ id, label, onPeek }] inline ingredient chips
 *  - timer: optional ReactNode (e.g. <TimerChip/>) shown under the text
 *  - state: 'active' | 'done' | 'upcoming' (default 'active')
 *  - onPrev / onNext: navigation callbacks
 *  - isFirst / isLast: hide prev / relabel next
 *  - prevLabel / nextLabel / doneLabel: copy overrides
 */
export function CookStep({
  stepNumber = 1,
  totalSteps = 1,
  children,
  text,
  media = null,
  ingredientRefs = [],
  timer = null,
  state = 'active',
  onPrev,
  onNext,
  isFirst = false,
  isLast = false,
  prevLabel = 'Back',
  nextLabel = 'Next',
  doneLabel = 'Done',
}) {
  const body = children ?? text;
  const dots = Math.max(1, totalSteps);

  return (
    <motion.div
      variants={withReducedMotion(riseIn)}
      initial="initial"
      animate="animate"
      data-state={state}
      style={{ inlineSize: '100%' }}
    >
      <Stack style={{ gap: 'var(--g-space-5)', inlineSize: '100%' }}>
        {/* Step-index dots */}
        <Group
          gap="var(--g-space-1)"
          wrap="wrap"
          role="group"
          aria-label={`Step ${stepNumber} of ${dots}`}
        >
          {Array.from({ length: dots }).map((_, i) => {
            const isCurrent = i + 1 === stepNumber;
            const isPast = i + 1 < stepNumber;
            return (
              <Box
                key={i}
                aria-hidden="true"
                style={{
                  blockSize: 4,
                  inlineSize: isCurrent ? 24 : 12,
                  borderRadius: 'var(--g-radius-chip)',
                  background:
                    isCurrent || isPast
                      ? 'var(--g-color-food-saffron)'
                      : 'var(--g-color-border-strong)',
                }}
              />
            );
          })}
        </Group>

        {media && (
          <Box
            style={{
              inlineSize: '100%',
              aspectRatio: '4 / 3',
              borderRadius: 'var(--g-radius-photo)',
              overflow: 'hidden',
              background: 'var(--g-color-bg-canvas)',
            }}
          >
            {media}
          </Box>
        )}

        {/* Instruction — large, scalable, 2-line clamp */}
        <Group wrap="nowrap" align="flex-start" style={{ gap: 'var(--g-space-2)' }}>
          {state === 'done' && (
            <IconCheck
              size={28}
              stroke={1.6}
              aria-hidden="true"
              style={{ color: 'var(--g-color-state-success-fg)', flexShrink: 0 }}
            />
          )}
          <Text
            style={{
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-22)',
              fontWeight: 500,
              lineHeight: 'var(--g-leading-body)',
              color: 'var(--g-color-text-primary)',
              textAlign: 'start',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {body}
          </Text>
        </Group>

        {timer && <Box>{timer}</Box>}

        {/* Inline ingredient refs — tap to peek */}
        {ingredientRefs.length > 0 && (
          <Group gap="var(--g-space-2)" wrap="wrap">
            {ingredientRefs.map((ref) => (
              <UnstyledButton
                key={ref.id ?? ref.label}
                component={motion.button}
                type="button"
                onClick={() => ref.onPeek?.(ref)}
                whileTap={pressResponse.whileTap}
                aria-label={`Ingredient: ${ref.label}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 44,
                  paddingInline: 'var(--g-space-3)',
                  borderRadius: 'var(--g-radius-chip)',
                  background: 'var(--g-color-bg-surface)',
                  border: '1px solid var(--g-color-border-strong)',
                  color: 'var(--g-color-text-primary)',
                  fontFamily: 'var(--g-font-text)',
                  fontSize: 'var(--g-font-size-14)',
                  fontWeight: 500,
                }}
              >
                {ref.label}
              </UnstyledButton>
            ))}
          </Group>
        )}

        {/* Giant bottom controls — prev (start) + next (end) */}
        <Group wrap="nowrap" style={{ gap: 'var(--g-space-3)', inlineSize: '100%' }}>
          {!isFirst && (
            <UnstyledButton
              component={motion.button}
              type="button"
              onClick={onPrev}
              whileTap={pressResponse.whileTap}
              aria-label={prevLabel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--g-space-1)',
                minBlockSize: 56,
                paddingInline: 'var(--g-space-5)',
                borderRadius: 'var(--g-radius-input)',
                background: 'var(--g-color-bg-surface)',
                border: '1px solid var(--g-color-border-strong)',
                color: 'var(--g-color-text-primary)',
                fontFamily: 'var(--g-font-display)',
                fontSize: 'var(--g-font-size-18)',
                fontWeight: 600,
                flex: '0 0 auto',
              }}
            >
              <IconChevronRight size={22} stroke={1.6} aria-hidden="true" />
              {prevLabel}
            </UnstyledButton>
          )}
          <UnstyledButton
            component={motion.button}
            type="button"
            onClick={onNext}
            whileTap={pressResponse.whileTap}
            aria-label={isLast ? doneLabel : nextLabel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--g-space-1)',
              minBlockSize: 56,
              paddingInline: 'var(--g-space-5)',
              borderRadius: 'var(--g-radius-input)',
              background: 'var(--g-color-food-saffron)',
              color: 'var(--g-color-text-inverse)',
              fontFamily: 'var(--g-font-display)',
              fontSize: 'var(--g-font-size-18)',
              fontWeight: 700,
              boxShadow: 'var(--g-shadow-1)',
              flex: 1,
            }}
          >
            {isLast ? doneLabel : nextLabel}
            {!isLast && <IconChevronLeft size={22} stroke={1.6} aria-hidden="true" />}
          </UnstyledButton>
        </Group>
      </Stack>
    </motion.div>
  );
}

export default CookStep;
