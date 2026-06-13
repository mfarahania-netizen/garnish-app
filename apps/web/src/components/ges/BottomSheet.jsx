import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Stack, Text, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import {
  sheetEnter,
  gentleFade,
  reducedMotionFallback,
  prefersReducedMotion,
} from '../../lib/motion';

/**
 * BottomSheet (PL row 4) — home for all multi-option decisions & contextual depth.
 *
 * Anatomy: grabber + title + scrollable content + footer actions.
 * Chrome: radius-sheet (top corners only) · shadow-3 · scrim overlay.
 * Layering: container at --g-z-sheet; scrim + panel both at --g-z-overlay,
 *   panel rendered after the scrim so it wins by DOM order and stays interactive.
 * Motion: sheetEnter (slide up); reduced-motion ⇒ fade (reducedMotionFallback).
 * A11y: focus trap, ESC / back closes, aria-modal, labelled by title.
 *
 * Pure presentational. Open/close behavior is owned by the caller via `opened`
 * + `onClose`; no business logic, no network, no routing.
 *
 * Props:
 *   opened   — boolean; controls visibility (default false)
 *   onClose  — callback fired by ESC, scrim tap, or close button
 *   title    — sheet heading (string or node); also the aria label source
 *   children — sheet body content (scrolls within the sheet)
 *   footer   — optional footer node (action area, e.g. an ActionShelf-style row)
 *   closeLabel — aria-label for the icon-only close control
 */
export function BottomSheet({
  opened = false,
  onClose,
  title,
  children,
  footer = null,
  closeLabel = 'Close',
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const reduceMotion = prefersReducedMotion();

  // ESC / hardware-back close. Body scroll lock while open.
  useEffect(() => {
    if (!opened) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
        return;
      }
      // Focus trap: keep Tab within the panel.
      if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [opened, onClose]);

  // Move focus into the panel on open.
  useEffect(() => {
    if (opened && panelRef.current) {
      panelRef.current.focus();
    }
  }, [opened]);

  if (typeof document === 'undefined') return null;

  const panelVariants = reduceMotion ? reducedMotionFallback : sheetEnter;

  return createPortal(
    <AnimatePresence>
      {opened && (
        <Box
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            zIndex: 'var(--g-z-sheet)',
          }}
        >
          {/* Scrim overlay — tap closes. Sits below the panel. */}
          <motion.div
            aria-hidden="true"
            onClick={() => onClose?.()}
            variants={gentleFade}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'var(--g-color-text-primary)',
              opacity: 0.45,
              zIndex: 'var(--g-z-overlay)',
            }}
          />

          {/* Sheet panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            tabIndex={-1}
            variants={panelVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              position: 'relative',
              zIndex: 'var(--g-z-overlay)',
              inlineSize: '100%',
              maxBlockSize: '90dvh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--g-color-bg-surface-raised)',
              borderStartStartRadius: 'var(--g-radius-sheet)',
              borderStartEndRadius: 'var(--g-radius-sheet)',
              boxShadow: 'var(--g-shadow-3)',
              overflow: 'hidden',
            }}
          >
            {/* Grabber */}
            <Box
              aria-hidden="true"
              style={{
                display: 'flex',
                justifyContent: 'center',
                paddingBlockStart: 'var(--g-space-3)',
                paddingBlockEnd: 'var(--g-space-2)',
                flex: '0 0 auto',
              }}
            >
              <Box
                style={{
                  inlineSize: 36,
                  blockSize: 4,
                  borderRadius: 'var(--g-radius-chip)',
                  background: 'var(--g-color-border-strong)',
                }}
              />
            </Box>

            {/* Title row + close */}
            {(title || onClose) && (
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--g-space-3)',
                  paddingInline: 'var(--g-space-5)',
                  paddingBlockEnd: 'var(--g-space-3)',
                  flex: '0 0 auto',
                }}
              >
                {title && (
                  <Text
                    id={titleId}
                    component="h2"
                    style={{
                      flex: 1,
                      minInlineSize: 0,
                      fontFamily: 'var(--g-font-display)',
                      fontSize: 'var(--g-font-size-18)',
                      fontWeight: 700,
                      lineHeight: 'var(--g-leading-heading)',
                      color: 'var(--g-color-text-primary)',
                      textAlign: 'start',
                    }}
                  >
                    {title}
                  </Text>
                )}
                {onClose && (
                  <ActionIcon
                    variant="subtle"
                    onClick={() => onClose?.()}
                    aria-label={closeLabel}
                    style={{
                      minInlineSize: 44,
                      minBlockSize: 44,
                      flex: '0 0 auto',
                      color: 'var(--g-color-text-secondary)',
                      background: 'transparent',
                    }}
                  >
                    <IconX size={20} stroke={1.5} aria-hidden="true" />
                  </ActionIcon>
                )}
              </Box>
            )}

            {/* Scrollable content */}
            <Box
              style={{
                flex: '1 1 auto',
                minBlockSize: 0,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingInline: 'var(--g-space-5)',
                paddingBlockEnd: footer ? 'var(--g-space-4)' : 'var(--g-space-5)',
              }}
            >
              <Stack style={{ gap: 'var(--g-space-4)' }}>{children}</Stack>
            </Box>

            {/* Footer action area — pinned, safe-area aware */}
            {footer && (
              <Box
                className="g-safe-bottom"
                style={{
                  flex: '0 0 auto',
                  paddingInline: 'var(--g-space-5)',
                  paddingBlockStart: 'var(--g-space-3)',
                  borderBlockStart: '1px solid var(--g-color-border-subtle)',
                  background: 'var(--g-color-bg-surface-raised)',
                }}
              >
                {footer}
              </Box>
            )}
          </motion.div>
        </Box>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export default BottomSheet;
