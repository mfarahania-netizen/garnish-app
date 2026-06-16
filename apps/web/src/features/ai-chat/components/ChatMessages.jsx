// features/ai-chat/components/ChatMessage.jsx
import { Group, Avatar, Text, Box } from '@mantine/core';
import { IconRobot, IconUser } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export default function ChatMessage({ message, index }) {
  const isUser = message.sender === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 100 }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
        padding: '0 4px',
      }}
    >
      <Group gap="sm" align="flex-start" wrap="nowrap" style={{ maxWidth: '90%', flexDirection: isUser ? 'row-reverse' : 'row' }}>
        <Avatar
          color={isUser ? 'blue' : 'orange'}
          radius="xl"
          size="md"
          style={{ flexShrink: 0 }}
        >
          {isUser ? <IconUser size={18} /> : <IconRobot size={18} />}
        </Avatar>
        <Box
          p="md"
          style={{
            background: isUser ? 'linear-gradient(135deg, var(--g-color-text-primary), var(--g-color-text-primary))' : 'var(--g-color-bg-surface)',
            borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
            border: `1px solid ${isUser ? 'var(--g-color-border-subtle)' : 'var(--g-color-border-subtle)'}`,
            boxShadow: 'var(--g-shadow-1)',
          }}
        >
          <Text size="sm" style={{ color: isUser ? 'var(--g-color-text-inverse)' : 'var(--g-color-text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.text}
          </Text>
        </Box>
      </Group>
    </motion.div>
  );
}
