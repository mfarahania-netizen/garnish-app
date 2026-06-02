import { Group, Text, ActionIcon, Tooltip, Badge, Box, useMantineColorScheme } from '@mantine/core';
import { IconTrash, IconBrain, IconSparkles, IconChefHat } from '@tabler/icons-react';
import { useAIChatContext } from '../context/AIChatContext';
import { getTimeBasedContext } from '../services/personalizationService';

export default function ChatHeader() {
  const { clearChat } = useAIChatContext();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const timeContext = getTimeBasedContext();

  return (
    <Box
      p="md"
      style={{
        background: dark
          ? 'linear-gradient(135deg, #1A237E 0%, #283593 50%, #3949AB 100%)'
          : 'linear-gradient(135deg, #1A237E 0%, #3949AB 50%, #FF6B35 100%)',
        borderRadius: '20px 20px 0 0',
        color: 'white',
      }}
    >
      <Group justify="space-between" align="center">
        <Group gap="sm">
          <Box
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              backdropFilter: 'blur(10px)',
            }}
          >
            🧑‍🍳
          </Box>
          <Box>
            <Group gap={8} mb={2}>
              <Text fw={700} size="lg" style={{ color: 'white' }}>
                سرآشپز گارنیش
              </Text>
              <Badge
                size="xs"
                variant="filled"
                color="rgba(255,255,255,0.2)"
                leftSection={<IconSparkles size={10} />}
                style={{ color: 'white' }}
              >
                AI
              </Badge>
            </Group>
            <Text size="xs" opacity={0.8} style={{ color: 'white' }}>
              آماده برای پیشنهاد {timeContext} 🍳
            </Text>
          </Box>
        </Group>
        <Tooltip label="پاک کردن گفتگو">
          <ActionIcon
            variant="subtle"
            color="white"
            size="lg"
            radius="xl"
            onClick={clearChat}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Box>
  );
}