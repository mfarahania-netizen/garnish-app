// features/ai-chat/components/ChatInput.jsx
import { Box, Group, TextInput, ActionIcon } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';

export default function ChatInput({ input, setInput, onSend, loading }) {
  return (
    <Box py="sm" px="md" style={{ borderTop: '1px solid var(--g-color-border-subtle)', background: 'var(--g-color-bg-surface)', backdropFilter: 'blur(12px)' }}>
      <Group gap="sm" wrap="nowrap">
        <TextInput
          placeholder="مواد اولیه‌ات رو بنویس..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          style={{ flex: 1 }}
          radius="xl"
          variant="unstyled"
          styles={{ input: { background: 'var(--g-color-bg-surface)', borderRadius: 24, paddingLeft: 20, paddingRight: 20, color: 'var(--g-color-text-primary)', '&::placeholder': { color: 'var(--g-color-text-muted)' } } }}
        />
        <ActionIcon variant="filled" color="orange" size="xl" radius="xl" onClick={onSend} loading={loading} disabled={!input.trim()} style={{ boxShadow: 'var(--g-shadow-2)' }}>
          <IconSend size={20} />
        </ActionIcon>
      </Group>
    </Box>
  );
}