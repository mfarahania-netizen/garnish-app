import { Box, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * NotificationRow (PL row 22) — one in-app notification.
 *
 * Anatomy: category icon + title + one-line body + timestamp + optional action
 * chip. States: unread | read | actioned | suppressed-group ("paused nudges"
 * honest header state). Tap deep-links (onOpen); the action chip is a real button.
 *
 * Honest fatigue handling: when a category is paused, render the suppressed state
 * as an explicit, calm "paused" row — never a re-nag. Pure presentational.
 * Motion: pressResponse. RTL-safe. Token-pure.
 *
 * Props:
 *  - title, body, timestamp
 *  - icon: category glyph (default a bell)
 *  - state: 'unread' | 'read' | 'actioned' | 'suppressed' (default 'unread')
 *  - onOpen: row tap (deep-link)
 *  - actionLabel / onAction: optional action chip
 *  - suppressedLabel: copy for the suppressed-group state
 */
export function NotificationRow({
  title,
  body,
  timestamp,
  icon,
  state = 'unread',
  onOpen,
  actionLabel,
  onAction,
  suppressedLabel = 'Nudges paused for now',
}) {
  // Suppressed-group: an honest paused header, not a notification.
  if (state === 'suppressed') {
    return (
      <Group
        wrap="nowrap"
        align="center"
        role="note"
        style={{
          gap: 'var(--g-space-2)',
          paddingBlock: 'var(--g-space-2)',
          paddingInline: 'var(--g-space-3)',
          borderRadius: 'var(--g-radius-input)',
          background: 'var(--g-color-state-info-bg)',
        }}
      >
        <IconBell size={16} stroke={1.5} aria-hidden="true" style={{ color: 'var(--g-color-text-muted)', flexShrink: 0 }} />
        <Text style={{ fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-secondary)', textAlign: 'start' }}>
          {suppressedLabel}
        </Text>
      </Group>
    );
  }

  const unread = state === 'unread';
  const Glyph = icon || <IconBell size={18} stroke={1.6} aria-hidden="true" />;

  return (
    <Group
      wrap="nowrap"
      align="flex-start"
      style={{
        gap: 'var(--g-space-3)',
        padding: 'var(--g-space-3)',
        borderRadius: 'var(--g-radius-card)',
        background: unread ? 'var(--g-color-brand-50)' : 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        inlineSize: '100%',
      }}
    >
      <Box style={{ flexShrink: 0, color: unread ? 'var(--g-color-food-saffron)' : 'var(--g-color-text-muted)', marginBlockStart: 2 }}>
        {Glyph}
      </Box>

      <UnstyledButton
        component={motion.button}
        type="button"
        onClick={onOpen}
        whileTap={pressResponse.whileTap}
        aria-label={title}
        style={{ flex: 1, minInlineSize: 0, minHeight: 44, background: 'transparent', textAlign: 'start', cursor: 'pointer' }}
      >
        <Stack style={{ gap: 2 }}>
          <Group wrap="nowrap" justify="space-between" style={{ gap: 'var(--g-space-2)' }}>
            <Text
              style={{
                flex: 1, minInlineSize: 0,
                fontFamily: 'var(--g-font-display)',
                fontSize: 'var(--g-font-size-14)',
                fontWeight: unread ? 700 : 600,
                color: 'var(--g-color-text-primary)',
                textAlign: 'start',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {title}
            </Text>
            {timestamp && (
              <Text style={{ flexShrink: 0, fontSize: 'var(--g-font-size-12)', color: 'var(--g-color-text-muted)' }}>
                {timestamp}
              </Text>
            )}
          </Group>
          {body && (
            <Text
              style={{
                fontFamily: 'var(--g-font-text)', fontSize: 'var(--g-font-size-12)',
                lineHeight: 'var(--g-leading-body)', color: 'var(--g-color-text-secondary)',
                textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {body}
            </Text>
          )}
        </Stack>
      </UnstyledButton>

      {actionLabel && onAction && (
        <UnstyledButton
          component={motion.button}
          type="button"
          onClick={onAction}
          whileTap={pressResponse.whileTap}
          aria-label={actionLabel}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minHeight: 44, paddingInline: 'var(--g-space-3)', borderRadius: 'var(--g-radius-chip)',
            background: 'var(--g-color-bg-surface)', border: '1px solid var(--g-color-border-strong)',
            color: 'var(--g-color-food-saffron)', fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-12)', fontWeight: 600,
          }}
        >
          {actionLabel}
        </UnstyledButton>
      )}
    </Group>
  );
}

export default NotificationRow;
