// GARNISH-OPS-L4-18 — Safety & Compliance evidence panel (real S12/S6/S11 data, AI-Act/investor readable).
import { useEffect, useState } from 'react';
import { Stack, SimpleGrid, Paper, Text, Group, Badge, Loader, Center, Table } from '@mantine/core';
import { IconShieldCheck, IconAlertTriangle, IconBellOff } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiClient from '../../../lib/apiClient';
import { GES, T, gesPanel, axisTick, gridStroke, tooltipStyle } from '../_shared/gesTheme';
import Panel, { SectionHeader } from '../_shared/Panel';
import AwaitingPilot from '../_shared/AwaitingPilot';
import { downloadCsv } from '../_shared/exportCsv';

export default function SafetyComplianceTab() {
  const [d, setD] = useState(undefined);
  useEffect(() => { apiClient.get('/admin/ops/safety-compliance').then((r) => setD(r.data)).catch(() => setD(null)); }, []);
  if (d === undefined) return <Center style={{ height: 300 }}><Loader color="orange" /></Center>;
  if (!d) return <Panel title="ایمنی و انطباق"><AwaitingPilot /></Panel>;

  const gc = d.guardCorpus || {};
  const guardBars = Object.entries(gc.byGuard || {}).map(([name, value]) => ({ name, value }));
  const allergy = d.allergySafety;
  const consent = d.consentPosture || {};

  const exportRows = () => downloadCsv('garnish-guard-fires', Object.entries(gc.byReason || {}).map(([reason, count]) => ({ reason, count })));

  return (
    <Stack gap="xl">
      <SectionHeader title="ایمنی و انطباق" subtitle="شواهد عملکرد واقعی گاردهای ایمنی — برای بازبینی انطباق/سرمایه‌گذار" />

      {/* Allergy hard-filter + notification dry-run — headline compliance indicators */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <Paper style={gesPanel()}>
          <Group gap="sm" mb="xs">
            {allergy?.pass ? <IconShieldCheck size={28} color={GES.success} /> : <IconAlertTriangle size={28} color={GES.danger} />}
            <Text fw={800} size="1.2rem" style={{ color: allergy?.pass ? GES.success : GES.danger }}>
              {allergy?.pass ? 'فیلتر سخت آلرژی: سالم' : `نشتی: ${allergy?.leaks ?? '—'}`}
            </Text>
          </Group>
          <Text size="xs" style={{ color: T.textMuted }}>
            {allergy ? `صفر نشتی آلرژن در ${allergy.fixturesChecked} پروفایل آزمایشی (گارد سخت S11)` : 'در دسترس نیست'}
          </Text>
        </Paper>
        <Paper style={gesPanel()}>
          <Group gap="sm" mb="xs">
            <IconBellOff size={28} color={GES.info} />
            <Text fw={800} size="1.2rem" style={{ color: T.textPrimary }}>{d.notificationDelivery?.realSendEnabled ? 'ارسال واقعی فعال' : 'حالت آزمایشی (Dry-run)'}</Text>
          </Group>
          <Text size="xs" style={{ color: T.textMuted }}>هیچ ارسال واقعی push/email — فلگ {d.notificationDelivery?.realSendFlag} خاموش</Text>
        </Paper>
      </SimpleGrid>

      {/* REAL guard-fire counts over the fixture corpus */}
      <Panel
        title="شلیک گاردهای ایمنی (روی مجموعهٔ آزمونِ واقعی)"
        subtitle={`${gc.casesEvaluated ?? 0} مورد ارزیابی شد · ${gc.blockedCases ?? 0} مسدود — شمارش از اجرای واقعی گاردها`}
        onExport={exportRows}
      >
        {guardBars.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={guardBars} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" tick={axisTick} />
              <YAxis tick={axisTick} width={40} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" name="شلیک" fill={GES.saffron} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <AwaitingPilot height={200} />}
      </Panel>

      {/* Consent posture (counts, no PII) */}
      <Panel title="وضعیت رضایت کاربران (تجمیعی، بدون داده شخصی)">
        {consent.status === 'real' ? (
          <Table withTableBorder>
            <Table.Thead><Table.Tr><Table.Th style={{ color: T.textSecondary }}>هدف</Table.Th><Table.Th style={{ color: T.textSecondary }}>اعطا شده</Table.Th><Table.Th style={{ color: T.textSecondary }}>پس‌گرفته</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {Object.entries(consent.byPurpose).map(([p, v]) => (
                <Table.Tr key={p}><Table.Td style={{ color: T.textPrimary }}>{p}</Table.Td><Table.Td><Badge color="green" variant="light" radius="sm">{v.granted}</Badge></Table.Td><Table.Td><Badge color="gray" variant="light" radius="sm">{v.withdrawn}</Badge></Table.Td></Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : <AwaitingPilot label="وضعیت رضایت در انتظار کاربران واقعی" height={160} />}
      </Panel>
    </Stack>
  );
}
