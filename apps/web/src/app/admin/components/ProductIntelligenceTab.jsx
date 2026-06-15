// GARNISH-DASHBOARD-L4-17 — Product Intelligence: what the engines actually do (real S12 data).
// FoodDNA bands · recsys quality (S11 harness) · INE distribution (S6 sim) · briefing · gamification.
import { useEffect, useState } from 'react';
import { Stack, SimpleGrid, Paper, Text, Group, Badge, Loader, Center } from '@mantine/core';
import { IconShieldCheck, IconAlertTriangle } from '@tabler/icons-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import apiClient from '../../../lib/apiClient';
import { GES, GES_SERIES, T, gesPanel, axisTick, gridStroke, tooltipStyle } from '../_shared/gesTheme';
import Panel, { SectionHeader } from '../_shared/Panel';
import AwaitingPilot, { isAwaiting } from '../_shared/AwaitingPilot';
import { downloadCsv } from '../_shared/exportCsv';

const BAND_LABELS = { empty: 'خالی', forming: 'در حال شکل‌گیری', developing: 'در حال رشد', mature: 'بالغ' };

function Stat({ label, value, suffix = '' }) {
  return (
    <Paper style={{ ...gesPanel(), padding: 'var(--g-space-4)' }}>
      <Text fw={800} size="1.6rem" style={{ color: T.textPrimary }}>{value}{suffix}</Text>
      <Text size="xs" style={{ color: T.textMuted }}>{label}</Text>
    </Paper>
  );
}

