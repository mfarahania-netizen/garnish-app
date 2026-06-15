// GARNISH-DASHBOARD-L4-17 — Overview: headline KPIs + key trends (real S12 data, honest awaiting).
import { useEffect, useState } from 'react';
import { SimpleGrid, Paper, Text, Group, ThemeIcon, Stack, Badge, Loader, Center } from '@mantine/core';
import { IconUsers, IconChefHat, IconActivity, IconTicket } from '@tabler/icons-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import apiClient from '../../../lib/apiClient';
import dayjs from 'dayjs';
import { GES, GES_SERIES, T, gesPanel, axisTick, gridStroke, tooltipStyle } from '../_shared/gesTheme';
import Panel, { SectionHeader } from '../_shared/Panel';
import AwaitingPilot from '../_shared/AwaitingPilot';
import { downloadCsv } from '../_shared/exportCsv';

const TREND_LABELS = { cook_complete: 'پخت', search_query: 'جستجو', mealplan_add: 'برنامه', favorite_add: 'ذخیره', ai_message_send: 'هوش مصنوعی' };

function mergeSeries(series) {
  const buckets = new Set();
  Object.values(series || {}).forEach((arr) => (arr || []).forEach((p) => buckets.add(p.bucketStart)));
  return [...buckets].sort().map((b) => {
    const row = { date: dayjs(b).format('MMM DD') };
    for (const [type, arr] of Object.entries(series || {})) row[type] = (arr || []).find((p) => p.bucketStart === b)?.count || 0;
    return row;
  });
}

export default function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [dash, tr] = await Promise.all([
          apiClient.get('/admin/dashboard').catch(() => ({ data: {} })),
          apiClient.get('/admin/analytics/trends?bucket=day&days=30').catch(() => ({ data: null })),
        ]);
        setStats(dash.data || {});
        setTrends(tr.data);
      } catch { setStats({}); }
    })();
  }, []);

  if (stats === null) return <Center style={{ height: 300 }}><Loader color="orange" /></Center>;

  const kpis = [
    { title: 'کاربران', value: stats.userCount ?? 0, icon: IconUsers, color: GES.info },
    { title: 'رسپی‌ها', value: stats.recipeCount ?? 0, icon: IconChefHat, color: GES.success },
    { title: 'رویدادهای امروز', value: stats.todayEvents ?? 0, icon: IconActivity, color: GES.saffron },
    { title: 'تیکت‌ها', value: stats.ticketCount ?? 0, icon: IconTicket, color: GES.warning },
  ];

  const rows = mergeSeries(trends?.series);
  const types = trends?.types || [];
  const awaiting = !trends || trends.status === 'awaiting_pilot' || rows.length === 0;

  return (
    <Stack gap="xl">
      <SectionHeader title="نمای کلی" subtitle="شاخص‌های کلیدی و روند فعالیت" right={<Badge variant="light" color="orange" size="lg" radius="xl">{dayjs().format('DD MMMM YYYY')}</Badge>} />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        {kpis.map((k, i) => (
          <Paper key={i} style={gesPanel()}>
            <ThemeIcon size={46} radius="xl" style={{ background: k.color + '18', color: k.color }} mb="sm"><k.icon size={24} /></ThemeIcon>
            <Text fw={800} size="2rem" style={{ color: T.textPrimary }}>{k.value}</Text>
            <Text size="xs" style={{ color: T.textMuted }}>{k.title}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      <Panel
        title="📈 روند رویدادهای کلیدی (۳۰ روز)"
        subtitle="پخت · جستجو · برنامه · ذخیره · هوش مصنوعی"
        onExport={awaiting ? undefined : () => downloadCsv('garnish-trends', rows)}
      >
        {awaiting ? (
          <AwaitingPilot label="روند فعالیت در انتظار داده است" note="با ثبت رویدادهای واقعی کاربران، این نمودار پر می‌شود." />
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={rows} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" tick={axisTick} dy={8} />
              <YAxis tick={axisTick} width={48} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13, fontFamily: 'var(--g-font-fa)' }} />
              {types.map((t, i) => (
                <Line key={t} type="monotone" dataKey={t} name={TREND_LABELS[t] || t} stroke={GES_SERIES[i % GES_SERIES.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Panel>
    </Stack>
  );
}
