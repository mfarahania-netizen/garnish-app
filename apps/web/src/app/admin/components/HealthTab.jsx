// 5. apps/web/src/app/admin/components/HealthTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, ThemeIcon,
  SimpleGrid, Loader, Center, useMantineColorScheme
} from '@mantine/core';
import { IconBug, IconShield, IconClock } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import dayjs from 'dayjs';

export default function HealthTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/analytics/system-health')
      .then(res => setHealth(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1F1B16'}>سلامت سیستم</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="red" variant="light" size="lg"><IconBug size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">خطاهای AI</Text>
          </Group>
          <Text fw={700} size="2rem">{health?.errorCount || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="blue" variant="light" size="lg"><IconShield size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">عملیات ادمین</Text>
          </Group>
          <Text fw={700} size="2rem">{health?.adminActions || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="green" variant="light" size="lg"><IconClock size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">آخرین Cron</Text>
          </Group>
          <Text fw={700} size="1.5rem">{health?.lastCronRun ? dayjs(health.lastCronRun).format('HH:mm - YYYY/MM/DD') : 'نامشخص'}</Text>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
