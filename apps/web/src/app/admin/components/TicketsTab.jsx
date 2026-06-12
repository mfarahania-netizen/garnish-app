// 2. apps/web/src/app/admin/components/TicketsTab.jsx
import { useState, useEffect } from 'react';
import {
  Paper, Text, Group, Stack, Badge, Textarea,
  ActionIcon, Loader, Center, Pagination, useMantineColorScheme
} from '@mantine/core';
import { IconSend, IconX, IconCircleCheck, IconAlertCircle } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';

const STATUS_MAP = {
  open: { label: 'باز', color: 'orange', icon: <IconAlertCircle size={14} /> },
  'in-progress': { label: 'در حال بررسی', color: 'blue', icon: <IconAlertCircle size={14} /> },
  closed: { label: 'بسته', color: 'gray', icon: <IconCircleCheck size={14} /> },
};

export default function TicketsTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [tickets, setTickets] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [replyInputs, setReplyInputs] = useState({});
  const LIMIT = 10;

  const fetchTickets = async (p = 1) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/tickets?page=${p}&limit=${LIMIT}`);
      setTickets(res.data.data || res.data || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTickets(page); }, [page]);

  const handleReply = async (ticketId) => {
    const message = replyInputs[ticketId] || '';
    if (!message.trim()) return;
    await apiClient.post(`/admin/tickets/${ticketId}/respond`, { message });
    setReplyInputs(prev => ({ ...prev, [ticketId]: '' }));
    fetchTickets(page);
  };

  const handleClose = async (ticketId) => {
    await apiClient.patch(`/admin/tickets/${ticketId}/status`, { status: 'closed' });
    fetchTickets(page);
  };

  const cardBg = dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';

  return (
    <Stack gap="lg">
      <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1A237E'}>تیکت‌ها</Text>
      <Paper p="lg" style={{ background: cardBg, backdropFilter: 'blur(12px)', borderRadius: 16, border: borderStyle }}>
        {loading ? <Center py="md"><Loader /></Center> : tickets.length === 0 ? <Text c="dimmed" ta="center">تیکتی وجود ندارد</Text> : (
          <Stack gap="md">
            {tickets.map(ticket => {
              const s = STATUS_MAP[ticket.status] || STATUS_MAP.open;
              return (
                <Paper key={ticket.id} p="md" radius="md" style={{ borderRight: `4px solid ${s.color}` }}>
                  <Group justify="space-between" mb="xs">
                    <Badge variant="light" color={s.color} leftSection={s.icon}>{s.label}</Badge>
                    <Text size="xs" c="dimmed">{new Date(ticket.createdAt).toLocaleDateString('fa-IR')}</Text>
                  </Group>
                  <Text fw={600} size="sm">{ticket.subject}</Text>
                  <Text size="xs" c="dimmed" mb="sm">{ticket.message}</Text>
                  {ticket.status !== 'closed' && (
                    <Group gap="sm">
                      <Textarea
                        size="xs"
                        style={{ flex: 1 }}
                        placeholder="پاسخ..."
                        value={replyInputs[ticket.id] || ''}
                        onChange={(e) => setReplyInputs(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      />
                      <ActionIcon color="blue" variant="filled" onClick={() => handleReply(ticket.id)}><IconSend size={16} /></ActionIcon>
                      <ActionIcon color="red" variant="light" onClick={() => handleClose(ticket.id)}><IconX size={16} /></ActionIcon>
                    </Group>
                  )}
                </Paper>
              );
            })}
          </Stack>
        )}
        <Center mt="md">
          <Pagination total={Math.ceil(total / LIMIT)} value={page} onChange={setPage} radius="xl" color="orange" />
        </Center>
      </Paper>
    </Stack>
  );
}
