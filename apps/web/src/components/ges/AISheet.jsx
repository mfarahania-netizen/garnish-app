import { useEffect, useRef } from 'react';
import { Box, Stack, Group, Text, UnstyledButton, ActionIcon } from '@mantine/core';
import {
  IconSparkles,
  IconX,
  IconCheck,
  IconShield,
  IconAlertCircle,
  IconRefresh,
} from '@tabler/icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  sheetEnter,
  gentleFade,
  pressResponse,
  withReducedMotion,
} from '../../lib/motion';

/**
 * AISheet (PL row 6) — act-on-the-current-object AI conversation.
 *
 * A bottom-sheet-styled surface anchored to one object. Anatomy: disclosure
 * header ("AI" glyph + label) + context chip ("About: X") + streamed body area
 * + inline confirm/decline actions.
 *
 * States (via `state` prop): loading | streaming | answer | guard-refusal |
 * error | confirm-pending. Any write is an EXPLICIT confirm button (onConfirm) —
 * never a silent or auto-focused-enter write (E47 Annex). Guard-refusal is a
 * designed, calm state, NOT an error. No navigation away; no invented tools; no
 * autonomous-agent language; no medical wording.
 *
 * A11y: aria-modal sheet; scrim/Close dismiss; streamed body region is
 * aria-live="polite" so chunks announce; confirm/decline are real buttons whose
 * order mirrors under RTL automatically (flex follows dir).
 *
 * Pure presentational. Streaming/refusal text must already be guard-filtered by
 * the caller. Behavior via callbacks; provides sensible defaults so it renders
 * standalone.
 *
 * Props:
 *  - opened: boolean — controls visibility
 *  - onClose: () => void
 *  - contextLabel: the anchored object name shown in the "About:" chip
 *  - state: 'loading' | 'streaming' | 'answer' | 'guard-refusal' | 'error' | 'confirm-pending'
 *  - children: streamed/answer body (caller-rendered, guard-filtered)
 *  - onConfirm / onDecline: explicit write confirm + decline (confirm-pending state)
 *  - onRetry: retry callback for the error state
 *  - confirmLabel / declineLabel: copy overrides
 *  - aiLabel: disclosure label text (default "AI")
 *  - title: short sheet heading
 *  - refusalText / refusalAlternatives: kind refusal copy + suggested alternatives
 */
