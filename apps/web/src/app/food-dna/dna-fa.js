/**
 * dna-fa — Persian-first localization layer for the Food DNA page.
 *
 * The backend behavior engine returns English engineering strings (prompts, options, safeExplanation,
 * trustGuidance, flavorPatternSummary). Per the redesign brief, the page MUST NEVER leak English or jargon.
 * So instead of translating those raw strings, this module DISCARDS them and rebuilds calm Persian copy
 * from the structured, language-neutral fields (band, score, evidenceCount, status, affinities,
 * avoidances, metric keys/numbers). Pure functions, no IO — unit-tested in dna-fa.test.js.
 */
import { toFaDigits } from '../../components/ges/format';

/** One Persian name for the whole page (header + ring caption). The old page mixed three names. */
export const DNA_TITLE_FA = 'شناسهٔ ذائقهٔ تو';

/* ───────────────────── Maturity band → Persian caption + tone ─────────────────────
 * Bands come from the engine maturityFor(): 'empty' | 'forming' | 'developing' | 'mature'.
 * tone drives FoodDnaRing's gradient (forming = soft, mature = saffron). */
export const BAND_FA = {
  empty: { caption: 'تازه شروع شده', tone: 'forming' },
  forming: { caption: 'در حالِ شکل‌گیری', tone: 'forming' },
  developing: { caption: 'در حالِ رشد', tone: 'mature' },
  mature: { caption: 'روشن و پخته', tone: 'mature' },
};
export const bandFa = (band) => BAND_FA[band] || BAND_FA.forming;

/**
 * A calm, evidence-grounded Persian one-liner derived from band + observation count. The raw
 * English `trustGuidance` (e.g. "Profile is developing — reasonable to personalize.") is NEVER used.
 */
export function bandLineFa(band, observationCount = 0) {
  const n = Number(observationCount) || 0;
  const base = (n > 0 ? `بر اساسِ ${toFaDigits(n)} وعدهٔ پخته‌شده، ` : '');
  switch (band) {
    case 'empty':
      return `${base}شناسهٔ ذائقه‌ات تازه شروع شده. چند غذا بپز تا کم‌کم روشن‌تر بشه.`;
    case 'forming':
      return `${base}ذائقه‌ات داره شکل می‌گیره. هر چی بیشتر بپزی، دقیق‌تر می‌شه.`;
    case 'developing':
      return `${base}از آشپزیت، ذائقه‌ات رو فهمیدم. هر وعده این تصویر رو کامل‌تر می‌کنه.`;
    case 'mature':
      return `${base}ذائقه‌ات خیلی روشنه — پیشنهادها رو با اطمینانِ بیشتر می‌دم.`;
    default:
      return `${base}هر چی بیشتر بپزی، ذائقه‌ات رو بهتر می‌شناسم.`;
  }
}

/* ───────────────────── The four dimensions ───────────────────── */
export const DIM_FA = {
  taste: { label: 'ذائقه و طعم', hint: 'چه طعم‌هایی رو بیشتر دوست داری' },
  effort: { label: 'زمان و تلاش', hint: 'چقدر حوصله داری آشپزی کنی' },
  skill: { label: 'مهارتِ آشپزی', hint: 'در چه سطحی هستی' },
  routine: { label: 'روالِ آشپزی', hint: 'کی و چطور آشپزی می‌کنی' },
};
export const dimFa = (key) => DIM_FA[key] || { label: key, hint: '' };

/**
 * Persian explanation for a dimension, built from its status + evidence — NEVER from the engine's
 * English safeExplanation. Only call this when the dimension has signal (status !== 'empty' AND
 * confidence > 0); callers hide silent dimensions instead.
 */
export function dimLineFa(key, status, evidenceCount = 0) {
  const { label } = dimFa(key);
  const n = Number(evidenceCount) || 0;
  const strong = status === 'usable' || status === 'confident';
  const root = (() => {
    switch (key) {
      case 'taste': return strong ? 'از رفتارِ آشپزیت، الگوی طعم‌دوستیت داره روشن می‌شه.' : 'به‌تدریج می‌فهمم چه طعم‌هایی رو بیشتر دوست داری.';
      case 'effort': return strong ? 'می‌بینم چقدر زمان و حوصله برای آشپزی می‌ذاری.' : 'به‌تدریج می‌فهمم چقدر حوصله داری.';
      case 'skill': return strong ? 'سطح مهارتت از روش پختنت پیداست.' : 'با هر بار پختن، مهارتت رو بهتر می‌بینم.';
      case 'routine': return strong ? 'روال هفتگی آشپزیت رو شناختم.' : 'به‌تدریج روال آشپزیت رو می‌شناسم.';
      default: return '';
    }
  })();
  return n > 0 ? `${root} (بر اساسِ ${toFaDigits(n)} نشانه)` : root;
}