export default function ProductIntelligenceTab() {
  const [pi, setPi] = useState(undefined);
  useEffect(() => { apiClient.get('/admin/analytics/product-intelligence').then((r) => setPi(r.data)).catch(() => setPi(null)); }, []);
  if (pi === undefined) return <Center style={{ height: 300 }}><Loader color="orange" /></Center>;
  if (!pi) return <Panel title="هوش محصول"><AwaitingPilot /></Panel>;

  const bandData = pi.foodDna && !isAwaiting(pi.foodDna) ? Object.entries(pi.foodDna.bands || {}).map(([k, v]) => ({ name: BAND_LABELS[k] || k, value: v })) : [];
  const recOffline = pi.recsys?.offline || {};
  const ine = pi.ine || {};
  const ineData = [
    { name: 'ارسال می‌شد', value: ine.wouldSend || 0 },
    { name: 'متوقف‌شده', value: ine.suppressed || 0 },
    { name: 'موکول‌شده', value: ine.deferred || 0 },
  ];
  const achievements = pi.gamification && !isAwaiting(pi.gamification) ? Object.entries(pi.gamification.achievementsByKey || {}).map(([k, v]) => ({ name: k, value: v })) : [];

  const exportSummary = () => downloadCsv('garnish-product-intelligence', [
    { metric: 'foodDna.avgOverallScore', value: pi.foodDna?.avgOverallScore ?? 'awaiting_pilot' },
    { metric: 'recsys.catalogCoverage', value: recOffline.catalogCoverage?.value ?? 'awaiting_pilot' },
    { metric: 'recsys.diversity', value: recOffline.diversity?.value ?? 'awaiting_pilot' },
    { metric: 'recsys.fitQuality', value: recOffline.fitQuality?.value ?? 'awaiting_pilot' },
    { metric: 'recsys.allergySafety.leaks', value: pi.recsys?.allergySafety?.leaks ?? 'n/a' },
    { metric: 'ine.wouldSend', value: ine.wouldSend ?? 0 },
    { metric: 'ine.suppressed', value: ine.suppressed ?? 0 },
    { metric: 'ine.deferred', value: ine.deferred ?? 0 },
    { metric: 'briefing.acceptRate', value: pi.briefing?.acceptRate ?? 'awaiting_pilot' },
  ]);

  return (
    <Stack gap="xl">
      <SectionHeader title="هوش محصول" subtitle="آنچه موتورهای گارنیش واقعاً انجام می‌دهند" right={<Badge variant="light" color="orange" radius="xl">خروجی در پنل‌ها</Badge>} />

      {/* Recsys quality — real now (offline) */}
      <Panel title="کیفیت توصیه‌گر (سنجش آفلاین S11)" subtitle="پوشش کاتالوگ · تنوع · کیفیت تناسب · ایمنی آلرژی" onExport={exportSummary}>
        {pi.recsys && pi.recsys.status === 'real' ? (
          <Stack gap="md">
            <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
              <Stat label="پوشش کاتالوگ" value={recOffline.catalogCoverage?.value ?? '—'} />
              <Stat label="تنوع فهرست" value={recOffline.diversity?.value ?? '—'} />
              <Stat label="کیفیت تناسب" value={recOffline.fitQuality?.value ?? '—'} />
              <Paper style={{ ...gesPanel(), padding: 'var(--g-space-4)' }}>
                <Group gap="xs">
                  {pi.recsys.allergySafety?.pass ? <IconShieldCheck size={22} color={GES.success} /> : <IconAlertTriangle size={22} color={GES.danger} />}
                  <Text fw={800} size="1.2rem" style={{ color: pi.recsys.allergySafety?.pass ? GES.success : GES.danger }}>
                    {pi.recsys.allergySafety?.pass ? 'ایمن' : `${pi.recsys.allergySafety?.leaks} نشتی`}
                  </Text>
                </Group>
                <Text size="xs" style={{ color: T.textMuted }}>ایمنی آلرژی (گارد سخت)</Text>
              </Paper>
            </SimpleGrid>
            <Text size="xs" style={{ color: T.textMuted }}>نرخ کلیک/ذخیره (CTR): در انتظار کاربران واقعی (Track 7)</Text>
          </Stack>
        ) : <AwaitingPilot label="کاتالوگ برای سنجش لازم است" />}
      </Panel>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        {/* Food DNA bands */}
        <Panel title="توزیع بلوغ Food DNA" subtitle={pi.foodDna?.avgOverallScore != null ? `میانگین امتیاز: ${pi.foodDna.avgOverallScore}` : undefined}>
          {bandData.length > 0 && bandData.some((b) => b.value > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={bandData} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" tick={axisTick} />
                <YAxis tick={axisTick} width={40} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="کاربران" fill={GES.saffron} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <AwaitingPilot label="پروفایل کاربران در انتظار است" height={200} />}
        </Panel>

        {/* INE distribution (dry-run simulation) */}
        <Panel title="تصمیم‌های موتور اعلان (شبیه‌سازی)" subtitle={`ارسال واقعی: ${ine.realSends ?? 0} — حالت آزمایشی`}>
          {ineData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={ineData} cx="45%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={3} dataKey="value" nameKey="name">
                  {ineData.map((_, i) => <Cell key={i} fill={GES_SERIES[i % GES_SERIES.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 13, fontFamily: 'var(--g-font-fa)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <AwaitingPilot height={200} />}
        </Panel>

        {/* Briefing acceptance */}
        <Panel title="پذیرش بریفینگ روزانه">
          {pi.briefing && pi.briefing.status === 'real' ? (
            <SimpleGrid cols={3} spacing="md">
              <Stat label="پذیرش" value={Math.round((pi.briefing.acceptRate || 0) * 100)} suffix="%" />
              <Stat label="رد" value={Math.round((pi.briefing.rejectRate || 0) * 100)} suffix="%" />
              <Stat label="تعویض" value={Math.round((pi.briefing.swapRate || 0) * 100)} suffix="%" />
            </SimpleGrid>
          ) : <AwaitingPilot label="بریفینگ در انتظار رویداد واقعی" height={200} />}
        </Panel>

        {/* Gamification distribution (aggregate, private) */}
        <Panel title="توزیع دستاوردها (تجمیعی)">
          {achievements.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={achievements} layout="vertical" margin={{ top: 10, right: 16, left: 20, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis type="number" tick={axisTick} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={axisTick} width={120} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="کاربران" fill={GES.success} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <AwaitingPilot label="دستاوردها در انتظار فعالیت کاربران" height={200} />}
        </Panel>
      </SimpleGrid>
    </Stack>
  );
}
