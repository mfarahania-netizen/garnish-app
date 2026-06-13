import { Box, Stack, Group, Text, UnstyledButton } from '@mantine/core';
import {
  IconCircleDot,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { cardShift, pressResponse, withReducedMotion } from '../../lib/motion';
import { BottomSheet } from './BottomSheet';

/**
 * WhySheet (PL row 9) — show the reasons behind a recommendation + offer a
 * one-tap correction.
 *
 * Composes BottomSheet for all sheet chrome (grabber, title, scrim, focus trap,
 * ESC/back, sheetEnter motion). Body anatomy: a title (delegated to BottomSheet),
 * up to THREE ranked reasons (icon + text, rendered with list semantics), then a
 * correction row of three quick one-tap options, then close (BottomSheet's close).
 *
 * SAFETY (PL row 9 + library-wide rule 3): reasons are rendered STRICTLY from the
 * passed `reasons` prop — this component never invents, pads, or decorates reasons.
 * If more than three are passed only the first three (highest-ranked) are shown. If
 * none are available the sheet shows the designed empty-fallback copy
 * ("based on your basics") — NOT a fabricated reason. Copy stays plain, never
 * preachy or medical.
 *
 * States (`state` prop):
 *  - 'loading'        — calm skeleton lines (g-skeleton), aria-busy
 *  - 'reasons'        — the ranked reasons list (default when reasons exist)
 *  - 'empty-fallback' — honest "based on your basics" message (no reasons payload)
 *  - 'error'          — inline, calm error + Retry (nothing was changed)
 *
 * Motion: cardShift staggers the reason list in (<=6 items, reduced-motion safe via
 * withReducedMotion); pressResponse on the correction/retry buttons. No inline
 * transitions, no keyframes.
 *
 * A11y: reasons are a real <ul>/<li> list; corrections are real <button>s with
 * 44px targets and aria-labels; error is announced assertively with a focusable
 * Retry. Sheet a11y (aria-modal, trap, ESC) inherited from BottomSheet.
 *
 * Pure presentational — behavior via callbacks only. No network, no logic.
 *
 * Props:
 *  - opened: boolean — controls visibility (default false)
 *  - onClose: () => void — close (scrim tap / ESC / close button)
 *  - title: sheet heading (default "Why this?")
 *  - state: 'loading' | 'reasons' | 'empty-fallback' | 'error'
 *  - reasons: array of reason items, rendered as-is (max 3 shown). Each item may be
 *      a string, or { text, icon? } where `icon` is a ReactNode glyph.
 *  - onCorrect: (option) => void — fired with the chosen correction option
 *  - corrections: array of <=3 quick correction options; each { id, label } (or a
 *      string). Defaults to three neutral, non-preachy options.
 *  - correctionTitle: heading above the correction row
 *  - emptyFallbackText: copy for the empty-fallback state
 *  - retryLabel: label for the error Retry button
 *  - onRetry: () => void — retry callback for the error state
 */
export function WhySheet({
  opened = false,
  onClose,
  title = 'Why this?',
  state = 'reasons',
  reasons = [],
  onCorrect,
  corrections = [
    { id: 'not-relevant', label: 'Not for me' },
    { id: 'seen-enough', label: 'Seen enough of this' },
    { id: 'wrong-reason', label: 'Wrong reason' },
  ],
  correctionTitle = 'Not quite right?',
  emptyFallbackText = 'This is based on your basics — your tastes and the choices you’ve made so far.',
  retryLabel = 'Try again',
  onRetry,
}) {
  // Reasons come ONLY from the prop; never fabricated, capped at three (ranked).
  const rankedReasons = Array.isArray(reasons) ? reasons.slice(0, 3) : [];

  // Normalise correction options to { id, label } shape.
  const correctionOptions = (Array.isArray(corrections) ? corrections : [])
    .slice(0, 3)
    .map((opt, i) =>
      typeof opt === 'string' ? { id: String(i), label: opt } : opt,
    );

  const renderReasonsBody = () => (
    <Stack
      component={motion.ul}
      variants={withReducedMotion(cardShift.container)}
      initial="initial"
      animate="animate"
      style={{
        gap: 'var(--g-space-3)',
        margin: 0,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {rankedReasons.map((reason, i) => {
        const text = typeof reason === 'string' ? reason : reason?.text;
        const icon = typeof reason === 'string' ? null : reason?.icon;
        return (
          <Group
            key={i}
            component={motion.li}
            variants={withReducedMotion(cardShift.item)}
            wrap="nowrap"
            align="flex-start"
            style={{ gap: 'var(--g-space-2)' }}
          >
            <Box
              aria-hidden="true"
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                color: 'var(--g-color-food-saffron)',
                marginBlockStart: '2px',
              }}
            >
              {icon || <IconCircleDot size={18} stroke={1.5} />}
            </Box>
            <Text
              style={{
                flex: 1,
                minInlineSize: 0,
                fontFamily: 'var(--g-font-text)',
                fontSize: 'var(--g-font-size-14)',
                lineHeight: 'var(--g-leading-body)',
                color: 'var(--g-color-text-primary)',
                textAlign: 'start',
              }}
            >
              {text}
            </Text>
          </Group>
        );
      })}
    </Stack>
  );

  const renderEmptyFallback = () => (
    <Box
      role="status"
      style={{
        inlineSize: '100%',
        background: 'var(--g-color-state-info-bg)',
        borderRadius: 'var(--g-radius-input)',
        padding: 'var(--g-space-4)',
      }}
    >
      <Text
        style={{
          fontFamily: 'var(--g-font-text)',
          fontSize: 'var(--g-font-size-14)',
          lineHeight: 'var(--g-leading-body)',
          color: 'var(--g-color-text-secondary)',
          textAlign: 'start',
        }}
      >
        {emptyFallbackText}
      </Text>
    </Box>
  );

  const renderLoading = () => (
    <Box
      role="status"
      aria-busy="true"
      aria-live="polite"
      style={{ inlineSize: '100%' }}
    >
      <span className="g-sr-only">Loading</span>
      <Stack style={{ gap: 'var(--g-space-3)' }}>
        {['100%', '88%', '72%'].map((w, i) => (
          <Group key={i} wrap="nowrap" align="center" style={{ gap: 'var(--g-space-2)' }}>
            <Box
              className="g-skeleton"
              aria-hidden="true"
              style={{ inlineSize: 18, blockSize: 18, borderRadius: 'var(--g-radius-chip)', flexShrink: 0 }}
            />
            <Box
              className="g-skeleton"
              aria-hidden="true"
              style={{ blockSize: 'var(--g-space-4)', inlineSize: w }}
            />
          </Group>
        ))}
      </Stack>
    </Box>
  );

  const renderError = () => (
    <Box
      role="alert"
      aria-live="assertive"
      style={{
        inlineSize: '100%',
        background: 'var(--g-color-state-info-bg)',
        borderRadius: 'var(--g-radius-input)',
        padding: 'var(--g-space-4)',
      }}
    >
      <Stack style={{ gap: 'var(--g-space-3)' }} align="flex-start">
        <Group wrap="nowrap" align="flex-start" style={{ gap: 'var(--g-space-2)' }}>
          <IconAlertCircle
            size={20}
            stroke={1.5}
            aria-hidden="true"
            style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }}
          />
          <Text
            style={{
              fontFamily: 'var(--g-font-text)',
              fontSize: 'var(--g-font-size-14)',
              lineHeight: 'var(--g-leading-body)',
              color: 'var(--g-color-text-secondary)',
              textAlign: 'start',
            }}
          >
            We couldn’t load the reasons just now. Nothing changed — you can try again.
          </Text>
        </Group>
        {onRetry && (
          <UnstyledButton
            component={motion.button}
            type="button"
            onClick={() => onRetry?.()}
            whileTap={pressResponse.whileTap}
            aria-label={retryLabel}
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
            <IconRefresh size={16} stroke={1.5} aria-hidden="true" />
            {retryLabel}
          </UnstyledButton>
        )}
      </Stack>
    </Box>
  );

  // Resolve body by state. If state is 'reasons' but the payload is empty, fall
  // back to the honest empty-fallback rather than an empty list (never fabricate).
  const renderBody = () => {
    if (state === 'loading') return renderLoading();
    if (state === 'error') return renderError();
    if (state === 'empty-fallback') return renderEmptyFallback();
    // 'reasons'
    return rankedReasons.length > 0 ? renderReasonsBody() : renderEmptyFallback();
  };

  // Correction row: only meaningful when there is something to correct (reasons /
  // empty-fallback). Hidden during loading/error so we never offer a correction
  // for content that isn't on screen.
  const showCorrections =
    correctionOptions.length > 0 &&
    (state === 'reasons' || state === 'empty-fallback');

  return (
    <BottomSheet opened={opened} onClose={onClose} title={title} closeLabel="Close">
      {renderBody()}

      {showCorrections && (
        <Box>
          <Text
            component="h3"
            style={{
              fontFamily: 'var(--g-font-display)',
              fontSize: 'var(--g-font-size-14)',
              fontWeight: 600,
              color: 'var(--g-color-text-secondary)',
              textAlign: 'start',
              marginBlockEnd: 'var(--g-space-2)',
            }}
          >
            {correctionTitle}
          </Text>
          <Group wrap="wrap" style={{ gap: 'var(--g-space-2)' }}>
            {correctionOptions.map((option) => (
              <UnstyledButton
                key={option.id}
                component={motion.button}
                type="button"
                onClick={() => onCorrect?.(option)}
                whileTap={pressResponse.whileTap}
                aria-label={option.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 44,
                  paddingInline: 'var(--g-space-4)',
                  borderRadius: 'var(--g-radius-chip)',
                  background: 'var(--g-color-bg-surface)',
                  border: '1px solid var(--g-color-border-strong)',
                  color: 'var(--g-color-text-primary)',
                  fontFamily: 'var(--g-font-text)',
                  fontSize: 'var(--g-font-size-14)',
                  fontWeight: 500,
                  textAlign: 'start',
                }}
              >
                {option.label}
              </UnstyledButton>
            ))}
          </Group>
        </Box>
      )}
    </BottomSheet>
  );
}

export default WhySheet;
