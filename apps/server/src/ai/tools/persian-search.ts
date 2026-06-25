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
  'دوست', 'چند', 'چندتا', 'لطفا', 'لطفاً', 'ممنون', 'سلام', 'های', 'یا',
]);

const ZWNJ = /‌/g;
const MAX_TOKENS = 6;

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
    const key = tok.replace(ZWNJ, '');
    if (key.length < 2) continue;
    if (STOPWORDS.has(key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(tok);
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

/**
 * Pull the candidate INGREDIENT term(s) from a substitution question ("جایگزینِ ماست چی بزنم؟" -> ["ماست"]),
 * by tokenizing, dropping question stopwords AND the substitution verbs/connectors. Longest-first so a more
 * specific token is tried before a generic modifier; the caller resolves each against the dictionary and the
 * first that resolves wins (so an adjective like «سفید» that resolves to nothing is harmlessly skipped).
 */
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
