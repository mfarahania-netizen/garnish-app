// apps/web/src/app/admin/components/UsersTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, Table, Badge, SimpleGrid,
  ThemeIcon, Loader, Center, Pagination, useMantineColorScheme
} from '@mantine/core';
import { IconUsers, IconUserPlus, IconBrain } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import dayjs from 'dayjs';

export default function UsersTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [userStats, setUserStats] = useState(null);
  const [behaviorProfiles, setBehaviorProfiles] = useState(null);
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const LIMIT = 15;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, profilesRes, usersRes] = await Promise.all([
          apiClient.get('/admin/analytics/user-stats'),
          apiClient.get('/admin/analytics/behavior-profiles'),
          apiClient.get(`/admin/users?page=${page}&limit=${LIMIT}`),
        ]);
        setUserStats(statsRes.data);
        setBehaviorProfiles(profilesRes.data);
        setUsers(usersRes.data.data || usersRes.data || []);
        setTotalUsers(usersRes.data.total || 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [page]);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  if (loading) return <Center py="xl"><Loader /></Center>;

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1A237E'}>کاربران</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="blue" variant="light" size="lg"><IconUsers size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">کل کاربران</Text>
          </Group>
          <Text fw={700} size="2rem">{userStats?.totalUsers || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="green" variant="light" size="lg"><IconUserPlus size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">ثبت‌نام امروز</Text>
          </Group>
          <Text fw={700} size="2rem">{userStats?.todayUsers || 0}</Text>
        </Paper>
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Group gap="xs" mb="sm">
            <ThemeIcon color="violet" variant="light" size="lg"><IconBrain size={20} /></ThemeIcon>
            <Text size="sm" c="dimmed">پروفایل‌های رفتاری</Text>
          </Group>
          <Text fw={700} size="2rem">{behaviorProfiles?.profiles?.length || 0}</Text>
        </Paper>
      </SimpleGrid>

      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        <Text fw={600} mb="md">لیست کاربران</Text>
        <Table striped highlightOnHover>
          <thead>
            <tr><th>نام</th><th>شماره</th><th>ایمیل</th><th>تاریخ عضویت</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.name || '-'}</td>
                <td>{u.phone || '-'}</td>
                <td>{u.email || '-'}</td>
                <td>{dayjs(u.createdAt).format('YYYY/MM/DD')}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Center mt="md">
          <Pagination total={Math.ceil(totalUsers / LIMIT)} value={page} onChange={setPage} radius="xl" />
        </Center>
      </Paper>

      {behaviorProfiles?.profiles?.length > 0 && (
        <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
          <Text fw={600} mb="md">پروفایل‌های رفتاری (اخیر)</Text>
          <Table striped highlightOnHover>
            <thead>
              <tr><th>کاربر</th><th>ثبات</th><th>ریسک ریزش</th><th>سلامت</th><th>دفعات آشپزی</th></tr>
            </thead>
            <tbody>
              {behaviorProfiles.profiles.slice(0, 10).map(bp => (
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