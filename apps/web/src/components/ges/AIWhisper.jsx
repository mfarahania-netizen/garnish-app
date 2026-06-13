import { Box, Stack, Group, Text, UnstyledButton } from '@mantine/core';
import { IconSparkles, IconCheck, IconX } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { whisperPulse, pressResponse, withReducedMotion } from '../../lib/motion';

/**
 * AIWhisper (PL row 5) — one in-context AI suggestion.
 *
 * Anatomy: ai-surface card + disclosure header ("AI" label + glyph) + one-line
 * suggestion text + reason snippet + accept/dismiss actions.
 *
 * Motion: whisperPulse fires ONCE on mount (a single soft halo, never looping),
 * routed through withReducedMotion so reduced-motion users get a calm fade.
 *
 * A11y: the card announces politely (aria-live="polite"); both actions are
 * keyboard-reachable real buttons with 44px targets and aria-labels.
 *
 * Pure presentational. Behavior via callbacks only — no auto-apply, no network,
 * no autonomous-agent language. Disclosure is mandatory (EPIC 40).
 *
 * Props:
 *  - text: the one-line suggestion (required for a meaningful whisper)
 *  - reason: short reason snippet tying the suggestion to current context
 *  - onAccept / onDismiss: callbacks (accept never auto-applies a write)
 *  - acceptLabel / dismissLabel: copy overrides
 *  - aiLabel: disclosure label text (default "AI")
 */
export function AIWhisper({
  text = '',
  reason = '',
  onAccept,
  onDismiss,
  acceptLabel = 'Add',
  dismissLabel = 'Dismiss',
  aiLabel = 'AI',
}) {
  // Empty handling: nothing meaningful to whisper → render nothing (never an
  // empty labelled card, which would imply an idle agent).
  if (!text) return null;

  return (
    <motion.div
      variants={withReducedMotion(whisperPulse)}
      initial="initial"
      animate="animate"
    >
      <Box
        role="status"
        aria-live="polite"
        style={{
          inlineSize: '100%',
          background: 'var(--g-color-ai-surface)',
          border: 'var(--g-border-ai)',
          borderRadius: 'var(--g-radius-card)',
          boxShadow: 'var(--g-shadow-1)',
          paddingBlock: 'var(--g-space-3)',
          paddingInline: 'var(--g-space-4)',
        }}
      >
        <Stack style={{ gap: 'var(--g-space-2)' }}>
          {/* Disclosure header — mandatory AI glyph + label */}
          <Group style={{ gap: 'var(--g-space-1)' }} wrap="nowrap" align="center">
            <IconSparkles
              size="var(--g-ai-glyph-size)"
              stroke={1.5}
              aria-hidden="true"
              style={{
                inlineSize: 'var(--g-ai-glyph-size)',
                blockSize: 'var(--g-ai-glyph-size)',
                color: 'var(--g-color-food-saffron)',
                flexShrink: 0,
              }}
            />
            <Text
              style={{
                fontFamily: 'var(--g-font-display)',
                fontSize: 'var(--g-font-size-12)',
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: 'var(--g-color-text-secondary)',
                textAlign: 'start',
              }}
            >
              {aiLabel}
            </Text>
          </Group>

          {/* One-line suggestion */}
          <Text
            style={{
              fontSize: 'var(--g-font-size-16)',
              lineHeight: 'var(--g-leading-body)',
              color: 'var(--g-color-text-primary)',
              textAlign: 'start',
            }}
          >
            {text}
          </Text>

          {/* Reason snippet — always carry a real reason tying to context */}
          {reason && (
            <Text
              style={{
                fontSize: 'var(--g-font-size-12)',
                lineHeight: 'var(--g-leading-body)',
                color: 'var(--g-color-text-muted)',
                textAlign: 'start',
              }}
            >
              {reason}
            </Text>
          )}

          {/* Actions — both keyboard-reachable; accept opens the user's flow,
              it never autonomously applies a write. */}
          <Group style={{ gap: 'var(--g-space-2)' }} wrap="nowrap">
            <UnstyledButton
              component={motion.button}
              type="button"
              onClick={onAccept}
              whileTap={pressResponse.whileTap}
              aria-label={acceptLabel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--g-space-1)',
                minHeight: 44,
                minWidth: 44,
                paddingInline: 'var(--g-space-4)',
                borderRadius: 'var(--g-radius-input)',
                background: 'var(--g-color-food-saffron)',
                color: 'var(--g-color-text-inverse)',
                fontFamily: 'var(--g-font-display)',
                fontSize: 'var(--g-font-size-14)',
                fontWeight: 600,
                boxShadow: 'var(--g-shadow-1)',
              }}
            >
              <IconCheck size={16} stroke={1.5} aria-hidden="true" />
              {acceptLabel}
            </UnstyledButton>

            <UnstyledButton
              component={motion.button}
              type="button"
              onClick={onDismiss}
              whileTap={pressResponse.whileTap}
              aria-label={dismissLabel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--g-space-1)',
                minHeight: 44,
                minWidth: 44,
                paddingInline: 'var(--g-space-4)',
                borderRadius: 'var(--g-radius-input)',
                background: 'transparent',
                border: '1px solid var(--g-color-border-strong)',
                color: 'var(--g-color-text-secondary)',
                fontFamily: 'var(--g-font-display)',
                fontSize: 'var(--g-font-size-14)',
                fontWeight: 500,
              }}
            >
              <IconX size={16} stroke={1.5} aria-hidden="true" />
              {dismissLabel}
            </UnstyledButton>
          </Group>
        </Stack>
      </Box>
    </motion.div>
  );
}

export default AIWhisper;
