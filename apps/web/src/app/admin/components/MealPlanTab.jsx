// apps/web/src/app/admin/components/MealPlanTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, Badge, ThemeIcon,
  Loader, Center, useMantineColorScheme
} from '@mantine/core';
import { IconCalendar, IconChefHat } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

export default function MealPlanTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [mealPlanning, setMealPlanning] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get('/admin/analytics/meal-planning')
      .then(res => setMealPlanning(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1F1B16'}>برنامه غذایی</Text>

      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        <Group gap="xs" mb="md">
          <ThemeIcon color="blue" variant="light" size="lg"><IconCalendar size={20} /></ThemeIcon>
          <Text fw={600}>آمار برنامه‌ریزی غذایی</Text>
        </Group>
        <Group gap="xs">
          <Text size="sm" c="dimmed">تعداد تولید هوشمند:</Text>
          <Badge variant="filled" color="blue">{mealPlanning?.generateCount || 0}</Badge>
        </Group>
      </Paper>

      {mealPlanning?.topRecipes?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="md">
            <ThemeIcon color="orange" variant="light" size="lg"><IconChefHat size={20} /></ThemeIcon>
            <Text fw={600}>محبوب‌ترین رسپی‌ها در برنامه</Text>
          </Group>
          <Stack gap="xs">
            {mealPlanning.topRecipes.map((r, idx) => (
              <Group key={idx} justify="space-between">
                <Text size="sm">{r.title}</Text>
                <Badge variant="light" color="orange">{r.count} بار</Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
