import { ActionIcon, Indicator } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useNotificationsQuery } from '../../../hooks/useNotificationsQuery';

export default function NotificationBell() {
  const { unreadCount } = useNotificationsQuery();

  return (
    <Indicator label={unreadCount} size={16} offset={2} color="red" disabled={unreadCount === 0}>
      <ActionIcon variant="subtle" size="lg" aria-label="اعلان‌ها">
        <IconBell size={22} />
      </ActionIcon>
    </Indicator>
  );
}