import { Box, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconInbox } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { riseIn, pressResponse, withReducedMotion } from '../../lib/motion';

/**
 * EmptyState (PL row 12) — Guide an empty list/grid surface toward one clear next step.
 * Anatomy: decorative illustration line (saffron accent) + 1 sentence + 1 action Button.
 * Pure presentational: behavior via onAction callback. No business logic.
 */
export function EmptyState({
  title = 'Nothing here yet',
  message = 'When there is something to show, it will appear right here.',
  actionLabel,
  onAction,
  icon,
  surface = 'generic',
}) {
  const Glyph = icon || <IconInbox size={28} stroke={1.5} aria-hidden="true" />;
  const hasAction = Boolean(actionLabel && onAction);

  return (
    <motion.div
      variants={withReducedMotion(riseIn)}
      initial="initial"
      animate="animate"
      data-surface={surface}
    >
      <Stack
        align="center"
        role="status"
        style={{
          gap: 'var(--g-space-4)',
          paddingBlock: 'var(--g-space-10)',
          paddingInline: 'var(--g-space-6)',
          textAlign: 'center',
        }}
      >
        {/* Decorative illustration line — saffron accent, hidden from SR */}
        <Box
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 64,
            minHeight: 64,
            borderRadius: 'var(--g-radius-card)',
            background: 'var(--g-color-brand-50)',
            color: 'var(--g-color-food-saffron)',
            border: '1px solid var(--g-color-border-subtle)',
          }}
        >
          {Glyph}
        </Box>

        <Stack align="center" style={{ gap: 'var(--g-space-2)', maxWidth: 360 }}>
          <Text
            component="h3"
            style={{
              fontFamily: 'var(--g-font-display)',
              fontSize: 'var(--g-font-size-18)',
              lineHeight: 'var(--g-leading-heading)',
              color: 'var(--g-color-text-primary)',
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontSize: 'var(--g-font-size-14)',
              lineHeight: 'var(--g-leading-body)',
              color: 'var(--g-color-text-secondary)',
            }}
          >
            {message}
          </Text>
        </Stack>

        {hasAction && (
          <UnstyledButton
            component={motion.button}
            type="button"
            onClick={onAction}
            whileTap={pressResponse.whileTap}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
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
            {actionLabel}
          </UnstyledButton>
        )}
      </Stack>
    </motion.div>
  );
}

export default EmptyState;
