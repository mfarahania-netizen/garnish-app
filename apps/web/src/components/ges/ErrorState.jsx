import { useState } from 'react';
import { Box, Stack, Group, Text, UnstyledButton } from '@mantine/core';
import { IconRefresh, IconAlertCircle, IconWifiOff, IconChevronDown } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { gentleFade, pressResponse, withReducedMotion } from '../../lib/motion';

/**
 * ErrorState (PL row 14) — Preserve trust on failure.
 * Anatomy: neutral icon + what happened + what's safe + Retry button + details disclosure (tech).
 * Variants: inline | section | full, plus an offline mode that says what still works.
 * Calm copy only (no raw codes, no blame, no dead ends). Behavior via onRetry callback.
 *
 * Props:
 *  - title: what happened (plain language)
 *  - message: what's safe / reassurance line
 *  - onRetry: callback; when provided a Retry button renders (focusable first)
 *  - details: optional technical text behind a disclosure (kept out of the way)
 *  - variant: 'inline' | 'section' | 'full'
 *  - offline: boolean — shows offline icon + "still works" framing
 *  - retryLabel / detailsLabel: copy overrides
 */
export function ErrorState({
  title,
  message,
  onRetry,
  details,
  variant = 'section',
  offline = false,
  retryLabel = 'Try again',
  detailsLabel = 'Show details',
}) {
  const [showDetails, setShowDetails] = useState(false);

  const resolvedTitle =
    title || (offline ? "You're offline" : 'Something went wrong');
  const resolvedMessage =
    message ||
    (offline
      ? 'Your saved content is still here. We will reconnect when you are back online.'
      : 'Nothing was lost. You can try again in a moment.');

  const isFull = variant === 'full';
  const isInline = variant === 'inline';
  const Icon = offline ? IconWifiOff : IconAlertCircle;

  const containerStyle = {
    inlineSize: '100%',
    background: 'var(--g-color-bg-surface)',
    borderRadius: 'var(--g-radius-card)',
    border: '1px solid var(--g-color-border-subtle)',
    paddingBlock: isFull ? 'var(--g-space-10)' : 'var(--g-space-6)',
    paddingInline: 'var(--g-space-5)',
    ...(isFull
      ? {
          minBlockSize: '60dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }
      : {}),
  };

  // Inline variant: compact single row, no card chrome.
  if (isInline) {
    return (
      <motion.div
        variants={withReducedMotion(gentleFade)}
        initial="initial"
        animate="animate"
      >
        <Group
          role="alert"
          aria-live="assertive"
          wrap="nowrap"
          style={{
            gap: 'var(--g-space-2)',
            paddingBlock: 'var(--g-space-2)',
            paddingInline: 'var(--g-space-3)',
            borderRadius: 'var(--g-radius-input)',
            background: 'var(--g-color-state-info-bg)',
          }}
        >
          <Icon
            size={18}
            stroke={1.5}
            aria-hidden="true"
            style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }}
          />
          <Text
            style={{
              flex: 1,
              fontSize: 'var(--g-font-size-14)',
              color: 'var(--g-color-text-secondary)',
              textAlign: 'start',
            }}
          >
            {resolvedTitle}
          </Text>
          {onRetry && (
            <UnstyledButton
              component={motion.button}
              type="button"
              onClick={onRetry}
              whileTap={pressResponse.whileTap}
              aria-label={retryLabel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--g-space-1)',
                minHeight: 44,
                minWidth: 44,
                paddingInline: 'var(--g-space-3)',
                borderRadius: 'var(--g-radius-input)',
                color: 'var(--g-color-food-saffron)',
                fontSize: 'var(--g-font-size-14)',
                fontFamily: 'var(--g-font-display)',
                flexShrink: 0,
              }}
            >
              <IconRefresh size={16} stroke={1.5} aria-hidden="true" />
              {retryLabel}
            </UnstyledButton>
          )}
        </Group>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={withReducedMotion(gentleFade)}
      initial="initial"
      animate="animate"
      data-variant={variant}
    >
      <Box role="alert" aria-live="assertive" style={containerStyle}>
        <Stack
          align="center"
          style={{ gap: 'var(--g-space-4)', textAlign: 'center', maxWidth: 420 }}
        >
          <Box
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 56,
              minHeight: 56,
              borderRadius: 'var(--g-radius-card)',
              background: 'var(--g-color-state-info-bg)',
              color: 'var(--g-color-text-secondary)',
            }}
          >
            <Icon size={26} stroke={1.5} />
          </Box>

          <Stack align="center" style={{ gap: 'var(--g-space-2)' }}>
            <Text
              component="h3"
              style={{
                fontFamily: 'var(--g-font-display)',
                fontSize: 'var(--g-font-size-18)',
                lineHeight: 'var(--g-leading-heading)',
                color: 'var(--g-color-text-primary)',
              }}
            >
              {resolvedTitle}
            </Text>
            <Text
              style={{
                fontSize: 'var(--g-font-size-14)',
                lineHeight: 'var(--g-leading-body)',
                color: 'var(--g-color-text-secondary)',
              }}
            >
              {resolvedMessage}
            </Text>
          </Stack>

          {/* Retry button is the first interactive control (focus order) */}
          {onRetry && (
            <UnstyledButton
              component={motion.button}
              type="button"
              onClick={onRetry}
              whileTap={pressResponse.whileTap}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--g-space-2)',
                minHeight: 44,
                minWidth: 44,
                paddingInline: 'var(--g-space-5)',
                paddingBlock: 'var(--g-space-3)',
                borderRadius: 'var(--g-radius-input)',
                background: 'var(--g-color-food-saffron)',
                color: 'var(--g-color-text-inverse)',
                fontSize: 'var(--g-font-size-16)',
                fontFamily: 'var(--g-font-display)',
                boxShadow: 'var(--g-shadow-1)',
              }}
            >
              <IconRefresh size={18} stroke={1.5} aria-hidden="true" />
              {retryLabel}
            </UnstyledButton>
          )}

          {/* Technical details kept behind a disclosure — never shown by default */}
          {details && (
            <Box style={{ inlineSize: '100%' }}>
              <UnstyledButton
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                aria-expanded={showDetails}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--g-space-1)',
                  minHeight: 44,
                  paddingInline: 'var(--g-space-3)',
                  color: 'var(--g-color-text-muted)',
                  fontSize: 'var(--g-font-size-12)',
                }}
              >
                <IconChevronDown
                  size={14}
                  stroke={1.5}
                  aria-hidden="true"
                  style={{
                    transform: showDetails ? 'rotate(180deg)' : 'none',
                  }}
                />
                {detailsLabel}
              </UnstyledButton>
              {showDetails && (
                <Box
                  style={{
                    marginBlockStart: 'var(--g-space-2)',
                    padding: 'var(--g-space-3)',
                    borderRadius: 'var(--g-radius-input)',
                    background: 'var(--g-color-bg-canvas)',
                    border: '1px solid var(--g-color-border-subtle)',
                  }}
                >
                  <Text
                    component="pre"
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 'var(--g-font-size-12)',
                      fontFamily: 'var(--g-font-text)',
                      color: 'var(--g-color-text-muted)',
                      textAlign: 'start',
                    }}
                  >
                    {details}
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Stack>
      </Box>
    </motion.div>
  );
}

export default ErrorState;
