/**
 * Persian-aware query tokenization for the read-only recipe search (E47 retrieval).
 *
 * WHY: the assistant's grounding retrieves candidates with `search_recipes`, which does a substring
 * `contains` over title/description/ingredient. A natural-language turn ("با مرغ و سبزی چی بپزم؟") is
 * NEVER a literal substring of a title, so whole-string matching returns nothing and every chat turn
 * dead-ends — including the UI's suggested starters, which are full sentences. This module turns a free
 * question into the meaningful CONTENT tokens (ingredients/dish words) to OR-match, after folding
 * Persian character variants and dropping function/question stopwords.
 *
 * Deterministic, zero-LLM, no fabrication. It only decides WHICH substrings to look for; the hard
 * allergy/safety gate downstream is unchanged and still runs over whatever this retrieves.
 */

// Arabic → Persian canonical folds + digit folds. The corpus is authored in Persian forms
// (ک U+06A9, ی U+06CC); folding user input toward those forms makes an Arabic-typed query match.
const CHAR_FOLD: Record<string, string> = {
  'ك': 'ک', // ك -> ک
  'ي': 'ی', // ي -> ی
  'ى': 'ی', // ى -> ی
  'ة': 'ه', // ة -> ه
  'ـ': '', // tatweel ـ -> (remove)
};
// Arabic-Indic ٠-٩ and Persian ۰-۹ digits -> western
for (let d = 0; d < 10; d++) {
  CHAR_FOLD[String.fromCharCode(0x0660 + d)] = String(d);
  CHAR_FOLD[String.fromCharCode(0x06F0 + d)] = String(d);
}

/** Arabic harakat / tashkil (kasra, fatha, damma, sukun, tanwin, superscript alef) — stripped before matching. */
const HARAKAT = /[ً-ْٰ]/g;

