import { useState, useEffect } from 'react';
import {
  Container, Title, Group, Text, Paper, SimpleGrid, Stack, Badge,
  Textarea, Button, ActionIcon, Tooltip, Tabs, Table,
  useMantineColorScheme, Loader, Center, Box, ThemeIcon,
  Avatar, Pagination
} from '@mantine/core';
import {
  IconUsers, IconTicket, IconChefHat, IconCheck, IconX,
  IconSend, IconRefresh, IconAlertCircle,
  IconCircleCheck, IconArrowUp, IconChartBar, IconActivity,
  IconTrendingUp, IconSearch, IconRobot, IconCalendar,
  IconLock
} from '@tabler/icons-react';
import apiClient from '../../lib/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics';
import { EventType } from '../../lib/eventTaxonomy';
import { motion } from 'framer-motion';

const TICKET_STATUS_MAP = {
  open: { label: 'باز', color: 'orange', icon: <IconAlertCircle size={14} /> },
  'in-progress': { label: 'در حال بررسی', color: 'blue', icon: <IconAlertCircle size={14} /> },
  closed: { label: 'بسته', color: 'gray', icon: <IconCircleCheck size={14} /> },
};

const RECIPE_STATUS_MAP = {
  pending: { label: 'در انتظار', color: 'yellow' },
  approved: { label: 'تأیید شده', color: 'green' },
  rejected: { label: 'رد شده', color: 'red' },
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const { trackEvent } = useAnalytics();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const [isAdmin, setIsAdmin] = useState(null);
  const [stats, setStats] = useState({ recipeCount: 0, userCount: 0, ticketCount: 0 });
  const [tickets, setTickets] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('behavior');
  const [replyInputs, setReplyInputs] = useState({});

  const [analyticsStats, setAnalyticsStats] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [searchQueries, setSearchQueries] = useState([]);
  const [mealPlanning, setMealPlanning] = useState(null);
  const [aiInteraction, setAIInteraction] = useState(null);
  const [eventsPage, setEventsPage] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const EVENTS_PER_PAGE = 10;

  useEffect(() => {
    if (!token) return;
    apiClient.get('/users/me')
      .then(res => {
        const admin = res.data.isAdmin === true;
        setIsAdmin(admin);
        if (admin) trackEvent(EventType.ADMIN_VIEW);
      })
      .catch(() => setIsAdmin(false));
  }, [token]);

  const fetchAll = async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const [statsRes, ticketsRes, recipesRes, usersRes] = await Promise.all([
        apiClient.get('/admin/dashboard'),
        apiClient.get('/admin/tickets'),
        apiClient.get('/admin/recipes'),
        apiClient.get('/admin/users'),
      ]);
      setStats(statsRes.data);
      // استخراج آرایه از ساختار paginated جدید
      const extractedTickets = ticketsRes.data?.data || ticketsRes.data || [];
      const extractedRecipes = recipesRes.data?.data || recipesRes.data || [];
      const extractedUsers = usersRes.data?.data || usersRes.data || [];
      setTickets(extractedTickets);
      setRecipes(extractedRecipes);
      setUsers(extractedUsers);
    } catch (err) {
      console.error('خطا در بارگذاری پنل:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async (page = 1) => {
    if (!token || !isAdmin) return;
    try {
      const [statsRes, eventsRes, searchRes, mealPlanRes, aiRes] = await Promise.all([
        apiClient.get('/admin/analytics/stats'),
        apiClient.get(`/admin/analytics/events?limit=${EVENTS_PER_PAGE}&page=${page}`),
        apiClient.get('/admin/analytics/search-queries'),
        apiClient.get('/admin/analytics/meal-planning'),
        apiClient.get('/admin/analytics/ai-interaction'),
      ]);
      setAnalyticsStats(statsRes.data);
      const eventsData = eventsRes.data;
      // این endpoint هم { events, total } برمی‌گردونه
      setRecentEvents(eventsData.events || eventsData.data || eventsData);
      setTotalEvents(eventsData.total || 0);
      // search-queries همچنان آرایه‌ست
      setSearchQueries(searchRes.data);
      setMealPlanning(mealPlanRes.data);
      setAIInteraction(aiRes.data);
    } catch (err) {
      console.error('خطا در دریافت اطلاعات رفتاری:', err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAll();
      fetchAnalytics(eventsPage);
    }
  }, [isAdmin, token, eventsPage]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    trackEvent(EventType.ADMIN_TAB_CHANGE, { tab });
  };

  const handleReply = async (ticketId) => {
    const message = replyInputs[ticketId] || '';
    if (!message.trim()) return;
    await apiClient.post(`/admin/tickets/${ticketId}/respond`, { message });
    trackEvent(EventType.ADMIN_TICKET_REPLY, { ticketId });
    setReplyInputs(prev => ({ ...prev, [ticketId]: '' }));
    fetchAll();
  };

  const handleTicketStatus = async (ticketId, status) => {
    await apiClient.patch(`/admin/tickets/${ticketId}/status`, { status });
    trackEvent(EventType.ADMIN_TICKET_STATUS, { ticketId, status });
    fetchAll();
  };

  const handleRecipeAction = async (recipeId, action) => {
    const endpoint = action === 'approve' ? 'approve' : 'reject';
    await apiClient.patch(`/admin/recipes/${recipeId}/${endpoint}`);
    trackEvent(action === 'approve' ? EventType.ADMIN_RECIPE_APPROVE : EventType.ADMIN_RECIPE_REJECT, { recipeId });
    fetchAll();
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // طراحی شیشه‌ای
  const bgGlow = dark ? 'rgba(26,35,126,0.4)' : 'rgba(255,107,53,0.15)';
  const cardBg = dark ? 'rgba(20,20,28,0.7)' : 'rgba(255,255,255,0.8)';
  const borderStyle = dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)';
  const textPrimary = dark ? '#fff' : '#1A237E';

  if (!token) {
    return (
      <Center style={{ height: '60vh' }}>
        <Stack align="center" gap="md">
          <IconLock size={48} color="red" />
          <Text fw={700} size="lg" c="red">دسترسی غیرمجاز</Text>
          <Button variant="light" color="gray" onClick={() => window.location.href = '/auth'}>ورود به حساب</Button>
        </Stack>
      </Center>
    );
  }

  if (isAdmin === null) return <Center style={{ height: '60vh' }}><Loader size="lg" color="orange" /></Center>;

  if (isAdmin === false) {
    return (
      <Center style={{ height: '60vh' }}>
        <Stack align="center" gap="md">
          <IconLock size={48} color="red" />
          <Text fw={700} size="lg" c="red">دسترسی غیرمجاز</Text>
          <Button variant="light" color="gray" onClick={() => window.location.href = '/'}>بازگشت به خانه</Button>
        </Stack>
      </Center>
    );
  }

  if (loading) return <Center style={{ height: '60vh' }}><Loader size="lg" color="orange" /></Center>;

  return (
    <Container size="lg" py="md" style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 120 }}>
      {/* هدر شیشه‌ای */}
      <Paper
        p="md"
        radius="xl"
        mb="xl"
        style={{
          background: cardBg,
          backdropFilter: 'blur(12px)',
          border: borderStyle,
          boxShadow: dark ? 'none' : '0 4px 20px rgba(0,0,0,0.06)',
        }}
      >
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <ThemeIcon size={42} radius="xl" variant="gradient" gradient={{ from: 'orange', to: 'red' }}>
              <IconChefHat size={24} />
            </ThemeIcon>
            <div>
              <Title order={3} c={textPrimary}>پنل مدیریت</Title>
              <Text size="xs" c="dimmed">مدیریت محتوا، کاربران و تحلیل رفتار</Text>
            </div>
          </Group>
          <ActionIcon variant="light" color="orange" size="lg" radius="xl" onClick={fetchAll}>
            <IconRefresh size={20} />
          </ActionIcon>
        </Group>
      </Paper>

      {/* کارت‌های آماری شیشه‌ای */}
      <SimpleGrid cols={3} spacing="md" mb="xl">
        {[
          { label: 'رسپی‌ها', value: stats.recipeCount, icon: IconChefHat, color: 'orange' },
          { label: 'کاربران', value: stats.userCount, icon: IconUsers, color: 'blue' },
          { label: 'تیکت‌ها', value: stats.ticketCount, icon: IconTicket, color: 'green' },
        ].map((item, i) => (
          <Paper
            key={i}
            p="lg"
            radius="xl"
            style={{
              background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(8px)',
              border: `2px solid ${item.color === 'orange' ? '#FF6B35' : item.color === 'blue' ? '#5C6BC0' : '#66BB6A'}`,
              textAlign: 'center',
              boxShadow: dark ? 'none' : '0 4px 15px rgba(0,0,0,0.05)',
            }}
          >
            <ThemeIcon size="xl" radius="xl" color={item.color} variant="light" mb="md">
              <item.icon size={24} />
            </ThemeIcon>
            <Text fw={700} size="xl" c={textPrimary}>{item.value}</Text>
            <Text size="sm" c="dimmed">{item.label}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      {/* تب‌های مدیریت */}
      <Tabs value={activeTab} onChange={handleTabChange} variant="pills" radius="xl" mb="lg">
        <Tabs.List grow>
          <Tabs.Tab value="behavior" leftSection={<IconChartBar size={18} />}>رفتار</Tabs.Tab>
          <Tabs.Tab value="tickets" leftSection={<IconTicket size={18} />}>تیکت‌ها</Tabs.Tab>
          <Tabs.Tab value="recipes" leftSection={<IconChefHat size={18} />}>رسپی‌ها</Tabs.Tab>
          <Tabs.Tab value="users" leftSection={<IconUsers size={18} />}>کاربران</Tabs.Tab>
        </Tabs.List>

        {/* پنل رفتار کاربران */}
        <Tabs.Panel value="behavior" pt="md">
          <Stack gap="md">
            {analyticsStats && (
              <SimpleGrid cols={2} spacing="md">
                <Paper p="md" radius="lg" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
                  <Group gap="xs" mb={4}><IconActivity size={20} color="#FF6B35" /><Text size="sm" c="dimmed">کل رویدادها</Text></Group>
                  <Text fw={700} size="xl" c="#FF6B35">{analyticsStats.totalEvents}</Text>
                </Paper>
                <Paper p="md" radius="lg" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
                  <Group gap="xs" mb={4}><IconTrendingUp size={20} color="#4CAF50" /><Text size="sm" c="dimmed">امروز</Text></Group>
                  <Text fw={700} size="xl" c="#4CAF50">{analyticsStats.todayEvents}</Text>
                </Paper>
              </SimpleGrid>
            )}

            <SimpleGrid cols={2} spacing="md">
              <Paper p="md" radius="lg" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
                <Group gap="xs" mb="sm"><IconRobot size={20} color="#FF6B35" /><Text fw={600} size="sm">دستیار هوش مصنوعی</Text></Group>
                {aiInteraction ? (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">کل پیام‌ها: {aiInteraction.totalMessages}</Text>
                    {aiInteraction.topIngredients?.length > 0 && (
                      <Box>
                        <Text size="xs" fw={500} mb={4}>🥕 مواد پرتکرار</Text>
                        <Group gap="xs">{aiInteraction.topIngredients.slice(0,5).map((item, idx) => <Badge key={idx} variant="filled" color="orange" size="xs" radius="xl">{item.name} ({item.count})</Badge>)}</Group>
                      </Box>
                    )}
                  </Stack>
                ) : <Text size="xs" c="dimmed">داده‌ای موجود نیست.</Text>}
              </Paper>

              <Paper p="md" radius="lg" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
                <Group gap="xs" mb="sm"><IconCalendar size={20} color="#FF6B35" /><Text fw={600} size="sm">برنامه‌ریزی غذایی</Text></Group>
                {mealPlanning ? (
                  <Stack gap="xs">
                    <Text size="xs" c="dimmed">تولید هوشمند: {mealPlanning.generateCount} بار</Text>
                    {mealPlanning.topRecipes?.length > 0 && (
                      <Box>
                        <Text size="xs" fw={500} mb={4}>📅 محبوب‌ترین در برنامه</Text>
                        <Stack gap={4}>{mealPlanning.topRecipes.slice(0,5).map((r, idx) => (
                          <Group key={idx} justify="space-between"><Text size="xs">{r.title}</Text><Badge variant="light" size="xs">{r.count}</Badge></Group>
                        ))}</Stack>
                      </Box>
                    )}
                  </Stack>
                ) : <Text size="xs" c="dimmed">داده‌ای موجود نیست.</Text>}
              </Paper>
            </SimpleGrid>

            {searchQueries.length > 0 && (
              <Paper p="md" radius="lg" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
                <Group gap="xs" mb="sm"><IconSearch size={20} color="#FF6B35" /><Text fw={600} size="sm">پرتکرارترین جستجوها</Text></Group>
                <Group gap="xs">
                  {searchQueries.slice(0,10).map((item, idx) => (
                    <Badge key={idx} variant="light" size="sm" radius="xl">{item.query} ({item.count})</Badge>
                  ))}
                </Group>
              </Paper>
            )}

            {/* تایم‌لاین رویدادها با Pagination واقعی */}
            <Paper p="md" radius="lg" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
              <Text fw={600} size="sm" mb="md">📌 آخرین رویدادها (صفحه {eventsPage})</Text>
              <Stack gap="sm">
                {recentEvents.map((event, index) => {
                  const userName = event.user?.name || event.user?.phone || event.userId?.slice(0, 8);
                  let pageDisplay = event.recipeTitle ? `🍽️ ${event.recipeTitle}` : (event.page || '-');
                  return (
                    <motion.div key={event.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.02 }}>
                      <Group gap="sm" wrap="nowrap" align="flex-start">
                        <Avatar size="sm" radius="xl" color="orange" style={{ flexShrink: 0 }}>
                          <IconActivity size={14} />
                        </Avatar>
                        <Box style={{ flex: 1 }}>
                          <Group gap="xs" mb={2}>
                            <Badge size="xs" variant="light" color="orange">{event.type}</Badge>
                            <Text size="xs" c="dimmed">{new Date(event.timestamp).toLocaleString('fa-IR')}</Text>
                          </Group>
                          <Text size="xs">{userName} در {pageDisplay}</Text>
                        </Box>
                      </Group>
                    </motion.div>
                  );
                })}
              </Stack>
              {totalEvents > EVENTS_PER_PAGE && (
                <Center mt="xl">
                  <Pagination
                    total={Math.ceil(totalEvents / EVENTS_PER_PAGE)}
                    value={eventsPage}
                    onChange={(p) => { setEventsPage(p); fetchAnalytics(p); }}
                    radius="xl"
                    size="md"
                    color="orange"
                  />
                </Center>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* تیکت‌ها */}
        <Tabs.Panel value="tickets" pt="md">
          <Paper p="lg" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
            {tickets.length === 0 ? <Text c="dimmed" ta="center">تیکتی نیست.</Text> :
              tickets.map(ticket => {
                const s = TICKET_STATUS_MAP[ticket.status] || TICKET_STATUS_MAP.open;
                return (
                  <Paper key={ticket.id} p="md" mb="sm" radius="md" style={{ borderRight: `4px solid ${s.color}`, background: 'transparent' }}>
                    <Group justify="space-between"><Badge variant="light" color={s.color}>{s.label}</Badge><Text size="xs" c="dimmed">{new Date(ticket.createdAt).toLocaleDateString('fa-IR')}</Text></Group>
                    <Text fw={600} size="sm">{ticket.subject}</Text>
                    <Text size="xs" c="dimmed">{ticket.message}</Text>
                    {ticket.status !== 'closed' && (
                      <Group gap="sm" mt="sm">
                        <Textarea size="xs" style={{ flex: 1 }} placeholder="پاسخ..." value={replyInputs[ticket.id] || ''} onChange={(e) => setReplyInputs(prev => ({ ...prev, [ticket.id]: e.target.value }))} />
                        <ActionIcon color="blue" variant="filled" onClick={() => handleReply(ticket.id)}><IconSend size={16} /></ActionIcon>
                        <ActionIcon color="red" variant="light" onClick={() => handleTicketStatus(ticket.id, 'closed')}><IconX size={16} /></ActionIcon>
                      </Group>
                    )}
                  </Paper>
                );
              })
            }
          </Paper>
        </Tabs.Panel>

        {/* رسپی‌ها */}
        <Tabs.Panel value="recipes" pt="md">
          <Paper p="lg" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
            {recipes.length === 0 ? <Text c="dimmed" ta="center">رسپی‌ای نیست.</Text> :
              recipes.map(recipe => {
                const s = RECIPE_STATUS_MAP[recipe.status] || RECIPE_STATUS_MAP.pending;
                return (
                  <Paper key={recipe.id} p="md" mb="sm" radius="md" style={{ borderRight: `4px solid ${s.color}`, background: 'transparent' }}>
                    <Group justify="space-between">
                      <div><Text size="sm" fw={600}>{recipe.title}</Text><Badge size="xs" color={s.color}>{s.label}</Badge></div>
                      <Group gap="xs">
                        <ActionIcon variant="light" color="green" onClick={() => handleRecipeAction(recipe.id, 'approve')}><IconCheck size={16} /></ActionIcon>
                        <ActionIcon variant="light" color="red" onClick={() => handleRecipeAction(recipe.id, 'reject')}><IconX size={16} /></ActionIcon>
                      </Group>
                    </Group>
                  </Paper>
                );
              })
            }
          </Paper>
        </Tabs.Panel>

        {/* کاربران */}
        <Tabs.Panel value="users" pt="md">
          <Paper p="lg" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: borderStyle }}>
            <Table striped highlightOnHover>
              <thead><tr><th>نام</th><th>شماره</th><th>تاریخ عضویت</th></tr></thead>
              <tbody>{users.map(user => <tr key={user.id}><td>{user.name || '-'}</td><td>{user.phone}</td><td>{new Date(user.createdAt).toLocaleDateString('fa-IR')}</td></tr>)}</tbody>
            </Table>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <ActionIcon
        variant="filled"
        color="orange"
        size="xl"
        radius="xl"
        style={{ position: 'fixed', bottom: 30, right: 20, zIndex: 50, boxShadow: '0 4px 12px rgba(255,107,53,0.4)' }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}