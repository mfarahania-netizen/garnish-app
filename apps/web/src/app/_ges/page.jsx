import { useState } from 'react';
import { Box, Stack, Group, Text, SimpleGrid } from '@mantine/core';
import {
  IconHome, IconBook, IconHeart, IconCalendar, IconUser, IconBell, IconLeaf,
} from '@tabler/icons-react';
import {
  Button, CardShell, SectionHeader, StatusBadge, BottomSheet, ActionShelf,
  TimerChip, AIWhisper, AISheet, AICompanion, WhyChip, WhySheet, NutritionBadge,
  AllergenMark, EmptyState, LoadingSkeleton, ErrorState,
  FoodDnaRing, CookStep, MealSlotCard, GamificationStrip, Chip, TextField,
  SelectField, Stepper, TopBar, BottomNav, Avatar, ProgressBar,
  RecommendationCard, GroceryRow, MergeChip, NotificationRow,
  PreferenceMemoryRow, FoodDnaStepCard, WeeklyFoodStoryCard,
} from '../../components/ges';

/**
 * GES Component Gallery (DS-ALIGN-L4-20) — an internal, admin-gated page that
 * renders every GES library component in its key states, so the library is
 * verifiable and S21+ can compose pages from a known-good kit. Dev/verification
 * surface only (wired behind <AdminRoute> in App.jsx). Token-pure chrome.
 */

function Section({ id, title, note, children }) {
  return (
    <Box
      component="section"
      aria-labelledby={id}
      style={{
        background: 'var(--g-color-bg-surface)',
        border: '1px solid var(--g-color-border-subtle)',
        borderRadius: 'var(--g-radius-card)',
        padding: 'var(--g-space-4)',
      }}
    >
      <Stack style={{ gap: 'var(--g-space-3)' }}>
        <SectionHeader id={id} title={title} subtitle={note} />
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--g-space-3)', alignItems: 'flex-start' }}>
          {children}
        </Box>
      </Stack>
    </Box>
  );
}

// A transform on the wrapper makes position:fixed children anchor to this box
// (so fixed bars preview in-place instead of sticking to the viewport).
function FixedPreview({ height = 120, children }) {
  return (
    <Box style={{ position: 'relative', inlineSize: '100%', minBlockSize: height, transform: 'translateZ(0)', overflow: 'hidden', borderRadius: 'var(--g-radius-input)', border: '1px dashed var(--g-color-border-strong)', background: 'var(--g-color-bg-canvas)' }}>
      {children}
    </Box>
  );
}

