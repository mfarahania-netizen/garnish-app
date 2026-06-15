// 4. apps/web/src/app/admin/components/PagesTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, Badge, ThemeIcon,
  Loader, Center, useMantineColorScheme
} from '@mantine/core';
import { IconChartBar, IconEye } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

export default function PagesTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [pages, setPages] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/analytics/page-views')
      .then(res => setPages(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1F1B16'}>تحلیل صفحات</Text>

      {pages?.topPages?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="md">
            <ThemeIcon color="blue" variant="light" size="lg"><IconEye size={20} /></ThemeIcon>
            <Text fw={600}>پربازدیدترین صفحات</Text>
          </Group>
          <Stack gap="xs">
            {pages.topPages.map((p, idx) => (
              <Group key={idx} justify="space-between">
                <Text size="sm">{p.page}</Text>
                <Badge variant="light" color="blue">{p.views} بازدید</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {pages?.dailyViews?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="md">
            <ThemeIcon color="orange" variant="light" size="lg"><IconChartBar size={20} /></ThemeIcon>
            <Text fw={600}>بازدید روزانه</Text>
          </Group>
          <Stack gap="xs">
            {pages.dailyViews.map((d, idx) => (
              <Group key={idx} justify="space-between">
                <Text size="sm">{d.date}</Text>
                <Badge variant="light" color="orange">{d.count} بازدید</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}