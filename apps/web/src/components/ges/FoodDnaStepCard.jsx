import { Box, Stack, Group, Text, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconShieldLock } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { riseIn, pressResponse, withReducedMotion } from '../../lib/motion';

/**
 * FoodDnaStepCard (PL row 24) — one Food DNA onboarding question.
 *
 * Anatomy: progress DOTS (never a % anxiety bar — GES) + a display-type question
 * + an answer-controls slot (chips/slider/stepper — typing is a last resort) +
 * next/skip. The allergy step adds a privacy note + an explicit confirm framing
 * (declared allergies are sensitive + safety-critical). Answers should be cached
 * on save-error (caller). Quick (≤15s) and one-thumb.
 *
 * Motion: settle on mount + pressResponse. Reduced-motion safe. RTL-safe.
 * Pure presentational. Token-pure. No medical framing.
 *
 * Props:
 *  - stepNumber / totalSteps: drive the dots
 *  - question: the question text (display font)
 *  - children: the answer controls (Chips / Stepper / etc.)
 *  - onNext / onSkip: navigation callbacks
 *  - isAllergyStep: boolean — shows the privacy note + confirm-framed primary
 *  - allergyNote: privacy copy for the allergy step
 *  - saving: boolean — primary shows a busy label and blocks re-tap
 *  - saveError: string — calm inline notice (answer cached locally)
 *  - nextLabel / skipLabel / confirmLabel: copy overrides
 */
export function FoodDnaStepCard({
  stepNumber = 1,
  totalSteps = 1,
  question,
  children,
  onNext,
  onSkip,
  isAllergyStep = false,
  allergyNote = 'Allergies stay private and are used only to keep suggestions safe for you.',
  saving = false,
  saveError,
  nextLabel = 'Next',
  skipLabel = 'Skip',
  confirmLabel = 'Confirm',
}) {
  const dots = Math.max(1, totalSteps);
  const primaryLabel = saving ? 'Saving…' : isAllergyStep ? confirmLabel : nextLabel;

  return (
    <motion.div variants={withReducedMotion(riseIn)} initial="initial" animate="animate" style={{ inlineSize: '100%' }}>
      <Stack
        style={{
          gap: 'var(--g-space-5)',
          padding: 'var(--g-space-5)',
          borderRadius: 'var(--g-radius-card)',
          background: 'var(--g-color-bg-surface)',
          border: '1px solid var(--g-color-border-subtle)',
          boxShadow: 'var(--g-shadow-1)',
          inlineSize: '100%',
        }}
      >
        {/* Progress dots (not a percentage bar) */}
        <Group gap="var(--g-space-1)" wrap="wrap" role="group" aria-label={`Question ${stepNumber} of ${dots}`}>
          {Array.from({ length: dots }).map((_, i) => {
            const done = i + 1 <= stepNumber;
            return (
              <Box
                key={i}
                aria-hidden="true"
                style={{
                  blockSize: 6, inlineSize: i + 1 === stepNumber ? 22 : 6,
                  borderRadius: 'var(--g-radius-chip)',
                  background: done ? 'var(--g-color-food-saffron)' : 'var(--g-color-border-strong)',
                }}
              />
            );
          })}
        </Group>

        <Text
          component="h2"
          style={{
            fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-22)',
            fontWeight: 700,
            lineHeight: 'var(--g-leading-heading)',
            color: 'var(--g-color-text-primary)',
            textAlign: 'start',
          }}
        >
          {question}
        </Text>

        {/* Answer controls slot */}
        <Box>{children}</Box>

        {isAllergyStep && (
          <Group wrap="nowrap" align="flex-start" style={{ gap: 'var(--g-space-2)', padding: 'var(--g-space-3)', borderRadius: 'var(--g-radius-input)', background: 'var(--g-color-state-info-bg)' }}>
            <IconShieldLock size={18} stroke={1.6} aria-hidden="true" style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }} />
            <Text style={{ fontSize: 'var(--g-font-size-12)', lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)', textAlign: 'start' }}>
              {allergyNote}
            </Text>
          </Group>
        )}

        {saveError && (
          <Text role="alert" style={{ fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', textAlign: 'start' }}>
            {saveError}
          </Text>
        )}

        <Group wrap="nowrap" justify="space-between" align="center" style={{ gap: 'var(--g-space-3)' }}>
          {onSkip && !isAllergyStep ? (
            <UnstyledButton
              type="button"
              onClick={onSkip}
              aria-label={skipLabel}
              style={{ minHeight: 44, paddingInline: 'var(--g-space-3)', background: 'transparent', color: 'var(--g-color-text-muted)', fontFamily: 'var(--g-font-text)', fontSize: 'var(--g-font-size-14)', fontWeight: 500 }}
            >
              {skipLabel}
            </UnstyledButton>
          ) : <span />}

          <UnstyledButton
            component={motion.button}
            type="button"
            onClick={() => !saving && onNext?.()}
            whileTap={pressResponse.whileTap}
            aria-label={primaryLabel}
            aria-busy={saving || undefined}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--g-space-1)',
              minHeight: 44, paddingInline: 'var(--g-space-6)', borderRadius: 'var(--g-radius-input)',
              background: 'var(--g-color-food-saffron)', color: 'var(--g-color-text-inverse)',
              fontFamily: 'var(--g-font-display)', fontSize: 'var(--g-font-size-16)', fontWeight: 600,
              boxShadow: 'var(--g-shadow-1)', cursor: saving ? 'progress' : 'pointer', opacity: saving ? 0.8 : 1,
            }}
          >
            {primaryLabel}
            {!saving && <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" />}
          </UnstyledButton>
        </Group>
      </Stack>
    </motion.div>
  );
}

export default FoodDnaStepCard;
