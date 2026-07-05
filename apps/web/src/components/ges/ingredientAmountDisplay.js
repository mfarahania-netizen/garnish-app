import { toFaDigits } from './format';

const UNIT_LABELS = {
  g: 'گرم',
  gram: 'گرم',
  grams: 'گرم',
  kg: 'کیلوگرم',
  ml: 'میلی‌لیتر',
  l: 'لیتر',
  tbsp: 'قاشق غذاخوری',
  tablespoon: 'قاشق غذاخوری',
  tsp: 'قاشق چای‌خوری',
  teaspoon: 'قاشق چای‌خوری',
  cup: 'پیمانه',
  clove: 'حبه',
  cloves: 'حبه',
  piece: 'عدد',
  pieces: 'عدد',
  unit: 'عدد',
  pcs: 'عدد',
};

const FA_TO_EN = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

const VULGAR = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, 'Â½': 0.5, 'Â¼': 0.25, 'Â¾': 0.75 };

function toLatinDigits(value) {
  return String(value ?? '').replace(/[۰-۹٠-٩]/g, (d) => FA_TO_EN[d] ?? d).replace(/٫/g, '.');
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\bgrams?\b/gi, 'گرم')
    .replace(/\bkg\b/gi, 'کیلوگرم')
    .replace(/\bml\b/gi, 'میلی‌لیتر')
    .replace(/\bl\b/gi, 'لیتر')
    .replace(/\bg\b/gi, 'گرم')
    .replace(/\s*(?:·|Â·)\s*/g, ' ')
    .trim();
}

function parseLeadingAmount(text) {
  const raw = toLatinDigits(text).trim();
  const wholeVulgar = raw.match(/^(\d+)\s*(Â½|Â¼|Â¾|[½¼¾⅓⅔])/);
  if (wholeVulgar) return { value: Number(wholeVulgar[1]) + VULGAR[wholeVulgar[2]], rest: raw.slice(wholeVulgar[0].length).trim() };
  const vulgar = raw.match(/^(Â½|Â¼|Â¾|[½¼¾⅓⅔])/);
  if (vulgar) return { value: VULGAR[vulgar[1]], rest: raw.slice(vulgar[0].length).trim() };
  const frac = raw.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac && Number(frac[2])) return { value: Number(frac[1]) / Number(frac[2]), rest: raw.slice(frac[0].length).trim() };
  const num = raw.match(/^\d+(?:\.\d+)?/);
  if (num) return { value: Number(num[0]), rest: raw.slice(num[0].length).trim() };
  return { value: null, rest: raw };
}

function roundTo(value, step) {
  return Math.round(value / step) * step;
}

function changedMeaningfully(exact, rounded) {
  return Math.abs(Number(exact) - Number(rounded)) > 0.01;
}

function formatNumber(value) {
  return toFaDigits(Number.isInteger(value) ? String(value) : String(value).replace('.', '٫'));
}

function formatRange(a, b, unitTail = '') {
  return `${toFaDigits(a)} تا ${toFaDigits(b)}${unitTail ? ` ${unitTail}` : ''}`;
}

function formatQuarterFraction(value) {
  const rounded = Math.round(value * 4) / 4;
  const whole = Math.floor(rounded);
  const frac = Math.round((rounded - whole) * 4) / 4;
  const fracLabel = frac === 0.25 ? 'یک‌چهارم' : frac === 0.5 ? 'نیم' : frac === 0.75 ? 'سه‌چهارم' : '';
  if (!whole && fracLabel) return fracLabel;
  if (whole && fracLabel) return `${toFaDigits(whole)} و ${fracLabel}`;
  return toFaDigits(Math.max(whole, 1));
}

function unitType(text, explicitUnit = '') {
  const unit = `${explicitUnit} ${text}`.toLowerCase();
  if (/قاشق غذاخوری|tbsp|tablespoon/.test(unit)) return 'spoon_tbsp';
  if (/قاشق چای|tsp|teaspoon/.test(unit)) return 'spoon_tsp';
  if (/پیمانه|cup/.test(unit)) return 'cup';
  if (/میلی‌?لیتر|ml\b/.test(unit)) return 'volume';
  if (/کیلوگرم|گرم|kg\b|g\b|grams?/.test(unit)) return 'weight';
  if (/حبه|عدد|برگ|دانه|چوب|تکه|piece|clove|unit|pcs/.test(unit)) return 'count';
  return 'unknown';
}

function countBehavior(name = '', tail = '') {
  const text = `${name} ${tail}`;
  if (/تخم|تخم‌مرغ|egg|لیمو عمانی|برگ بو|bay leaf|چوب دارچین|دارچین|cinnamon stick|حبه سیر|سیر/.test(text)) return 'indivisible';
  if (/پیاز|onion|لیمو|lime|lemon|سیب‌زمینی|potato|هویج|carrot|بادمجان|eggplant|فلفل|pepper|گوجه|tomato/.test(text)) return 'divisible';
  if (/برگ|سبزی|نعناع|ریحان|جعفری|گشنیز|herb|mint|basil|parsley|cilantro/.test(text)) return 'garnish';
  return 'indivisible';
}

function formatWeight(value, tail = 'گرم') {
  const abs = Math.abs(value);
  let step = 1;
  if (abs >= 500) step = 10;
  else if (abs >= 100) step = 10;
  else if (abs >= 10) step = 5;
  const rounded = roundTo(value, step);
  const prefix = changedMeaningfully(value, rounded) ? 'حدود ' : '';
  return `${prefix}${formatNumber(rounded)} ${tail.includes('کیلو') ? 'کیلوگرم' : 'گرم'}`;
}

