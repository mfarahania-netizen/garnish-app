// «زنده» — live activity: today's events, a 30-min active gauge, and a refreshing event feed. §13.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconBolt, IconCalendarTime, IconUsers, IconActivity } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, Panel, Awaiting, grid, toFaDigits, fmtInt } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);
const TYPE_FA = {
  page_view: 'بازدید صفحه', recipe_view: 'دیدنِ رسپی', ai_message_send: 'پیامِ هوش مصنوعی', ai_suggestion_generated: 'پاسخِ هوش مصنوعی',
  mealplan_add: 'افزودن به برنامه', mealplan_remove: 'حذف از برنامه', mealplan_generate: 'ساختِ برنامه', cook_complete: 'تکمیلِ پخت',
  favorite_add: 'علاقه‌مندی', start_cooking_click: 'شروعِ پخت', search_unmet: 'جستجوی بی‌نتیجه', login: 'ورود', logout: 'خروج',
  recommendation_impression: 'نمایشِ پیشنهاد', recommendation_click: 'کلیکِ پیشنهاد',
};
const rel = (ts, now) => {
  const s = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${toFaDigits(s)} ثانیه پیش`;
  const m = Math.floor(s / 60); if (m < 60) return `${toFaDigits(m)} دقیقه پیش`;
  const h = Math.floor(m / 60); if (h < 24) return `${toFaDigits(h)} ساعت پیش`;
  return `${toFaDigits(Math.floor(h / 24))} روز پیش`;
};

export default function RealtimeTab() {
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => get('/admin/analytics/stats'), refetchInterval: 5000 });
  const events = useQuery({ queryKey: ['admin', 'events-live'], queryFn: () => get('/admin/analytics/events?limit=40'), refetchInterval: 5000 });

  if (events.isLoading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 60 }}><Loader color="var(--g-color-brand-600)" /></Box>;

  const list = events.data?.events || [];
  const now = events.dataUpdatedAt || stats.dataUpdatedAt || 0;
  const since = now - 30 * 60 * 1000;
  const recent = list.filter((e) => new Date(e.timestamp).getTime() >= since);

  return (
    <>
      <Box style={grid(184)}>
        <Kpi icon={IconCalendarTime} label="رویدادِ امروز" status={typeof stats.data?.todayEvents === 'number' ? 'real' : 'awaiting_pilot'} value={fmtInt(stats.data?.todayEvents)} sub="از نیمه‌شب" awaitNote="—" />
        <Kpi icon={IconActivity} label="کل رویداد" status={typeof stats.data?.totalEvents === 'number' ? 'real' : 'awaiting_pilot'} value={fmtInt(stats.data?.totalEvents)} sub="کلِ تاریخچه" awaitNote="—" />
        <Kpi icon={IconBolt} label="رویداد در ۳۰ دقیقهٔ اخیر" status={recent.length ? 'real' : 'awaiting_pilot'} value={fmtInt(recent.length)} sub="از فیدِ زنده" awaitNote="فعالیتی نیست" />
        <Kpi icon={IconUsers} label="کاربرانِ فعالِ ۳۰ دقیقهٔ اخیر" status={typeof stats.data?.activeUsers30m === 'number' ? 'real' : 'awaiting_pilot'} value={fmtInt(stats.data?.activeUsers30m)} sub="کاربرانِ متمایز (محاسبهٔ سرور، نه حدس)" awaitNote="—" />
      </Box>

      <Section title="آخرین رویدادها" sub="هر ۵ ثانیه به‌روز می‌شود (polling — نه streamِ قطعی)" right={<Box style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)' }}><Box style={{ inlineSize: 7, blockSize: 7, borderRadius: '50%', background: 'var(--g-color-state-success-fg)' }} />تقریباً زنده</Box>} />
      <Panel status={list.length ? 'real' : 'awaiting_pilot'}>
        {list.length ? (
          <Box style={{ display: 'flex', flexDirection: 'column' }}>
            {list.slice(0, 30).map((e) => (
              <Box key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBlock: 8, borderBlockEnd: '1px solid var(--g-color-border-subtle)' }}>
                <Box style={{ inlineSize: 6, blockSize: 6, borderRadius: '50%', background: 'var(--g-color-brand-400)', flexShrink: 0 }} />
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-primary)', flexShrink: 0, minInlineSize: 120 }}>{TYPE_FA[e.type] || e.type}</Text>
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12px', color: 'var(--g-color-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.recipeTitle || e.page || ''}</Text>
                <Text component="span" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', flexShrink: 0 }}>{rel(e.timestamp, now)}</Text>
              </Box>
            ))}
          </Box>
        ) : <Awaiting note="رویدادی در جریان نیست." />}
      </Panel>
    </>
  );
}
