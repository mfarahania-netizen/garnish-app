import { Box, Group, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { pressResponse } from '../../lib/motion';

/**
 * TopBar — the screen header: optional back affordance + title + optional
 * trailing actions slot. Sticky, safe-area aware (.g-safe-top), token chrome.
 *
 * The back control points to the logical start (RTL-first; LTR icon mirroring is
 * handled in S24). Title truncates; actions sit at the logical end. 44px targets.
 *
 * Pure presentational. Behavior via onBack + the actions node. Token-pure.
 *
 * Props:
 *  - title: screen title (string or node)
 *  - onBack: when provided, renders the back control
 *  - actions: optional trailing ReactNode (icon buttons, etc.)
 *  - backLabel: aria-label for the back control
 *  - as: heading element for the title (default 'h1')
 */
export function TopBar({ title, onBack, actions = null, backLabel = 'Back', as = 'h1' }) {
  return (
    <Box
      component="header"
      className="g-safe-top"
      style={{
        position: 'sticky',
        insetBlockStart: 0,
        zIndex: 'var(--g-z-sticky)',
        background: 'var(--g-color-bg-surface)',
        borderBlockEnd: '1px solid var(--g-color-border-subtle)',
      }}
    >
      <Group
        wrap="nowrap"
        align="center"
        style={{
          gap: 'var(--g-space-2)',
          minBlockSize: 56,
          paddingInline: 'var(--g-space-4)',
          paddingBlock: 'var(--g-space-2)',
        }}
      >
        {onBack && (
          <UnstyledButton
            component={motion.button}
            type="button"
            onClick={onBack}
            whileTap={pressResponse.whileTap}
            aria-label={backLabel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              minWidth: 44,
              marginInlineStart: 'calc(var(--g-space-2) * -1)',
              color: 'var(--g-color-text-primary)',
              background: 'transparent',
              flexShrink: 0,
            }}
          >
            <IconChevronRight size={22} stroke={1.8} aria-hidden="true" />
          </UnstyledButton>
        )}

        <Text
          component={as}
          style={{
            flex: 1,
            minInlineSize: 0,
            fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-18)',
            fontWeight: 700,
            lineHeight: 'var(--g-leading-heading)',
            color: 'var(--g-color-text-primary)',
            textAlign: 'start',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </Text>

        {actions && (
          <Group wrap="nowrap" style={{ gap: 'var(--g-space-1)', flexShrink: 0 }}>
            {actions}
          </Group>
        )}
      </Group>
    </Box>
  );
}

export default TopBar;
