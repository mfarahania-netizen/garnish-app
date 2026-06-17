// Honest localization helpers. The recommendation API returns matchedSignals as raw machine
// tokens and prose `explanation`/`reasons` in ENGLISH — we NEVER render the English text or a
// raw token to the (Persian) user. We map known tokens/dimensions to calm Persian; unknown ones
// are dropped. Reasons are always REAL (from the API), never decorative.

// ── recommendation matchedSignals → Persian (used by the picks WhyChip popover) ──
const SIGNAL_LABELS = {
  likes_chicken: 'مرغ', likes_beef: 'گوشت', likes_seafood: 'غذای دریایی', likes_cheese: 'پنیر',
  likes_eggplant: 'بادمجان', likes_mushroom: 'قارچ', likes_spicy: 'تند', likes_healthy: 'سالم',
  health_conscious: 'سالم', health_consciousness: 'سالم', likes_high_protein: 'پرپروتئین',
  likes_vegetarian: 'گیاهی', plant_based: 'گیاهی', likes_grilled: 'کبابی', likes_grilled_food: 'کبابی',
  likes_fried: 'سرخ‌کردنی', likes_baked: 'غذای فر', likes_steamed: 'بخارپز', likes_stew: 'خورشتی',
  likes_one_pot: 'یک‌قابلمه‌ای', likes_no_cook: 'بدون‌پخت', likes_quick_meals: 'سریع',
  likes_fast_meals: 'سریع', likes_family_meals: 'خانوادگی', likes_weekend_cooking: 'آخر هفته',
  likes_italian: 'ایتالیایی', likes_asian: 'آسیایی', likes_middle_eastern: 'خاورمیانه‌ای',
  likes_budget_meals: 'کم‌هزینه', budget_sensitive: 'کم‌هزینه', budget_sensitivity: 'کم‌هزینه',
  budget: 'کم‌هزینه', comfort_food_lover: 'دلچسب', comfort: 'دلچسب', comfortable: 'دلچسب',
  novelty: 'تازگی', novelty_boost: 'تازگی', novelty_fit: 'تازگی', novelty_friendly: 'تازگی',
};

export function reasonLabels(signals = [], max = 3) {
  const seen = new Set();
  const out = [];
  for (const s of signals || []) {
    const label = SIGNAL_LABELS[s];
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
    if (out.length >= max) break;
  }
  return out;
}

// Honest fit from a recommendation finalScore (0..1). Only the earned positive badge is surfaced.
export function fitFromScore(score) {
  return typeof score === 'number' && score >= 0.7 ? 'great' : null;
}

// Food DNA band (from /profile maturity.band) -> Persian headline + ring tone.
export const DNA_BAND = {
  empty: { title: 'بیا ذائقه‌ات رو کشف کنیم', tone: 'forming' },
  forming: { title: 'تازه داریم آشنا می‌شیم', tone: 'forming' },
  developing: { title: 'ذائقه‌ات داره شکل می‌گیره', tone: 'mature' },
  mature: { title: 'ذائقه‌ات رو خوب می‌شناسیم', tone: 'mature' },
};

// ── Food DNA TRAITS — taste/behaviour DIMENSIONS only (never recipe ingredients) ──
// Sourced from the living profile's dimensions, not from recommendation matchedSignals.
const DIMENSION_LABELS = {
  plant_forward: 'گیاه‌محور', plant_based: 'گیاه‌محور', vegetarian: 'گیاه‌خوار', vegan: 'وگن',
  health_conscious: 'سلامت‌محور', health_consciousness: 'سلامت‌محور', healthy: 'سلامت‌محور',
  budget_sensitive: 'صرفه‌جو', budget_sensitivity: 'صرفه‌جو', budget: 'صرفه‌جو',
  spicy: 'تندپسند', spice_lover: 'تندپسند', spice: 'تندپسند',
  quick: 'سریع‌پز', time_poor: 'سریع‌پز', fast: 'سریع‌پز', speed: 'سریع‌پز',
  comfort: 'دلپذیر', comfort_food: 'دلپذیر', comfort_food_lover: 'دلپذیر',
  novelty: 'ماجراجو', variety: 'متنوع‌پسند', adventurous: 'ماجراجو',
  meal_planner: 'برنامه‌ریز', meal_plan: 'برنامه‌ریز', traditional: 'سنتی‌پسند', high_protein: 'پرپروتئین',
};