export default function GesGallery() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [chips, setChips] = useState({ quick: true, healthy: false, vegan: false });
  const [qty, setQty] = useState(2);
  const [search, setSearch] = useState('');
  const [select, setSelect] = useState('');
  const [tab, setTab] = useState('home');
  const [checked, setChecked] = useState(false);
  const [merge, setMerge] = useState(false);

  const navItems = [
    { value: 'home', label: 'خانه', icon: <IconHome size={24} /> },
    { value: 'recipes', label: 'رسپی‌ها', icon: <IconBook size={24} /> },
    { value: 'favorites', label: 'علاقه', icon: <IconHeart size={24} />, badge: 3 },
    { value: 'plan', label: 'برنامه', icon: <IconCalendar size={24} /> },
    { value: 'profile', label: 'پروفایل', icon: <IconUser size={24} /> },
  ];

  const demoRecipe = { id: 1, title: 'خورش قورمه‌سبزی', cook_time: '۹۰ دقیقه', difficulty: 'متوسط', foodType: 'main', isQuick: false, isHealthy: true, mealType: 'ناهار' };

  return (
    <Box dir="rtl" style={{ minBlockSize: '100dvh', background: 'var(--g-color-bg-canvas)' }}>
      <TopBar title="GES Component Gallery" />
      <Box style={{ maxInlineSize: 960, marginInline: 'auto', padding: 'var(--g-space-4)' }}>
        <Text style={{ marginBlockEnd: 'var(--g-space-4)', color: 'var(--g-color-text-secondary)', fontSize: 'var(--g-font-size-14)' }}>
          Internal verification surface — every GES primitive in its states. Token-pure, RTL, reduced-motion aware.
        </Text>

        <Stack style={{ gap: 'var(--g-space-4)' }}>
          <Section id="g-buttons" title="Button" note="primary / secondary / ghost / destructive / loading">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete</Button>
            <Button loading>Loading</Button>
          </Section>

          <Section id="g-badges" title="StatusBadge / NutritionBadge / AllergenMark">
            <StatusBadge tone="success">Saved</StatusBadge>
            <StatusBadge tone="warning">Pending</StatusBadge>
            <StatusBadge tone="danger">Failed</StatusBadge>
            <NutritionBadge state="verified" value="320 kcal" sourceName="USDA" />
            <NutritionBadge state="estimate" />
            <NutritionBadge state="unavailable" />
            <AllergenMark allergen="بادام‌زمینی" />
          </Section>

          <Section id="g-chips" title="Chip" note="filter / selected / removable">
            <Chip label="سریع" selected={chips.quick} onClick={() => setChips((c) => ({ ...c, quick: !c.quick }))} />
            <Chip label="سالم" selected={chips.healthy} onClick={() => setChips((c) => ({ ...c, healthy: !c.healthy }))} />
            <Chip label="گیاهی" icon={<IconLeaf size={14} />} selected={chips.vegan} onClick={() => setChips((c) => ({ ...c, vegan: !c.vegan }))} onRemove={() => setChips((c) => ({ ...c, vegan: false }))} />
          </Section>

          <Section id="g-inputs" title="Inputs" note="text/search · select · stepper · focus/error">
            <Box style={{ inlineSize: 240 }}><TextField type="search" placeholder="جستجوی رسپی…" value={search} onChange={setSearch} ariaLabel="Search" /></Box>
            <Box style={{ inlineSize: 240 }}><TextField label="نام" value="" onChange={() => {}} error="این فیلد لازم است" /></Box>
            <Box style={{ inlineSize: 240 }}><SelectField label="وعده" placeholder="انتخاب…" value={select} onChange={setSelect} options={[{ value: 'b', label: 'صبحانه' }, { value: 'l', label: 'ناهار' }, { value: 'd', label: 'شام' }]} /></Box>
            <Stepper label="نفر" value={qty} onChange={setQty} min={1} max={12} />
          </Section>

          <Section id="g-fooddna" title="FoodDnaRing" note="the signature — empty / forming / developing / mature">
            <FoodDnaRing band="empty" size={120} />
            <FoodDnaRing band="forming" size={120} />
            <FoodDnaRing band="developing" size={120} />
            <FoodDnaRing band="mature" size={120} />
          </Section>

          <Section id="g-progress" title="ProgressBar / GamificationStrip / Avatar">
            <Box style={{ inlineSize: 240 }}><ProgressBar value={62} label="پروفایل" /></Box>
            <GamificationStrip streakDays={5} achievement={{ label: 'اولین پخت' }} />
            <GamificationStrip streakState="frozen" />
            <GamificationStrip streakState="broken" />
            <Avatar name="Mehran F" />
            <Avatar name="" size={48} />
          </Section>

          <Section id="g-cards" title="RecipeCard / RecommendationCard">
            <Box style={{ inlineSize: 200 }}><RecommendationCard recipe={demoRecipe} reason="چون سبزیجات تازه دوست داری" onWhy={() => setWhyOpen(true)} /></Box>
          </Section>

          <Section id="g-cook" title="CookStep">
            <Box style={{ inlineSize: '100%' }}>
              <CookStep stepNumber={2} totalSteps={5} text="پیاز را با حرارت ملایم تفت بده تا طلایی شود." ingredientRefs={[{ id: 'a', label: 'پیاز' }, { id: 'b', label: 'روغن' }]} timer={<TimerChip label="پخت" seconds={600} state="running" onPause={() => {}} />} onNext={() => {}} onPrev={() => {}} />
            </Box>
          </Section>

          <Section id="g-mealslot" title="MealSlotCard" note="empty / AI-suggested (pending-confirm) / filled / locked">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="var(--g-space-3)" style={{ inlineSize: '100%' }}>
              <MealSlotCard dayLabel="دوشنبه" mealLabel="شام" state="empty" onAdd={() => {}} onAskAi={() => {}} />
              <MealSlotCard dayLabel="سه‌شنبه" mealLabel="شام" state="suggested" recipeTitle="عدس‌پلو" confidence="high" onConfirm={() => {}} onDecline={() => {}} onWhy={() => setWhyOpen(true)} />
              <MealSlotCard dayLabel="چهارشنبه" mealLabel="ناهار" state="filled" recipeTitle="کوکوسبزی" onClear={() => {}} />
              <MealSlotCard dayLabel="پنجشنبه" mealLabel="شام" state="locked" recipeTitle="قیمه" />
            </SimpleGrid>
          </Section>

          <Section id="g-grocery" title="GroceryRow / MergeChip">
            <Box style={{ inlineSize: '100%' }}>
              <GroceryRow name="گوجه‌فرنگی" qty="۴ عدد" checked={checked} onToggle={setChecked} onHaveIt={() => {}} mergeChip={<MergeChip count={2} sources={[{ recipe: 'سالاد', qty: '۲ عدد' }, { recipe: 'خورش', qty: '۲ عدد' }]} expanded={merge} onToggle={setMerge} />} />
            </Box>
          </Section>

          <Section id="g-notif" title="NotificationRow" note="unread / read / suppressed">
            <Box style={{ inlineSize: '100%' }}>
              <Stack style={{ gap: 'var(--g-space-2)', inlineSize: '100%' }}>
                <NotificationRow title="پیشنهاد امشب آماده‌ست" body="یک گزینهٔ سریع برای شام" timestamp="۲ دقیقه" state="unread" icon={<IconBell size={18} />} actionLabel="ببین" onAction={() => {}} onOpen={() => {}} />
                <NotificationRow title="لیست خرید به‌روزرسانی شد" body="۳ قلم اضافه شد" timestamp="دیروز" state="read" onOpen={() => {}} />
                <NotificationRow state="suppressed" />
              </Stack>
            </Box>
          </Section>

          <Section id="g-prefs" title="PreferenceMemoryRow" note="stated / inferred">
            <Box style={{ inlineSize: '100%' }}>
              <Stack style={{ gap: 'var(--g-space-2)', inlineSize: '100%' }}>
                <PreferenceMemoryRow belief="گشنیز را دوست ندارد" source="stated" onEdit={() => {}} onDelete={() => {}} />
                <PreferenceMemoryRow belief="غذاهای تند را ترجیح می‌دهد" source="inferred" onEdit={() => {}} onDelete={() => {}} />
              </Stack>
            </Box>
          </Section>

          <Section id="g-onboard" title="FoodDnaStepCard / WeeklyFoodStoryCard">
            <Box style={{ inlineSize: 360, maxInlineSize: '100%' }}>
              <FoodDnaStepCard stepNumber={3} totalSteps={8} question="کدام طعم‌ها را بیشتر دوست داری؟" onNext={() => {}} onSkip={() => {}}>
                <Group gap="var(--g-space-2)" wrap="wrap">
                  <Chip label="ترش" selected onClick={() => {}} />
                  <Chip label="تند" onClick={() => {}} />
                  <Chip label="شیرین" onClick={() => {}} />
                </Group>
              </FoodDnaStepCard>
            </Box>
            <Box style={{ inlineSize: 320, maxInlineSize: '100%' }}>
              <WeeklyFoodStoryCard stat="۵ وعده" statLabel="این هفته پختی" onView={() => {}} />
            </Box>
          </Section>

          <Section id="g-ai" title="AIWhisper / AICompanion" note="disclosure + kind refusal">
            <Box style={{ inlineSize: 320, maxInlineSize: '100%' }}>
              <AIWhisper text="می‌تونی امشب عدسی درست کنی؟" reason="چون مواد لازمش رو داری" onAccept={() => {}} onDismiss={() => {}} />
            </Box>
            <Box style={{ inlineSize: 320, maxInlineSize: '100%', blockSize: 320, border: '1px solid var(--g-color-border-subtle)', borderRadius: 'var(--g-radius-card)', overflow: 'hidden' }}>
              <AICompanion messages={[{ id: 1, role: 'user', content: 'یه شام سریع پیشنهاد بده' }, { id: 2, role: 'assistant', content: 'املت گوجه چطوره؟ ۱۰ دقیقه آماده می‌شه.' }]} onSend={() => {}} onFeedback={() => {}} />
            </Box>
          </Section>

          <Section id="g-states" title="EmptyState / ErrorState / LoadingSkeleton">
            <Box style={{ inlineSize: 280 }}><EmptyState title="هنوز چیزی نیست" message="اولین رسپی‌ت رو اضافه کن." actionLabel="افزودن" onAction={() => {}} /></Box>
            <Box style={{ inlineSize: 280 }}><ErrorState onRetry={() => {}} /></Box>
            <Box style={{ inlineSize: 280 }}><LoadingSkeleton shape="card" lines={2} /></Box>
          </Section>

          <Section id="g-sheets" title="Sheets" note="BottomSheet / WhySheet / AISheet (open to preview)">
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>Open BottomSheet</Button>
            <Button variant="secondary" onClick={() => setWhyOpen(true)}>Open WhySheet</Button>
            <Button variant="secondary" onClick={() => setAiOpen(true)}>Open AISheet</Button>
          </Section>

          <Section id="g-shelf" title="ActionShelf (fixed — previewed in a bounded frame)">
            <FixedPreview height={100}>
              <ActionShelf primary={<Button fullWidth>ذخیره</Button>} secondary={[<Button key="s" variant="secondary">لغو</Button>]} />
            </FixedPreview>
          </Section>

          <Section id="g-nav" title="BottomNav (5 tabs, RTL — bounded preview)">
            <FixedPreview height={88}>
              <BottomNav items={navItems} value={tab} onChange={setTab} />
            </FixedPreview>
          </Section>
        </Stack>
      </Box>

      <BottomSheet opened={sheetOpen} onClose={() => setSheetOpen(false)} title="نمونهٔ شیت">
        <Text style={{ color: 'var(--g-color-text-secondary)' }}>محتوای شیت اینجاست. با لمس بیرون یا ESC بسته می‌شود.</Text>
      </BottomSheet>
      <WhySheet opened={whyOpen} onClose={() => setWhyOpen(false)} state="reasons" reasons={['با سلیقهٔ تو هم‌خوانی دارد', 'مواد لازمش را داری', 'سریع آماده می‌شود']} onCorrect={() => {}} />
      <AISheet opened={aiOpen} onClose={() => setAiOpen(false)} contextLabel="قورمه‌سبزی" state="answer">
        <Text>این یک پاسخ نمونه است که با رعایت ایمنی فیلتر شده.</Text>
      </AISheet>
    </Box>
  );
}
