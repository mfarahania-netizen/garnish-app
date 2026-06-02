import { useState, useRef, useCallback } from 'react';
import { Group, Textarea, ActionIcon, Box, Paper, Text } from '@mantine/core';
import { IconSend, IconPhoto } from '@tabler/icons-react';
import { useAIChatContext } from '../context/AIChatContext';
import VoiceInput from './VoiceInput';
import ImageUploader from './ImageUploader';

export default function ChatInput() {
  const [input, setInput] = useState('');
  const [imageIngredients, setImageIngredients] = useState(null);
  const textareaRef = useRef(null);
  const { sendMessage, loading } = useAIChatContext();

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text && !imageIngredients) return;

    sendMessage(text || 'چه غذایی می‌توانم با این مواد بپزم؟', 
      imageIngredients ? { ingredients: imageIngredients } : null
    );
    setInput('');
    setImageIngredients(null);
    textareaRef.current?.focus();
  }, [input, imageIngredients, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceTranscript = (text) => {
    setInput(prev => prev + (prev ? ' ' : '') + text);
  };

  const handleImageAnalyzed = (ingredients, result) => {
    setImageIngredients(ingredients);
    sendMessage(
      `مواد شناسایی شده: ${ingredients.join('، ')} - چه غذایی پیشنهاد می‌کنی؟`,
      { ingredients, ...result }
    );
  };

  return (
    <Paper
      shadow="md"
      p="sm"
      radius="lg"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: 400,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}
    >
      {imageIngredients && (
        <Group gap="xs" mb="xs" px="xs">
          <Text size="xs" c="orange.6">📸 مواد شناسایی شده:</Text>
          <Text size="xs" fw={500}>{imageIngredients.slice(0, 6).join('، ')}</Text>
          <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setImageIngredients(null)}>
            ✕
          </ActionIcon>
        </Group>
      )}

      <Group gap="xs" wrap="nowrap" align="flex-end">
        <VoiceInput onTranscript={handleVoiceTranscript} />
        <ImageUploader onImageAnalyzed={handleImageAnalyzed} />
        
        <Textarea
          ref={textareaRef}
          placeholder="مواد اولیه‌ات رو بگو..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          minRows={1}
          maxRows={4}
          autosize
          style={{ flex: 1 }}
          styles={{
            input: {
              border: 'none',
              backgroundColor: 'transparent',
              fontSize: 14,
              lineHeight: 1.5,
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
          disabled={!input.trim() && !imageIngredients}
        >
          <IconSend size={18} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}