export function AISheet({
  opened = false,
  onClose,
  contextLabel = '',
  state = 'answer',
  children,
  onConfirm,
  onDecline,
  onRetry,
  confirmLabel = 'Confirm',
  declineLabel = 'Not now',
  aiLabel = 'AI',
  title = 'Ask about this',
  refusalText = 'I can’t help with that one, but here are some things I can do.',
  refusalAlternatives = [],
}) {
  const closeRef = useRef(null);

  // Move focus to the Close control when the sheet opens (focusable entry that
  // is NOT the confirm button — avoids an auto-confirm trap).
  useEffect(() => {
    if (opened) closeRef.current?.focus?.();
  }, [opened]);

  // ESC / back closes the sheet.
  useEffect(() => {
    if (!opened) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opened, onClose]);

  const renderBody = () => {
    if (state === 'loading') {
      // Snapshot loading: skeleton lines mirroring the answer area (≤300ms then
      // these). Spinner-in-header concept handled by the calm skeleton twin.
      return (
        <Box role="status" aria-busy="true" aria-live="polite" style={{ inlineSize: '100%' }}>
          <span className="g-sr-only">Loading</span>
          <Stack style={{ gap: 'var(--g-space-2)' }}>
            {['100%', '92%', '70%'].map((w, i) => (
              <Box
                key={i}
                className="g-skeleton"
                aria-hidden="true"
                style={{ blockSize: 'var(--g-space-4)', inlineSize: w }}
              />
            ))}
          </Stack>
        </Box>
      );
    }

    if (state === 'guard-refusal') {
      // Designed refusal state — calm, with alternatives. Not an error.
      return (
        <Box
          role="status"
          aria-live="polite"
          style={{
            inlineSize: '100%',
            background: 'var(--g-color-state-info-bg)',
            borderRadius: 'var(--g-radius-input)',
            padding: 'var(--g-space-4)',
          }}
        >
          <Group style={{ gap: 'var(--g-space-2)' }} wrap="nowrap" align="flex-start">
            <IconShield
              size={20}
              stroke={1.5}
              aria-hidden="true"
              style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }}
            />
            <Stack style={{ gap: 'var(--g-space-2)', flex: 1 }}>
              <Text
                style={{
                  fontSize: 'var(--g-font-size-14)',
                  lineHeight: 'var(--g-leading-body)',
                  color: 'var(--g-color-text-secondary)',
                  textAlign: 'start',
                }}
              >
                {refusalText}
              </Text>
              {refusalAlternatives.length > 0 && (
                <Stack
                  component="ul"
                  style={{
                    gap: 'var(--g-space-1)',
                    margin: 0,
                    paddingInlineStart: 'var(--g-space-5)',
                  }}
                >
                  {refusalAlternatives.map((alt, i) => (
                    <Text
                      key={i}
                      component="li"
                      style={{
                        fontSize: 'var(--g-font-size-14)',
                        lineHeight: 'var(--g-leading-body)',
                        color: 'var(--g-color-text-primary)',
                        textAlign: 'start',
                      }}
                    >
                      {alt}
                    </Text>
                  ))}
                </Stack>
              )}
            </Stack>
          </Group>
        </Box>
      );
    }

    if (state === 'error') {
      return (
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
            <Group style={{ gap: 'var(--g-space-2)' }} wrap="nowrap">
              <IconAlertCircle
                size={20}
                stroke={1.5}
                aria-hidden="true"
                style={{ color: 'var(--g-color-text-secondary)', flexShrink: 0 }}
              />
              <Text
                style={{
                  fontSize: 'var(--g-font-size-14)',
                  lineHeight: 'var(--g-leading-body)',
                  color: 'var(--g-color-text-secondary)',
                  textAlign: 'start',
                }}
              >
                Something went wrong. Nothing was changed — you can try again.
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
                Try again
              </UnstyledButton>
            )}
          </Stack>
        </Box>
      );
    }

    // answer | streaming | confirm-pending — render the caller body in an
    // aria-live region so streamed chunks announce politely.
    return (
      <Box
        aria-live="polite"
        aria-busy={state === 'streaming' || undefined}
        style={{
          inlineSize: '100%',
          fontSize: 'var(--g-font-size-16)',
          lineHeight: 'var(--g-leading-body)',
          color: 'var(--g-color-text-primary)',
          textAlign: 'start',
        }}
      >
        {children || (
          <Text style={{ color: 'var(--g-color-text-muted)', textAlign: 'start' }}>
            Ask something about this and the answer will appear here.
          </Text>
        )}
        {state === 'streaming' && (
          <Box
            className="g-skeleton"
            aria-hidden="true"
            style={{
              marginBlockStart: 'var(--g-space-2)',
              blockSize: 'var(--g-space-4)',
              inlineSize: '40%',
            }}
          />
        )}
      </Box>
    );
  };

  return (
    <AnimatePresence>
      {opened && (
        <Box
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 'var(--g-z-sheet)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}
        >
          {/* Scrim — tap to close */}
          <motion.div
            variants={withReducedMotion(gentleFade)}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--g-scrim-photo)',
              zIndex: 'var(--g-z-overlay)',
            }}
          />

          {/* Sheet panel */}
          <motion.div
            variants={withReducedMotion(sheetEnter)}
            initial="initial"
            animate="animate"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            style={{
              position: 'relative',
              /* Panel shares the scrim's tier and wins by DOM order (panel is
                 rendered after the scrim), so it paints on top and stays
                 interactive — matches BottomSheet's layering. */
              zIndex: 'var(--g-z-overlay)',
              inlineSize: '100%',
              maxBlockSize: '92dvh',
              background: 'var(--g-color-ai-surface)',
              border: 'var(--g-border-ai)',
              borderStartStartRadius: 'var(--g-radius-sheet)',
              borderStartEndRadius: 'var(--g-radius-sheet)',
              boxShadow: 'var(--g-shadow-3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Grabber */}
            <Box
              aria-hidden="true"
              style={{
                inlineSize: 40,
                blockSize: 4,
                borderRadius: 'var(--g-radius-chip)',
                background: 'var(--g-color-border-strong)',
                marginInline: 'auto',
                marginBlockStart: 'var(--g-space-2)',
                marginBlockEnd: 'var(--g-space-1)',
              }}
            />

            {/* Header row: disclosure + close */}
            <Group
              justify="space-between"
              wrap="nowrap"
              style={{
                paddingInline: 'var(--g-space-4)',
                paddingBlock: 'var(--g-space-2)',
              }}
            >
              <Group style={{ gap: 'var(--g-space-2)' }} wrap="nowrap" align="center">
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
                    }}
                  >
                    {aiLabel}
                  </Text>
                </Group>
                <Text
                  component="h2"
                  style={{
                    fontFamily: 'var(--g-font-display)',
                    fontSize: 'var(--g-font-size-16)',
                    fontWeight: 600,
                    color: 'var(--g-color-text-primary)',
                    textAlign: 'start',
                  }}
                >
                  {title}
                </Text>
              </Group>

              <ActionIcon
                ref={closeRef}
                component={motion.button}
                type="button"
                onClick={onClose}
                whileTap={pressResponse.whileTap}
                aria-label="Close"
                variant="transparent"
                style={{
                  minHeight: 44,
                  minWidth: 44,
                  color: 'var(--g-color-text-secondary)',
                  flexShrink: 0,
                }}
              >
                <IconX size={20} stroke={1.5} aria-hidden="true" />
              </ActionIcon>
            </Group>

            {/* Context chip — "About: X" anchors to the current object */}
            {contextLabel && (
              <Box
                style={{
                  paddingInline: 'var(--g-space-4)',
                  paddingBlockEnd: 'var(--g-space-2)',
                }}
              >
                <Group
                  wrap="nowrap"
                  style={{
                    gap: 'var(--g-space-1)',
                    display: 'inline-flex',
                    maxInlineSize: '100%',
                    paddingInline: 'var(--g-space-3)',
                    paddingBlock: 'var(--g-space-1)',
                    borderRadius: 'var(--g-radius-chip)',
                    background: 'var(--g-color-brand-50)',
                    border: '1px solid var(--g-color-border-subtle)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 'var(--g-font-size-12)',
                      color: 'var(--g-color-text-muted)',
                      flexShrink: 0,
                    }}
                  >
                    About:
                  </Text>
                  <Text
                    style={{
                      fontSize: 'var(--g-font-size-12)',
                      fontWeight: 600,
                      color: 'var(--g-color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {contextLabel}
                  </Text>
                </Group>
              </Box>
            )}

            {/* Scrollable body */}
            <Box
              style={{
                flex: 1,
                overflowY: 'auto',
                paddingInline: 'var(--g-space-4)',
                paddingBlock: 'var(--g-space-3)',
              }}
            >
              {renderBody()}
            </Box>

            {/* Footer: explicit write confirm/decline only in confirm-pending */}
            {state === 'confirm-pending' && (
              <Group
                wrap="nowrap"
                style={{
                  gap: 'var(--g-space-3)',
                  paddingInline: 'var(--g-space-4)',
                  paddingBlock: 'var(--g-space-3)',
                  paddingBlockEnd: 'calc(var(--g-space-4) + env(safe-area-inset-bottom))',
                  borderBlockStart: '1px solid var(--g-color-border-subtle)',
                  background: 'var(--g-color-bg-surface)',
                }}
              >
                <UnstyledButton
                  component={motion.button}
                  type="button"
                  onClick={onDecline}
                  whileTap={pressResponse.whileTap}
                  aria-label={declineLabel}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 44,
                    paddingInline: 'var(--g-space-4)',
                    borderRadius: 'var(--g-radius-input)',
                    background: 'transparent',
                    border: '1px solid var(--g-color-border-strong)',
                    color: 'var(--g-color-text-secondary)',
                    fontFamily: 'var(--g-font-display)',
                    fontSize: 'var(--g-font-size-16)',
                    fontWeight: 500,
                  }}
                >
                  {declineLabel}
                </UnstyledButton>
                <UnstyledButton
                  component={motion.button}
                  type="button"
                  onClick={onConfirm}
                  whileTap={pressResponse.whileTap}
                  aria-label={confirmLabel}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--g-space-1)',
                    minHeight: 44,
                    paddingInline: 'var(--g-space-4)',
                    borderRadius: 'var(--g-radius-input)',
                    background: 'var(--g-color-food-saffron)',
                    color: 'var(--g-color-text-inverse)',
                    fontFamily: 'var(--g-font-display)',
                    fontSize: 'var(--g-font-size-16)',
                    fontWeight: 600,
                    boxShadow: 'var(--g-shadow-1)',
                  }}
                >
                  <IconCheck size={18} stroke={1.5} aria-hidden="true" />
                  {confirmLabel}
                </UnstyledButton>
              </Group>
            )}
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  );
}

export default AISheet;
