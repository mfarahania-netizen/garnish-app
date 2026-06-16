import { useState, useMemo } from 'react';
import {
  Container, Group, Text, Stack, Box, SegmentedControl, ActionIcon,
} from '@mantine/core';
import {
  IconTrash, IconBell, IconSparkles, IconArrowUp, IconClock, IconBellOff, IconSettings,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationsQuery } from '../../../hooks/useNotificationsQuery';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { EventType } from '../../../lib/eventTaxonomy';
import IneNotificationPreview from '../components/IneNotificationPreview';
import {
  NotificationRow, SectionHeader, StatusBadge, Button as GesButton, EmptyState,
} from '../../../components/ges';

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

const iconFor = (type) =>
  type === 'suggestion' ? <IconSparkles size={18} aria-hidden="true" />
  : type === 'reminder' ? <IconClock size={18} aria-hidden="true" />
  : <IconBell size={18} aria-hidden="true" />;

export default function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications, unreadCount, isGenerating,
    generateSuggestion, markAsRead, deleteNotification,
  } = useNotificationsQuery();
  const { trackEvent } = useAnalytics();
  const [filter, setFilter] = useState('unread');

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.isRead);
    if (filter === 'read') return notifications.filter(n => n.isRead);
    return notifications;
  }, [notifications, filter]);

  const handleGenerateSuggestion = () => { trackEvent(EventType.NOTIFICATION_GENERATE); generateSuggestion(); };
  const handleMarkAsRead = (id) => { trackEvent(EventType.NOTIFICATION_READ, { notificationId: id }); markAsRead(id); };
  const handleDeleteNotification = (id) => { trackEvent(EventType.NOTIFICATION_DELETE, { notificationId: id }); deleteNotification(id); };
  const handleFilterChange = (value) => { setFilter(value); trackEvent(EventType.NOTIFICATION_FILTER, { filter: value }); };
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 100px' }}>
      <Group justify="space-between" align="center" mt="md" mb="lg">
        <SectionHeader as="h1" title="اعلان‌ها" subtitle={unreadCount > 0 ? undefined : 'آرام و بدون فشار — هر زمان می‌تونی خاموششون کنی'} />
        <Group gap="xs" wrap="nowrap">
          {unreadCount > 0 && <StatusBadge tone="info">{`${unreadCount} خوانده‌نشده`}</StatusBadge>}
          <ActionIcon variant="subtle" onClick={() => navigate('/settings')} aria-label="تنظیمات اعلان‌ها" style={{ color: 'var(--g-color-text-secondary)' }}>
            <IconSettings size={20} />
          </ActionIcon>
        </Group>
      </Group>

      <Box mb="md">
        <GesButton variant="secondary" leftIcon={<IconSparkles size={16} />} loading={isGenerating} onClick={handleGenerateSuggestion}>
          پیشنهاد هوشمند
        </GesButton>
      </Box>

      {/* NOTIF-L4-10: dry-run preview of the Notification Intelligence Engine */}
      <IneNotificationPreview />

      <SegmentedControl
        value={filter}
        onChange={handleFilterChange}
        data={[
          { label: 'خوانده‌نشده', value: 'unread' },
          { label: 'همه', value: 'all' },
          { label: 'خوانده‌شده', value: 'read' },
        ]}
        fullWidth radius="xl" mb="lg" color="saffron"
      />

      {filteredNotifications.length === 0 ? (
        <EmptyState
          icon={<IconBellOff size={28} stroke={1.5} aria-hidden="true" />}
          title="اعلانی نیست"
          message="اینجا آرام است. اعلان‌های مفید و ملایم اینجا ظاهر می‌شوند."
        />
      ) : (
        <Stack gap="sm">
          <AnimatePresence>
            {filteredNotifications.map((n) => (
              <motion.div key={n.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.2 }}>
                <Group wrap="nowrap" align="flex-start" style={{ gap: 'var(--g-space-1)' }}>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <NotificationRow
                      title={n.title}
                      body={n.body}
                      timestamp={timeAgo(n.createdAt)}
                      icon={iconFor(n.type)}
                      state={n.isRead ? 'read' : 'unread'}
                      onOpen={() => handleMarkAsRead(n.id)}
                    />
                  </Box>
                  <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteNotification(n.id)} aria-label="حذف اعلان">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </motion.div>
            ))}
          </AnimatePresence>
        </Stack>
      )}

      <ActionIcon variant="filled" color="saffron" size="xl" radius="xl" style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 'var(--g-z-sticky)', boxShadow: 'var(--g-shadow-2)' }} onClick={scrollToTop} aria-label="برگشت به بالا">
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}
