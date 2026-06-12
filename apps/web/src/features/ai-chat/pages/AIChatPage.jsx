// features/ai-chat/pages/AIChatPage.jsx
import { useState, useRef, useEffect } from 'react';
import { Container, ScrollArea, Stack, Loader, Group, Avatar, Text, ActionIcon, Tooltip, Transition } from '@mantine/core';
import { IconChevronDown, IconRobot } from '@tabler/icons-react';
import { AnimatePresence } from 'framer-motion';
import { askAI } from '../services/aiEngine';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { EventType } from '../../../lib/eventTaxonomy';
import ChatHeader from '../components/ChatHeader';
import MessageBubble from '../components/MessageBubble';
import ChatInput from '../components/ChatInput';

export default function AIChatPage() {
  const { trackEvent } = useAnalytics();
  const [messages, setMessages] = useState([
    { sender: 'bot', text: '👋 سلام! هر ماده غذایی که دوست داری رو بنویس تا بهترین غذاها رو بهت پیشنهاد بدم.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const viewportRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasTrackedStart = useRef(false);

  useEffect(() => {
    if (!hasTrackedStart.current) {
      trackEvent(EventType.AI_CHAT_STARTED);
      hasTrackedStart.current = true;
    }
  }, [trackEvent]);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: prompt }]);
    setLoading(true);
    trackEvent(EventType.AI_MESSAGE_SEND, { message: prompt });
    try {
      const startTime = Date.now();
      const reply = await askAI(prompt);
      const latency = Date.now() - startTime;
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
      trackEvent(EventType.AI_SUGGESTION_GENERATED, { prompt, responseLength: reply.length, latency });
    } catch {
      setMessages(prev => [...prev, { sender: 'bot', text: '❌ خطا در ارتباط با دستیار. دوباره تلاش کن.' }]);
      trackEvent(EventType.AI_ERROR, { message: prompt });
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([{ sender: 'bot', text: '👋 سلام! هر ماده غذایی که دوست داری رو بنویس تا بهترین غذاها رو بهت پیشنهاد بدم.' }]);
  };

  const handleScroll = ({ y }) => setShowScrollButton(y < -100);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => { scrollToBottom(); }, [messages]);

  return (
    <Container fluid p={0} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#0b0e14' }}>
      <ChatHeader onClear={handleClear} />
      <ScrollArea style={{ flex: 1 }} px="md" pt="sm" onScrollPositionChange={handleScroll} viewportRef={viewportRef} type="never">
        <Stack gap="sm">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} index={i} />
            ))}
          </AnimatePresence>
          {loading && (
            <Group gap="sm" align="center" px="md">
              <Avatar color="orange" radius="xl" size="sm"><IconRobot size={18} /></Avatar>
              <Loader size="sm" color="orange" />
              <Text size="xs" c="dimmed">در حال فکر کردن...</Text>
            </Group>
          )}
          <div ref={messagesEndRef} style={{ height: 10 }} />
        </Stack>
      </ScrollArea>
      {showScrollButton && (
        <Transition transition="fade" mounted={showScrollButton}>
          {(styles) => (
            <Tooltip label="برو به آخر">
              <ActionIcon variant="filled" color="orange" size="lg" radius="xl" onClick={scrollToBottom}
                style={{ ...styles, position: 'absolute', bottom: 90, right: 20, zIndex: 20, boxShadow: '0 4px 12px rgba(255,107,53,0.3)' }}>
                <IconChevronDown size={20} />
              </ActionIcon>
            </Tooltip>
          )}
        </Transition>
      )}
      <ChatInput input={input} setInput={setInput} onSend={handleSend} loading={loading} />
    </Container>
  );
}
