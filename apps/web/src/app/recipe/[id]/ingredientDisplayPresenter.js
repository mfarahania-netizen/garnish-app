const SECTION_ORDER = [
  'مواد اصلی',
  'چاشنی‌ها و ادویه‌ها',
  'برای مواد میانی',
  'برای خمیر',
  'برای مرینیت',
  'برای سس',
  'برای سرخ‌کردن',
  'برای ته‌دیگ',
  'برای رومال',
  'برای سرو',
];

const GENERIC_DETAIL_PATTERNS = [
  /واسط\s+حرارت/,
  /نقطه\s+دود/,
  /تازه\s+انتخاب/,
  /سالم\s+انتخاب/,
  /کیفیت\s+بهتر/,
  /طعم\s+بهتر/,
  /استخراج\s+طعم/,
  /هویت\s+غذا/,
  /حذف\s+نشود/,
  /مواد\s+تازه/,
  /پایه\s+طعم/,
];

const USEFUL_DETAIL_PATTERNS = [
  /تلخ/,
  /نبرد/,
  /نبر[د|ی]/,
  /نریزد/,
  /وا\s+نرود/,
  /لطافت/,
  /بو/,
  /دودی/,
  /ترد/,
  /خامه/,
  /غلظت/,
  /بافت/,
  /اشتباه/,
  /جایگزین/,
  /اختیاری/,
  /کم‌کم/,
  /کم کم/,
  /آخر/,
  /له\s+نشود/,
];

const OIL_TERMS = ['روغن', 'کره', 'دنبه', 'چربی'];
const SALT_SPICE_TERMS = ['نمک', 'فلفل', 'زردچوبه', 'دارچین', 'ادویه', 'زعفران', 'سماق', 'زیره', 'پاپریکا'];
const LIQUID_TERMS = ['آبلیمو', 'آبغوره', 'سرکه'];
const BASE_TERMS = ['پیاز', 'سیر'];

const normalize = (value) => String(value ?? '')
  .replace(/\u200c/g, ' ')
  .replace(/[ي]/g, 'ی')
  .replace(/[ك]/g, 'ک')
  .replace(/\s+/g, ' ')
  .trim();

function stripDisplayIds(text) {
  return String(text ?? '')
    .replace(/\s*با\s+ing_[a-z0-9_]+/gi, '')
    .replace(/\s*[—–-]?\s*ing_[a-z0-9_]+/gi, '')
    .replace(/\s*\(\s*اصلاح[^)]*\)/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const cleanText = (value) => stripDisplayIds(String(value ?? '')).replace(/\s+/g, ' ').trim();

const includesAny = (text, terms) => terms.some((term) => text.includes(normalize(term)));

function isUsefulDetail(text) {
  const clean = normalize(text);
  if (!clean) return false;
  if (GENERIC_DETAIL_PATTERNS.some((pattern) => pattern.test(clean))) return false;
  return USEFUL_DETAIL_PATTERNS.some((pattern) => pattern.test(clean)) || clean.length <= 90;
}

function canonicalSection(ingredient) {
  const rawGroup = normalize(ingredient.component || ingredient.group || ingredient.section || ingredient.category || ingredient.role);
  const name = normalize(ingredient.name || ingredient.displayName);
  const combined = `${rawGroup} ${name}`;

  if (/مرینیت|ماریناد|marinad/.test(combined)) return 'برای مرینیت';
  if (/رومال|egg wash/.test(combined)) return 'برای رومال';
  if (/ته\s?دیگ/.test(combined)) return 'برای ته‌دیگ';
  if (/مواد\s+میانی|فیلینگ|داخل/.test(combined)) return 'برای مواد میانی';
  if (/خمیر|dough/.test(combined)) return 'برای خمیر';
  if (/سس|sauce/.test(combined)) return 'برای سس';
  if (/سرو|تزئین|تزیین|روی\s+غذا|garnish|serv/.test(combined)) return 'برای سرو';

  if (/سرخ/.test(rawGroup) && !isOrdinaryPantryItem(name)) return 'برای سرخ‌کردن';
  if (includesAny(name, SALT_SPICE_TERMS)) return 'چاشنی‌ها و ادویه‌ها';
  if (includesAny(name, OIL_TERMS) || includesAny(name, LIQUID_TERMS)) return 'چاشنی‌ها و ادویه‌ها';

  return 'مواد اصلی';
}

function isOrdinaryPantryItem(nameOrIngredient) {
  const name = normalize(typeof nameOrIngredient === 'string' ? nameOrIngredient : nameOrIngredient?.name);
  return includesAny(name, [...OIL_TERMS, ...SALT_SPICE_TERMS, ...LIQUID_TERMS, ...BASE_TERMS]);
}

function amountText(ingredient) {
  if (ingredient.amountText) return cleanText(ingredient.amountText);
  if (ingredient.volume) return cleanText(ingredient.volume);
  const amount = ingredient.amount ?? ingredient.quantity;
  const unit = ingredient.displayUnit || ingredient.unit;
  const parts = [amount, unit].filter((part) => part != null && String(part).trim() !== '');
  return cleanText(parts.join(' '));
}

function preparationText(ingredient) {
  return cleanText(ingredient.preparation || ingredient.prepState || ingredient.prep || '');
}

function detailText(ingredient) {
  const details = [ingredient.userNote, ingredient.note, ingredient.role, ingredient.buyTip]
    .map(cleanText)
    .filter(Boolean)
    .filter(isUsefulDetail);
  return details[0] || '';
}

function toDisplayItem(ingredient) {
  const name = cleanText(ingredient.displayName || ingredient.name || ingredient.title);
  const detail = detailText(ingredient);
  return {
    name,
    amountText: amountText(ingredient),
    preparationText: preparationText(ingredient),
    userNote: detail,
    showDetail: Boolean(detail),
    detailText: detail,
    source: ingredient,
  };
}

export function presentIngredientSections(ingredients = []) {
  const groups = new Map();
  for (const ingredient of Array.isArray(ingredients) ? ingredients : []) {
    const item = toDisplayItem(ingredient);
    if (!item.name) continue;
    const section = canonicalSection(ingredient);
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push(item);
  }

  const sections = [...groups.entries()]
    .filter(([, items]) => items.length)
    .map(([title, items]) => ({ title, items }))
    .sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a.title);
      const bi = SECTION_ORDER.indexOf(b.title);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi) || a.title.localeCompare(b.title, 'fa');
    });

  return { sections };
}

export const ingredientDisplayPresenterInternals = {
  canonicalSection,
  isUsefulDetail,
};
