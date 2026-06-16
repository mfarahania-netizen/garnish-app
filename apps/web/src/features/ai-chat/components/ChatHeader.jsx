// features/ai-chat/components/ChatHeader.jsx
import { Box, Group, Text, ActionIcon } from '@mantine/core';
import { IconTrash, IconSparkles } from '@tabler/icons-react';

/**
 * AI Companion header — MANDATORY AI disclosure (glyph + "AI" chip), so it is never ambiguous that the
 * user is talking to an assistant (EPIC 40 / GES). Tokenized, RTL-safe.
 */
export default function ChatHeader({ onClear }) {
  return (
    <Box
      py="md" px="lg"
      style={{
        background: 'var(--g-color-ai-surface)',
        borderBottom: 'var(--g-border-ai)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Group gap="sm" wrap="nowrap" align="center">
        <IconSparkles size={20} color="var(--g-color-food-saffron)" aria-hidden="true" />
        <Text fw={800} size="xl" style={{ color: 'var(--g-color-text-primary)', letterSpacing: '-0.5px' }}>
          گارنیش
        </Text>
        {/* Mandatory AI disclosure chip */}
        <Box
          component="span"
          aria-label="دستیار هوش مصنوعی"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            paddingInline: 'var(--g-space-2)',
            paddingBlock: 2,
            borderRadius: 'var(--g-radius-chip)',
            background: 'var(--g-color-bg-surface)',
            border: 'var(--g-border-ai)',
            color: 'var(--g-color-text-secondary)',
            fontFamily: 'var(--g-font-display)',
            fontSize: 'var(--g-font-size-12)',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          AI
        </Box>
      </Group>
      <ActionIcon variant="subtle" color="gray" onClick={onClear} aria-label="پاک کردن گفتگو">
        <IconTrash size={18} />
      </ActionIcon>
    </Box>
  );
}
