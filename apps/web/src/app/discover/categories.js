/* Discovery browse facets — taken from the mockup (Garnish Discovery.dc.html).
   Tapping a facet runs a real search for its `term` (no fabricated category routing). */
import { IconSunrise, IconSun, IconMoon, IconCake, IconBowlSpoon, IconSalad, IconSoup, IconPlant2 } from '@tabler/icons-react';

// «دستهٔ وعده» — meal-type chips
export const MEAL_CHIPS = [
  { label: 'صبحانه', term: 'صبحانه', Icon: IconSunrise },
  { label: 'ناهار', term: 'ناهار', Icon: IconSun },
  { label: 'شام', term: 'شام', Icon: IconMoon },
  { label: 'دسر', term: 'دسر', Icon: IconCake },
];

// «دستهٔ غذا» — cuisine/type tiles (warm token tones, never a gray gradient)
export const FOOD_TILES = [
  { label: 'ایرانی', term: 'ایرانی', Icon: IconBowlSpoon, bg: 'var(--g-color-brand-50)', fg: 'var(--g-color-brand-700)' },
  { label: 'سالاد', term: 'سالاد', Icon: IconSalad, bg: 'var(--g-color-state-success-bg)', fg: 'var(--g-color-state-success-fg)' },
  { label: 'سوپ و آش', term: 'آش', Icon: IconSoup, bg: 'var(--g-color-state-warning-bg)', fg: 'var(--g-color-state-warning-fg)' },
  { label: 'گیاهی', term: 'گیاهی', Icon: IconPlant2, bg: 'var(--g-color-brand-50)', fg: 'var(--g-color-brand-700)' },
];

// unmetSearch suggestion chips — alternatives offered instead of a dead end
export const UNMET_SUGGESTIONS = ['غذای ژاپنی', 'برنجِ سبک', 'ماهی'];

// quick result filters (client-side refine over the real search results)
export const QUICK_FILTERS = [
  { id: 'under60', label: 'زیر ۱ ساعت' },
  { id: 'quick', label: 'سریع (زیر ۳۰ دقیقه)' },
  { id: 'veg', label: 'گیاهی' },
];
