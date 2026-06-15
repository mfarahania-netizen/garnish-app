// GARNISH-DASHBOARD-L4-17 — Funnels: onboarding + cook drop-off (real S12 /admin/analytics/funnels).
import { useEffect, useState } from 'react';
import { Stack, Text, Group, Loader, Center, Progress, Badge } from '@mantine/core';
import apiClient from '../../../lib/apiClient';
import { GES, T } from '../_shared/gesTheme';
import Panel, { SectionHeader } from '../_shared/Panel';
import AwaitingPilot from '../_shared/AwaitingPilot';
import { downloadCsv } from '../_shared/exportCsv';

const FUNNEL_TITLES = { onboarding: 'قیف ثبت‌نام', cook: 'قیف پخت (مشاهده → پخت)' };

function FunnelView({ funnel }) {
  if (funnel.status === 'awaiting_pilot') {
    return <AwaitingPilot label="هنوز کاربری وارد این قیف نشده" height={160} note="نرخ تبدیل با ورود کاربران واقعی محاسبه می‌شود." />;
  }
  const max = Math.max(1, ...funnel.stages.map((s) => s.count));
  return (
    <Stack gap="md">
      {funnel.stages.map((s, i) => (
        <div key={s.key}>
          <Group justify="space-between" mb={4}>
            <Text size="sm" style={{ color: T.textPrimary }}>{s.label}</Text>
            <Group gap="xs">
              <Text size="sm" fw={700} style={{ color: T.textPrimary }}>{s.count}</Text>
              {s.dropOffFromPrev != null && s.dropOffFromPrev > 0 && (
                <Badge size="xs" variant="light" color="red" radius="sm">−{Math.round(s.dropOffFromPrev * 100)}%</Badge>
              )}
            </Group>
          </Group>
          <Progress value={(s.count / max) * 100} color="orange" radius="sm" size="lg" />
          {i === 0 && s.conversionFromStart != null && (
            <Text size="xs" style={{ color: T.textMuted }} mt={2}>نقطهٔ شروع قیف</Text>
          )}
        </div>
      ))}
      <Group justify="flex-end">
        <Text size="sm" style={{ color: GES.saffron }} fw={700}>
          تبدیل کلی: {funnel.overallConversion != null ? `${Math.round(funnel.overallConversion * 100)}%` : '—'}
        </Text>
      </Group>
    </Stack>
  );
}

export default function FunnelsTab() {
  const [data, setData] = useState(undefined);
  useEffect(() => { apiClient.get('/admin/analytics/funnels').then((r) => setData(r.data)).catch(() => setData(null)); }, []);
  if (data === undefined) return <Center style={{ height: 300 }}><Loader color="orange" /></Center>;

  const funnels = data?.funnels || [];
  const exportRows = funnels.flatMap((f) => f.stages.map((s) => ({ funnel: f.name, stage: s.label, count: s.count, dropOffFromPrev: s.dropOffFromPrev ?? '', conversionFromStart: s.conversionFromStart ?? '', status: f.status })));

  return (
    <Stack gap="xl">
      <SectionHeader title="قیف‌ها" subtitle="افت کاربران در هر مرحله — از داده‌های واقعی رویداد" />
      {funnels.map((f) => (
        <Panel key={f.name} title={FUNNEL_TITLES[f.name] || f.name} onExport={() => downloadCsv('garnish-funnels', exportRows)}>
          <FunnelView funnel={f} />
        </Panel>
      ))}
      {funnels.length === 0 && <Panel title="قیف‌ها"><AwaitingPilot /></Panel>}
    </Stack>
  );
}
