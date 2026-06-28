/**
 * Amount → gram resolver (the connector that lets the engine compute a whole dish's macros).
 *
 * Pure, deterministic, NO fabrication. Given a recipe ingredient's authored `amount` + `unit` and the
 * dictionary ingredient's `gramConversions` (populated by backfill-ingredient-gram-conversions.cjs), it
 * returns the grams — or null when it genuinely cannot be grounded (then the caller leaves the dish
 * un-surfaced and the nutrition guard stays). It NEVER guesses a number it can't defend.
 *
 * Trust order (strongest first):
 *   1. direct mass (گرم/کیلوگرم)                         → exact, grounded.
 *   2. per-ingredient `gramConversions.perUnit[unit]`    → corpus-mined or documented for THIS ingredient.
 *   3. density × volume (for ml/پیمانه/قاشق when a real density is known)   → grounded.
 *   4. GLOBAL fallback table (a generic per-unit median)  → returned but flagged `grounded:false`, because a
 *      generic piece/cup weight can be wrong for a specific ingredient (1 «عدد» onion ≠ egg ≠ pizza-dough).
 *      The compute layer refuses to surface a number when a calorie-significant ingredient resolves only here.
 */

export interface GramConversionEntry {
  /** grams for ONE of this unit of this ingredient. */
  g: number;
  /** provenance: 'mined' (corpus median), 'curated' (documented culinary reference), 'density', 'global'. */
  src: string;
  /** corpus sample count when src='mined'. */
  n?: number;
}
export interface GramConversions {
  /** grams-per-unit for each non-mass unit this ingredient is authored with. */
  perUnit?: Record<string, GramConversionEntry>;
  /** g/ml for liquids/oils (refines ml/پیمانه/قاشق when no explicit perUnit entry). */
  densityGPerMl?: number | null;
  /** overall provenance tag (e.g. 'estimated_gram_conversions_v1'). */
  source?: string;
}

export interface ResolvedGrams {
  grams: number | null;
  /** how the grams were derived (for observability + the compute-layer trust gate). */
  source: 'mass' | 'perUnit' | 'density' | 'global' | 'none';
  /** false only for the generic GLOBAL fallback — a specific ingredient's piece/cup weight may differ. */
  grounded: boolean;
}

const NONE: ResolvedGrams = { grams: null, source: 'none', grounded: false };

// ── amount parsing ─────────────────────────────────────────────────────────────────────────────────────
const FA_DIGITS: Record<string, string> = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9', '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
const VULGAR: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅙': 1 / 6, '⅚': 5 / 6 };

/** Parse a Persian/Western amount string («۲», «۱.۵», «۱/۲», «۲ و ½», «نیم») → a number, or null. */
export function parseAmount(raw: unknown): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[۰-۹٠-٩]/g, (d) => FA_DIGITS[d] ?? d);
  if (!s) return null;
  // «نیم» (half) / «یک‌ونیم» style words that carry no digit
  const hasHalfWord = /(^|\s|‌)نیم(\s|$|‌)/.test(s);
  let total = 0;
  let matched = false;
  for (const [glyph, val] of Object.entries(VULGAR)) if (s.includes(glyph)) { total += val; s = s.split(glyph).join(' '); matched = true; }
  s = s.replace(/(\d+)\s*\/\s*(\d+)/g, (_, a, b) => { const d = Number(b); if (d) { total += Number(a) / d; matched = true; } return ' '; });
  const m = s.match(/\d+(\.\d+)?/);
  if (m) { total += Number(m[0]); matched = true; }
  if (!matched && hasHalfWord) return 0.5;
  if (matched && hasHalfWord && total === Math.floor(total)) total += 0.5; // «یک و نیم» when «نیم» follows the integer
  return matched ? total : null;
}

