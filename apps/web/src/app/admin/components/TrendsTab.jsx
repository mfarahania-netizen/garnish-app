// GARNISH-DASHBOARD-L4-17 — Trends: time-bucketed key events with bucket/range control (real S12).
import { useEffect, useState } from 'react';
import { Stack, Group, SegmentedControl, Loader, Center } from '@mantine/core';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import apiClient from '../../../lib/apiClient';
import dayjs from 'dayjs';
import { GES_SERIES, axisTick, gridStroke, tooltipStyle } from '../_shared/gesTheme';
import Panel, { SectionHeader } from '../_shared/Panel';
import AwaitingPilot from '../_shared/AwaitingPilot';
import { downloadCsv } from '../_shared/exportCsv';

const TREND_LABELS = { cook_complete: 'پخت', search_query: 'جستجو', mealplan_add: 'برنامه', favorite_add: 'ذخیره', ai_message_send: 'هوش مصنوعی' };

function mergeSeries(series) {
  const buckets = new Set();
  Object.values(series || {}).forEach((arr) => (arr || []).forEach((p) => buckets.add(p.bucketStart)));
  return [...buckets].sort().map((b) => {
    const row = { date: dayjs(b).format('MMM DD'), _raw: b };
    for (const [type, arr] of Object.entries(series || {})) row[type] = (arr || []).find((p) => p.bucketStart === b)?.count || 0;
    return row;
  });
}

export default function TrendsTab() {
  const [bucket, setBucket] = useState('day');
  const [days, setDays] = useState('30');
  const [data, setData] = useState(undefined);

  useEffect(() => {
    setData(undefined);
    apiClient.get(`/admin/analytics/trends?bucket=${bucket}&days=${days}`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [bucket, days]);

  const rows = mergeSeries(data?.series);
  const types = data?.types || [];
  const awaiting = data && data.status !== undefined && (data.status === 'awaiting_pilot' || rows.length === 0);

  return (
    <Stack gap="xl">
      <SectionHeader title="روندها" subtitle="سری زمانی رویدادهای کلیدی" />
      <Panel
        title="روند رویدادها"
        right={
          <Group gap="sm">
            <SegmentedControl size="xs" radius="md" value={bucket} onChange={setBucket} data={[{ label: 'روزانه', value: 'day' }, { label: 'هفتگی', value: 'week' }]} />
            <SegmentedControl size="xs" radius="md" value={days} onChange={setDays} data={[{ label: '۳۰ روز', value: '30' }, { label: '۹۰ روز', value: '90' }]} />
          </Group>
        }
        onExport={data && !awaiting ? () => downloadCsv('garnish-trends', rows.map(({ _raw, ...r }) => r)) : undefined}
      >
        {data === undefined ? (
          <Center style={{ height: 360 }}><Loader color="orange" /></Center>
        ) : awaiting ? (
          <AwaitingPilot label="روند در انتظار داده است" />
        ) : (
          <ResponsiveContainer width="100%" height={400}>
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
