// GARNISH-DASHBOARD-L4-17 — Cohort & retention (real S12 /admin/analytics/cohorts; honest awaiting pre-pilot).
import { useEffect, useState } from 'react';
import { Stack, Table, Text, Loader, Center, Badge, Group } from '@mantine/core';
import apiClient from '../../../lib/apiClient';
import { GES, T } from '../_shared/gesTheme';
import Panel, { SectionHeader } from '../_shared/Panel';
import AwaitingPilot from '../_shared/AwaitingPilot';
import { downloadCsv } from '../_shared/exportCsv';

// retention cell tint: higher retention → warmer saffron (calm, single-hue, no rainbow)
function cellBg(v) {
  if (v == null) return 'transparent';
  const a = Math.min(0.85, 0.12 + v * 0.7);
  return `rgba(234,108,10,${a.toFixed(2)})`;
}

export default function CohortTab() {
  const [data, setData] = useState(undefined);
  useEffect(() => { apiClient.get('/admin/analytics/cohorts').then((r) => setData(r.data)).catch(() => setData(null)); }, []);
  if (data === undefined) return <Center style={{ height: 300 }}><Loader color="orange" /></Center>;

  const periods = data?.periods || [1, 2, 4];
  const cohorts = data?.cohorts || [];
  const awaiting = !data || data.status === 'awaiting_pilot' || cohorts.length === 0;

  const exportRows = cohorts.map((c) => ({ cohortWeek: c.cohortWeek, size: c.size, ...Object.fromEntries(periods.map((p) => [`W${p}`, c.retention?.[`W${p}`] ?? ''])) }));

  return (
    <Stack gap="xl">
      <SectionHeader title="کوهورت و بازگشت کاربران" subtitle="نرخ بازگشت هفتگی بر اساس هفتهٔ ثبت‌نام" />
      <Panel title="ماتریس بازگشت (Retention)" onExport={awaiting ? undefined : () => downloadCsv('garnish-cohorts', exportRows)}>
        {awaiting ? (
          <AwaitingPilot label="کوهورت‌ها در انتظار کاربران واقعی" note="ریاضیات بازگشت آماده است و با اولین ثبت‌نام‌ها و فعالیت واقعی در پایلوت (Track 7) پر می‌شود." />
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ color: T.textSecondary }}>هفتهٔ کوهورت</Table.Th>
                <Table.Th style={{ color: T.textSecondary }}>اندازه</Table.Th>
                {periods.map((p) => <Table.Th key={p} style={{ color: T.textSecondary }}>W{p}</Table.Th>)}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cohorts.map((c) => (
                <Table.Tr key={c.cohortWeek}>
                  <Table.Td style={{ color: T.textPrimary }}>{c.cohortWeek}</Table.Td>
                  <Table.Td><Badge variant="light" color="orange" radius="sm">{c.size}</Badge></Table.Td>
                  {periods.map((p) => {
                    const v = c.retention?.[`W${p}`];
                    return <Table.Td key={p} style={{ background: cellBg(v), color: v != null && v > 0.5 ? '#fff' : T.textPrimary, fontWeight: 600 }}>{v != null ? `${Math.round(v * 100)}%` : '—'}</Table.Td>;
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Panel>
    </Stack>
  );
}