// ── unit normalisation ─────────────────────────────────────────────────────────────────────────────────
/** Fold ZWNJ/space/kaf/yeh variants so «قاشق غذاخوری» / «قاشق‌غذاخوری» / «قاشق غذا خوری» all match one key. */
export function normalizeUnit(unit: unknown): string {
  return String(unit ?? '')
    .replace(/‌/g, ' ')
    .replace(/[يی]/g, 'ی')
    .replace(/[كک]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

// Direct MASS units → grams per unit (exact; no per-ingredient data needed).
const MASS_GRAMS: Record<string, number> = { 'گرم': 1, 'گ': 1, 'g': 1, 'gram': 1, 'grams': 1, 'کیلوگرم': 1000, 'کیلو': 1000, 'کیلوگرمی': 1000, 'kg': 1000 };
// Direct VOLUME units → millilitres per unit (× density → grams).
const VOLUME_ML: Record<string, number> = { 'میلی لیتر': 1, 'میلیلیتر': 1, 'سی سی': 1, 'cc': 1, 'ml': 1, 'لیتر': 1000, 'l': 1000, 'لیوان': 240, 'فنجان': 240 };

// Size multipliers for «عدد بزرگ/متوسط/کوچک» when only a base «عدد» factor is known.
const SIZE_MULT: { re: RegExp; base: string; mult: number }[] = [
  { re: /^نصف\s*عدد$|^نیم\s*عدد$/, base: 'عدد', mult: 0.5 },
  { re: /^ربع\s*عدد$/, base: 'عدد', mult: 0.25 },
  { re: /^عدد\s*بزرگ$/, base: 'عدد', mult: 1.4 },
  { re: /^عدد\s*متوسط$/, base: 'عدد', mult: 1.0 },
  { re: /^عدد\s*کوچک$/, base: 'عدد', mult: 0.6 },
];

/**
 * GLOBAL fallback grams-per-unit — a generic median used ONLY when the ingredient has no per-ingredient
 * factor. Informed by the corpus mining (عدد≈110, قاشق غذاخوری≈13.7, پیمانه≈180, قاشق چای‌خوری≈3, حبه≈3)
 * and standard culinary references. Returned `grounded:false` so the compute layer treats it as untrusted
 * for a calorie-significant ingredient. `null` = a unit too variable to guess generically (→ blocks instead).
 */
export const GLOBAL_UNIT_GRAMS: Record<string, number | null> = {
  'قاشق غذاخوری': 13.7, 'قاشق سوپخوری': 13.7, 'قاشق غذا خوری': 13.7,
  'قاشق چایخوری': 3, 'قاشق چای خوری': 3, 'قاشق مرباخوری': 5,
  'پیمانه': 180, 'عدد': 110, 'عدد متوسط': 120, 'عدد بزرگ': 150, 'عدد کوچک': 70,
  'نصف عدد': 55, 'ربع عدد': 28, 'حبه': 3, 'دسته': 40, 'ساقه': 15, 'شاخه': 15,
  'برگ': 1, 'پر': 1, 'تکه': 30, 'تکه کوچک': 15, 'برش': 25, 'قاچ': 30,
};

/**
 * Resolve an authored (amount, unit) to grams using this ingredient's conversion data.
 * Returns grams + how they were derived; grams is null when nothing can ground it.
 */
export function resolveGrams(input: {
  amount: number | null;
  unit: unknown;
  gramConversions?: GramConversions | null;
}): ResolvedGrams {
  const amount = input.amount;
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return NONE;
  const unit = normalizeUnit(input.unit);
  if (!unit) return NONE;
  const conv = input.gramConversions ?? null;
  const density = typeof conv?.densityGPerMl === 'number' && conv.densityGPerMl > 0 ? conv.densityGPerMl : null;

  // 1) direct MASS — exact.
  if (MASS_GRAMS[unit] != null) return { grams: amount * MASS_GRAMS[unit], source: 'mass', grounded: true };

  // 2) per-ingredient factor for this exact unit (corpus-mined or documented).
  const direct = conv?.perUnit?.[unit];
  if (direct && Number.isFinite(direct.g) && direct.g > 0) return { grams: amount * direct.g, source: 'perUnit', grounded: true };

  // 2b) size variant («نصف/ربع/بزرگ/کوچک عدد») off the base unit's per-ingredient factor.
  for (const s of SIZE_MULT) {
    if (s.re.test(unit)) {
      const base = conv?.perUnit?.[s.base];
      if (base && Number.isFinite(base.g) && base.g > 0) return { grams: amount * base.g * s.mult, source: 'perUnit', grounded: true };
    }
  }

  // 3) direct VOLUME with a real density → grounded.
  if (VOLUME_ML[unit] != null) {
    if (density != null) return { grams: amount * VOLUME_ML[unit] * density, source: 'density', grounded: true };
    // water-like assumption (≈1 g/ml) for ml/litre/glass when no density is known — fine for the common
    // water/milk/broth case; flagged not-fully-grounded so a dense liquid can't masquerade as exact.
    return { grams: amount * VOLUME_ML[unit] * 1, source: 'global', grounded: false };
  }

  // 4) GLOBAL generic fallback — return a number but flag it untrusted for calorie-significant ingredients.
  if (Object.prototype.hasOwnProperty.call(GLOBAL_UNIT_GRAMS, unit)) {
    const g = GLOBAL_UNIT_GRAMS[unit];
    if (g != null) return { grams: amount * g, source: 'global', grounded: false };
  }
  // size variant off the GLOBAL base («عدد») when the ingredient has no per-ingredient factor.
  for (const s of SIZE_MULT) {
    if (s.re.test(unit)) {
      const g = GLOBAL_UNIT_GRAMS[s.base];
      if (g != null) return { grams: amount * g * s.mult, source: 'global', grounded: false };
    }
  }
  return NONE;
}