/* ───────────────────── Metrics: key → Persian label, value → Persian text ─────────────────────
 * The engine metric values are language-neutral numbers (0..1) or English flavor tokens. We render
 * numbers as calm descriptive text (low/mid/high) instead of bare %, and map known flavor tokens to
 * Persian. Unknown values are dropped (never leak English/jargon). */
export const METRIC_LABEL_FA = {
  flavorPattern: 'طعم‌های پسندیده',
  exploration: 'کنجکاوی در آشپزی',
  repetition: 'تکرارپسندی',
  quickMeal: 'علاقه به غذای سریع',
  lowPrep: 'کم‌زحمت‌پسندی',
  complexReady: 'آمادگی برای دستورهای پیچیده',
  technique: 'اعتماد به تکنیک',
  completionGrowth: 'رشد در تکمیل دستور',
  nextChallenge: 'آمادگی برای چالش بعدی',
  weeklyPlanning: 'برنامه‌ریزی هفتگی',
  mealTiming: 'ریتم وعده‌ها',
  weekendCooking: 'آشپزی آخر هفته',
};

const FLAVOR_FA = {
  smoky: 'دودی', smoke: 'دودی', herby: 'گیاهی', herbal: 'گیاهی',
  spicy: 'تند', hot: 'تند', sweet: 'شیرین', sour: 'ترش',
  savory: 'خوشمزه', umami: 'خوشمزه', rich: 'غنی', tangy: 'ترش‌شیرین',
  earthy: 'خاکی', nutty: 'آجیلی', citrusy: 'مرکباتی', creamy: 'خامه‌ای',
  fresh: 'تازه', roasted: 'تنوری', grilled: 'کبابی', fried: 'سرخ‌شده',
};

function levelFa(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  if (n >= 0.66) return 'زیاد';
  if (n >= 0.33) return 'متوسط';
  return 'کم';
}

/** Format one metric to a short Persian "{label}: {value}" chip, or null if it can't be made Persian. */
export function metricFa(metricKey, value) {
  const label = METRIC_LABEL_FA[metricKey];
  if (!label) return null; // unknown metric → hide (never leak the raw key)
  if (typeof value === 'number' && Number.isFinite(value)) {
    const lvl = levelFa(value);
    return lvl ? `${label}: ${lvl}` : null;
  }
  if (typeof value === 'string') {
    // Flavor tokens like "smoky/herby" — map every token; if any is unknown, drop the whole value.
    const tokens = value.toLowerCase().split(/[/,،|\s]+/).filter(Boolean);
    if (!tokens.length) return null;
    const fa = tokens.map((t) => FLAVOR_FA[t]).filter(Boolean);
    if (fa.length !== tokens.length) return null; // unmapped token → hide rather than leak English
    return `${label}: ${fa.join(' و ')}`;
  }
  return null;
}

/* ───────────────────── Onboarding question options + prompts ─────────────────────
 * The backend returns English prompts and English enum option keys. We map BOTH to Persian. The
 * option KEY is what gets submitted back (kept as-is), but only its Persian label is shown. Unknown
 * options are dropped (never shown as English). */

