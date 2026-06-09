// apps/web/src/app/admin/components/ShoppingTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, Badge, ThemeIcon,
  SimpleGrid, Loader, Center, useMantineColorScheme
} from '@mantine/core';
import { IconShoppingCart, IconCheck, IconBasket } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

export default function ShoppingTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [shopping, setShopping] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/analytics/shopping')
      .then(res => setShopping(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1A237E'}>سبد خرید</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="orange" variant="light" size="lg"><IconBasket size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">کل آیتم‌ها</Text>
          </Group>
          <Text fw={700} size="2rem">{shopping?.totalItems || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="green" variant="light" size="lg"><IconCheck size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">آیتم‌های خریدشده</Text>
          </Group>
          <Text fw={700} size="2rem">{shopping?.checkedItems || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="violet" variant="light" size="lg"><IconShoppingCart size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">نرخ تکمیل</Text>
          </Group>
          <Text fw={700} size="2rem">
            {shopping?.totalItems ? Math.round((shopping.checkedItems / shopping.totalItems) * 100) : 0}%
          </Text>
        </Paper>
      </SimpleGrid>

      {shopping?.topItems?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text fw={600} mb="md">پرتکرارترین آیتم‌های خرید</Text>
          <Stack gap="xs">
            {shopping.topItems.slice(0, 15).map((item, idx) => (
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