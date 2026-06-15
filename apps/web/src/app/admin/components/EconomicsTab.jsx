// GARNISH-OPS-L4-18 — Economics & cost panel (ACCOUNTING only; cost honest-null until verified rates).
import { useEffect, useState } from 'react';
import { Stack, SimpleGrid, Paper, Text, Group, Badge, Loader, Center } from '@mantine/core';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../../../lib/apiClient';
import { GES, T, gesPanel, axisTick, gridStroke, tooltipStyle } from '../_shared/gesTheme';
import Panel, { SectionHeader } from '../_shared/Panel';
import AwaitingPilot from '../_shared/AwaitingPilot';
import { downloadCsv } from '../_shared/exportCsv';

function Stat({ label, value, suffix = '' }) {
  return (
    <Paper style={{ ...gesPanel(), padding: 'var(--g-space-4)' }}>
      <Text fw={800} size="1.5rem" style={{ color: T.textPrimary }}>{value ?? '—'}{value != null ? suffix : ''}</Text>
      <Text size="xs" style={{ color: T.textMuted }}>{label}</Text>
    </Paper>
  );
}

export default function EconomicsTab() {
  const [d, setD] = useState(undefined);
  useEffect(() => { apiClient.get('/admin/ops/economics').then((r) => setD(r.data)).catch(() => setD(null)); }, []);
  if (d === undefined) return <Center style={{ height: 300 }}><Loader color="orange" /></Center>;
  if (!d) return <Panel title="اقتصاد و هزینه"><AwaitingPilot /></Panel>;

  const usage = d.usage || {};
  const cost = d.cost || {};
  const surfaceBars = Object.entries(usage.tokensBySurface || {}).map(([name, value]) => ({ name, value }));

  return (
    <Stack gap="xl">
      <SectionHeader title="اقتصاد و هزینه" subtitle="حسابداری مصرف توکن و برآورد هزینه (نه صورتحساب)" right={<Badge variant="light" color="gray" radius="xl">حسابداری، نه پرداخت</Badge>} />

      <Panel title="مصرف توکن (۳۰ روز)" onExport={usage.status === 'real' ? () => downloadCsv('garnish-token-usage', surfaceBars) : undefined}>
        {usage.status === 'real' ? (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
              <Stat label="کل توکن" value={usage.totalTokens} />
              <Stat label="کاربران فعال" value={usage.distinctUsers} />
              <Stat label="میانگین توکن/کاربر" value={usage.avgTokensPerUser} />
            </SimpleGrid>
            {surfaceBars.length > 0 && (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={surfaceBars} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="name" tick={axisTick} />
                  <YAxis tick={axisTick} width={56} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="توکن" fill={GES.saffron} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Stack>
        ) : <AwaitingPilot label="مصرف توکن در انتظار تماس‌های واقعی" height={180} />}
      </Panel>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Panel title="هزینهٔ تخمینی">
          {cost.status === 'real' ? (
            <SimpleGrid cols={2} spacing="md">
              <Stat label="کل (USD)" value={cost.totalEstimatedCostUsd} />
              <Stat label="هزینه/کاربر (USD)" value={cost.costPerUserUsd} />
            </SimpleGrid>
          ) : (
            <AwaitingPilot label="هزینه در انتظار نرخ‌های تأییدشده" height={160} note="نرخ‌های USD هر مدل هنوز پیکربندی نشده‌اند — هزینه به‌صورت صادقانه null است، هرگز ساختگی نیست." />
          )}
        </Panel>
        <Panel title="درآمد">
          <Stack align="center" justify="center" gap={6} style={{ height: 160, textAlign: 'center' }}>
            <Badge size="lg" variant="light" color="gray" radius="xl">هنوز نه</Badge>
            <Text size="xs" style={{ color: T.textMuted, maxWidth: 300 }}>درآمدزایی آینده — هیچ منطق پرداخت/صورتحساب هنوز وجود ندارد (خارج از محدوده).</Text>
          </Stack>
        </Panel>
      </SimpleGrid>
    </Stack>
  );
}
