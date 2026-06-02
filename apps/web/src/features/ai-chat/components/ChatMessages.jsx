import { Box } from '@mantine/core';
import { useEffect } from 'react';
import { useAIChatContext } from '../context/AIChatContext';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';

export default function ChatMessages() {
  const { messages, loading, messagesEndRef } = useAIChatContext();

  return (
    <Box style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {loading && <ThinkingIndicator />}
      <div ref={messagesEndRef} />
    </Box>
  );
}