// features/ai-chat/components/ChatHeader.jsx
import { Box, Group, Text, ActionIcon } from '@mantine/core';
import { IconTrash, IconSparkles } from '@tabler/icons-react';

export default function ChatHeader({ onClear }) {
  return (
    <Box
      py="md" px="lg"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
      }}
    >
      <Group gap="sm">
        <Text fw={800} size="xl" style={{ color: '#fff', letterSpacing: '-0.5px' }}>
          گارنیش AI
        </Text>
        <IconSparkles size={20} color="#FFD166" />
      </Group>
      <ActionIcon variant="subtle" color="gray" onClick={onClear}>
        <IconTrash size={18} />
      </ActionIcon>
    </Box>
  );
}