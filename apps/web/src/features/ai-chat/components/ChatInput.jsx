// features/ai-chat/components/ChatInput.jsx
import { Box, Group, TextInput, ActionIcon } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';

export default function ChatInput({ input, setInput, onSend, loading }) {
  return (
    <Box py="sm" px="md" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)' }}>
      <Group gap="sm" wrap="nowrap">
        <TextInput
          placeholder="مواد اولیه‌ات رو بنویس..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          style={{ flex: 1 }}
          radius="xl"
          variant="unstyled"
          styles={{ input: { background: 'rgba(255,255,255,0.06)', borderRadius: 24, paddingLeft: 20, paddingRight: 20, color: '#fff', '&::placeholder': { color: '#888' } } }}
        />
        <ActionIcon variant="filled" color="orange" size="xl" radius="xl" onClick={onSend} loading={loading} disabled={!input.trim()} style={{ boxShadow: '0 4px 14px rgba(255,107,53,0.4)' }}>
          <IconSend size={20} />
        </ActionIcon>
      </Group>
    </Box>
  );
}