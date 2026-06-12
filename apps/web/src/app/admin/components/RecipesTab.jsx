// apps/web/src/app/admin/components/RecipesTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, Table, Badge, SimpleGrid,
  Loader, Center, Pagination, ActionIcon, useMantineColorScheme
} from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

const STATUS_COLOR = { pending: 'yellow', approved: 'green', rejected: 'red' };

export default function RecipesTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [recipes, setRecipes] = useState([]);
  const [recipesStats, setRecipesStats] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 15;
  const [loading, setLoading] = useState(true);

  const fetchRecipes = async (p = 1) => {
    try {
      const [recRes, statsRes] = await Promise.all([
        apiClient.get(`/admin/recipes?page=${p}&limit=${LIMIT}`),
        apiClient.get('/admin/analytics/recipes-stats'),
      ]);
      setRecipes(recRes.data.data || recRes.data || []);
      setTotal(recRes.data.total || 0);
      setRecipesStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecipes(page); }, [page]);

  const handleAction = async (recipeId, action) => {
    const endpoint = action === 'approve' ? 'approve' : 'reject';
    await apiClient.patch(`/admin/recipes/${recipeId}/${endpoint}`);
    fetchRecipes(page);
  };

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1A237E'}>رسپی‌ها</Text>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text size="sm" c="dimmed" mb="xs">پربازدیدترین رسپی‌ها</Text>
          <Stack gap="xs">
            {recipesStats?.topViewed?.slice(0, 5).map(r => (
              <Group key={r.id} justify="space-between">
                <Text size="sm">{r.title}</Text>
                <Badge variant="light">{r.views} بازدید</Badge>
              </Group>
            )) || <Text size="xs" c="dimmed">داده‌ای موجود نیست</Text>}
          </Stack>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text size="sm" c="dimmed" mb="xs">محبوب‌ترین رسپی‌ها (علاقه‌مندی)</Text>
          <Stack gap="xs">
            {recipesStats?.topFavorited?.slice(0, 5).map(r => (
              <Group key={r.id} justify="space-between">
                <Text size="sm">{r.title}</Text>
                <Badge variant="light">{r.favorites} ❤️</Badge>
              </Group>
            )) || <Text size="xs" c="dimmed">داده‌ای موجود نیست</Text>}
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        <Text fw={600} mb="md">مدیریت رسپی‌ها</Text>
        <Table striped highlightOnHover>
          <thead>
            <tr><th>عنوان</th><th>نویسنده</th><th>وضعیت</th><th>عملیات</th></tr>
          </thead>
          <tbody>
            {recipes.map(recipe => (
              <tr key={recipe.id}>
                <td>{recipe.title}</td>
                <td>{recipe.author?.name || '-'}</td>
                <td><Badge color={STATUS_COLOR[recipe.status] || 'gray'}>{recipe.status}</Badge></td>
                <td>
                  {recipe.status !== 'approved' && (
                    <ActionIcon color="green" variant="light" onClick={() => handleAction(recipe.id, 'approve')}><IconCheck size={16} /></ActionIcon>
                  )}
                  {recipe.status !== 'rejected' && (
                    <ActionIcon color="red" variant="light" onClick={() => handleAction(recipe.id, 'reject')}><IconX size={16} /></ActionIcon>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Center mt="md">
          <Pagination total={Math.ceil(total / LIMIT)} value={page} onChange={setPage} radius="xl" />
        </Center>
      </Paper>
    </Stack>
  );
}
