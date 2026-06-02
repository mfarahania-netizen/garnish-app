import { useState, useMemo } from 'react';
import {
  Container, Title, Group, Text, Paper, Stack, Badge,
  ActionIcon, Button, Alert, Box, SegmentedControl
} from '@mantine/core';
import {
  IconTrash, IconCheck, IconBell, IconSparkles,
  IconArrowUp, IconBellOff, IconClock
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationsQuery } from '../../../hooks/useNotificationsQuery';
import { useAnalytics } from '../../../hooks/useAnalytics'; // 👈 جدید

const timeAgo = (dateString) => {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'اکنون';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  return `${Math.floor(hours / 24)} روز پیش`;
};

export default function NotificationsPage() {
  const {
    notifications, unreadCount, loading, isGenerating,
    generateSuggestion, markAsRead, deleteNotification
  } = useNotificationsQuery();
  const { trackEvent } = useAnalytics(); // 👈 جدید

  const dark = false;
  const [filter, setFilter] = useState('unread');

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.isRead);
    if (filter === 'read') return notifications.filter(n => n.isRead);
    return notifications;
  }, [notifications, filter]);

  const handleGenerateSuggestion = () => {
    trackEvent('notification_generate'); // 👈 ردیابی
    generateSuggestion();
  };

  const handleMarkAsRead = (id) => {
    trackEvent('notification_read', { notificationId: id }); // 👈 ردیابی
    markAsRead(id);
  };

  const handleDeleteNotification = (id) => {
    trackEvent('notification_delete', { notificationId: id }); // 👈 ردیابی
    deleteNotification(id);
  };

  const handleFilterChange = (value) => {
    setFilter(value);
    trackEvent('notification_filter', { filter: value }); // 👈 ردیابی
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 40px' }}>
      {/* هدر */}
      <Box mb="lg" mt="md">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconBell size={32} style={{ color: '#FF6B35' }} />
            <Title order={3} style={{ color: '#1A237E' }}>اعلان‌ها</Title>
            {unreadCount > 0 && (
              <Badge color="orange" variant="filled" size="sm">{unreadCount}</Badge>
            )}
          </Group>
          <Button
            variant="light"
            color="orange"
            radius="xl"
            size="xs"
            leftSection={<IconSparkles size={16} />}
            onClick={handleGenerateSuggestion} // 👈 تغییر یافت
            loading={isGenerating}
          >
            پیشنهاد هوشمند
          </Button>
        </Group>
      </Box>

      {/* فیلتر */}
      <SegmentedControl
        value={filter}
        onChange={handleFilterChange} // 👈 تغییر یافت
        data={[
          { label: 'خوانده نشده', value: 'unread' },
          { label: 'همه', value: 'all' },
          { label: 'خوانده شده', value: 'read' },
        ]}
        fullWidth
        radius="xl"
        mb="lg"
        color="orange"
      />

      {/* لیست اعلان‌ها */}
      {filteredNotifications.length === 0 ? (
        <Alert color="orange" radius="lg" icon={<IconBellOff size={18} />}>
          <Text size="sm">اعلانی برای نمایش وجود ندارد.</Text>
        </Alert>
      ) : (
        <Stack gap="sm">
          <AnimatePresence>
            {filteredNotifications.map((n) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <Paper
                  p="sm"
                  radius="md"
                  style={{
                    background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${n.isRead ? '#eee' : '#FF6B35'}`,
                    borderRight: `4px solid ${n.isRead ? '#ddd' : '#FF6B35'}`,
                    opacity: n.isRead ? 0.7 : 1,
                  }}
                >
                  <Group justify="space-between" mb={4}>
                    <Group gap="xs">
                      <Badge color={n.isRead ? 'gray' : 'orange'} variant="light" size="sm">
                        {n.type === 'suggestion' ? 'پیشنهاد' : n.type === 'reminder' ? 'یادآوری' : 'سیستم'}
                      </Badge>
                      <Text size="xs" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <IconClock size={12} />
                        {timeAgo(n.createdAt)}
                      </Text>
                    </Group>
                    <Group gap={4}>
                      {!n.isRead && (
                        <ActionIcon variant="subtle" color="green" size="sm" onClick={() => handleMarkAsRead(n.id)}>
                          <IconCheck size={16} />
                        </ActionIcon>
                      )}
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteNotification(n.id)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                  <Text fw={600} size="sm" mb={4}>{n.title}</Text>
                  <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>{n.body}</Text>
                </Paper>
              </motion.div>
            ))}
          </AnimatePresence>
        </Stack>
      )}

      <ActionIcon
        variant="light" color="orange" size="xl" radius="xl"
        style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 50 }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}