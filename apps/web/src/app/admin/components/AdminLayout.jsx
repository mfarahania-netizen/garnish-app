// apps/web/src/app/admin/components/AdminLayout.jsx
import { useState } from 'react';
import {
  Box, Flex, Stack, ThemeIcon, UnstyledButton,
  Text, Avatar, Menu, Divider, ActionIcon,
  useMantineColorScheme, Container
} from '@mantine/core';
import {
  IconLayoutDashboard, IconUsers, IconChefHat, IconSearch,
  IconCalendar, IconShoppingCart, IconRobot, IconActivity,
  IconTicket, IconBrain, IconChartBar, IconSettings,
  IconLogout, IconSparkles, IconChevronLeft, IconChevronRight, IconReportAnalytics
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../../context/AuthContext'; // مسیر اصلاح شد

const TABS = [
  { value: 'dashboard', label: 'داشبورد', icon: IconLayoutDashboard, color: '#FF6B35' },
  { value: 'users', label: 'کاربران', icon: IconUsers, color: '#5C6BC0' },
  { value: 'recipes', label: 'رسپی‌ها', icon: IconChefHat, color: '#66BB6A' },
  { value: 'search', label: 'جستجوها', icon: IconSearch, color: '#FFA726' },
  { value: 'mealplan', label: 'برنامه غذایی', icon: IconCalendar, color: '#42A5F5' },
  { value: 'shopping', label: 'سبد خرید', icon: IconShoppingCart, color: '#AB47BC' },
  { value: 'ai', label: 'دستیار هوش مصنوعی', icon: IconRobot, color: '#26C6DA' },
  { value: 'events', label: 'رویدادها', icon: IconActivity, color: '#EF5350' },
  { value: 'tickets', label: 'تیکت‌ها', icon: IconTicket, color: '#EC407A' },
  { value: 'behavior', label: 'پروفایل رفتاری', icon: IconBrain, color: '#7E57C2' },
  { value: 'pages', label: 'تحلیل صفحات', icon: IconChartBar, color: '#8D6E63' },
  { value: 'health', label: 'سلامت سیستم', icon: IconSettings, color: '#78909C' },
  { value: 'intelligence', label: 'هوش محصول', icon: IconReportAnalytics, color: '#26A69A' },
];

export default function AdminLayout({ children, activeTab, onTabChange }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';

  const sidebarBg = dark ? 'rgba(20,20,35,0.85)' : 'rgba(255,255,255,0.85)';
  const textColor = dark ? '#ccc' : '#555';
  const activeBg = dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,107,53,0.1)';

  return (
    <Flex direction="row" style={{ height: '100vh' }}>
      {/* سایدبار */}
      <Box
        style={{
          width: collapsed ? 80 : 260,
          background: sidebarBg,
          backdropFilter: 'blur(20px)',
          borderRight: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
          boxShadow: dark ? '0 0 30px rgba(0,0,0,0.5)' : '0 0 30px rgba(0,0,0,0.05)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s',
          overflow: 'hidden',
        }}
      >
        <Flex justify="space-between" align="center" mb="xl">
          {!collapsed && (
            <Flex gap="xs" align="center">
              <ThemeIcon variant="gradient" gradient={{ from: '#FF6B35', to: '#D84315' }} size={36} radius="md">
                <IconSparkles size={20} />
              </ThemeIcon>
              <Text fw={800} size="lg" c={dark ? 'white' : '#1A237E'}>گارنیش</Text>
            </Flex>
          )}
          <ActionIcon variant="subtle" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
          </ActionIcon>
        </Flex>

        <Stack gap="xs" style={{ flex: 1 }}>
          {TABS.map(tab => (
            <UnstyledButton
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 12,
                background: activeTab === tab.value ? activeBg : 'transparent',
                color: activeTab === tab.value ? tab.color : textColor,
                fontWeight: activeTab === tab.value ? 700 : 500,
                transition: 'all 0.2s',
              }}
            >
              <tab.icon size={22} />
              {!collapsed && <Text size="sm">{tab.label}</Text>}
            </UnstyledButton>
          ))}
        </Stack>

        <Divider my="sm" />
        <Menu shadow="md" position="right-end">
          <Menu.Target>
            <UnstyledButton>
              <Flex align="center" gap="sm">
                <Avatar color="orange" radius="xl" size={32}>{user?.name?.[0] || 'A'}</Avatar>
                {!collapsed && <Text size="sm">{user?.name || 'ادمین'}</Text>}
              </Flex>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconLogout size={16} />} onClick={logout} color="red">خروج</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Box>

      {/* محتوای اصلی */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        <Container size="xl" py="lg" style={{ maxWidth: 1400 }}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </Container>
      </Box>
    </Flex>
  );
}
