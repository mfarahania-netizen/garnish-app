// apps/web/src/app/admin/components/AITab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, Badge, ThemeIcon,
  SimpleGrid, Loader, Center, useMantineColorScheme
} from '@mantine/core';
import { IconRobot, IconMessage, IconMicrophone, IconExclamationCircle } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

export default function AITab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [ai, setAI] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/analytics/ai-interaction')
      .then(res => setAI(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1F1B16'}>دستیار هوش مصنوعی</Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="cyan" variant="light" size="lg"><IconMessage size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">کل پیام‌ها</Text>
          </Group>
          <Text fw={700} size="2rem">{ai?.totalMessages || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="violet" variant="light" size="lg"><IconRobot size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">جستجوی صوتی</Text>
          </Group>
          <Text fw={700} size="2rem">{ai?.voiceSearches || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="orange" variant="light" size="lg"><IconMicrophone size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">مفاهیم پرتکرار</Text>
          </Group>
          <Text fw={700} size="2rem">{ai?.topConcepts?.length || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="red" variant="light" size="lg"><IconExclamationCircle size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">مواد پرتکرار</Text>
          </Group>
          <Text fw={700} size="2rem">{ai?.topIngredients?.length || 0}</Text>
        </Paper>
      </SimpleGrid>

      {ai?.topIngredients?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text fw={600} mb="md">🥕 مواد پرتکرار در درخواست‌ها</Text>
          <Group gap="xs">
            {ai.topIngredients.map((item, idx) => (
              <Badge key={idx} variant="filled" color="orange" size="sm" radius="xl">{item.name} ({item.count})</Badge>
            ))}
          </Group>
        </Paper>
      )}

      {ai?.topConcepts?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text fw={600} mb="md">🧠 مفاهیم پرتکرار</Text>
          <Group gap="xs">
            {ai.topConcepts.map((item, idx) => (
              <Badge key={idx} variant="filled" color="violet" size="sm" radius="xl">{item.name} ({item.count})</Badge>
            ))}
          </Group>
        </Paper>
      )}

      {ai?.topRecipes?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text fw={600} mb="md">🍽️ رسپی‌های پیشنهادی پرتکرار</Text>
          <Stack gap="xs">
            {ai.topRecipes.map((item, idx) => (
              <Group key={idx} justify="space-between">
                <Text size="sm">{item.name}</Text>
                <Badge variant="light" color="orange">{item.count} بار</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}