// GES — Persian numeral formatting. Canonical data stays Latin; fa display uses Persian digits.
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const toFaDigits = (value) => String(value ?? '').replace(/[0-9]/g, (d) => FA_DIGITS[+d]);

export const faPercent = (n) => `${toFaDigits(Math.round(Number(n) || 0))}٪`;

const EN_DIGITS = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

export function parseDurationMinutes(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== 'string') return null;
  const text = value.replace(/[۰-۹٠-٩]/g, (d) => EN_DIGITS[d] ?? d).trim();
  if (!text) return null;
  const direct = Number(text);
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct);
  const nums = [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  const hasHour = /ساعت|hour|hr/i.test(text);
  const hasMinute = /دقیقه|minute|min/i.test(text);
  if (hasHour) {
    const hours = nums[0] || 0;
    const minutes = hasMinute && nums.length > 1 ? nums[1] : 0;
    const total = hours * 60 + minutes;
    return total > 0 ? Math.round(total) : null;
  }
  return nums[0] > 0 ? Math.round(nums[0]) : null;
}

export function recipeDurationMinutes(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  const glance = recipe.gris?.glance ?? {};
  const prep = parseDurationMinutes(recipe.prepTime);
  const cooking = parseDurationMinutes(recipe.cookingTime);
  const candidates = [
    parseDurationMinutes(glance.totalTimeMin),
    parseDurationMinutes(recipe.totalTime),
    prep && cooking ? prep + cooking : null,
    cooking,
    parseDurationMinutes(glance.activeTimeMin),
  ];
  return candidates.find((m) => Number.isFinite(m) && m > 0) ?? null;
}

// Minutes -> calm Persian duration ("۴۵ دقیقه" / "۱ ساعت و ۳۰ دقیقه").
export function faDuration(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m <= 0) return '';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${toFaDigits(rem)} دقیقه`;
  if (rem === 0) return `${toFaDigits(h)} ساعت`;
  return `${toFaDigits(h)} ساعت و ${toFaDigits(rem)} دقیقه`;
}

// Difficulty token -> Persian label.
const DIFFICULTY = {
  easy: 'آسان', beginner: 'آسان', simple: 'آسان',
  medium: 'متوسط', intermediate: 'متوسط', moderate: 'متوسط',
  hard: 'سخت', advanced: 'سخت', expert: 'سخت', difficult: 'سخت',
  آسان: 'آسان', متوسط: 'متوسط', سخت: 'سخت',
};
export const faDifficulty = (d) => DIFFICULTY[String(d || '').toLowerCase()] || DIFFICULTY[d] || '';
