import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
  AppShell, Container, Group, ActionIcon, NavLink,
  Text, Divider, Box, Image, Avatar,
  useMantineColorScheme
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconHome, IconBook, IconCalendar, IconUser, IconLogout,
  IconLogin, IconPencil, IconShoppingCart, IconHeadset,
  IconRobot, IconX, IconChevronRight, IconSun, IconMoon,
  IconHeart
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { gentleFade, pressResponse, duration, ease } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../features/notifications/components/NotificationBell';
import NotificationPopover from '../features/notifications/components/NotificationPopover';

export default function MainLayout() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
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

  const handleNavigate = (path) => {
    navigate(path);
    close();
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    close();
  };

  // GES tokens — dark handled by [data-theme="dark"] in tokens.css (no JS color conditionals).
  const sidebarBg = 'var(--g-color-bg-surface)';
  const sidebarBorder = 'var(--g-color-border-subtle)';
  const overlayColor = 'var(--g-scrim-photo)'; // proposal: a flat scrim token would suit full overlays better

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
              variants={gentleFade}
              initial="initial"
              animate="animate"
              exit="exit"
              onClick={close}
              style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: overlayColor, zIndex: 'var(--g-z-overlay)'
              }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: duration.slow, ease: ease.enter }}
              style={{
                position: 'fixed', top: 0, bottom: 0, right: 0,
                width: '75%', maxWidth: 320,
                backgroundColor: sidebarBg,
                boxShadow: 'var(--g-shadow-3)',
                borderRadius: 'var(--g-radius-sheet) 0 0 var(--g-radius-sheet)',
                zIndex: 'var(--g-z-sheet)', overflowY: 'auto', direction: 'rtl',
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
                    <Avatar color="saffron" radius="xl" size="sm">{user.name?.charAt(0)}</Avatar>
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
                        rightSection={activeTab === item.tab ? <IconChevronRight size={16} color="saffron" /> : null}
                        active={activeTab === item.tab}
                        onClick={() => handleNavigate(item.path, item.tab)}
                        variant="light"
                        color="saffron"
                        style={{ borderRadius: 'var(--g-radius-input)', marginBottom: 'var(--g-space-1)' }}
                        styles={{ label: { fontSize: 'var(--g-font-size-14)', fontWeight: 500 } }}
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
                  style={{ borderRadius: 'var(--g-radius-input)', marginBottom: 'var(--g-space-2)' }}
                  styles={{ label: { fontSize: 'var(--g-font-size-14)' } }}
                />

                <Divider my="sm" color={sidebarBorder} />

                {user ? (
                  <NavLink
                    label="خروج از حساب"
                    leftSection={<IconLogout size={20} color="red" />}
                    onClick={handleLogout}
                    variant="subtle"
                    color="red"
                    style={{ borderRadius: 'var(--g-radius-input)' }}
                    styles={{ label: { fontSize: 'var(--g-font-size-14)' } }}
                  />
                ) : (
                  <NavLink
                    label="ورود / عضویت"
                    leftSection={<IconLogin size={20} />}
                    onClick={() => { navigate('/auth'); close(); }}
                    variant="light"
                    color="saffron"
                    style={{ borderRadius: 'var(--g-radius-input)' }}
                    styles={{ label: { fontSize: 'var(--g-font-size-14)' } }}
                  />
                )}
              </Box>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ===== نوار پایین (BottomNav) ===== */}
      <div className="glass-nav g-safe-bottom" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 420,
        margin: '0 auto', display: 'flex', justifyContent: 'space-around',
        paddingTop: 'var(--g-space-2)', zIndex: 'var(--g-z-shelf)',
        backgroundColor: 'var(--g-color-bg-surface)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid var(--g-color-border-subtle)'
      }}>
        {bottomTabs.map(item => (
          <motion.div
            key={item.tab}
            {...pressResponse}
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer',
              color: activeTab === item.tab ? 'var(--g-color-brand-600)' : 'var(--g-color-text-muted)',
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
