// GARNISH-OPS-L4-18 — Operational health panel (AI-call latency/error/guard-block, event-quality, jobs).
import { useEffect, useState } from 'react';
import { Stack, SimpleGrid, Paper, Text, Group, Badge, Loader, Center, List } from '@mantine/core';
import apiClient from '../../../lib/apiClient';
import { GES, T, gesPanel } from '../_shared/gesTheme';
import Panel, { SectionHeader } from '../_shared/Panel';
import AwaitingPilot from '../_shared/AwaitingPilot';

function Stat({ label, value, suffix = '' }) {
  return (
    <Paper style={{ ...gesPanel(), padding: 'var(--g-space-4)' }}>
      <Text fw={800} size="1.5rem" style={{ color: T.textPrimary }}>{value ?? '—'}{value != null ? suffix : ''}</Text>
      <Text size="xs" style={{ color: T.textMuted }}>{label}</Text>
    </Paper>
  );
}
const pct = (v) => (v == null ? null : `${Math.round(v * 100)}%`);

export default function OpsHealthTab() {
  const [d, setD] = useState(undefined);
  useEffect(() => { apiClient.get('/admin/ops/health').then((r) => setD(r.data)).catch(() => setD(null)); }, []);
  if (d === undefined) return <Center style={{ height: 300 }}><Loader color="orange" /></Center>;
  if (!d) return <Panel title="سلامت عملیاتی"><AwaitingPilot /></Panel>;

  const ai = d.aiCalls || {};
  const eq = d.eventQuality || {};
  const jobs = d.scheduledJobs || {};

  return (
    <Stack gap="xl">
      <SectionHeader title="سلامت عملیاتی" subtitle="تأخیر، خطا، نرخ مسدودسازی گارد، کیفیت داده، و زمان‌بند‌ها" />

      <Panel title="تماس‌های هوش مصنوعی (۲۴ ساعت)" subtitle={ai.status === 'real' ? `${ai.total} تماس` : undefined}>
        {ai.status === 'real' ? (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            <Stat label="تأخیر p50 (ms)" value={ai.latencyMsP50} />
            <Stat label="تأخیر p95 (ms)" value={ai.latencyMsP95} />
            <Stat label="نرخ خطا" value={pct(ai.errorRate)} />
            <Stat label="نرخ مسدودسازی گارد" value={pct(ai.guardBlockRate)} />
          </SimpleGrid>
        ) : <AwaitingPilot label="تماس‌های هوش مصنوعی در انتظار داده است" height={180} />}
      </Panel>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Panel title="کیفیت داده رویدادها">
          {eq.status === 'real' ? (
            <Stack gap={4}>
              <Text fw={800} size="2rem" style={{ color: GES.success }}>{pct(eq.wellFormedRate)}</Text>
              <Text size="xs" style={{ color: T.textMuted }}>رویدادهای ساختارمند در نمونهٔ {eq.sampled} موردی ({eq.malformed} ناقص)</Text>
            </Stack>
          ) : <AwaitingPilot label="کیفیت داده در انتظار رویداد" height={160} />}
        </Panel>

        <Panel title="زمان‌بند‌ها و صف‌ها">
          <Text size="sm" style={{ color: T.textPrimary }} mb={4}>اجرا: {jobs.runner}</Text>
          <Badge variant="light" color="gray" radius="sm" mb="sm">سیستم صف: {jobs.queueSystem || 'ندارد (n/a)'}</Badge>
          <List size="sm" spacing={4} style={{ color: T.textSecondary }}>
            {(jobs.jobs || []).map((j, i) => <List.Item key={i}>{j}</List.Item>)}
          </List>
          <Group mt="sm" gap="xs">
            <Text size="xs" style={{ color: T.textMuted }}>حذف مخرب نگه‌داری:</Text>
            <Badge size="xs" variant="light" color={d.retentionDestructiveEnabled ? 'red' : 'green'} radius="sm">{d.retentionDestructiveEnabled ? 'فعال' : 'خاموش (امن)'}</Badge>
          </Group>
        </Panel>
      </SimpleGrid>
    </Stack>
  );
}
