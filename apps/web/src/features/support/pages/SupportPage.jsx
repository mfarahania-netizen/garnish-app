import { useState } from 'react';
import {
  Container, Title, Group, Text, Paper, TextInput, Textarea, Select,
  Button, Badge, ActionIcon, Tooltip, Alert,
  useMantineColorScheme, Stack, Box, Divider
} from '@mantine/core';
import {
  IconPhone, IconBrandWhatsapp, IconBrandTelegram,
  IconMessageCircle, IconSend, IconCheck, IconAlertCircle,
  IconClock, IconProgress, IconX,
  IconArrowUp, IconLifebuoy, IconFileReport
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSupportQuery } from '../../../hooks/useSupportQuery';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { EventType } from '../../../lib/eventTaxonomy'; // 👈 اضافه شد

const TICKET_STATUS = {
  open: { label: 'باز', color: 'orange', icon: <IconClock size={14} /> },
  'in-progress': { label: 'در حال بررسی', color: 'blue', icon: <IconProgress size={14} /> },
  answered: { label: 'پاسخ داده شد', color: 'green', icon: <IconCheck size={14} /> },
  need_info: { label: 'نیاز به اطلاعات', color: 'orange', icon: <IconAlertCircle size={14} /> },
  closed: { label: 'بسته شده', color: 'gray', icon: <IconX size={14} /> },
};

const SUPPORT_CONTACTS = [
  { icon: <IconPhone size={22} />, label: 'تماس', action: 'tel:+982112345678' },
  { icon: <IconBrandWhatsapp size={22} color="#25D366" />, label: 'واتساپ', action: 'https://wa.me/989121234567' },
  { icon: <IconBrandTelegram size={22} color="#0088cc" />, label: 'تلگرام', action: 'https://t.me/garnish_support' },
  { icon: <IconMessageCircle size={22} color="#00A885" />, label: 'بله', action: 'https://ble.im/garnish_bot' },
];

