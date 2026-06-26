import { foldPersian } from './persian-search';

/**
 * Curated FAMOUS / beloved Persian-dish prior — Iran phase-1.
 *
 * WHY this exists: ranking had NO popularity signal, so a generic ask («چند تا خورشت») surfaced obscure dishes
 * (آلو‌اسفناج / کرفس / بامیه) just as high as the beloved classics (قرمه‌سبزی / قیمه / فسنجان). Real popularity data
 * (views / favorites / cook-completes) is still ~empty, so we encode the "what an Iranian actually loves" prior as
 * a small curated list — a TIE-BREAKER nudge, never an override of a strong specific-title match. As real
 * engagement accrues, an earned-popularity score should supplement (then can outweigh) this static prior.
 *
 * TIER 2 = the most iconic (the founder's bar). TIER 1 = very common + loved. Title-keyword match, foldPersian-
 * normalized. Keep ADDITIONS conservative — only genuinely-famous dishes, or the prior loses meaning.
 */
const ICONIC = [
  'قرمه', 'قورمه', 'قیمه', 'فسنجان', 'زرشک پلو', 'باقالی پلو', 'جوجه', 'کوبیده', 'آبگوشت',
  'تاهچین', 'ته چین', 'تهچین', 'کشک بادمجان', 'میرزا قاسمی', 'آش رشته', 'حلیم', 'کباب برگ',
].map((s) => foldPersian(s)).filter(Boolean);

const FAMOUS = [
  'دلمه', 'کوفته', 'کتلت', 'شامی', 'سبزی پلو', 'عدس پلو', 'لوبیا پلو', 'کلم پلو', 'الویه', 'کوکو',
  'ماکارونی', 'لازانیا', 'استامبولی', 'خوراک', 'آلبالو پلو', 'شیرین پلو', 'عدسی', 'کباب',
].map((s) => foldPersian(s)).filter(Boolean);

/** 2 = iconic, 1 = famous, 0 = neither — by FOLD-normalized title keyword. */
export function famousTier(title: unknown): 0 | 1 | 2 {
  const t = foldPersian(title);
  if (!t) return 0;
  if (ICONIC.some((k) => t.includes(k))) return 2;
  if (FAMOUS.some((k) => t.includes(k))) return 1;
  return 0;
}
