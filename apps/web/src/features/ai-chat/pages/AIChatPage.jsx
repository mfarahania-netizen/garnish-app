import { useState, useRef, useEffect } from 'react';
import {
  Container, Paper, Text, TextInput, ActionIcon, Group,
  Avatar, ScrollArea, Stack, Loader, Box,
  useMantineTheme, Transition, Tooltip
} from '@mantine/core';
import { IconSend, IconRobot, IconUser, IconChevronDown, IconSparkles } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { askAI } from '../services/aiEngine';
import { useAuth } from '../../../context/AuthContext';
import { useAnalytics } from '../../../hooks/useAnalytics';

export default function AIChatPage() {
  const { token } = useAuth();
  const { trackEvent } = useAnalytics();
  const [messages, setMessages] = useState([
    { sender: 'bot', text: '👋 سلام! هر ماده غذایی که دوست داری رو بنویس تا بهترین غذاها رو بهت پیشنهاد بدم.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const viewportRef = useRef(null);
  const messagesEndRef = useRef(null);
  const theme = useMantineTheme();
  const hasTrackedStart = useRef(false);

  // ردیابی شروع چت (فقط یک بار)
  useEffect(() => {
    if (!hasTrackedStart.current) {
      trackEvent('ai_chat_started');
      hasTrackedStart.current = true;
    }
  }, []);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || loading) return;

    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: prompt }]);
    setLoading(true);

    // ردیابی ارسال پیام
    trackEvent('ai_message_send', { message: prompt });

    try {
      const startTime = Date.now();
      const reply = await askAI(prompt, token);
      const latency = Date.now() - startTime;
      
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
      
      // ردیابی دریافت پاسخ و مدت زمان پاسخگویی
      trackEvent('ai_suggestion_generated', { 
        prompt, 
        responseLength: reply.length,
        latency 
      });
    } catch {
      setMessages(prev => [...prev, { sender: 'bot', text: '❌ خطا در ارتباط با دستیار. دوباره تلاش کن.' }]);
      trackEvent('ai_error', { message: prompt });
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = ({ y }) => {
    setShowScrollButton(y < -100);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <Container size="xs" p={0} style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: '100%',
      overflow: 'hidden',
    }}>
      {/* Header با طراحی بهبودیافته */}
      <Box
        py="md"
        px="md"
        style={{
          background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
          color: '#fff',
          textAlign: 'center',
          flexShrink: 0,
          zIndex: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderRadius: '0 0 24px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ 
          position: 'absolute', top: -30, right: -30, 
          width: 100, height: 100, borderRadius: '50%', 
          background: 'rgba(255,255,255,0.08)' 
        }} />
        <div style={{ 
          position: 'absolute', bottom: -20, left: -20, 
          width: 70, height: 70, borderRadius: '50%', 
          background: 'rgba(255,255,255,0.05)' 
        }} />
        
        <Group gap="xs" justify="center" style={{ position: 'relative', zIndex: 1 }}>
          <Avatar color="white" radius="xl" size="md" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <IconRobot size={20} color="#fff" />
          </Avatar>
          <Text fw={700} size="lg">دستیار هوشمند گارنیش</Text>
          <IconSparkles size={18} color="#FFD166" style={{ marginLeft: 4 }} />
        </Group>
        <Text size="xs" opacity={0.8} mt={6} style={{ position: 'relative', zIndex: 1 }}>
          مواد اولیه‌ات رو بنویس تا بهترین غذاها رو با هوش مصنوعی پیدا کنی 🍳
        </Text>
      </Box>

      {/* Messages Area */}
      <ScrollArea
        style={{ flex: 1 }}
        px="md"
        pt="sm"
        onScrollPositionChange={handleScroll}
        viewportRef={viewportRef}
        type="always"
      >
        <Stack gap="sm">
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.05, type: 'spring', stiffness: 100 }}
                style={{
                  display: 'flex',
                  justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%',
                }}
              >
                <Group
                  gap="xs"
                  align="flex-start"
                  wrap="nowrap"
                  style={{
                    maxWidth: '90%',
                    flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    color={msg.sender === 'user' ? 'blue' : 'orange'}
                    radius="xl"
                    size="sm"
                    style={{ flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                  >
                    {msg.sender === 'user' ? <IconUser size={16} /> : <IconRobot size={16} />}
                  </Avatar>
                  <Paper
                    p="sm"
                    radius="lg"
                    style={{
                      background: msg.sender === 'user'
                        ? 'linear-gradient(135deg, #1976D2, #42A5F5)'
                        : 'rgba(255,255,255,0.9)',
                      color: msg.sender === 'user' ? '#fff' : theme.colorScheme === 'dark' ? '#fff' : '#1A237E',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
                      border: msg.sender === 'bot' ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    <Text size="sm" style={{ lineHeight: 1.7 }}>{msg.text}</Text>
                  </Paper>
                </Group>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <Group gap="xs" align="center" px="md">
              <Avatar color="orange" radius="xl" size="sm"><IconRobot size={16} /></Avatar>
              <Loader size="sm" color="orange" />
              <Text size="xs" c="dimmed">در حال فکر کردن...</Text>
            </Group>
          )}
          <div ref={messagesEndRef} style={{ height: 10 }} />
        </Stack>
      </ScrollArea>

      {/* دکمه اسکرول به پایین */}
      {showScrollButton && (
        <Transition transition="fade" mounted={showScrollButton}>
          {(styles) => (
            <Tooltip label="برو به آخر">
              <ActionIcon
                variant="filled"
                color="orange"
                size="lg"
                radius="xl"
                onClick={scrollToBottom}
                style={{
                  ...styles,
                  position: 'absolute',
                  bottom: 80,
                  right: 20,
                  zIndex: 20,
                  boxShadow: '0 4px 12px rgba(255,107,53,0.3)',
                }}
              >
                <IconChevronDown size={20} />
              </ActionIcon>
            </Tooltip>
          )}
        </Transition>
      )}

      {/* Input Area */}
      <Box
        py="sm"
        px="md"
        style={{
          flexShrink: 0,
          borderTop: '1px solid rgba(0,0,0,0.06)',
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
        }}
      >
        <Group gap="sm" wrap="nowrap">
          <TextInput
            placeholder="مثال: مرغ، قارچ، برنج..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            style={{ flex: 1 }}
            radius="xl"
            size="md"
            variant="filled"
            disabled={loading}
            styles={{
              input: {
                backgroundColor: 'rgba(0,0,0,0.04)',
                border: 'none',
                '&:focus': { backgroundColor: 'rgba(0,0,0,0.06)' },
              },
            }}
          />
          <ActionIcon
            variant="filled"
            color="orange"
            size="lg"
            radius="xl"
            onClick={handleSend}
            loading={loading}
            disabled={!input.trim() || loading}
            style={{
              boxShadow: '0 4px 12px rgba(255,107,53,0.3)',
              transition: '0.2s',
              transform: 'scale(1)',
              ':hover': { transform: 'scale(1.05)' },
            }}
          >
            <IconSend size={18} />
          </ActionIcon>
        </Group>
      </Box>
    </Container>
  );
}