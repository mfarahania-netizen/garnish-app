/* ============================================================
   ONBOARDING — step option datasets + honest derivations.
   Content is taken from the approved mockup (Garnish Onboarding Flow.dc.html).
   Option ids are the canonical values persisted via PUT /users/preferences
   (diet/skillLevel/budget + JSON arrays of allergies/healthGoals). No fabricated data.
   ============================================================ */
import {
  IconBriefcase, IconClock, IconHome, IconCoffee,
  IconUser, IconHeart, IconUsersGroup, IconUsers,
  IconMeat, IconLeaf, IconCarrot, IconPlant2, IconFish, IconSalad, IconEgg, IconChecks,
  IconArrowsShuffle, IconBolt, IconWallet, IconSchool,
  IconSeeding, IconToolsKitchen2, IconChefHat,
  IconCoin, IconCoins, IconCash, IconClockBolt,
} from '@tabler/icons-react';

// STEP 2 — context (routine/time + who + how-many)
export const WORK_OPTIONS = [
  { id: 'desk', label: 'پشت‌میز و پرمشغله', Icon: IconBriefcase },
  { id: 'shift', label: 'شیفتی / نامنظم', Icon: IconClock },
  { id: 'home', label: 'دورکاری / خانه', Icon: IconHome },
  { id: 'free', label: 'وقت آزاد دارم', Icon: IconCoffee },
];

export const HOUSEHOLD_OPTIONS = [
  { id: 'solo', label: 'فقط خودم', Icon: IconUser },
  { id: 'couple', label: 'من و پارتنر', Icon: IconHeart },
  { id: 'family', label: 'خانواده با بچه', Icon: IconUsersGroup },
  { id: 'mates', label: 'هم‌خانه‌ای‌ها', Icon: IconUsers },
];

// STEP 3 — diet pattern + allergens + dislikes
export const PATTERN_OPTIONS = [
  { id: 'omnivore', label: 'همه‌چیزخوار', Icon: IconMeat },
  { id: 'flexitarian', label: 'گیاه‌محور', Icon: IconLeaf },
  { id: 'vegetarian', label: 'گیاه‌خوار', Icon: IconCarrot },
  { id: 'vegan', label: 'وگان', Icon: IconPlant2 },
  { id: 'pescatarian', label: 'ماهی‌خوار', Icon: IconFish },
  { id: 'mediterranean', label: 'مدیترانه‌ای', Icon: IconSalad },
  { id: 'keto', label: 'کتو', Icon: IconEgg },
  { id: 'halal', label: 'حلال', Icon: IconChecks },
];

// EU-14 declarable allergens (FIC 1169/2011 Annex II). 'molluscs' is folded into the shellfish token (the
// extractor + hard gate map molluscs⊆shellfish), so 13 chips cover all 14. Ids MUST equal the server's canonical
// tokens (CANONICAL_ALLERGEN_TOKENS, derived from allergen-extractor.ts) so the hard allergy gate filters them —
// asserted by allergen-options.canon.test in apps/web. sulphites is correct-but-inert until ingredients are tagged.
export const ALLERGEN_OPTIONS = [
  { id: 'gluten', label: 'گلوتن' },
  { id: 'dairy', label: 'لبنیات' },
  { id: 'egg', label: 'تخم‌مرغ' },
  { id: 'nut', label: 'آجیل' },
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

export const DISLIKE_OPTIONS = [
  { id: 'eggplant', label: 'بادمجان' },
  { id: 'liver', label: 'جگر' },
  { id: 'veryspicy', label: 'تندِ زیاد' },
  { id: 'olive', label: 'زیتون' },
  { id: 'mushroom', label: 'قارچ' },
  { id: 'seafood', label: 'غذای دریایی' },
];

// STEP 4 — goals (multi-select; optional) — WELLNESS framing only, no medical goals
export const GOAL_OPTIONS = [
  { id: 'variety', label: 'تنوعِ بیشتر', Icon: IconArrowsShuffle },
  { id: 'energy', label: 'انرژی و تعادل', Icon: IconBolt },
  { id: 'home_cooking', label: 'آشپزی بیشتر در خانه', Icon: IconHome },
  { id: 'time', label: 'صرفه‌جویی در زمان', Icon: IconClock },
  { id: 'budget', label: 'مدیریت بودجه', Icon: IconWallet },
  { id: 'skill', label: 'یادگیری مهارت', Icon: IconSchool },
];

// STEP 5 — skill + budget BAND (never an exact number)
export const SKILL_OPTIONS = [
  { id: 'beginner', label: 'تازه‌کار', Icon: IconSeeding },
  { id: 'intermediate', label: 'متوسط', Icon: IconToolsKitchen2 },
  { id: 'advanced', label: 'حرفه‌ای', Icon: IconChefHat },
];

export const BUDGET_OPTIONS = [
  { id: 'low', label: 'کم', Icon: IconCoin },
  { id: 'mid', label: 'متوسط', Icon: IconCoins },
  { id: 'generous', label: 'دست‌ودل‌باز', Icon: IconCash },
];

// COOKING TIME on a workday — the declared effort lever. ids MUST equal the engine bands
// (constraints.cooking_time_workday: under_15/15_30/30_60/60_plus); under_15+15_30 = "wants quick" → quicker slate.
export const COOKTIME_OPTIONS = [
  { id: 'under_15', label: 'کمتر از ۱۵ دقیقه', Icon: IconClockBolt },
  { id: '15_30', label: '۱۵ تا ۳۰ دقیقه', Icon: IconClock },
  { id: '30_60', label: '۳۰ تا ۶۰ دقیقه', Icon: IconClock },
  { id: '60_plus', label: 'بیشتر از یک ساعت', Icon: IconCoffee },
];

// ── Food DNA reveal traits — derived ONLY from the user's real answers (never invented) ──
const PATTERN_TRAIT = {
  flexitarian: 'گیاه‌محور', vegetarian: 'گیاه‌خوار', vegan: 'وگن', pescatarian: 'ماهی‌محور',
  mediterranean: 'مدیترانه‌ای', keto: 'کم‌کربوهیدرات', halal: 'حلال', omnivore: 'همه‌چیزخوار',
};

export function deriveTraits(state) {
  const out = [];
  const push = (label, Icon) => { if (label && !out.some((t) => t.label === label)) out.push({ label, Icon }); };

  // Derived ONLY from the v1 answers actually collected (diet · workday cooking-time · dislikes) — never invented.
  if (state.pattern && PATTERN_TRAIT[state.pattern]) push(PATTERN_TRAIT[state.pattern], IconLeaf);
  if (state.workdayTime === 'under_15' || state.workdayTime === '15_30') push('سریعِ وسط‌هفته', IconClockBolt);
  else if (state.workdayTime === '60_plus') push('وقت‌دارِ آشپزی', IconCoffee);
  const dislikeCount = state.dislikes ? Object.keys(state.dislikes).length : 0;
  if (dislikeCount) push('سلیقهٔ مشخص', IconChecks);

  return out.slice(0, 3);
}
