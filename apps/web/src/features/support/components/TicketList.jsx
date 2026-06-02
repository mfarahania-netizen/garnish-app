import { Paper, Text, Group, Badge } from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useSupportContext } from '../context/SupportContext';
import { useMantineColorScheme } from '@mantine/core';

const TICKET_STATUS = {
  open: { label: 'باز', color: 'orange', icon: <IconAlertCircle size={14} /> },
  answered: { label: 'پاسخ داده شد', color: 'blue', icon: <IconCheck size={14} /> },
  closed: { label: 'بسته', color: 'gray', icon: <IconCheck size={14} /> },
};

export default function TicketList() {
  const { tickets } = useSupportContext();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const textColor = dark ? '#fff' : '#1A237E';
  const dimmedColor = dark ? '#aaa' : '#666';

  if (!tickets.length) return null;

  return (
    <Paper shadow="sm" p="md" radius="lg" style={{ backgroundColor: dark ? '#1e1e24' : '#fff' }}>
      <Text fw={500} mb="sm" c={textColor}>تیکت‌های شما</Text>
      {tickets.map((ticket) => {
        const status = TICKET_STATUS[ticket.status] || TICKET_STATUS.open;
        return (
          <Paper
            key={ticket.id}
            withBorder
            p="sm"
            radius="md"
            mb="xs"
            style={{ backgroundColor: dark ? '#25252b' : '#fafafa', borderColor: dark ? '#444' : '#e0e0e0' }}
          >
            <Group justify="space-between" mb={4}>
              <Text size="sm" fw={500} c={textColor}>{ticket.subject}</Text>
              <Badge variant="light" color={status.color} leftSection={status.icon} size="sm">
                {status.label}
              </Badge>
            </Group>
            <Text size="xs" c={dimmedColor} mb={4}>{ticket.message}</Text>
            <Text size="xs" c="gray">{new Date(ticket.createdAt).toLocaleString('fa-IR')}</Text>
          </Paper>
        );
      })}
    </Paper>
  );
}