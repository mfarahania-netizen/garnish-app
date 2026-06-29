// Behavior + Improve — the founder's core ask: see precisely what users DO, and a short action list of what
// to fix. Improve list at top (the to-dos), then the granular behaviour (recipe funnel, searches, AI topics).
// Reads /admin/insights/behavior — real where data exists, honestly thin until launch. No decorative tiles.
import { Box, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { IconSearch, IconSparkles, IconBulb, IconToolsKitchen2, IconFlame, IconMessage } from '@tabler/icons-react';
import apiClient from '../../../lib/apiClient';
import { CARD, grid, Kpi, Panel, Section, Table, HBar, Note, Awaiting, fmtInt, fmtPct01, faPercent, toFaDigits } from '../_ui';

const get = (url) => apiClient.get(url).then((r) => r.data);

// plain-Persian labels for the raw event types (no cryptic labels — the founder's standing ask)
const ACTION_FA = {
  recipe_view: 'دیدنِ رسپی', page_view: 'بازدیدِ صفحه', ai_message_send: 'پیام به هوش مصنوعی', mealplan_add: 'افزودن به برنامه',
  search_query: 'جست‌وجو', search_unmet: 'جست‌وجوی بی‌نتیجه', favorite_add: 'ذخیرهٔ رسپی', cook_complete: 'تکمیلِ پخت',
  start_cooking_click: 'شروعِ پخت', session_start: 'شروعِ نشست', ai_feedback: 'بازخوردِ هوش مصنوعی', shopping_item_add: 'افزودن به خرید',
  recommendation_impression: 'نمایشِ پیشنهاد', recommendation_click: 'کلیکِ پیشنهاد', login: 'ورود', register: 'ثبت‌نام',
};
const actionFa = (t) => ACTION_FA[t] || t;
const SEV = {
  high: { fg: 'var(--g-color-state-danger-fg, #c0392b)', bg: 'var(--g-color-state-danger-bg, #fdecea)', label: 'مهم' },
  medium: { fg: 'var(--g-color-state-warning-fg, #c0801c)', bg: 'var(--g-color-state-warning-bg, #fdf3e3)', label: 'متوسط' },
  low: { fg: 'var(--g-color-text-secondary)', bg: 'var(--g-color-state-info-bg)', label: 'کم' },
};

export default function BehaviorTab() {
  const q = useQuery({ queryKey: ['admin', 'behavior'], queryFn: () => get('/admin/insights/behavior'), refetchInterval: 30000 });
  const d = q.data;
  if (q.isLoading && !d) return <Box style={CARD}><Awaiting note="در حال خواندن رفتار کاربران…" /></Box>;
  if (!d) return <Box style={CARD}><Awaiting note="داده‌ای نیست." /></Box>;

  const { recipes, search, ai, improve = [], funnel, usage } = d;
  const maxTopic = Math.max(1, ...(ai.topTopics || []).map((t) => t.count));
  const maxIntent = Math.max(1, ...(ai.topIntents || []).map((t) => t.count));
  const maxAction = Math.max(1, ...((usage?.topActions) || []).map((a) => a.count));
  const maxPage = Math.max(1, ...((usage?.topPages) || []).map((p) => p.count));
  const fView = funnel?.view || 0;

  return (
    <Box>
      <Note icon={IconBulb}>
        اینجا دقیق می‌بینی کاربر چه می‌کند، و بالای صفحه فهرستِ کوتاهِ «چه چیزی را بهبود بده». هر چیزی که با کاربرِ واقعی پر می‌شود
        تا لانچ کم‌داده است (نه فیک) و از روزِ اول زنده می‌شود.
      </Note>

      {/* ── IMPROVE: the action list, first ── */}
      <Section title="چه چیزی را بهبود بدهم؟" sub="کارهای پیشنهادی بر اساسِ رفتارِ واقعی">
        {improve.length === 0 ? (
          <Box style={CARD}><Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '12.5px', color: 'var(--g-color-text-muted)' }}>فعلاً کارِ بهبودی از داده‌ها درنیامده — با ورودِ کاربرِ واقعی این فهرست پر می‌شود.</Text></Box>
        ) : (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {improve.map((it) => {
              const s = SEV[it.severity] || SEV.low;
              return (
                <Box key={it.key} style={{ ...CARD, borderInlineStartWidth: 3, borderInlineStartColor: s.fg, borderInlineStartStyle: 'solid', display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                  <Box style={{ flexShrink: 0, minInlineSize: 44, textAlign: 'center' }}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '20px', fontWeight: 700, color: s.fg, lineHeight: 1.1 }}>{toFaDigits(it.count)}</Text>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '9.5px', color: s.fg, background: s.bg, borderRadius: '5px', padding: '1px 5px', marginBlockStart: 3 }}>{s.label}</Text>
                  </Box>
                  <Box style={{ minInlineSize: 0 }}>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '13px', fontWeight: 600, color: 'var(--g-color-text-primary)' }}>{it.title}</Text>
                    <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11.5px', color: 'var(--g-color-text-secondary)', lineHeight: 1.7, marginBlockStart: 3 }}>{it.detail}</Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Section>

      {/* ── BEHAVIOR: the precise detail ── */}
      <Section title="رفتارِ کاربر" sub="دقیق و ریز">
        <Box style={grid(150)}>
          <Kpi icon={IconSearch} label="جست‌وجوهای بی‌نتیجه" value={fmtInt(search.failed)} status={search.failed > 0 ? 'real' : search.status} sub={search.total > 0 ? `${fmtPct01(search.failRate)} از کلِ جست‌وجوها` : 'کاربر دنبالِ چیزی بوده که نداریم'} tone={search.failed > 0 ? 'warn' : undefined} awaitNote="با جست‌وجوی کاربر پر می‌شود" />
          <Kpi icon={IconSparkles} label="نرخِ مدلِ پشتیبانِ AI" value={fmtPct01(ai.fallbackRate)} status={ai.status} sub={`${toFaDigits(ai.calls)} درخواستِ هوش مصنوعی`} tone={ai.fallbackRate > 0.5 ? 'warn' : undefined} awaitNote="با استفادهٔ کاربر از AI پر می‌شود" />
          <Kpi icon={IconFlame} label="پخت‌های ثبت‌شده" value={fmtInt(recipes.totalCooks)} status={recipes.status} sub={`روی ${toFaDigits(recipes.trackedRecipes)} رسپی`} awaitNote="با پختِ کاربر پر می‌شود" />
          <Kpi icon={IconToolsKitchen2} label="رسپی‌های منتشرشده" value={fmtInt(recipes.publicRecipes)} status="real" sub="کلِ کاتالوگ" />
        </Box>

        {/* cook funnel — where users drop off */}
        <Box style={{ marginBlockStart: 11 }}>
          <Panel title="قیفِ پخت — کجا رها می‌کنند؟" sub="از دیدنِ رسپی تا تکمیلِ پخت" status={funnel?.status}>
            {fView > 0 ? (
              <Box>
                <HBar label="دیدنِ رسپی" value={funnel.view} max={fView} display={toFaDigits(funnel.view)} />
                <HBar label="شروعِ پخت" value={funnel.start} max={fView} display={`${toFaDigits(funnel.start)} · ${faPercent(Math.round((funnel.start / fView) * 100))}`} color="var(--g-color-brand-400)" />
                <HBar label="تکمیلِ پخت" value={funnel.cook} max={fView} display={`${toFaDigits(funnel.cook)} · ${faPercent(Math.round((funnel.cook / fView) * 100))}`} color="var(--g-color-state-success-fg, #2e7d4f)" />
                <Text component="div" style={{ fontFamily: 'var(--g-font-fa)', fontSize: '11px', color: 'var(--g-color-text-muted)', marginBlockStart: 10 }}>
                  بیشترین افت: از دیدن تا شروعِ پخت — {faPercent(Math.round((1 - funnel.start / fView) * 100))} بعد از دیدنِ رسپی، شروع به پخت نمی‌کنند.
                </Text>
              </Box>
            ) : <Awaiting note="با پختِ کاربرِ واقعی پر می‌شود." />}
          </Panel>
        </Box>

        <Box style={{ ...grid(330), marginBlockStart: 11 }}>
          <Panel title="پربازدیدترین رسپی‌ها" sub="چه چیزی دیده می‌شود — و چقدرش پخته می‌شود" status={recipes.status}>
            <Table
              columns={[
                { key: 'title', label: 'رسپی' },
                { key: 'views', label: 'بازدید', align: 'center', render: (r) => toFaDigits(r.views) },
                { key: 'cooks', label: 'پخت', align: 'center', render: (r) => toFaDigits(r.cooks) },
                { key: 'cookRate', label: 'نرخِ پخت', align: 'center', render: (r) => (r.cookRate != null ? fmtPct01(r.cookRate) : '—') },
              ]}
              rows={(recipes.topViewed || []).map((r) => ({ ...r, _key: r.recipeId }))}
              empty="هنوز بازدیدِ ثبت‌شده‌ای نیست — با کاربرِ واقعی پر می‌شود."
            />
          </Panel>

          <Panel title="دیده شد، پخته نشد" sub="کاندیدای بازبینی — چرا پخته نمی‌شوند؟" status={recipes.status}>
            <Table
              columns={[
                { key: 'title', label: 'رسپی' },
                { key: 'views', label: 'بازدید', align: 'center', render: (r) => toFaDigits(r.views) },
              ]}
              rows={(recipes.viewedNotCooked || []).map((r) => ({ ...r, _key: r.recipeId }))}
              empty="فعلاً موردی نیست."
            />
          </Panel>
        </Box>

        <Box style={{ ...grid(330), marginBlockStart: 11 }}>
          <Panel title="پرکاربردترین کارها" sub="کاربر بیشتر چه می‌کند" status={usage?.status}>
            {usage?.topActions?.length ? usage.topActions.map((a) => <HBar key={a.action} label={actionFa(a.action)} value={a.count} max={maxAction} />) : <Awaiting note="با فعالیتِ کاربر پر می‌شود." />}
          </Panel>
          <Panel title="پربازدیدترین صفحه‌ها" sub="کدام صفحه‌ها باز می‌شوند" status={usage?.topPages?.length ? 'real' : 'awaiting_pilot'}>
            {usage?.topPages?.length ? usage.topPages.map((p) => <HBar key={p.page} label={p.page} value={p.count} max={maxPage} color="var(--g-color-brand-400)" />) : <Awaiting note="با بازدیدِ صفحه پر می‌شود." />}
          </Panel>
        </Box>

        <Box style={{ ...grid(330), marginBlockStart: 11 }}>
          <Panel title="مردم از هوش مصنوعی چه می‌پرسند" sub="موضوعاتِ واقعیِ گفت‌وگوها" status={ai.topTopics?.length ? 'real' : 'awaiting_pilot'}>
            {ai.topTopics?.length ? ai.topTopics.map((t) => <HBar key={t.topic} label={t.topic} value={t.count} max={maxTopic} />) : <Awaiting note="با گفت‌وگوی کاربر با AI پر می‌شود." icon={IconMessage} />}
          </Panel>

          <Panel title="نوعِ درخواست‌های AI" sub="کاربر بیشتر چه می‌خواهد" status={ai.topIntents?.length ? 'real' : 'awaiting_pilot'}>
            {ai.topIntents?.length ? ai.topIntents.map((t) => <HBar key={t.intent} label={t.intent} value={t.count} max={maxIntent} color="var(--g-color-brand-400)" />) : <Awaiting note="با استفادهٔ کاربر از AI پر می‌شود." />}
          </Panel>
        </Box>
      </Section>
    </Box>
  );
}