/** Normalize a Persian/Latin string: strip harakat, fold char/digit variants, lowercase, collapse whitespace. */
export function foldPersian(input: unknown): string {
  const s = String(input ?? '').replace(HARAKAT, '');
  let out = '';
  for (const ch of s) out += CHAR_FOLD[ch] ?? ch;
  return out.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Function / question / filler words that carry no recipe meaning. Stored ZWNJ-free + folded so
// "می‌خوام" (with ZWNJ) and "ميخوام" (Arabic yeh) both normalize to a listed entry. Conservative on
// purpose — content adjectives like سبک/مقوی/سریع are intentionally NOT here.
const STOPWORDS = new Set<string>([
  'با', 'و', 'یا', 'از', 'به', 'در', 'که', 'را', 'رو', 'این', 'اون', 'آن', 'یه', 'یک', 'یکم',
  'چی', 'چه', 'چیه', 'چیست', 'چیزی', 'چطور', 'چطوری', 'چگونه', 'چرا', 'کجا', 'کی', 'کدوم', 'کدام', 'آیا', 'ایا',
  'میخوام', 'میخواهم', 'میخوای', 'بپزم', 'بپز', 'بپزیم', 'بخورم', 'بخوریم', 'درست', 'بسازم',
  'کنم', 'کنیم', 'کن', 'کنید', 'بزنم', 'بزن', 'پیشنهاد', 'بده', 'بدید', 'بدی', 'برای', 'تا',
  'هم', 'اگه', 'اگر', 'هست', 'هستش', 'میشه', 'میتونم', 'میتونی', 'الان', 'خوب', 'دارم', 'دارین',
  'دوست', 'چند', 'چندتا', 'لطفا', 'لطفاً', 'ممنون', 'سلام', 'های', 'یا', 'بدون',
]);

const ZWNJ = /‌/g;
const MAX_TOKENS = 6;

// CURATED colloquial/typo → canonical map (EXACT whole-token replacement, never a fuzzy guess). Deliberately
// NOT edit-distance: on short Persian words «شیر»(milk, an allergen) and «سیر»(garlic) are 1 edit apart, so a
// fuzzy match could confuse an allergen — unacceptable next to the allergy gate. Only unambiguous, allergen-safe
// colloquial spellings (و→ا) and common head-word typos live here. Applied per token in tokenizeQuery.
const COLLOQUIAL_MAP = new Map<string, string>([
  ['بادمجون', 'بادمجان'], ['نون', 'نان'], ['خونه', 'خانه'], ['آشپزخونه', 'آشپزخانه'],
  ['ارزون', 'ارزان'], ['آسون', 'آسان'], ['مهمون', 'مهمان'], ['مهمونی', 'مهمانی'],
  ['لیمون', 'لیمو'], ['زمستون', 'زمستان'], ['تابستون', 'تابستان'], ['قیموه', 'قیمه'],
  // common typos of the substitution head-word (NOT ingredient names — safe to canonicalize)
  ['جیگزین', 'جایگزین'], ['جاگزین', 'جایگزین'], ['جایگرین', 'جایگزین'], ['جانیشن', 'جانشین'],
]);

export interface TokenizedQuery {
  /** Content terms to OR-match against the corpus (folded). Always at least one entry. */
  terms: string[];
  /** true when no content token survived and we fell back to the whole folded query. */
  fallback: boolean;
}

/**
 * Split a free question into content search terms. Drops stopwords + tokens shorter than 2 chars,
 * dedupes, caps to MAX_TOKENS. If nothing meaningful remains, falls back to the whole folded query
 * (so a bare keyword like "کباب" behaves exactly as before).
 */
export function tokenizeQuery(raw: unknown): TokenizedQuery {
  const folded = foldPersian(raw);
  if (!folded) return { terms: [], fallback: true };
  // split on whitespace + punctuation (keep ZWNJ inside words; it is handled in the stopword key)
  const rawTokens = folded.split(/[\s،؛؟?!.,:;()«»"'\/\\\-_…]+/u).filter(Boolean);
  const terms: string[] = [];
  const seen = new Set<string>();
  for (const tok of rawTokens) {
    const rawKey = tok.replace(ZWNJ, '');
    const canon = COLLOQUIAL_MAP.get(rawKey); // exact colloquial/typo fold, else undefined
    const key = canon ?? rawKey;
    if (key.length < 2) continue;
    if (STOPWORDS.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(canon ?? tok); // push the canonical form when folded, else the original token
    if (terms.length >= MAX_TOKENS) break;
  }
  if (terms.length === 0) return { terms: [folded], fallback: true };
  return { terms, fallback: false };
}

// Colloquial base ingredient -> the canonical dictionary entry. The USDA-derived ingredient dictionary
// names things specifically (no plain «شیر»/«تخم مرغ»/«کره»), so a user's everyday term needs mapping to a
// real, sensible default row. Keys are foldPersian forms; values are EXACT dictionary names (VERIFIED by DB
// query 2026-06-25). Extend as new gaps surface. This only steers resolution; the allergy filter is untouched.
const INGREDIENT_ALIAS: Record<string, string> = {
  'شیر': 'شیر کامل',
  'تخم مرغ': 'تخم‌مرغ کامل خام',
  'تخممرغ': 'تخم‌مرغ کامل خام',
  'کره': 'کره بدون نمک', // generic/cooking butter ≈ unsalted; this row has the rich, sensible swap set
  'ماست': 'ماست ساده',
  'خامه': 'خامه پرچرب',
  'پنیر': 'پنیر فتا',
  'پیاز': 'پیاز خام',
  'سیر': 'سیر خام',
  'گوجه': 'گوجه‌فرنگی خام',
  'گوجه فرنگی': 'گوجه‌فرنگی خام',
  'لیمو': 'لیمو زرد خام',
  'ابلیمو': 'آبلیموی بطری',
  'نمک': 'نمک خوراکی',
  'نشاسته': 'نشاسته ذرت',
  'سرکه': 'سرکه سیب',
  'رب گوجه': 'رب گوجه‌فرنگی',
  'رب گوجه فرنگی': 'رب گوجه‌فرنگی',
  'رب': 'رب گوجه‌فرنگی',
  'روغن': 'روغن آفتابگردان',
  'مرغ': 'مرغ کامل خام',
};

/** Map a colloquial ingredient term to its canonical dictionary name, or return it unchanged. */
export function aliasIngredient(term: unknown): string {
  const raw = String(term ?? '').trim();
  return INGREDIENT_ALIAS[foldPersian(raw)] ?? raw;
}

// Substitution-intent verbs/connectors — stripped so only the INGREDIENT token remains. Stored ZWNJ-free
// + folded (the tokenizer already folds; we compare on the ZWNJ-removed key).
const SUBSTITUTION_ANCHORS = new Set<string>([
  'جایگزین', 'جای', 'بهجای', 'عوض', 'عوضش', 'عوضی', 'بدل',
  'vervang', 'vervanging', 'vervangen', 'plaats', 'alternatief',
  'substitute', 'substitution', 'instead', 'replace', 'replacement', 'swap', 'alternative', 'sub',
]);

// Culinary MODIFIERS that keep the base ingredient the same (ZWNJ-free + folded). They let us tell
// «ماست ساده»/«کره شور»/«تخم مرغ خام» (same base, more specific — CONFIDENT) apart from «کره سیب»/«کره بادام»
// (a DIFFERENT base — NOT a confident match for «کره»). The USDA dictionary has no colloquial base rows.
const MODIFIER_TOKENS = new Set<string>([
  'ساده', 'خام', 'تازه', 'پخته', 'ابپز', 'شور', 'بینمک', 'بدون', 'نمک', 'کمچرب', 'پرچرب', 'چرب',
  'محلی', 'یونانی', 'چکیده', 'بوداده', 'بو', 'داده', 'اسیابشده', 'اسیاب', 'شده', 'پودر', 'رنده',
  'رندهشده', 'نرم', 'سفت', 'کامل', 'چربی', 'قند', 'شکر', 'منجمد', 'کنسروی', 'خشک', 'تلخ', 'شیرین',
  'سرخشده', 'سرخ', 'گرم', 'سرد', 'درشت', 'ریز', 'بزرگ', 'کوچک', 'قرمز', 'سفید', 'سیاه', 'سبز', 'زرد',
]);

/**
 * Is `name` a CONFIDENT resolution of the user's `query` ingredient term? True when the names fold-equal,
 * or when `name` is `query` + only culinary modifiers (e.g. «ماست»→«ماست ساده», «کره»→«کره شور»). False for
 * a different base («کره»→«کره سیب», «تخم»→«تخمه کدو»), so the caller can fall through instead of mis-answering.
 */
export function isConfidentIngredientMatch(query: unknown, name: unknown): boolean {
  // ZWNJ is a soft space: «تخم‌مرغ» (corpus) and «تخم مرغ» (typed) must compare equal here.
  const soft = (s: string) => s.replace(ZWNJ, ' ').replace(/\s+/g, ' ').trim();
  const fq = soft(foldPersian(query));
  const fn = soft(foldPersian(name));
  if (!fq || !fn) return false;
  if (fn === fq) return true;
  if (!fn.startsWith(`${fq} `)) return false;
  const remainder = fn.slice(fq.length + 1).trim();
  if (!remainder) return false;
  return remainder.split(/\s+/).every((tok) => MODIFIER_TOKENS.has(tok));
}

// Words that don't narrow a search on their own — «غذای بدون گوشت» should rely on the EXCLUDE, not «غذا»,
// and «غذای گیاهی ایرانی» on the diet filter, not the descriptor «ایرانی».
const GENERIC_FOOD_WORDS = new Set([
  'غذا', 'غذای', 'چیز', 'چیزی', 'خوراکی', 'یه‌چیزی', 'ایرانی', 'سنتی', 'اصیل', 'خوشمزه', 'خوشمزه‌ای', 'محلی',
]);

export interface ParsedSearchQuery {
  /** positive content terms to match (may be empty for a pure «بدون X» / diet query). */
  include: string[];
  /** terms whose recipes must be EXCLUDED — fixes «بدون گوشت» returning meat (a real correctness bug). */
  exclude: string[];
  /** Recipe.diet values to filter to (vegetarian/vegan/high_protein), or empty. */
  diets: string[];
}

/**
 * Parse a discovery query into include / exclude / diet. Negation («بدون X», «بی X», without/zonder/geen X)
 * and diet words (گیاهی→vegetarian+vegan, وگان→vegan, high-protein) are pulled out so retrieval can FILTER
 * rather than positively matching the negated/diet word. Deterministic; no LLM.
 */
export function parseSearchQuery(raw: unknown): ParsedSearchQuery {
  const folded = foldPersian(raw);
  const exclude: string[] = [];
  let stripped = folded;
  // capture «بدون X» / «بی X» (and a 2nd word for compound ingredients like «تخم مرغ»/«گوشت قرمز»), removing
  // the WHOLE span so neither word becomes a positive term — «بدون تخم مرغ» must not search FOR مرغ.
  // The optional 2nd word captures a COMPOUND ingredient («تخم مرغ»), but it must NOT swallow the next
  // negation marker — «بدون شکر بدون آرد» has to exclude BOTH (else «آرد» leaks back as a POSITIVE term and a
  // flour-bearing savory dish answers a dessert query). The lookahead stops the 2nd word from eating «بدون»/«بی».
  stripped = stripped.replace(/(?:بدون|بی)\s+([^\s،,؛.!?]+)(?:\s+(?!بدون\s|بی\s)([^\s،,؛.!?]+))?/g, (_m, w1) => { const t = String(w1).replace(ZWNJ, '').trim(); if (t.length >= 2) exclude.push(t); return ' '; });
  stripped = stripped.replace(/\b(?:without|no|zonder|geen)\s+([a-z؀-ۿ‌]+)(?:\s+(?!without\s|no\s|zonder\s|geen\s)([a-z؀-ۿ‌]+))?/gi, (_m, w1) => { const t = String(w1).replace(ZWNJ, '').trim(); if (t.length >= 2) exclude.push(t); return ' '; });

  const diets: string[] = /وگان|\bvegan\b/i.test(folded)
    ? ['vegan']
    : /گیاهی|vegetar/i.test(folded)
      ? ['vegetarian', 'vegan']
      : /پرپروتئین|پروتئین بالا|high.?protein/i.test(folded)
        ? ['high_protein']
        : [];
  stripped = stripped.replace(/گیاهی|وگان|vegan|vegetar\w*|پرپروتئین|high.?protein/gi, ' ');

  const { terms, fallback } = tokenizeQuery(stripped);
  const excludeSet = new Set(exclude);
  // fallback = no real content tokens survived (all stopwords) — don't use the whole string as a positive term
  // when we already have an exclude/diet filter to apply (e.g. «چی بپزم بدون پیاز» → just exclude پیاز).
  const include = fallback ? [] : terms.filter((t) => !GENERIC_FOOD_WORDS.has(t.replace(ZWNJ, '')) && !excludeSet.has(t.replace(ZWNJ, '')));
  return { include, exclude: [...excludeSet], diets };
}

/**
 * Pull the candidate INGREDIENT term(s) from a substitution question ("جایگزینِ ماست چی بزنم؟" -> ["ماست"]),
 * by tokenizing, dropping question stopwords AND the substitution verbs/connectors. Longest-first so a more
 * specific token is tried before a generic modifier; the caller resolves each against the dictionary and the
 * first that resolves wins (so an adjective like «سفید» that resolves to nothing is harmlessly skipped).
 */
// Nutrition-question words — stripped so only the INGREDIENT remains («کالریِ برنج چقدره؟» -> «برنج»).
const NUTRITION_WORDS = new Set([
  // fa
  'کالری', 'کالریه', 'کالریِ', 'پروتئین', 'پروتیین', 'چربی', 'قند', 'کربوهیدرات', 'فیبر', 'سدیم', 'نمک',
  'ارزش', 'غذایی', 'چقدر', 'چقدره', 'چنده', 'مقدار', 'انرژی',
  // en
  'calorie', 'calories', 'protein', 'fat', 'carb', 'carbs', 'fiber', 'energy', 'kcal', 'of', 'in', 'the', 'how', 'much',
  // nl
  'calorieën', 'calorieen', 'eiwit', 'koolhydraten', 'vet', 'vezels', 'voedingswaarde', 'energie', 'hoeveel', 'zit', 'van', 'het',
]);

/** Pull the candidate ingredient term(s) from a nutrition question, longest-first (caller resolves each). */
export function extractNutritionTargets(raw: unknown): string[] {
  const { terms, fallback } = tokenizeQuery(raw);
  if (fallback) return [];
  const targets = terms.filter((t) => !NUTRITION_WORDS.has(t.replace(ZWNJ, '')));
  return [...targets].sort((a, b) => b.length - a.length);
}

export function extractSubstitutionTargets(raw: unknown): string[] {
  const { terms, fallback } = tokenizeQuery(raw);
  if (fallback) return [];
  const targets = terms.filter((t) => !SUBSTITUTION_ANCHORS.has(t.replace(ZWNJ, '')));
  if (targets.length === 0) return [];
  // Try the FULL phrase first so a multi-word ingredient («تخم مرغ») resolves before its split tokens
  // («تخم» alone matches «تخم گشنیز»). Then the individual tokens, longest-first.
  const out: string[] = [];
  if (targets.length > 1) out.push(targets.join(' '));
  for (const t of [...targets].sort((a, b) => b.length - a.length)) if (!out.includes(t)) out.push(t);
  return out;
}
