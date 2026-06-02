import { useState, useCallback, useRef } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconMicrophone, IconPlayerStop } from '@tabler/icons-react';
import { startListening, stopListening, initSpeechRecognition, isSpeechSupported } from '../services/speechService';

export default function VoiceInput({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const supported = isSpeechSupported();
  const initialized = useRef(false);

  const handleStart = useCallback(() => {
    if (!initialized.current) {
      initSpeechRecognition('fa-IR');
      initialized.current = true;
    }

    setListening(true);
    startListening(
      (final) => {
        if (final) onTranscript(final);
      },
      () => {
        setListening(false);
      },
      (error) => {
        console.warn('Speech error:', error);
        setListening(false);
      }
    );
  }, [onTranscript]);

  const handleStop = useCallback(() => {
    stopListening();
    setListening(false);
  }, []);

  if (!supported) return null;

  return (
    <Tooltip label={listening ? 'توقف' : 'ورودی صوتی'}>
      <ActionIcon
        variant={listening ? 'filled' : 'subtle'}
        color={listening ? 'red' : 'gray'}
        size="lg"
        radius="xl"
        onClick={listening ? handleStop : handleStart}
        style={{
          animation: listening ? 'pulse 1.5s infinite' : 'none',
        }}
      >
        {listening ? <IconPlayerStop size={18} /> : <IconMicrophone size={18} />}
      </ActionIcon>
    </Tooltip>
  );
}