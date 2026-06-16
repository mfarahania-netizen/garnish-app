// GES — Persian numeral formatting. Canonical data stays Latin; fa display uses Persian digits.
const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const toFaDigits = (value) => String(value ?? '').replace(/[0-9]/g, (d) => FA_DIGITS[+d]);

export const faPercent = (n) => `${toFaDigits(Math.round(Number(n) || 0))}٪`;

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