export function traitsFromProfile(profile, max = 3) {
  if (!profile) return [];
  const keys = [...(profile.observed?.strongestDimensions || [])];
  const dims = profile.declared?.dimensions || {};
  for (const [k, d] of Object.entries(dims)) {
    if (d && d.status === 'declared') keys.push(k);
  }
  const seen = new Set();
  const out = [];
  for (const k of keys) {
    const label = DIMENSION_LABELS[k] || DIMENSION_LABELS[String(k).toLowerCase()];
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
    if (out.length >= max) break;
  }
  return out;
}

// ── Profile DNA breakdown — per-dimension confidence from the REAL reconciled profile (never raw keys) ──
// /profile.reconciled.dimensions is keyed dietary_pattern|effort|skill|allergies (each with a 0..1
// confidence + status). We skip 'allergies' (a safety constraint, not a taste %) and unknown/empty dims,
// and only render dimensions we have a Persian label for — a raw key is NEVER shown.
const DIM_KEY_LABELS = {
  dietary_pattern: 'الگوی غذایی', 'dietary.pattern': 'الگوی غذایی',
  effort: 'زمان و سرعتِ پخت', 'constraints.cooking_time_workday': 'زمان و سرعتِ پخت',
  skill: 'مهارتِ آشپزی', 'constraints.cooking_skill': 'مهارتِ آشپزی',
  budget: 'بودجه', 'constraints.weekly_budget_band': 'بودجه',
  variety: 'تنوعِ آشپزی', spicy: 'تندپسندی',
};
export function dimensionBreakdown(profile, max = 5) {
  const dims = profile?.reconciled?.dimensions || {};
  const rows = [];
  for (const [k, d] of Object.entries(dims)) {
    if (!d || k === 'allergies') continue;
    if (d.status === 'unknown' || d.status === 'empty') continue;
    const label = DIM_KEY_LABELS[k] || DIMENSION_LABELS[k];
    if (!label) continue;
    const c = Math.max(0, Math.min(1, Number(d.confidence) || 0));
    if (c <= 0) continue;
    rows.push({ key: k, label, value: c, band: c >= 0.6 ? 'high' : c >= 0.3 ? 'med' : 'low' });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows.slice(0, max);
}

// ── Honest reconciliation — surface a real declared↔observed divergence (both kept), never invented ──
const RECON_FA = {
  plant_forward: 'گیاه‌محور', plant_based: 'گیاه‌محور', flexitarian: 'گیاه‌محور', vegetarian: 'گیاه‌خوار',
  vegan: 'وگن', pescatarian: 'ماهی‌خوار', omnivore: 'همه‌چیزخوار', meat_inclusive: 'غذای گوشتی',
  mediterranean: 'مدیترانه‌ای', keto: 'کتو', low_carb: 'کم‌کربوهیدرات', halal: 'حلال',
};
export function tasteReconciliation(profile) {
  const dims = profile?.reconciled?.dimensions || {};
  for (const d of Object.values(dims)) {
    if (d?.status === 'declared_observed_conflict' && d.declared && d.observed) {
      const declared = RECON_FA[String(d.declared.value)];
      const observed = RECON_FA[String(d.observed.value)];
      if (declared && observed && declared !== observed) return { specific: true, declared, observed };
    }
  }
  return { specific: false };
}

// ── Recipe Detail: honest fit (built from structured fields, never English reasons) ──
export const FIT_LABEL = {
  great_fit: 'عالی برای تو',
  ok: 'مناسبِ تو',
  caution: 'با کمی ملاحظه',
  avoid_allergen: 'برای ایمنی پایین‌تر نشان داده شد',
};

export function recipeFitReasons(fit, max = 3) {
  if (!fit) return [];
  const out = [];
  if (fit.dietaryMatch === 'match') out.push('هم‌خوان با رژیمت');
  if (fit.effortFit === 'fit') out.push('هم‌اندازهٔ زمانِ معمولت');
  else if (fit.effortFit === 'stretch') out.push('کمی طولانی‌تر از معمولت');
  if (fit.skillFit === 'fit') out.push('در حدِ مهارتت');
  else if (fit.skillFit === 'stretch') out.push('کمی پیشرفته‌تر');
  return out.slice(0, max);
}

// ── Recipe category / course / meal-type / diet enums → Persian (Recipe Detail tags) ──
// The catalog mixes machine enum keys (e.g. "main_course") with already-Persian tags. We map
// every known key to a Persian label; a Persian value passes through; an unknown machine key is
// humanized (snake_case → spaced) so a raw key like "main_course" is NEVER shown verbatim.
const CATEGORY_LABELS = {
  // course
  main_course: 'غذای اصلی', main_dish: 'غذای اصلی', main: 'غذای اصلی', entree: 'غذای اصلی',
  side_dish: 'مخلفات', side: 'مخلفات', appetizer: 'پیش‌غذا', starter: 'پیش‌غذا',
  dessert: 'دسر', sweet: 'شیرینی', drink: 'نوشیدنی', beverage: 'نوشیدنی', smoothie: 'اسموتی',
  soup: 'سوپ', stew: 'خورشت', salad: 'سالاد', bread: 'نان', sauce: 'سس', dip: 'دیپ',
  snack: 'میان‌وعده', condiment: 'چاشنی', pickle: 'ترشی',
  // meal type
  breakfast: 'صبحانه', brunch: 'بنونه', lunch: 'ناهار', dinner: 'شام', supper: 'شام',
  // diet / attributes
  vegetarian: 'گیاهی', vegan: 'وگن', gluten_free: 'بدون گلوتن', dairy_free: 'بدون لبنیات',
  low_carb: 'کم‌کربوهیدرات', keto: 'کتو', high_protein: 'پرپروتئین', low_calorie: 'کم‌کالری',
  healthy: 'سالم', quick: 'سریع', easy: 'آسان', budget: 'کم‌هزینه', kid_friendly: 'مناسب کودک',
  // cuisine
  persian: 'ایرانی', iranian: 'ایرانی', italian: 'ایتالیایی', asian: 'آسیایی',
  middle_eastern: 'خاورمیانه‌ای', mediterranean: 'مدیترانه‌ای', indian: 'هندی', mexican: 'مکزیکی',
};

const humanize = (s) => String(s).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const hasPersian = (s) => /[؀-ۿ]/.test(String(s));

export function faCategory(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+/g, '_');
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  if (hasPersian(raw)) return raw;        // already a Persian tag — keep
  return humanize(raw);                   // unknown machine key — humanize, never show raw snake_case
}

// allergen token -> Persian (for the demoted-not-hidden safety banner)
const ALLERGEN_LABELS = {
  gluten: 'گلوتن', wheat: 'گندم', dairy: 'لبنیات', milk: 'شیر', lactose: 'لاکتوز',
  egg: 'تخم‌مرغ', eggs: 'تخم‌مرغ', nut: 'آجیل', nuts: 'آجیل', tree_nut: 'آجیل', peanut: 'بادام‌زمینی',
  soy: 'سویا', soya: 'سویا', sesame: 'کنجد', fish: 'ماهی', shellfish: 'صدف', seafood: 'غذای دریایی',
  mustard: 'خردل', celery: 'کرفس', honey: 'عسل',
};
export const faAllergen = (a) => ALLERGEN_LABELS[String(a || '').toLowerCase()] || a;
