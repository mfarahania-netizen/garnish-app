// apps/web/src/app/admin/components/EventsTab.jsx
import { useState, useEffect, useCallback } from 'react';
import {
  Paper, Text, Group, Stack, Badge,
  Loader, Center, Pagination, Select, useMantineColorScheme,
  ActionIcon, Tooltip
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconFilter, IconCalendar, IconX } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import dayjs from 'dayjs';

const EVENT_TYPES = [
  { value: 'all', label: 'همه' },
  { value: 'page_view', label: 'page_view' },
  { value: 'search_query', label: 'search_query' },
  { value: 'recipe_view', label: 'recipe_view' },
  // ...
];

export default function EventsTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState([null, null]);
  const [loading, setLoading] = useState(true);
  const LIMIT = 20;

  const fetchEvents = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', LIMIT);
      params.append('page', p);
      if (filter !== 'all') params.append('type', filter);
      if (dateRange[0]) params.append('from', dayjs(dateRange[0]).format('YYYY-MM-DD'));
      if (dateRange[1]) params.append('to', dayjs(dateRange[1]).format('YYYY-MM-DD'));

      const res = await apiClient.get(`/admin/analytics/events?${params.toString()}`);
      const eventsData = res.data;
      setEvents(eventsData.events || eventsData.data || []);
      setTotal(eventsData.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filter, dateRange]);

  useEffect(() => {
    fetchEvents(page);
  }, [fetchEvents, page]);

  const clearDateRange = () => setDateRange([null, null]);

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1F1B16'}>رویدادها</Text>
        <Group gap="sm">
          <DatePickerInput
            type="range"
            placeholder="بازهٔ زمانی"
            value={dateRange}
            onChange={setDateRange}
            clearable
            rightSection={<IconCalendar size={16} />}
            style={{ width: 220 }}
            locale="fa"
            valueFormat="YYYY/MM/DD"
          />
          {dateRange[0] && (
            <Tooltip label="پاک کردن فیلتر تاریخ">
              <ActionIcon variant="subtle" color="red" onClick={clearDateRange}>
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Select
            placeholder="فیلتر نوع رویداد"
            data={EVENT_TYPES}
            value={filter}
            onChange={(value) => { setFilter(value || 'all'); setPage(1); }}
            radius="xl"
            style={{ width: 220 }}
            leftSection={<IconFilter size={16} />}
          />
        </Group>
      </Group>

      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        {loading ? (
          <Center py="md"><Loader /></Center>
        ) : (
          <Stack gap="sm">
            {events.length === 0 ? (
              <Text c="dimmed" ta="center">رویدادی یافت نشد.</Text>
            ) : (
              events.map(event => (
                <Paper key={event.id} p="sm" radius="md" withBorder>
                  <Group justify="space-between" wrap="nowrap">
                    <Stack gap={2}>
                      <Group gap="xs">
                        <Badge size="xs" color="orange" variant="light">{event.type}</Badge>
                        <Text size="xs" c="dimmed">{dayjs(event.timestamp).format('HH:mm - YYYY/MM/DD')}</Text>
                      </Group>
                      <Text size="xs" c="dimmed">
                        کاربر: {event.user?.name || event.user?.phone || event.userId?.slice(0,8)}
                        {event.recipeTitle ? ` | رسپی: ${event.recipeTitle}` : ''}
                        {event.page ? ` | صفحه: ${event.page}` : ''}
                      </Text>
                    </Stack>
                  </Group>
                </Paper>
              ))
            )}
          </Stack>
        )}
        <Center mt="md">
          <Pagination total={Math.ceil(total / LIMIT)} value={page} onChange={setPage} radius="xl" color="orange" />
        </Center>
      </Paper>
    </Stack>
  );
}
