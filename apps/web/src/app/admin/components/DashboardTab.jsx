// apps/web/src/app/admin/components/DashboardTab.jsx
import { useState, useEffect } from 'react';
import {
  SimpleGrid, Paper, Text, Group, ThemeIcon, Stack,
  Badge, useMantineColorScheme, Box
} from '@mantine/core';
import { IconUsers, IconChefHat, IconActivity, IconTicket } from '@tabler/icons-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion } from 'framer-motion';
import apiClient from '../../../lib/apiClient';
import dayjs from 'dayjs';

const COLORS = ['#FF6B35', '#5C6BC0', '#66BB6A', '#FFA726', '#AB47BC', '#26C6DA', '#EF5350', '#EC407A'];

// نگاشت نام رویداد به فارسی روان
const EVENT_LABELS = {
  recipe_view: 'مشاهدهٔ رسپی',
  search_query: 'جستجو',
  login: 'ورود',
  register: 'ثبت‌نام',
  favorite_add: 'افزودن به علاقه‌مندی',
  favorite_remove: 'حذف از علاقه‌مندی',
  mealplan_add: 'افزودن به برنامه',
  mealplan_generate: 'تولید برنامه',
  shopping_item_add: 'افزودن به سبد خرید',
  page_view: 'بازدید صفحه',
  admin_view: 'مشاهدهٔ ادمین',
  recipe_share: 'اشتراک‌گذاری رسپی',
  tips_expand: 'باز کردن نکات',
  tips_collapse: 'بستن نکات',
  tips_read: 'خواندن نکات',
  ai_message_send: 'ارسال پیام به هوش مصنوعی',
  ai_chat_started: 'شروع چت',
};

// تبدیل نام رویداد به فارسی یا حداقل خواناتر
const translateEventType = (type) => {
  if (EVENT_LABELS[type]) return EVENT_LABELS[type];
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export default function DashboardTab() {
  const { colorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  const [stats, setStats] = useState(null);
  const [dailyEvents, setDailyEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, eventsRes] = await Promise.all([
          apiClient.get('/admin/dashboard'),
          apiClient.get('/admin/analytics/stats'),
        ]);
        setStats({ ...statsRes.data, ...eventsRes.data });

        const { data: eventsData } = await apiClient.get('/admin/analytics/events?limit=2000&page=1');
        const allEvents = eventsData.events || eventsData.data || [];

        // پردازش داده‌های روزانه
        const dailyMap = new Map();
        allEvents.forEach(e => {
          const day = dayjs(e.timestamp).format('YYYY-MM-DD');
          dailyMap.set(day, (dailyMap.get(day) || 0) + 1);
        });
        setDailyEvents(
          Array.from(dailyMap, ([date, count]) => ({
            date: dayjs(date).format('MMM DD'),
            count,
          })).sort((a, b) => a.date.localeCompare(b.date))
        );

        // توزیع نوع رویدادها
        const typeMap = new Map();
        allEvents.forEach(e => {
          typeMap.set(e.type, (typeMap.get(e.type) || 0) + 1);
        });
        const sortedTypes = Array.from(typeMap, ([name, value]) => ({
          name: translateEventType(name),
          value,
        }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);
        setEventTypes(sortedTypes);
      } catch (err) {
        console.error('خطا در بارگذاری داشبورد:', err);
      }
    };
    fetchData();
  }, []);

  // استایل کارت شیشه‌ای
  const glassCard = {
    background: dark ? 'rgba(25,25,40,0.7)' : 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(16px)',
    borderRadius: 20,
    padding: 28,
    border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'}`,
    boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.05)',
  };

  const kpiCards = [
    { title: 'کاربران', value: stats?.userCount || 0, icon: IconUsers, color: '#5C6BC0', desc: 'کل کاربران ثبت‌نام‌شده' },
    { title: 'رسپی‌ها', value: stats?.recipeCount || 0, icon: IconChefHat, color: '#66BB6A', desc: 'تعداد رسپی‌های موجود' },
    { title: 'رویدادهای امروز', value: stats?.todayEvents || 0, icon: IconActivity, color: '#FF6B35', desc: 'رویدادهای ثبت‌شده امروز' },
    { title: 'تیکت‌ها', value: stats?.ticketCount || 0, icon: IconTicket, color: '#AB47BC', desc: 'تیکت‌های پشتیبانی باز' },
  ];

  return (
    <Stack gap="xl">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text fw={800} size="1.8rem" c={dark ? 'white' : '#1A237E'}>داشبورد مدیریت</Text>
          <Text size="sm" c="dimmed">خلاصهٔ اطلاعات کلیدی سامانه</Text>
        </div>
        <Badge variant="light" color="orange" size="lg" radius="xl">
          📅 {dayjs().format('DD MMMM YYYY')}
        </Badge>
      </Group>

      {/* کارت‌های KPI با توضیح */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        {kpiCards.map((card, idx) => (
          <motion.div key={idx} whileHover={{ y: -4 }}>
            <Paper style={glassCard}>
              <Group justify="space-between" mb="sm">
                <ThemeIcon size={46} radius="xl" style={{ background: card.color + '18', color: card.color }}>
                  <card.icon size={24} />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="2rem" c={dark ? 'white' : '#1A237E'}>{card.value}</Text>
              <Text size="xs" c="dimmed">{card.desc}</Text>
            </Paper>
          </motion.div>
        ))}
      </SimpleGrid>

      {/* نمودارها به صورت عمودی، هر کدام توضیح کامل */}
      <Paper style={glassCard}>
        <Text fw={600} size="sm" mb={4} c={dark ? '#ddd' : '#333'}>
          📈 روند رویدادهای روزانه
        </Text>
        <Text size="xs" c="dimmed" mb="lg">
          تعداد رویدادهای ثبت‌شده در ۷ روز گذشته (هر ستون یک روز)
        </Text>
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={dailyEvents} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#444' : '#e0e0e0'} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: dark ? '#aaa' : '#555' }} dy={8} />
            <YAxis tick={{ fontSize: 12, fill: dark ? '#aaa' : '#555' }} width={50} />
            <Tooltip
              contentStyle={{
                background: dark ? '#1e1e2f' : '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
              }}
              labelFormatter={(label) => `تاریخ: ${label}`}
              formatter={(value) => [`${value} رویداد`]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#FF6B35"
              strokeWidth={2}
              fill="url(#grad)"
              dot={{ r: 3, strokeWidth: 1, fill: '#fff', stroke: '#FF6B35' }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Paper>

      <Paper style={glassCard}>
        <Text fw={600} size="sm" mb={4} c={dark ? '#ddd' : '#333'}>
          🎯 توزیع رویدادها بر اساس نوع
        </Text>
        <Text size="xs" c="dimmed" mb="lg">
          سهم هر دسته از کل رویدادهای ثبت‌شده (۸ مورد برتر)
        </Text>
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={eventTypes}
              cx="40%"
              cy="50%"
              innerRadius={70}
              outerRadius={120}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
            >
              {eventTypes.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: dark ? '#1e1e2f' : '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 13,
              }}
              formatter={(value, name) => [`${value} رویداد`, name]}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconType="circle"
              iconSize={10}
              wrapperStyle={{
                fontSize: 13,
                lineHeight: '28px',
                color: dark ? '#ccc' : '#444',
                paddingLeft: 10,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Paper>
    </Stack>
  );
}