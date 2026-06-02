import { useState, useEffect } from 'react';
import {
  Container, Title, Group, Text, Paper, SimpleGrid, Stack, Badge,
  Textarea, Button, ActionIcon, Tooltip, Tabs, Table,
  useMantineColorScheme, Loader, Center, Box, ThemeIcon,
  Accordion, Avatar, RingProgress
} from '@mantine/core';
import {
  IconUsers, IconTicket, IconChefHat, IconCheck, IconX,
  IconSend, IconEye, IconRefresh, IconAlertCircle,
  IconCircleCheck, IconArrowUp, IconChartBar, IconActivity,
  IconTrendingUp, IconSearch, IconRobot, IconCalendar,
  IconLock, IconBulb, IconToolsKitchen, IconMessageCircle,
  IconHeart, IconShoppingCart, IconBell
} from '@tabler/icons-react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useAnalytics } from '../../hooks/useAnalytics'; // 👈 جدید
import { motion } from 'framer-motion';

const TICKET_STATUS_MAP = {
  open: { label: 'باز', color: 'orange', icon: <IconAlertCircle size={14} /> },
  'in-progress': { label: 'در حال بررسی', color: 'blue', icon: <IconEye size={14} /> },
  closed: { label: 'بسته', color: 'gray', icon: <IconCircleCheck size={14} /> },
};

