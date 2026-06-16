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

// allergen token -> Persian (for the demoted-not-hidden safety banner)
const ALLERGEN_LABELS = {
  gluten: 'گلوتن', wheat: 'گندم', dairy: 'لبنیات', milk: 'شیر', lactose: 'لاکتوز',
  egg: 'تخم‌مرغ', eggs: 'تخم‌مرغ', nut: 'آجیل', nuts: 'آجیل', tree_nut: 'آجیل', peanut: 'بادام‌زمینی',
  soy: 'سویا', soya: 'سویا', sesame: 'کنجد', fish: 'ماهی', shellfish: 'صدف', seafood: 'غذای دریایی',
  mustard: 'خردل', celery: 'کرفس', honey: 'عسل',
};
export const faAllergen = (a) => ALLERGEN_LABELS[String(a || '').toLowerCase()] || a;
