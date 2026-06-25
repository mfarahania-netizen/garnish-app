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

/** Normalize a Persian/Latin string: fold char/digit variants, lowercase, collapse whitespace. */
export function foldPersian(input: unknown): string {
  const s = String(input ?? '');
  let out = '';
  for (const ch of s) out += CHAR_FOLD[ch] ?? ch;
  return out.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Function / question / filler words that carry no recipe meaning. Stored ZWNJ-free + folded so
// "می‌خوام" (with ZWNJ) and "ميخوام" (Arabic yeh) both normalize to a listed entry. Conservative on
// purpose — content adjectives like سبک/مقوی/سریع are intentionally NOT here.
const STOPWORDS = new Set<string>([
  'با', 'و', 'یا', 'از', 'به', 'در', 'که', 'را', 'رو', 'این', 'اون', 'آن', 'یه', 'یک', 'یکم',
  'چی', 'چه', 'چیه', 'چیزی', 'چطور', 'چطوری', 'چگونه', 'چرا', 'کجا', 'کی', 'آیا', 'ایا',
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
