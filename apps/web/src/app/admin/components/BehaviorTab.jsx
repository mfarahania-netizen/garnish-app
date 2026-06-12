// 3. apps/web/src/app/admin/components/BehaviorTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, ThemeIcon,
  SimpleGrid, Table, Loader, Center, useMantineColorScheme
} from '@mantine/core';
import { IconBrain, IconChartBar } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

export default function BehaviorTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [profiles, setProfiles] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/analytics/behavior-profiles')
      .then(res => setProfiles(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1A237E'}>پروفایل رفتاری</Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="violet" variant="light" size="lg"><IconChartBar size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">میانگین ثبات</Text>
          </Group>
          <Text fw={700} size="2rem">{profiles?.avgConsistency?.toFixed(1) || 0}%</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="red" variant="light" size="lg"><IconBrain size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">میانگین ریسک ریزش</Text>
          </Group>
          <Text fw={700} size="2rem">{profiles?.avgChurnRisk?.toFixed(1) || 0}%</Text>
        </Paper>
      </SimpleGrid>

      {profiles?.profiles?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text fw={600} mb="md">لیست پروفایل‌ها</Text>
          <Table striped highlightOnHover>
            <thead>
              <tr><th>کاربر</th><th>ثبات</th><th>ریسک ریزش</th><th>سلامت</th><th>دفعات آشپزی</th></tr>
            </thead>
            <tbody>
              {profiles.profiles.map(bp => (
                <tr key={bp.id}>
                  <td>{bp.user?.name || bp.user?.phone || bp.userId}</td>
                  <td>{bp.consistencyScore?.toFixed(1)}%</td>
                  <td>{bp.churnRiskScore?.toFixed(1)}%</td>
                  <td>{bp.healthAdherenceScore?.toFixed(1)}%</td>
                  <td>{bp.cookingFrequency || '-'}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
