// Honest "why this?" localization. The recommendation API returns matchedSignals as raw
// machine tokens (e.g. 'likes_chicken') and a prose `explanation` in ENGLISH. We NEVER render
// the English explanation or a raw token to the (Persian) user. Instead we map known signal
// tokens to calm Persian labels; unknown tokens are dropped. If nothing maps, callers fall back
// to a generic disclosed line — reasons are always REAL (from matchedSignals), never decorative.
const SIGNAL_LABELS = {
  likes_chicken: 'مرغ',
  likes_beef: 'گوشت',
  likes_seafood: 'غذای دریایی',
  likes_cheese: 'پنیر',
  likes_eggplant: 'بادمجان',
  likes_mushroom: 'قارچ',
  likes_spicy: 'تند',
  likes_healthy: 'سالم',
  health_conscious: 'سالم',
  health_consciousness: 'سالم',
  likes_high_protein: 'پرپروتئین',
  likes_vegetarian: 'گیاهی',
  plant_based: 'گیاهی',
  likes_grilled: 'کبابی',
  likes_grilled_food: 'کبابی',
  likes_fried: 'سرخ‌کردنی',
  likes_baked: 'غذای فر',
  likes_steamed: 'بخارپز',
  likes_stew: 'خورشتی',
  likes_one_pot: 'یک‌قابلمه‌ای',
  likes_no_cook: 'بدون‌پخت',
  likes_quick_meals: 'سریع',
  likes_fast_meals: 'سریع',
  likes_family_meals: 'خانوادگی',
  likes_weekend_cooking: 'آخر هفته',
  likes_italian: 'ایتالیایی',
  likes_asian: 'آسیایی',
  likes_middle_eastern: 'خاورمیانه‌ای',
  likes_budget_meals: 'کم‌هزینه',
  budget_sensitive: 'کم‌هزینه',
  budget_sensitivity: 'کم‌هزینه',
  budget: 'کم‌هزینه',
  comfort_food_lover: 'دلچسب',
  comfort: 'دلچسب',
  comfortable: 'دلچسب',
  novelty: 'تازگی',
  novelty_boost: 'تازگی',
  novelty_fit: 'تازگی',
  novelty_friendly: 'تازگی',
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

// Honest fit from finalScore (0..1). We only surface the positive earned badge; if a pick isn't
// a strong match we show no badge rather than inventing a fit. There is no server `great_fit` flag.
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