function formatVolume(value, tail = 'میلی‌لیتر') {
  const rounded = roundTo(value, value >= 100 ? 5 : 5);
  const prefix = changedMeaningfully(value, rounded) ? 'حدود ' : '';
  return `${prefix}${formatNumber(rounded)} ${tail || 'میلی‌لیتر'}`;
}

function formatSpoonOrCup(value, tail, approxWhenAwkward = true) {
  const rounded = Math.round(value * 4) / 4;
  const prefix = approxWhenAwkward && Math.abs(value - rounded) > 0.08 ? 'حدود ' : '';
  return `${prefix}${formatQuarterFraction(rounded)} ${tail}`.trim();
}

function formatCount(value, tail, name) {
  const behavior = countBehavior(name, tail);
  if (behavior === 'garnish') {
    if (value <= 1) return `۱ ${tail || 'برگ'}`.trim();
    const rounded = Math.max(1, Math.round(value));
    return `${toFaDigits(rounded)} ${tail}`.trim();
  }
  if (behavior === 'divisible') {
    const frac = value - Math.floor(value);
    if (Math.abs(frac - 0.5) < 0.04 && /پیاز|onion/.test(`${name} ${tail}`)) return `${formatQuarterFraction(value)} ${tail}`.trim();
    if (Math.abs(frac - 0.5) < 0.08 && value >= 2) return formatRange(Math.floor(value), Math.ceil(value), tail);
    return `${formatQuarterFraction(value)} ${tail}`.trim();
  }
  const frac = value - Math.floor(value);
  if (Math.abs(frac - 0.5) < 0.08 && value >= 2) return formatRange(Math.floor(value), Math.ceil(value), tail);
  return `${toFaDigits(Math.max(1, Math.round(value)))} ${tail}`.trim();
}

export function classifyIngredientAmount({ text = '', unit = '', name = '' } = {}) {
  const type = unitType(text, unit);
  return {
    unitType: type === 'spoon_tbsp' || type === 'spoon_tsp' ? 'spoon' : type,
    countBehavior: type === 'count' ? countBehavior(name, text) : 'not_applicable',
    precisionMode: /خمیر|نان|کیک|شیرینی|croissant|dough|pastry|baking/i.test(name) ? 'baking_precise' : 'normal',
  };
}

export function practicalScaleAmountText(amountText, factor = 1, context = {}) {
  const raw = normalizeText(amountText);
  if (!raw) return '';
  const { value, rest } = parseLeadingAmount(raw);
  if (!Number.isFinite(value) || value <= 0) return raw;
  if (Math.abs((Number(factor) || 1) - 1) < 1e-9 && !/[0-9.٫/½¼¾⅓⅔Â]/.test(raw)) return raw;
  const scaled = value * (Number(factor) || 1);
  const type = unitType(raw, context.unit);
  if (type === 'weight') return formatWeight(scaled, rest || 'گرم');
  if (type === 'volume') return formatVolume(scaled, rest || 'میلی‌لیتر');
  if (type === 'spoon_tbsp') return formatSpoonOrCup(scaled, 'قاشق غذاخوری');
  if (type === 'spoon_tsp') return formatSpoonOrCup(scaled, 'قاشق چای‌خوری');
  if (type === 'cup') return formatSpoonOrCup(scaled, 'پیمانه', false);
  if (type === 'count') return formatCount(scaled, rest || formatUnit(context.unit) || 'عدد', context.name || context.displayName || '');
  return `${formatQuarterFraction(scaled)}${rest ? ` ${rest}` : ''}`;
}

function formatAmountValue(amount, unit, context = {}) {
  const raw = String(amount ?? '').trim();
  if (!raw) return '';
  return practicalScaleAmountText(`${raw} ${formatUnit(unit)}`.trim(), 1, context);
}

export function formatUnit(unit) {
  const key = String(unit ?? '').trim().toLowerCase();
  if (!key) return '';
  return UNIT_LABELS[key] || unit;
}

export function formatIngredientAmountDisplay({ volume, displayUnit, amount, unit, weightG, name, displayName } = {}, factor = 1) {
  const context = { unit, name, displayName };
  const human = normalizeText(volume || displayUnit || '');
  if (human) return practicalScaleAmountText(human, factor, context);

  const amountLabel = formatAmountValue(amount, unit, context);
  if (amountLabel) return practicalScaleAmountText(amountLabel, factor, context);

  const grams = Number(weightG);
  if (Number.isFinite(grams) && grams > 0) return formatWeight(grams * (Number(factor) || 1), 'گرم');
  return '';
}

export function hasBadIngredientAmountDisplay(value) {
  const text = String(value ?? '');
  return /[0-9۰-۹]\s*g\b/i.test(text)
    || /\bgrams?\b/i.test(text)
    || /(?:½|¼|¾|Â½|Â¼|Â¾)/.test(text)
    || /(?:·|Â·)/.test(text)
    || /\d+(?:[٫.]\d+)?\s*(?:عدد|حبه|برگ)/.test(toLatinDigits(text))
    || /(?:لیمو عمانی).*(?:نیم|½|Â½)/.test(text)
    || /g\s*(?:·|Â·)\s*\d+/i.test(text);
}
