// «محتوا و آشپزی» — recipe scorecards (views/favorites/meal-plans), shopping, and the content-gap signal
// (top zero-result searches = what to author next). §7.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconEye, IconHeart, IconCalendarEvent, IconShoppingCart, IconSearchOff, IconBulb } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, HBar, Panel, Note, Awaiting, grid, toFaDigits, fmtInt, fmtPct01 } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);

export default function ContentTab() {
  const recipes = useQuery({ queryKey: ['admin', 'recipes-stats'], queryFn: () => get('/admin/analytics/recipes-stats') });
  const meal = useQuery({ queryKey: ['admin', 'meal-planning'], queryFn: () => get('/admin/analytics/meal-planning') });
  const shopping = useQuery({ queryKey: ['admin', 'shopping'], queryFn: () => get('/admin/analytics/shopping') });
  const gaps = useQuery({ queryKey: ['admin', 'content-gaps'], queryFn: () => get('/admin/analytics/content-gaps') });

  if (recipes.isLoading) return <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 60 }}><Loader color="var(--g-color-brand-600)" /></Box>;

  const topViewed = recipes.data?.topViewed || [];
  const topFav = recipes.data?.topFavorited || [];
  const topPlanned = meal.data?.topRecipes || [];
  const sh = shopping.data || {};
  const topItems = sh.topItems || [];
  const g = gaps.data || {};
  const checkRate = sh.totalItems > 0 ? sh.checkedItems / sh.totalItems : null;
  const maxV = (arr, k) => Math.max(1, ...arr.map((x) => x[k] || 0));

  return (
    <>
      <Box style={grid(184)}>
        <Kpi icon={IconCalendarEvent} label="برنامه‌های ساخته‌شده" status={meal.data?.generateCount > 0 ? 'real' : 'awaiting_pilot'} value={fmtInt(meal.data?.generateCount)} sub="رویدادِ mealplan_generate" awaitNote="—" />
        <Kpi icon={IconShoppingCart} label="کل آیتمِ خرید" status={sh.totalItems > 0 ? 'real' : 'awaiting_pilot'} value={fmtInt(sh.totalItems)} sub={`${toFaDigits(sh.checkedItems ?? 0)} تیک‌خورده`} awaitNote="—" />
        <Kpi icon={IconShoppingCart} label="نرخِ تیک‌خوردن" status={checkRate != null ? 'real' : 'awaiting_pilot'} value={checkRate != null ? fmtPct01(checkRate) : '—'} sub="آیتم‌های خریده‌شده" awaitNote="—" />
        <Kpi icon={IconSearchOff} label="جستجوی بی‌نتیجه" status={g.totalUnmet > 0 ? 'real' : 'awaiting_pilot'} value={fmtInt(g.totalUnmet)} sub={`${toFaDigits(g.distinctQueries ?? 0)} عبارتِ متمایز`} awaitNote="—" />
      </Box>

      <Section title="کارنامهٔ رسپی‌ها" sub="بر اساس رویدادهای واقعی" />
      <Box style={grid(300)}>
        <Panel title="پربازدیدترین" status={topViewed.length ? 'real' : 'awaiting_pilot'} right={<IconEye size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
          {topViewed.length ? topViewed.slice(0, 8).map((r) => <HBar key={r.id} label={r.title} value={r.views} max={maxV(topViewed, 'views')} display={toFaDigits(r.views)} />) : <Awaiting note="بازدیدی ثبت نشده." />}
        </Panel>
        <Panel title="پرعلاقه‌ترین" status={topFav.length ? 'real' : 'awaiting_pilot'} right={<IconHeart size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
          {topFav.length ? topFav.slice(0, 8).map((r) => <HBar key={r.id} label={r.title} value={r.favorites} max={maxV(topFav, 'favorites')} display={toFaDigits(r.favorites)} color="var(--g-color-brand-400)" />) : <Awaiting note="علاقه‌مندی‌ای ثبت نشده." />}
        </Panel>
      </Box>

      <Box style={grid(300)}>
        <Panel title="پر‌برنامه‌ترین در هفته" status={topPlanned.length ? 'real' : 'awaiting_pilot'} right={<IconCalendarEvent size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
          {topPlanned.length ? topPlanned.slice(0, 8).map((r) => <HBar key={r.id} label={r.title} value={r.count} max={maxV(topPlanned, 'count')} display={toFaDigits(r.count)} />) : <Awaiting note="افزودنی به برنامه ثبت نشده." />}
        </Panel>
        <Panel title="پرتکرارترین اقلامِ خرید" status={topItems.length ? 'real' : 'awaiting_pilot'} right={<IconShoppingCart size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
          {topItems.length ? topItems.slice(0, 8).map((i) => <HBar key={i.name} label={i.name} value={i.count} max={maxV(topItems, 'count')} display={toFaDigits(i.count)} color="var(--g-color-brand-400)" />) : <Awaiting note="آیتمی ثبت نشده." />}
        </Panel>
      </Box>

      <Section title="گپِ محتوا — چه رسپی‌ای بعد بنویسیم" sub="پرتکرارترین جستجوهایی که نتیجهٔ خوبی نداشتند" />
      <Note tone="brand" icon={IconBulb}>
        این فهرست مستقیماً می‌گوید کاربران دنبالِ چه‌اند که <Text component="span" style={{ fontWeight: 600 }}>نداریم</Text> — بک‌لاگِ تولیدِ محتوا، بر اساسِ تقاضای واقعی.
      </Note>
      <Panel status={g.topQueries?.length ? 'real' : 'awaiting_pilot'}>
        {g.topQueries?.length ? g.topQueries.map((qq) => <HBar key={qq.query} label={qq.query} value={qq.count} max={Math.max(1, ...(g.topQueries.map((x) => x.count)))} display={toFaDigits(qq.count)} color="var(--g-color-state-warning-fg, #c0801c)" />) : <Awaiting note={g.note || (g.totalUnmet > 0 ? `${toFaDigits(g.totalUnmet)} جستجوی بی‌نتیجه ثبت شده.` : 'جستجوی بی‌نتیجه‌ای ثبت نشده.')} />}
      </Panel>
    </>
  );
}