const OPT_FA = {
  // dietary.pattern
  'dietary.pattern': {
    omnivore: 'همه‌چیزخوار', vegetarian: 'گیاهی با تخم‌مرغ و لبنیات', vegan: 'گیاه‌خوار',
    pescatarian: 'با ماهی', flexitarian: 'انعطاف‌پذیر', mediterranean: 'مدیترانه‌ای',
    keto: 'کتوژنیک', low_carb: 'کم‌کربوهیدرات', paleo: 'پالئو', halal: 'حلال',
    kosher: 'کوشر', custom: 'سفارشی',
  },
  // dietary.cultural_constraints
  'dietary.cultural_constraints': {
    halal: 'حلال', kosher: 'کوشر', no_pork: 'بدون گوشت خوک', no_alcohol: 'بدون الکل',
    no_beef: 'بدون گوشت گاو', fasting_periods: 'روزه و دوره‌های روزه', none: 'هیچ‌کدوم', other: 'چیز دیگه',
  },
  // context.age_range
  'context.age_range': {
    under_18: 'زیر ۱۸', '18_24': '۱۸ تا ۲۴', '25_34': '۲۵ تا ۳۴', '35_44': '۳۵ تا ۴۴',
    '45_54': '۴۵ تا ۵۴', '55_64': '۵۵ تا ۶۴', '65_plus': '۶۵ به بالا', prefer_not: 'ترجیح می‌دم نگم',
  },
  // context.gender
  'context.gender': {
    woman: 'زن', man: 'مرد', nonbinary: 'غیرباینری', self_describe: 'خودم توضیح می‌دم', prefer_not: 'ترجیح می‌دم نگم',
  },
  // context.work_pattern
  'context.work_pattern': {
    office_9_5: 'اداری (۹ تا ۵)', shift_work: 'شیفت‌کار', remote: 'دورکار / خانه',
    student: 'دانشجو', home_maker: 'خانه‌دار', retired: 'بازنشسته', unemployed: 'بدون شغل', other: 'چیز دیگه', prefer_not: 'ترجیح می‌دم نگم',
  },
  // context.income_band
  'context.income_band': {
    low: 'پایین', lower_middle: 'پایین‌متوسط', middle: 'متوسط', upper_middle: 'بالای متوسط', high: 'بالا', prefer_not: 'ترجیح می‌دم نگم',
  },
  // context.household_composition (multi)
  'context.household_composition': {
    just_me: 'فقط خودم', partner: 'همسر / شریک', children: 'بچه‌ها', extended_family: 'خانواده', roommates: 'هم‌خانه', guests_often: 'مهمان',
  },
  // context.cooks_for_count
  'context.cooks_for_count': { '1': '۱ نفر', '2': '۲ نفر', '3_4': '۳–۴ نفر', '5_plus': '۵ نفر یا بیشتر' },
  // context.time_at_home
  'context.time_at_home': { low: 'کم', medium: 'متوسط', high: 'زیاد' },
  // context.exercise_frequency
  'context.exercise_frequency': {
    rarely: 'به‌ندرت', weekly_1_2: 'هفتگی ۱–۲ بار', weekly_3_5: 'هفتگی ۳–۵ بار', daily: 'هر روز', prefer_not: 'ترجیح می‌دم نگم',
  },
  // context.cuisine_style
  'context.cuisine_style': { traditional: 'سنتی', modern: 'مدرن و سریع', both: 'هر دو' },
  // goals.primary (multi)
  'goals.primary': {
    general: 'حالتِ کلی', eat_healthier: 'سالم‌تر غذا بخورم', weight_loss: 'تنظیم وزن',
    muscle_gain: 'عضله‌سازی', more_energy: 'انرژی بیشتر', save_money: 'صرفه‌جویی در هزینه',
    save_time: 'صرفه‌جویی در زمان', learn_cooking: 'آشپزی یاد بگیرم', none: 'هدف خاصی ندارم',
  },
  // history.knowledge_self_rating
  'history.knowledge_self_rating': { beginner: 'مبتدی', some: 'مقداری', confident: 'مطمئن', expert: 'حرفه‌ای' },
  // constraints.weekly_budget_band
  'constraints.weekly_budget_band': { tight: 'محدود', moderate: 'متوسط', comfortable: 'راحت', flexible: 'انعطاف‌پذیر' },
  // constraints.kitchen_equipment (multi)
  'constraints.kitchen_equipment': {
    stovetop: 'گاز', oven: 'فر', microwave: 'مایکروویو', air_fryer: 'سرخ‌کن بدون روغن',
    pressure_cooker: 'زودپز', blender: 'مخلوط‌کن', rice_cooker: 'ابزار برنج', grill: 'زغالی / گریل', minimal: 'حداقلی',
  },
  // constraints.cooking_skill
  'constraints.cooking_skill': { beginner: 'مبتدی', intermediate: 'متوسط', advanced: 'پیشرفته' },
  // constraints.cooking_time_workday / weekend (same bands)
  'constraints.cooking_time_workday': { under_15: 'زیر ۱۵ دقیقه', '15_30': '۱۵ تا ۳۰ دقیقه', '30_60': '۳۰ تا ۶۰ دقیقه', '60_plus': 'بیش از یک ساعت' },
  'constraints.cooking_time_weekend': { under_15: 'زیر ۱۵ دقیقه', '15_30': '۱۵ تا ۳۰ دقیقه', '30_60': '۳۰ تا ۶۰ دقیقه', '60_plus': 'بیش از یک ساعت' },
  // constraints.meal_timing_rhythm
  'constraints.meal_timing_rhythm': {
    three_meals: 'سه وعده', two_meals: 'دو وعده', grazing: 'در طول روز پچ‌پچ', one_big_meal: 'یک وعدهٔ کامل', irregular: 'نامنظم',
  },
};

