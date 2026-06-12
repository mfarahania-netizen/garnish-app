// features/ai-chat/components/MessageBubble.jsx
import { Group, Avatar, Text, Box } from '@mantine/core';
import { IconRobot, IconUser } from '@tabler/icons-react';
import { motion } from 'framer-motion';

export default function MessageBubble({ message, index }) {
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
      <Group gap="sm" align="flex-start" wrap="nowrap" style={{ maxWidth: '88%', flexDirection: isUser ? 'row-reverse' : 'row' }}>
        <Avatar color={isUser ? 'blue' : 'orange'} radius="xl" size="md" style={{ flexShrink: 0 }}>
          {isUser ? <IconUser size={18} /> : <IconRobot size={18} />}
        </Avatar>
        <Box
          p="md"
          style={{
            background: isUser ? 'linear-gradient(135deg, #1e3a5f, #2a4a6b)' : 'rgba(255,255,255,0.07)',
            borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
            border: `1px solid ${isUser ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          <Text size="sm" style={{ color: '#fff', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.text}
          </Text>
        </Box>
      </Group>
    </motion.div>
  );
}