export default function SupportPage() {
  const { tickets, loading, createTicket, addReply, closeTicket } = useSupportQuery();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('technical');
  const [replyTexts, setReplyTexts] = useState({});
  const [expandedTicketId, setExpandedTicketId] = useState(null);

  const handleCreateTicket = () => {
    if (!subject.trim() || !message.trim()) return;
    createTicket({ subject, message, category, priority: 'normal' });
    trackEvent(EventType.TICKET_CREATE, { subject, category });
    setSubject('');
    setMessage('');
  };

  const handleAddReply = (ticketId) => {
    const msg = replyTexts[ticketId] || '';
    if (!msg.trim()) return;
    addReply(ticketId, msg);
    trackEvent(EventType.TICKET_REPLY, { ticketId });
    setReplyTexts(prev => ({ ...prev, [ticketId]: '' }));
  };

  const handleCloseTicket = (ticketId) => {
    closeTicket(ticketId);
    trackEvent(EventType.TICKET_CLOSE, { ticketId });
  };

  const handleContactClick = (contactLabel) => {
    trackEvent(EventType.SUPPORT_CONTACT_CLICK, { contact: contactLabel });
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const cardBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)';
  const textColor = dark ? '#fff' : '#1A237E';
  const borderColor = dark ? '#333' : '#FF6B35';

  return (
    <Container size="xs" style={{ maxWidth: 420, margin: '0 auto', padding: '0 8px 100px' }}>
      {/* هدر */}
      <Paper
        p="md"
        radius="xl"
        mb="lg"
        mt="md"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,107,53,0.2)',
        }}
      >
        <Group gap="xs" align="center">
          <IconLifebuoy size={32} style={{ color: '#FF6B35' }} />
          <div>
            <Title order={3} style={{ color: '#1A237E' }}>پشتیبانی</Title>
            <Text size="xs" c="dimmed">ما همیشه آمادهٔ کمک به شما هستیم</Text>
          </div>
        </Group>
      </Paper>

      {/* راه‌های ارتباطی */}
      <Paper
        p="lg"
        radius="xl"
        mb="lg"
        style={{
          background: cardBg,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${borderColor}`,
        }}
      >
        <Text fw={600} mb="md" ta="center" c={textColor}>راه‌های ارتباطی</Text>
        <Group justify="center" gap="xl" wrap="wrap">
          {SUPPORT_CONTACTS.map((contact, i) => (
            <Tooltip key={i} label={contact.label} withArrow>
              <motion.a
                href={contact.action}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleContactClick(contact.label)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 52, height: 52, borderRadius: '50%',
                  background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
                  cursor: 'pointer', textDecoration: 'none',
                }}
              >
                {contact.icon}
              </motion.a>
            </Tooltip>
          ))}
        </Group>
      </Paper>

      {/* فرم تیکت جدید */}
      <Paper
        p="lg"
        radius="xl"
        mb="lg"
        style={{
          background: cardBg,
          backdropFilter: 'blur(8px)',
          border: `1px solid ${borderColor}`,
        }}
      >
        <Group gap="xs" mb="sm">
          <IconFileReport size={20} color="#FF6B35" />
          <Text fw={600} c={textColor}>ثبت تیکت جدید</Text>
        </Group>
        <Stack gap="sm">
          <Select
            label="دسته‌بندی"
            data={[
              { value: 'technical', label: 'مشکل فنی' },
              { value: 'content', label: 'گزارش خطا در محتوا' },
              { value: 'suggestion', label: 'پیشنهاد' },
              { value: 'account', label: 'حساب کاربری' },
              { value: 'other', label: 'سایر' },
            ]}
            value={category}
            onChange={setCategory}
            styles={{ input: { textAlign: 'right' }, item: { textAlign: 'right' } }}
          />
          <TextInput
            placeholder="موضوع تیکت"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            styles={{ input: { textAlign: 'right' } }}
          />
          <Textarea
            placeholder="توضیحات خود را بنویسید..."
            minRows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            styles={{ input: { textAlign: 'right' } }}
          />
          <Button
            fullWidth
            leftSection={<IconSend size={18} />}
            onClick={handleCreateTicket}
            radius="xl"
            color="orange"
            size="md"
            loading={loading}
            disabled={!subject.trim() || !message.trim()}
          >
            ارسال تیکت
          </Button>
        </Stack>
      </Paper>

      {/* لیست تیکت‌ها */}
      {tickets.length > 0 && (
        <Paper
          p="lg"
          radius="xl"
          style={{
            background: cardBg,
            backdropFilter: 'blur(8px)',
            border: `1px solid ${borderColor}`,
          }}
        >
          <Text fw={600} mb="sm" c={textColor}>تیکت‌های شما ({tickets.length})</Text>
          <Stack gap="sm">
            <AnimatePresence>
              {tickets.map(ticket => {
                const statusInfo = TICKET_STATUS[ticket.status] || TICKET_STATUS.open;
                const isExpanded = expandedTicketId === ticket.id;
                return (
                  <motion.div
                    key={ticket.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Paper
                      p="sm"
                      radius="md"
                      style={{
                        borderRight: `4px solid ${statusInfo.color}`,
                        background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)',
                        backdropFilter: 'blur(4px)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        overflow: 'hidden',
                      }}
                      onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                    >
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <Badge variant="light" color={statusInfo.color} leftSection={statusInfo.icon} size="sm">
                            {statusInfo.label}
                          </Badge>
                          <Text size="sm" fw={600} lineClamp={1}>{ticket.subject}</Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {new Date(ticket.createdAt).toLocaleDateString('fa-IR')}
                        </Text>
                      </Group>
                      <Text size="xs" c="dimmed" lineClamp={isExpanded ? 0 : 2}>
                        {ticket.message}
                      </Text>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{ overflow: 'hidden' }}
                          >
                            <Box mt="sm" onClick={(e) => e.stopPropagation()}>
                              <Divider mb="sm" />
                              {ticket.replies?.length > 0 && (
                                <Stack gap="xs" mb="sm">
                                  {ticket.replies.map(reply => (
                                    <Paper
                                      key={reply.id}
                                      p="xs"
                                      radius="md"
                                      style={{
                                        borderRight: `4px solid ${reply.isStaff ? '#4CAF50' : '#FF6B35'}`,
                                        background: reply.isStaff
                                          ? (dark ? 'rgba(76,175,80,0.08)' : '#e8f5e9')
                                          : (dark ? 'rgba(255,107,53,0.08)' : '#fff3e0'),
                                      }}
                                    >
                                      <Group justify="space-between" mb={4}>
                                        <Badge size="xs" color={reply.isStaff ? 'green' : 'orange'}>
                                          {reply.isStaff ? 'ادمین' : 'شما'}
                                        </Badge>
                                        <Text size="xs" c="dimmed">
                                          {new Date(reply.createdAt).toLocaleDateString('fa-IR')}
                                        </Text>
                                      </Group>
                                      <Text size="sm">{reply.message}</Text>
                                    </Paper>
                                  ))}
                                </Stack>
                              )}

                              {ticket.status !== 'closed' && (
                                <Group gap="xs" align="flex-end" mt="sm">
                                  <Textarea
                                    placeholder="پاسخ خود را بنویسید..."
                                    value={replyTexts[ticket.id] || ''}
                                    onChange={(e) =>
                                      setReplyTexts(prev => ({ ...prev, [ticket.id]: e.target.value }))
                                    }
                                    style={{ flex: 1 }}
                                    minRows={2}
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    styles={{ input: { textAlign: 'right' } }}
                                  />
                                  <Stack gap={4}>
                                    <ActionIcon
                                      color="blue"
                                      variant="filled"
                                      radius="xl"
                                      onClick={() => handleAddReply(ticket.id)}
                                      disabled={!(replyTexts[ticket.id] || '').trim()}
                                    >
                                      <IconSend size={16} />
                                    </ActionIcon>
                                    <ActionIcon
                                      color="gray"
                                      variant="filled"
                                      radius="xl"
                                      onClick={() => handleCloseTicket(ticket.id)}
                                      title="بستن تیکت"
                                    >
                                      <IconX size={16} />
                                    </ActionIcon>
                                  </Stack>
                                </Group>
                              )}
                            </Box>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Paper>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </Stack>
        </Paper>
      )}

      {tickets.length === 0 && !loading && (
        <Alert color="orange" radius="lg" mt="lg">
          <Text size="sm" fw={500}>هنوز تیکتی ثبت نکرده‌اید</Text>
          <Text size="xs">می‌توانید از طریق فرم بالا، تیکت جدیدی ایجاد کنید.</Text>
        </Alert>
      )}

      <ActionIcon
        variant="light"
        color="orange"
        size="xl"
        radius="xl"
        style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 50 }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}