const PROMPT_FA = {
  'context.age_range': 'تو چه ردهٔ سنی هستی؟ (اختیاری)',
  'context.gender': 'جنسیتت رو چطور توصیف می‌کنی؟ (اختیاری)',
  'context.work_pattern': 'الگوی کاریت معمولاً چطوریه؟',
  'context.income_band': 'کدام بازهٔ درآمدی خانوار به وضعیتت نزدیک‌تره؟ (اختیاری، عدد دقیق لازم نیست)',
  'context.household_composition': 'معمولاً برای چه کسانی آشپزی می‌کنی؟',
  'context.cooks_for_count': 'معمولاً برای چند نفر آشپزی می‌کنی؟',
  'context.time_at_home': 'تقریباً چقدر در طول روز تو خونه هستی؟',
  'context.exercise_frequency': 'چقدر ورزش می‌کنی؟ (اختیاری)',
  'context.cuisine_style': 'بیشتر به آشپزی سنتی میل داری یا مدرن و سریع؟',
  'dietary.pattern': 'الگوی غذایی‌ات رو چطور توصیف می‌کنی؟',
  'dietary.allergies_intolerances': 'حساسیت یا عدم‌تحملی هست که از پیشنهادها دور نگهش داریم؟',
  'dietary.hard_dislikes': 'ماده‌ای هست که اصلاً نخواهی پیشنهاد بشه؟',
  'dietary.cultural_constraints': 'نیاز غذاییِ فرهنگی یا مذهبی خاصی داری؟',
  'goals.primary': 'الان هدف اصلی‌ت با غذا چیه؟',
  'history.dieted_before': 'قبلاً از یک برنامهٔ غذایی خاص پیروی کردی؟',
  'history.researched_nutrition': 'قبلاً دربارهٔ تغذیه مطالعه کردی؟',
  'history.knowledge_self_rating': 'دانش غذا و آشپزیت رو چطور ارزیابی می‌کنی؟',
  'constraints.weekly_budget_band': 'هزینهٔ هفتگی غذا برایت چقدره؟',
  'constraints.kitchen_equipment': 'چه ابزارهای آشپزی داری؟',
  'constraints.cooking_skill': 'مهارت آشپزیت رو چطور ارزیابی می‌کنی؟',
  'constraints.cooking_time_workday': 'روزهای کاری معمولاً چقدر وقت برای آشپزی داری؟',
  'constraints.cooking_time_weekend': 'آخر هفته‌ها معمولاً چقدر وقت برای آشپزی داری؟',
  'constraints.meal_timing_rhythm': 'ریتم وعده‌های غذایی‌ات در طول روز چطوریه؟',
};

/** Persian prompt for a question id; falls back to a calm generic line — never English. */
export function questionPromptFa(question) {
  if (!question) return '';
  const id = question.id || question.dimensionKey;
  const p = PROMPT_FA[id];
  if (p) return p;
  // last resort: a warm generic prompt that never leaks the English backend prompt
  return 'یه سؤال کوتاه دربارهٔ سلیقه‌ات — کمک می‌کنه بهتر بشناسمشت.';
}

/** Map a question's option keys to { key, label }, DROPPING any option we can't Persianize. */
export function questionOptionsFa(question) {
  if (!question || !Array.isArray(question.options)) return [];
  const id = question.id || question.dimensionKey;
  const map = OPT_FA[id] || {};
  const out = [];
  for (const raw of question.options) {
    const key = String(raw);
    const label = map[key];
    if (label) out.push({ key, label });
  }
  return out;
}

/* ───────────────────── Top-of-page Persian summary ─────────────────────
 * Synthesize ONE sentence from the dimension signals (Persian only). Returns '' when too little. */
export function summaryFa(dimensions = []) {
  const parts = [];
  for (const d of dimensions || []) {
    if (!d || !(d.confidence > 0)) continue;
    if (d.key === 'taste') {
      const m = (d.metrics || []).find((x) => x.key === 'flavorPattern');
      if (m && typeof m.value === 'string') {
        const fa = metricFa('flavorPattern', m.value);
        if (fa) parts.push(`به طعم‌های ${fa.replace(/^.*:\s*/, '')} گرایش داری`);
      }
    } else if (d.key === 'effort') {
      const m = (d.metrics || []).find((x) => x.key === 'quickMeal');
      if (m && typeof m.value === 'number' && m.value >= 0.5) parts.push('بیشتر غذای سریع می‌پزی');
    } else if (d.key === 'routine') {
      const m = (d.metrics || []).find((x) => x.key === 'weekendCooking');
      if (m && typeof m.value === 'number' && m.value >= 0.5) parts.push('آخر هفته‌ها بیشتر آشپزی می‌کنی');
    }
  }
  if (parts.length === 0) return '';
  return parts.join('، ') + '.';
}
