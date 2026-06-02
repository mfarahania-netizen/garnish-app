import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  AppShell, Container, Group, ActionIcon, Drawer, Stack, NavLink,
  Text, Divider, Box, Image, Avatar,
  useMantineColorScheme, useMantineTheme, Tooltip
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconHome, IconBook, IconCalendar, IconUser, IconLogout,
  IconBell, IconLogin, IconPencil, IconShoppingCart, IconHeadset,
  IconRobot, IconX, IconChevronRight, IconSun, IconMoon,
  IconHeart, IconSettings, IconShield
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../features/notifications/components/NotificationBell';
import NotificationPopover from '../features/notifications/components/NotificationPopover';

export default function MainLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const theme = useMantineTheme();
  const dark = colorScheme === 'dark';

  // ===== ۱. استخراج tab فعال از URL =====
  const getActiveTab = (pathname) => {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/recipes')) return 'recipes';
    if (pathname.startsWith('/plan')) return 'plan';
    if (pathname.startsWith('/profile')) return 'profile';
    if (pathname.startsWith('/favorites')) return 'favorites';
    if (pathname.startsWith('/shopping-list')) return 'shopping';
    if (pathname.startsWith('/ai-chat')) return 'ai';
    if (pathname.startsWith('/support')) return 'support';
    if (pathname.startsWith('/add-recipe')) return 'add-recipe';
    return 'home';
  };
  const activeTab = getActiveTab(location.pathname);

  const handleNavigate = (path, tab) => {
    navigate(path);
    close();
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    close();
  };

  // رنگ‌های داینامیک برای سایدبار و نوارها
  const sidebarBg = dark ? '#1A1B1E' : '#ffffff';
  const sidebarBorder = dark ? '#2C2E33' : '#f0f0f0';
  const sidebarText = dark ? '#C1C2C5' : '#1A237E';
  const overlayColor = dark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.3)';

  const menuGroups = [
    {
      title: 'اصلی',
      items: [
        { icon: <IconHome size={20} />, label: 'خانه', path: '/', tab: 'home' },
        { icon: <IconBook size={20} />, label: 'همه رسپی‌ها', path: '/recipes', tab: 'recipes' },
        { icon: <IconCalendar size={20} />, label: 'برنامه غذایی', path: '/plan', tab: 'plan' },
      ]
    },
    {
      title: 'ابزارها',
      items: [
        { icon: <IconPencil size={20} />, label: 'افزودن رسپی', path: '/add-recipe', tab: 'add-recipe' },
        { icon: <IconShoppingCart size={20} />, label: 'لیست خرید', path: '/shopping-list', tab: 'shopping' },
        { icon: <IconRobot size={20} />, label: 'دستیار هوش مصنوعی', path: '/ai-chat', tab: 'ai' },
      ]
    },
    {
      title: 'بیشتر',
      items: [
        { icon: <IconUser size={20} />, label: 'پروفایل', path: '/profile', tab: 'profile' },
        { icon: <IconHeart size={20} />, label: 'علاقه‌مندی‌ها', path: '/favorites', tab: 'favorites' },
        { icon: <IconHeadset size={20} />, label: 'پشتیبانی', path: '/support', tab: 'support' },
      ]
    }
  ];

  // آیتم‌های نوار پایین
  const bottomTabs = [
    { icon: <IconHome size={24} />, label: 'خانه', tab: 'home', path: '/' },
    { icon: <IconBook size={24} />, label: 'رسپی‌ها', tab: 'recipes', path: '/recipes' },
    { icon: <IconHeart size={24} />, label: 'علاقه‌مندی', tab: 'favorites', path: '/favorites' },
    { icon: <IconCalendar size={24} />, label: 'برنامه', tab: 'plan', path: '/plan' },
    { icon: <IconUser size={24} />, label: 'پروفایل', tab: 'profile', path: '/profile' },
  ];

  return (
    <AppShell header={{ height: 60 }} padding="md">
      {/* ===== هدر ===== */}
      <AppShell.Header>
        <Container size="xs" h="100%" style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            height: '100%', width: '100%'
          }}>
            <ActionIcon variant="subtle" onClick={toggle} size="lg" color={dark ? 'gray.4' : 'dark'}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </ActionIcon>

            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <Image src="/logo-garnish.png" alt="گارنیش" height={34} fit="contain" />
            </div>

            <NotificationPopover>
              <NotificationBell />
            </NotificationPopover>
          </div>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      {/* ===== منوی کشویی (سایدبار) ===== */}
      <AnimatePresence>
        {opened && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: overlayColor, zIndex: 999
              }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              style={{
                position: 'fixed', top: 0, bottom: 0, right: 0,
                width: '75%', maxWidth: 320,
                backgroundColor: sidebarBg,
                boxShadow: dark ? '-8px 0 30px rgba(0,0,0,0.5)' : '-8px 0 30px rgba(0,0,0,0.15)',
                borderRadius: '20px 0 0 20px',
                zIndex: 1000, overflowY: 'auto', direction: 'rtl',
                borderLeft: `1px solid ${sidebarBorder}`
              }}
            >
              <Box pt="xl" px="lg" pb="md" style={{ borderBottom: `1px solid ${sidebarBorder}` }}>
                <Group justify="space-between" align="center">
                  <Image src="/logo-garnish.png" alt="گارنیش" height={44} fit="contain" />
                  <ActionIcon variant="subtle" onClick={close} color={dark ? 'gray.4' : 'gray'}>
                    <IconX size={24} />
                  </ActionIcon>
                </Group>
                {user && (
                  <Group mt="md" gap="sm">
                    <Avatar color="orange" radius="xl" size="sm">{user.name?.charAt(0)}</Avatar>
                    <Text size="sm" fw={500} c={dark ? 'gray.4' : 'dark'}>{user.name}</Text>
                  </Group>
                )}
              </Box>

              <Box p="md">
                {menuGroups.map((group) => (
                  <Box key={group.title} mb="lg">
                    <Text size="xs" c="dimmed" mb="xs" px="sm">{group.title}</Text>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.label}
                        label={item.label}
                        leftSection={item.icon}
                        rightSection={activeTab === item.tab ? <IconChevronRight size={16} color="orange" /> : null}
                        active={activeTab === item.tab}
                        onClick={() => handleNavigate(item.path, item.tab)}
                        variant="light"
                        color="orange"
                        style={{
                          borderRadius: 8, marginBottom: 4,
                          backgroundColor: activeTab === item.tab ? 'rgba(255,107,53,0.08)' : 'transparent',
                        }}
                        styles={{
                          label: { fontSize: 14, fontWeight: 500 },
                          root: { '&:hover': { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' } }
                        }}
                      />
                    ))}
                  </Box>
                ))}

                <Divider my="sm" color={sidebarBorder} />

                <NavLink
                  label={dark ? 'حالت روشن' : 'حالت تاریک'}
                  leftSection={dark ? <IconSun size={20} /> : <IconMoon size={20} />}
                  onClick={toggleColorScheme}
                  variant="subtle"
                  style={{ borderRadius: 8, marginBottom: 8 }}
                  styles={{
                    label: { fontSize: 14 },
                    root: { '&:hover': { backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' } }
                  }}
                />

                <Divider my="sm" color={sidebarBorder} />

                {user ? (
                  <NavLink
                    label="خروج از حساب"
                    leftSection={<IconLogout size={20} color="red" />}
                    onClick={handleLogout}
                    variant="subtle"
                    color="red"
                    style={{ borderRadius: 8 }}
                    styles={{
                      label: { fontSize: 14 },
                      root: { '&:hover': { backgroundColor: dark ? 'rgba(255,0,0,0.1)' : 'rgba(255,0,0,0.05)' } }
                    }}
                  />
                ) : (
                  <NavLink
                    label="ورود / عضویت"
                    leftSection={<IconLogin size={20} />}
                    onClick={() => { navigate('/auth'); close(); }}
                    variant="light"
                    color="orange"
                    style={{ borderRadius: 8 }}
                    styles={{ label: { fontSize: 14 } }}
                  />
                )}
              </Box>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== نوار پایین (BottomNav) ===== */}
      <div className="glass-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 420,
        margin: '0 auto', display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 16px', zIndex: 10,
        backgroundColor: dark ? 'rgba(26,27,30,0.85)' : 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${dark ? '#2C2E33' : '#f0f0f0'}`
      }}>
        {bottomTabs.map(item => (
          <motion.div
            key={item.tab}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
              color: activeTab === item.tab ? '#FF6B35' : (dark ? '#909296' : '#1A237E'),
              transition: 'color 0.2s'
            }}
          >
            {item.icon}
            <Text size="xs" mt={2} fw={activeTab === item.tab ? 700 : 400}>
              {item.label}
            </Text>
          </motion.div>
        ))}
      </div>
    </AppShell>
  );
}