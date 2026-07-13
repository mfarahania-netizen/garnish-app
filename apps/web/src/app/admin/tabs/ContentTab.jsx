// «محتوا و آشپزی» — operational Recipe table first, then explicitly 30-day aggregate analytics.
import { Box, Text, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconEye, IconHeart, IconCalendarEvent, IconShoppingCart, IconSearchOff, IconBulb } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { Section, Kpi, HBar, Panel, Note, Awaiting, ErrorState, grid, toFaDigits, fmtInt, fmtPct01 } from '../_ui';
import RecipeOperations from './RecipeOperations';

const DAYS = 30;
const get = (url) => apiClient.get(url).then((r) => r.data);
export const CONTENT_PRODUCT_COPY = {
  analyticsSubtitle: 'همهٔ شاخص‌های زیر یک بازه دارند؛ جدول عملیاتی بالا نمای لحظه‌ای فعلی است',
  sourceNote: 'منابع: رویداد مشاهدهٔ دستور غذا و افزودن به برنامه، زمان ثبت علاقه‌مندی و قلم خرید، و نیاز جستجوی بی‌نتیجهٔ نرمال‌شده و بدون دادهٔ شناسایی‌کننده.',
  gapSubtitle: 'فقط نیاز جستجوی نرمال‌شده و برچسب‌های تجمیعی؛ متن خام جستجو ذخیره و نمایش داده نمی‌شود',
};

