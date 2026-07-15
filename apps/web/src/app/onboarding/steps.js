import {
  IconMeat,
  IconLeaf,
  IconCarrot,
  IconPlant2,
  IconClockBolt,
  IconClock,
  IconMeatOff,
} from '@tabler/icons-react';

/**
 * Onboarding V2 option registry.
 *
 * IDs intentionally mirror the typed backend contract. Keep labels here so the
 * review screen and Settings render the same language for the same value.
 */
export const PATTERN_OPTIONS = [
  { id: 'omnivore', label: 'همه‌چیزخوار', description: 'گوشت، ماهی و غذاهای گیاهی', Icon: IconMeat },
  { id: 'flexitarian', label: 'گیاه‌محور', description: 'بیشتر گیاهی، گاهی گوشت یا ماهی', Icon: IconLeaf },
  { id: 'vegetarian', label: 'گیاه‌خوار', description: 'بدون گوشت و ماهی', Icon: IconCarrot },
  { id: 'vegan', label: 'وگان', description: 'بدون فرآورده‌های حیوانی', Icon: IconPlant2 },
];

// EU-14 declarable allergens. Molluscs are folded into the shellfish token by
// the canonical server extractor, therefore 13 UI values cover the full set.
export const ALLERGEN_OPTIONS = [
  { id: 'gluten', label: 'غلاتِ دارای گلوتن' },
  { id: 'dairy', label: 'شیر و لبنیات' },
  { id: 'egg', label: 'تخم‌مرغ' },
  { id: 'nut', label: 'آجیل و مغزها' },
  { id: 'peanut', label: 'بادام‌زمینی' },
  { id: 'shellfish', label: 'صدف و سخت‌پوستان' },
  { id: 'fish', label: 'ماهی' },
  { id: 'soy', label: 'سویا' },
  { id: 'sesame', label: 'کنجد' },
  { id: 'mustard', label: 'خردل' },
  { id: 'celery', label: 'کرفس' },
  { id: 'lupin', label: 'لوپین' },
  { id: 'sulphites', label: 'سولفیت' },
];

// Runtime safety audit (2026-07-14): these are the only tokens whose recipe
// corpus coverage is currently sufficient for a fail-closed onboarding claim.
// Keep the full canonical registry above for Settings/drift checks, but never
// collect unsupported declarations in V2 until backend coverage is certified.
const ONBOARDING_SUPPORTED_ALLERGEN_IDS = new Set([
  'gluten', 'dairy', 'egg', 'nut', 'peanut', 'shellfish',
  'fish', 'soy', 'sesame', 'mustard', 'celery',
]);

export const ONBOARDING_ALLERGEN_OPTIONS = ALLERGEN_OPTIONS.filter((option) =>
  ONBOARDING_SUPPORTED_ALLERGEN_IDS.has(option.id));

export const DIETARY_RULE_OPTIONS = [
  { id: 'no_pork', label: 'گوشت خوک نمی‌خورم', description: 'غذاهای دارای گوشت خوک نمایش داده نشوند', Icon: IconMeatOff },
];

export const COOKTIME_OPTIONS = [
  { id: 'under_15', label: 'کمتر از ۱۵ دقیقه', description: 'برای روزهای خیلی شلوغ', Icon: IconClockBolt },
  { id: '15_30', label: '۱۵ تا ۳۰ دقیقه', description: 'سریع و مناسب روزهای معمولی', Icon: IconClock },
  { id: '30_60', label: '۳۰ تا ۶۰ دقیقه', description: 'برای آشپزی با حوصله‌تر', Icon: IconClock },
  { id: '60_plus', label: 'بیشتر از یک ساعت', description: 'برای آشپزی مفصل و باحوصله', Icon: IconClock },
];

export const COOKS_FOR_OPTIONS = [
  { id: '1', label: '۱ نفر' },
  { id: '2', label: '۲ نفر' },
  { id: '3_4', label: '۳ تا ۴ نفر' },
  { id: '5_plus', label: '۵ نفر یا بیشتر' },
];

export const STEP_META = {
  2: { key: 'safety', index: 1, title: 'ایمنی غذایی' },
  3: { key: 'preferences', index: 2, title: 'الگوی غذایی' },
  4: { key: 'preferences', index: 3, title: 'زمان آشپزی' },
  5: { key: 'taste', index: 4, title: 'کالیبراسیون ذائقه', optional: true },
};

export const QUESTION_STEP_TOTAL = 4;

export const optionLabel = (options, id, fallback = 'ثبت نشده') =>
  options.find((option) => option.id === id)?.label || fallback;

export const allergenLabels = (ids = []) =>
  ids.map((id) => optionLabel(ALLERGEN_OPTIONS, id, id));