const RECIPE_STATUS_MAP = {
  pending: { label: 'در انتظار', color: 'yellow' },
  approved: { label: 'تأیید شده', color: 'green' },
  rejected: { label: 'رد شده', color: 'red' },
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const { trackEvent } = useAnalytics(); // 👈 جدید
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

  const headers = { Authorization: `Bearer ${token}` };

  // چک ادمین
  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:3000/users/me', { headers })
      .then(res => {
        const admin = res.data.isAdmin === true;
        setIsAdmin(admin);
        if (admin) trackEvent('admin_view'); // 👈 ردیابی ورود موفق ادمین
      })
      .catch(() => setIsAdmin(false));
  }, [token]);

  const fetchAll = async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      const [statsRes, ticketsRes, recipesRes, usersRes] = await Promise.all([
        axios.get('http://localhost:3000/admin/dashboard', { headers }),
        axios.get('http://localhost:3000/admin/tickets', { headers }),
        axios.get('http://localhost:3000/admin/recipes', { headers }),
        axios.get('http://localhost:3000/admin/users', { headers }),
      ]);
      setStats(statsRes.data);
      setTickets(ticketsRes.data);
      setRecipes(recipesRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('خطا در بارگذاری پنل:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    if (!token || !isAdmin) return;
    try {
      const [statsRes, eventsRes, searchRes, mealPlanRes, aiRes] = await Promise.all([
        axios.get('http://localhost:3000/admin/analytics/stats', { headers }),
        axios.get('http://localhost:3000/admin/analytics/events?limit=100', { headers }),
        axios.get('http://localhost:3000/admin/analytics/search-queries', { headers }),
        axios.get('http://localhost:3000/admin/analytics/meal-planning', { headers }),
        axios.get('http://localhost:3000/admin/analytics/ai-interaction', { headers }),
      ]);
      setAnalyticsStats(statsRes.data);
      setRecentEvents(eventsRes.data);
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
      fetchAnalytics();
    }
  }, [isAdmin, token]);

  // 👇 ردیابی تغییر تب
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    trackEvent('admin_tab_change', { tab });
  };

  // 👇 ردیابی پاسخ به تیکت
  const handleReply = async (ticketId) => {
    const message = replyInputs[ticketId] || '';
    if (!message.trim()) return;
    await axios.post(`http://localhost:3000/admin/tickets/${ticketId}/respond`, { message }, { headers });
    trackEvent('admin_ticket_reply', { ticketId }); // 👈 ردیابی
    setReplyInputs(prev => ({ ...prev, [ticketId]: '' }));
    fetchAll();
  };

  const handleTicketStatus = async (ticketId, status) => {
    await axios.patch(`http://localhost:3000/admin/tickets/${ticketId}/status`, { status }, { headers });
    trackEvent('admin_ticket_status', { ticketId, status }); // 👈 ردیابی
    fetchAll();
  };

  // 👇 ردیابی تأیید/رد رسپی
  const handleRecipeAction = async (recipeId, action) => {
    const endpoint = action === 'approve' ? 'approve' : 'reject';
    await axios.patch(`http://localhost:3000/admin/recipes/${recipeId}/${endpoint}`, {}, { headers });
    trackEvent(action === 'approve' ? 'admin_recipe_approve' : 'admin_recipe_reject', { recipeId }); // 👈 ردیابی
    fetchAll();
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const cardBg = dark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.8)';

  // ==== حالت‌های عدم دسترسی ====
  if (!token) {
    return (
      <Center style={{ height: '60vh' }}>
        <Stack align="center" gap="md">
          <IconLock size={48} color="red" />
          <Text fw={700} size="lg" c="red">دسترسی غیرمجاز</Text>
          <Text size="sm" c="dimmed">برای مشاهده این صفحه باید وارد حساب کاربری خود شوید.</Text>
          <Button variant="light" color="gray" onClick={() => window.location.href = '/auth'}>
            ورود به حساب
          </Button>
        </Stack>
      </Center>
    );
  }

  if (isAdmin === null) {
    return (
      <Center style={{ height: '60vh' }}>
        <Loader size="lg" color="orange" />
      </Center>
    );
  }

  if (isAdmin === false) {
    return (
      <Center style={{ height: '60vh' }}>
        <Stack align="center" gap="md">
          <IconLock size={48} color="red" />
          <Text fw={700} size="lg" c="red">دسترسی غیرمجاز</Text>
          <Text size="sm" c="dimmed">شما اجازهٔ دسترسی به پنل مدیریت را ندارید.</Text>
          <Button variant="light" color="gray" onClick={() => window.location.href = '/'}>
            بازگشت به خانه
          </Button>
        </Stack>
      </Center>
    );
  }

  if (loading) {
    return (
      <Center style={{ height: '60vh' }}>
        <Loader size="lg" color="orange" />
      </Center>
    );
  }

  // ========== پنل اصلی ==========
  return (
    <Container size="lg" py="md" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 80 }}>
      <Group justify="space-between" mb="lg">
        <Group gap="xs">
          <ThemeIcon size={36} radius="md" color="orange" variant="light">
            <IconChefHat size={22} />
          </ThemeIcon>
          <Title order={2} style={{ color: dark ? '#fff' : '#1A237E' }}>پنل مدیریت</Title>
        </Group>
        <ActionIcon variant="light" color="orange" size="lg" radius="xl" onClick={fetchAll} title="بروزرسانی">
          <IconRefresh size={22} />
        </ActionIcon>
      </Group>

      {/* کارت‌های آماری */}
      <SimpleGrid cols={3} spacing="md" mb="xl">
        {[
          { label: 'رسپی‌ها', value: stats.recipeCount, icon: IconChefHat, color: 'orange' },
          { label: 'کاربران', value: stats.userCount, icon: IconUsers, color: 'blue' },
          { label: 'تیکت‌ها', value: stats.ticketCount, icon: IconTicket, color: 'green' },
        ].map((item, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Paper p="lg" radius="xl" style={{
              background: dark
                ? 'linear-gradient(135deg, #1A237E, #283593)'
                : 'linear-gradient(135deg, #FF6B35, #FF8A65)',
              color: 'white',
              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
              <Stack align="center" gap="xs" style={{ position: 'relative', zIndex: 1 }}>
                <item.icon size={36} color="white" />
                <Text fw={700} size="xl">{item.value}</Text>
                <Text size="xs" opacity={0.8}>{item.label}</Text>
              </Stack>
            </Paper>
          </motion.div>
        ))}
      </SimpleGrid>

      <Tabs value={activeTab} onChange={handleTabChange}> {/* 👈 تغییر یافت */}
        <Tabs.List mb="md">
          <Tabs.Tab value="behavior" leftSection={<IconChartBar size={18} />}>رفتار کاربران</Tabs.Tab>
          <Tabs.Tab value="tickets" leftSection={<IconTicket size={18} />}>تیکت‌ها</Tabs.Tab>
          <Tabs.Tab value="recipes" leftSection={<IconChefHat size={18} />}>رسپی‌ها</Tabs.Tab>
          <Tabs.Tab value="users" leftSection={<IconUsers size={18} />}>کاربران</Tabs.Tab>
        </Tabs.List>

        {/* ==================== تب رفتار کاربران ==================== */}
        <Tabs.Panel value="behavior">
          <Stack gap="md">
            {analyticsStats && (
              <SimpleGrid cols={2} spacing="md">
                <Paper p="md" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: '1px solid #FF6B35' }}>
                  <Group gap="xs" mb={4}><IconActivity size={20} color="#FF6B35" /><Text size="sm" c="dimmed">کل رویدادها</Text></Group>
                  <Text fw={700} size="xl" c="#1A237E">{analyticsStats.totalEvents}</Text>
                </Paper>
                <Paper p="md" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: '1px solid #4CAF50' }}>
                  <Group gap="xs" mb={4}><IconTrendingUp size={20} color="#4CAF50" /><Text size="sm" c="dimmed">امروز</Text></Group>
                  <Text fw={700} size="xl" c="#1A237E">{analyticsStats.todayEvents}</Text>
                </Paper>
              </SimpleGrid>
            )}

            <SimpleGrid cols={2} spacing="md">
              {/* تحلیل AI */}
              <Paper p="md" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: '1px solid #FF6B35' }}>
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
                    {aiInteraction.topRecipes?.length > 0 && (
                      <Box>
                        <Text size="xs" fw={500} mb={4}>🍲 غذاهای پرتکرار</Text>
                        <Group gap="xs">{aiInteraction.topRecipes.slice(0,5).map((item, idx) => <Badge key={idx} variant="filled" color="teal" size="xs" radius="xl">{item.name} ({item.count})</Badge>)}</Group>
                      </Box>
                    )}
                  </Stack>
                ) : <Text size="xs" c="dimmed">داده‌ای موجود نیست.</Text>}
              </Paper>

              {/* برنامه‌ریزی غذایی */}
              <Paper p="md" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: '1px solid #4CAF50' }}>
                <Group gap="xs" mb="sm"><IconCalendar size={20} color="#4CAF50" /><Text fw={600} size="sm">برنامه‌ریزی غذایی</Text></Group>
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

            {/* جستجوها */}
            {searchQueries.length > 0 && (
              <Paper p="md" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: '1px solid #FF6B35' }}>
                <Group gap="xs" mb="sm"><IconSearch size={20} color="#FF6B35" /><Text fw={600} size="sm">پرتکرارترین جستجوها</Text></Group>
                <Group gap="xs">
                  {searchQueries.slice(0,10).map((item, idx) => (
                    <Badge key={idx} variant="light" size="sm" radius="xl">{item.query} ({item.count})</Badge>
                  ))}
                </Group>
              </Paper>
            )}

            {/* تایم‌لاین رویدادها */}
            <Paper p="md" radius="xl" style={{ background: cardBg, backdropFilter: 'blur(8px)', border: '1px solid #FF6B35' }}>
              <Text fw={600} size="sm" mb="md">📌 آخرین رویدادها</Text>
              <Stack gap="sm">
                {recentEvents.slice(0, 10).map((event, index) => {
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
            </Paper>
          </Stack>
        </Tabs.Panel>

        {/* === سایر تب‌ها === */}
        <Tabs.Panel value="tickets">
          <Paper p="lg" radius="xl" withBorder style={{ backgroundColor: cardBg }}>
            {tickets.length === 0 ? <Text c="dimmed" ta="center">تیکتی نیست.</Text> :
              tickets.map(ticket => {
                const s = TICKET_STATUS_MAP[ticket.status] || TICKET_STATUS_MAP.open;
                return (
                  <Paper key={ticket.id} p="md" mb="sm" radius="md" style={{ borderRight: `4px solid ${s.color}` }}>
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

        <Tabs.Panel value="recipes">
          <Paper p="lg" radius="xl" withBorder style={{ backgroundColor: cardBg }}>
            {recipes.length === 0 ? <Text c="dimmed" ta="center">رسپی‌ای نیست.</Text> :
              recipes.map(recipe => {
                const s = RECIPE_STATUS_MAP[recipe.status] || RECIPE_STATUS_MAP.pending;
                return (
                  <Paper key={recipe.id} p="md" mb="sm" radius="md" style={{ borderRight: `4px solid ${s.color}` }}>
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

        <Tabs.Panel value="users">
          <Paper p="lg" radius="xl" withBorder style={{ backgroundColor: cardBg }}>
            <Table striped>
              <thead><tr><th>نام</th><th>شماره</th><th>تاریخ عضویت</th></tr></thead>
              <tbody>{users.map(user => <tr key={user.id}><td>{user.name || '-'}</td><td>{user.phone}</td><td>{new Date(user.createdAt).toLocaleDateString('fa-IR')}</td></tr>)}</tbody>
            </Table>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <ActionIcon
        variant="light" color="orange" size="xl" radius="xl"
        style={{ position: 'fixed', bottom: 80, right: 16, zIndex: 50, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
        onClick={scrollToTop}
      >
        <IconArrowUp size={18} />
      </ActionIcon>
    </Container>
  );
}