export default function ContentTab() {
  const recipes = useQuery({ queryKey: ['admin', 'recipes-stats', DAYS], queryFn: () => get(`/admin/analytics/recipes-stats?days=${DAYS}`) });
  const meal = useQuery({ queryKey: ['admin', 'meal-planning', DAYS], queryFn: () => get(`/admin/analytics/meal-planning?days=${DAYS}`) });
  const shopping = useQuery({ queryKey: ['admin', 'shopping', DAYS], queryFn: () => get(`/admin/analytics/shopping?days=${DAYS}`) });
  const gaps = useQuery({ queryKey: ['admin', 'content-gaps', DAYS], queryFn: () => get(`/admin/analytics/content-gaps?days=${DAYS}`) });
  const analytics = [recipes, meal, shopping, gaps];
  const failed = analytics.some((query) => query.isError);
  const loading = analytics.some((query) => query.isLoading && !query.data);

  const topViewed = recipes.data?.topViewed || [];
  const topFav = recipes.data?.topFavorited || [];
  const topPlanned = meal.data?.topRecipes || [];
  const sh = shopping.data || {};
  const topItems = sh.topItems || [];
  const g = gaps.data || {};
  const checkRate = sh.totalItems > 0 ? sh.checkedItems / sh.totalItems : null;
  const maxV = (arr, key) => Math.max(1, ...arr.map((item) => item[key] || 0));
  const asOfValues = analytics.map((query) => query.data?.asOf).filter(Boolean).map((value) => new Date(value).getTime()).filter(Number.isFinite);
  const oldestAsOf = asOfValues.length ? new Date(Math.min(...asOfValues)).toLocaleString('fa-IR') : 'نامعلوم';

  return (
    <>
      <RecipeOperations />

      <Section title="تحلیلِ محتوا · ۳۰ روز" sub={CONTENT_PRODUCT_COPY.analyticsSubtitle} />
      {failed ? <ErrorState note="حداقل یکی از منابع تحلیل محتوا پاسخ نداد؛ جمع‌بندی ناقص نمایش داده نمی‌شود." onRetry={() => analytics.forEach((query) => query.refetch())} />
        : loading ? <Box style={{ display: 'grid', placeItems: 'center', paddingBlock: 40 }}><Loader color="var(--g-color-brand-600)" /></Box>
          : (
            <>
              <Note tone="info">{CONTENT_PRODUCT_COPY.sourceNote} بازه: ۳۰ روز؛ قدیمی‌ترین زمان دریافت: {oldestAsOf}.</Note>
              <Box style={grid(184)}>
                <Kpi icon={IconCalendarEvent} label="افزودن به برنامه · ۳۰ روز" status={meal.data?.slotsAdded > 0 ? 'real' : 'awaiting_pilot'} value={fmtInt(meal.data?.slotsAdded)} sub={`${toFaDigits(meal.data?.distinctPlanners ?? 0)} برنامه‌ریزِ متمایز`} awaitNote="رویدادی در بازه ثبت نشده" />
                <Kpi icon={IconShoppingCart} label="آیتمِ خرید · ۳۰ روز" status={sh.totalItems > 0 ? 'real' : 'awaiting_pilot'} value={fmtInt(sh.totalItems)} sub={`${toFaDigits(sh.checkedItems ?? 0)} تیک‌خورده`} awaitNote="آیتمی در بازه ثبت نشده" />
                <Kpi icon={IconShoppingCart} label="نرخِ تیک‌خوردن · ۳۰ روز" status={checkRate != null ? 'real' : 'awaiting_pilot'} value={checkRate != null ? fmtPct01(checkRate) : '—'} sub="از آیتم‌های افزوده‌شده در بازه" awaitNote="—" />
                <Kpi icon={IconSearchOff} label="جستجوی بی‌نتیجه · ۳۰ روز" status={g.totalUnmet > 0 ? 'real' : 'awaiting_pilot'} value={fmtInt(g.totalUnmet)} sub={`${toFaDigits(g.distinctQueries ?? 0)} نیاز جستجوی نرمال‌شده`} awaitNote="رویدادی در بازه ثبت نشده" />
              </Box>

              <Section title="کارنامهٔ دستورهای غذا · ۳۰ روز" sub="فقط رویدادها و رکوردهای داخل بازه" />
              <Box style={grid(300)}>
                <Panel title="پربازدیدترین" status={topViewed.length ? 'real' : 'awaiting_pilot'} right={<IconEye size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
                  {topViewed.length ? topViewed.slice(0, 8).map((recipe) => <HBar key={recipe.id} label={recipe.title} value={recipe.views} max={maxV(topViewed, 'views')} display={toFaDigits(recipe.views)} />) : <Awaiting note="بازدیدی در این بازه ثبت نشده." />}
                </Panel>
                <Panel title="پرعلاقه‌ترین" status={topFav.length ? 'real' : 'awaiting_pilot'} right={<IconHeart size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
                  {topFav.length ? topFav.slice(0, 8).map((recipe) => <HBar key={recipe.id} label={recipe.title} value={recipe.favorites} max={maxV(topFav, 'favorites')} display={toFaDigits(recipe.favorites)} color="var(--g-color-brand-400)" />) : <Awaiting note="علاقه‌مندی‌ای در این بازه ثبت نشده." />}
                </Panel>
              </Box>

              <Box style={grid(300)}>
                <Panel title="پربرنامه‌ترین · ۳۰ روز" status={topPlanned.length ? 'real' : 'awaiting_pilot'} right={<IconCalendarEvent size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
                  {topPlanned.length ? topPlanned.slice(0, 8).map((recipe) => <HBar key={recipe.id} label={recipe.title} value={recipe.count} max={maxV(topPlanned, 'count')} display={toFaDigits(recipe.count)} />) : <Awaiting note="افزودنی به برنامه در این بازه ثبت نشده." />}
                </Panel>
                <Panel title="پرتکرارترین اقلام خرید · ۳۰ روز" status={topItems.length ? 'real' : 'awaiting_pilot'} right={<IconShoppingCart size={15} stroke={1.8} style={{ color: 'var(--g-color-text-muted)' }} />}>
                  {topItems.length ? topItems.slice(0, 8).map((item) => <HBar key={item.name} label={item.name} value={item.count} max={maxV(topItems, 'count')} display={toFaDigits(item.count)} color="var(--g-color-brand-400)" />) : <Awaiting note="آیتمی در این بازه ثبت نشده." />}
                </Panel>
              </Box>

              <Section title="شکاف محتوا · ۳۰ روز" sub={CONTENT_PRODUCT_COPY.gapSubtitle} />
              <Note tone="brand" icon={IconBulb}>
                این بخش تنها وقتی نام تقاضا را نشان می‌دهد که دادهٔ نرمال‌شده و بدون اطلاعات شناسایی‌کننده موجود باشد. در غیر این صورت فقط <Text component="span" style={{ fontWeight: 600 }}>حجم جستجوهای بی‌نتیجه</Text> قابل اتکاست، نه اینکه کاربران دقیقاً دنبال چه عبارتی بوده‌اند.
              </Note>
              <Panel status={g.topQueries?.length ? 'real' : 'awaiting_pilot'}>
                {g.topQueries?.length ? g.topQueries.map((item) => <HBar key={item.query} label={item.query} value={item.count} max={Math.max(1, ...g.topQueries.map((row) => row.count))} display={toFaDigits(item.count)} color="var(--g-color-state-warning-fg, #c0801c)" />) : <Awaiting note={g.totalUnmet > 0 ? `${toFaDigits(g.totalUnmet)} جستجوی بی‌نتیجه ثبت شده؛ نیاز جستجوی نرمال‌شده موجود نیست.` : 'جستجوی بی‌نتیجه‌ای در بازه ثبت نشده.'} />}
              </Panel>
            </>
          )}
    </>
  );
}
