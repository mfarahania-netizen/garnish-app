// GES — pure, deterministic serving-scaling helpers (Phase 0 of the recipe-interaction layer).
//
// These three primitives are the foundation every personalization feature sits on:
//   • extractBaseServings — read the recipe's base serving count from its «N نفر» text (L1)
//   • parseQuantity       — parse a Persian/Latin amount string into a structured value (H1)
//   • scaleAmountText     — rescale an amount string by a factor, preserving the unit tail (C1/C2)
//
// Honesty contract: non-numeric amounts («به‌مزه», «کمی», «to taste») are NEVER fabricated into a
// number — they're flagged non-scalable and returned unchanged. Canonical data stays Latin; the
// display strings these produce use Persian digits (matching the rest of the app).
import { toFaDigits } from './format';

const FA = '۰۱۲۳۴۵۶۷۸۹';
const toLatinNum = (s) => String(s ?? '').replace(/[۰-۹]/g, (d) => FA.indexOf(d));

// vulgar-fraction glyphs that show up in amounts
const VULGAR = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8 };

// phrases that mean "no fixed quantity" — these must never be scaled into a fake number
const NON_SCALABLE = ['به‌مزه', 'به مزه', 'به‌اندازه', 'به اندازه', 'به‌دلخواه', 'به دلخواه', 'کمی', 'مقداری', 'اختیاری', 'به‌قدر', 'به قدر', 'to taste', 'as needed', 'a pinch', 'pinch', 'optional'];

/**
 * extractBaseServings — pull the base serving count from a servings string («۴ نفر» → 4).
 * Falls back to `fallback` (default 4) when no integer is present, so callers never divide by 0/NaN.
 */
export function extractBaseServings(text, fallback = 4) {
  const m = toLatinNum(text).match(/\d+/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * parseQuantity — parse the FIRST numeric token of an amount string into a Number.
 * Supports integers, decimals («۱.۵» / «۱٫۵»), simple fractions («۱/۲»), and vulgar glyphs («½»),
 * including a leading whole + fraction («۱ ½»). Returns { value, scalable, hasNumber }.
 */
export function parseQuantity(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { value: null, scalable: false, hasNumber: false };
  const lower = raw.toLowerCase();
  if (NON_SCALABLE.some((p) => lower.includes(p))) return { value: null, scalable: false, hasNumber: false };

  const t = toLatinNum(raw).replace(/٫/g, '.');
  // whole + vulgar fraction, e.g. "1 ½"
  const wholeVulgar = t.match(/(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘])/);
  if (wholeVulgar) return { value: Number(wholeVulgar[1]) + VULGAR[wholeVulgar[2]], scalable: true, hasNumber: true };
  // bare vulgar fraction
  const vulgar = t.match(/[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]/);
  if (vulgar) return { value: VULGAR[vulgar[0]], scalable: true, hasNumber: true };
  // simple fraction a/b
  const frac = t.match(/(\d+)\s*\/\s*(\d+)/);
  if (frac && Number(frac[2]) !== 0) return { value: Number(frac[1]) / Number(frac[2]), scalable: true, hasNumber: true };
  // decimal or integer
  const num = t.match(/\d+(?:\.\d+)?/);
  if (num) return { value: Number(num[0]), scalable: true, hasNumber: true };
  return { value: null, scalable: false, hasNumber: false };
}

const FRACTIONS = [[0.5, '½'], [1 / 3, '⅓'], [2 / 3, '⅔'], [0.25, '¼'], [0.75, '¾'], [0.125, '⅛'], [0.375, '⅜'], [0.625, '⅝'], [0.875, '⅞']];

/**
 * formatQuantity — render a Number back to a calm Persian amount, snapping to a nice fraction when
 * close (1.5 → «۱½», 0.5 → «½»), else a short decimal with the Persian decimal separator «٫».
 */
export function formatQuantity(value) {
  if (!Number.isFinite(value) || value <= 0) return '';
  const whole = Math.floor(value + 1e-9);
  const frac = value - whole;
  for (const [f, glyph] of FRACTIONS) {
    if (Math.abs(frac - f) < 0.04) return (whole > 0 ? toFaDigits(whole) : '') + glyph;
  }
  if (frac < 0.04) return toFaDigits(whole);
  // no clean fraction → short decimal (≤2 places, trailing zeros stripped)
  const rounded = Math.round(value * 100) / 100;
  const str = (Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, '')).replace('.', '٫');
  return toFaDigits(str);
}

/**
 * scaleAmountText — rescale every numeric token in a display amount string by `factor`, keeping the
 * unit/word tail intact. «۲ پیمانه» ×2 → «۴ پیمانه»; «۱/۲ قاشق» ×2 → «۱ قاشق»; ranges «۲ تا ۳ قاشق»
 * scale both ends. Non-scalable amounts («به‌مزه») and factor≈1 are returned unchanged (no churn).
 */
export function scaleAmountText(amountText, factor) {
  const raw = String(amountText ?? '');
  if (!raw.trim()) return raw;
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 1e-9) return raw;
  const { scalable } = parseQuantity(raw);
  if (!scalable) return raw;

  const t = toLatinNum(raw).replace(/٫/g, '.');
  // replace whole+vulgar pairs first, then bare vulgar, then fractions, then decimals/ints
  let out = t.replace(/(\d+)\s*([½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘])/g, (_, w, g) => formatQuantity((Number(w) + VULGAR[g]) * factor));
  out = out.replace(/[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘]/g, (g) => formatQuantity(VULGAR[g] * factor));
  out = out.replace(/(\d+)\s*\/\s*(\d+)/g, (m, a, b) => (Number(b) ? formatQuantity((Number(a) / Number(b)) * factor) : m));
  out = out.replace(/\d+(?:\.\d+)?/g, (n) => formatQuantity(Number(n) * factor));
  return out;
}

/**
 * scaleWeightG — rescale a numeric gram weight (GRIS ingredients), rounded to a sensible step:
 * whole grams under 100, nearest 5g above. Returns null for non-numbers (no fabrication).
 */
export function scaleWeightG(weightG, factor) {
  if (typeof weightG !== 'number' || !Number.isFinite(weightG)) return null;
  if (!Number.isFinite(factor) || factor <= 0) return weightG;
  const scaled = weightG * factor;
  return scaled >= 100 ? Math.round(scaled / 5) * 5 : Math.round(scaled);
}
