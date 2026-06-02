export const UNITS = ['کیلوگرم', 'گرم', 'عدد', 'بسته', 'بطری', 'شیشه', 'پاکت', 'لیوان', 'قاشق', 'پیمانه', 'حبه', 'ورق', 'کارتن'];

export const LIST_TYPES = [
  { value: 'daily', label: '🛒 روزمره', description: 'مقادیر عادی' },
  { value: 'party', label: '🎉 مهمانی', description: 'مقادیر ۴-۸ برابر' },
  { value: 'bulk', label: '📦 عمده', description: 'مقادیر بزرگ و کنسروی' },
];

export const PARTY_MULTIPLIER = 5;
export const BULK_MULTIPLIER = 10;

export function normalize(text) {
  if (!text) return '';
  return text.replace(/\u200c/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
}

export function loadFromStorage(key, fallback = '[]') {
  try { return JSON.parse(localStorage.getItem(key) || fallback); }
  catch { return JSON.parse(fallback); }
}

export function saveToStorage(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}