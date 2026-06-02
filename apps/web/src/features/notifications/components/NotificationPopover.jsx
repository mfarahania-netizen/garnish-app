import { Popover, ScrollArea, Stack, Text, Paper, Group, ActionIcon, Button } from '@mantine/core';
import { IconCheck, IconTrash, IconSparkles } from '@tabler/icons-react';
import { useState } from 'react';
import { useNotificationsQuery } from '../../../hooks/useNotificationsQuery';
import { useNavigate } from 'react-router-dom';

export default function NotificationPopover({ children }) {
  const { notifications, markAsRead, deleteNotification, generateSuggestion } = useNotificationsQuery();
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();

  const latestUnread = notifications.filter(n => !n.isRead).slice(0, 4);

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" width={320} shadow="md">
      <Popover.Target>
        <div onClick={() => setOpened(o => !o)} style={{ cursor: 'pointer' }}>{children}</div>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={600}>اعلان‌های اخیر</Text>
            <Button
              variant="subtle" size="xs" leftSection={<IconSparkles size={14} />}
              onClick={() => { generateSuggestion(); setOpened(false); }}
            >
              پیشنهاد
            </Button>
          </Group>
          {latestUnread.length === 0 ? (
            <Text size="xs" c="dimmed" ta="center" py="md">همه را خوانده‌اید 😊</Text>
          ) : (
            <ScrollArea h={220}>
              <Stack gap="xs">
                {latestUnread.map(n => (
                  <Paper key={n.id} p="xs" radius="md" withBorder style={{ borderColor: '#FF6B35' }}>
                    <Text size="xs" fw={600}>{n.title}</Text>
                    <Text size="xs" c="dimmed" lineClamp={2}>{n.body}</Text>
                    <Group justify="flex-end" mt={4}>
                      <ActionIcon size="sm" variant="subtle" color="green" onClick={() => markAsRead(n.id)}>
                        <IconCheck size={14} />
                      </ActionIcon>
                      <ActionIcon size="sm" variant="subtle" color="red" onClick={() => deleteNotification(n.id)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </ScrollArea>
          )}
          <Button fullWidth variant="light" size="xs" onClick={() => { navigate('/notifications'); setOpened(false); }}>
            مشاهده همه
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}