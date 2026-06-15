// apps/web/src/app/admin/components/SearchTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, Table, Badge, ThemeIcon,
  Loader, Center, useMantineColorScheme
} from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

export default function SearchTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await apiClient.get('/admin/analytics/search-queries');
        setQueries(res.data || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1F1B16'}>جستجوها</Text>

      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        <Group gap="xs" mb="md">
          <ThemeIcon color="orange" variant="light" size="lg"><IconSearch size={20} /></ThemeIcon>
          <Text fw={600}>پرتکرارترین جستجوها</Text>
        </Group>
        <Table striped highlightOnHover>
          <thead>
            <tr><th>عبارت جستجو</th><th>تعداد تکرار</th></tr>
          </thead>
          <tbody>
            {queries.length === 0 ? (
              <tr><td colSpan={2}><Text c="dimmed" ta="center">هنوز جستجویی ثبت نشده است.</Text></td></tr>
            ) : (
              queries.map((q, idx) => (
                <tr key={idx}>
                  <td>{q.query}</td>
                  <td><Badge variant="light" color="orange">{q.count}</Badge></td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Paper>
    </Stack>
  );
}