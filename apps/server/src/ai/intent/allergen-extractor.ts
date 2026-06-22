import { normalizeText } from './intent-classifier.service';

/**
 * Deterministic allergen-mention extractor (AI_DESIGN_SPEC §3, conversational-allergy confirm-then-write).
 *
 * Given a user message the IntentClassifier flagged as `stated_constraint` (a DECLARATION like "I'm allergic to
 * walnuts"), this finds WHICH EU-14 allergen(s) were named and maps them to the canonical onboarding chip token
 * — the SAME id the deterministic hard allergy gate reads from the declared set. ZERO LLM: a normalized-name
 * lexicon (fa/nl/en) over the normalized text. The result drives a CONFIRM-then-write offer (decision D2) — it is
 * never auto-written, and the deterministic gate stays the sole source of truth.
 */

export interface ExtractedAllergen {
  token: string; // canonical chip id stored as Allergy.name (what the hard gate matches)
  label: string; // Persian display label for the confirm prompt
}

// chip token → { label, name-substrings to detect (already normalized: lowercased, fa→plain, digits/ZWNJ folded) }
const ALLERGEN_LEXICON: Array<{ token: string; label: string; names: string[] }> = [
  { token: 'peanut', label: 'بادام‌زمینی', names: ['بادام زمینی', 'بادوم زمینی', 'peanut', 'groundnut', 'pinda'] },
  { token: 'nut', label: 'آجیل/مغزها', names: ['گردو', 'بادام', 'بادوم', 'خشکبار', 'پسته', 'فندق', 'بادام هندی', 'کاجو', 'نارگیل', 'مغز', 'اجیل', 'nut', 'tree nut', 'treenut', 'walnut', 'almond', 'pistachio', 'hazelnut', 'cashew', 'pecan', 'macadamia', 'brazil nut', 'noot', 'noten', 'walnoot', 'amandel'] },
  { token: 'dairy', label: 'لبنیات', names: ['شیر', 'لبنیات', 'پنیر', 'ماست', 'خامه', 'لاکتوز', 'dairy', 'milk', 'cheese', 'yogurt', 'lactose', 'melk', 'kaas', 'zuivel'] }, // کره dropped: کره=Korea collides; شیر/پنیر/ماست/خامه/لبنیات cover dairy
  { token: 'egg', label: 'تخم‌مرغ', names: ['تخم مرغ', 'تخممرغ', 'تخم‌مرغ', 'egg', 'eggs', 'ei', 'eieren'] },
  { token: 'gluten', label: 'گلوتن', names: ['گلوتن', 'گندم', 'جو', 'آرد', 'نان', 'gluten', 'wheat', 'barley', 'rye', 'tarwe'] },
  { token: 'shellfish', label: 'صدف و سخت‌پوستان', names: ['صدف', 'میگو', 'خرچنگ', 'خرچنگ دریایی', 'حلزون', 'shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'crustacean', 'mollusc', 'schaaldier', 'schaaldieren', 'garnaal'] },
  { token: 'fish', label: 'ماهی', names: ['ماهی', 'تن', 'سالمون', 'قزل آلا', 'fish', 'tuna', 'salmon', 'vis'] },
  { token: 'soy', label: 'سویا', names: ['سویا', 'soy', 'soya', 'soybean', 'soja', 'edamame', 'tofu', 'توفو'] },
  { token: 'sesame', label: 'کنجد', names: ['کنجد', 'ارده', 'طحینی', 'sesame', 'tahini', 'sesam'] },
  { token: 'mustard', label: 'خردل', names: ['خردل', 'mustard', 'mosterd'] },
  { token: 'celery', label: 'کرفس', names: ['کرفس', 'celery', 'celeriac', 'selderij'] },
  { token: 'lupin', label: 'لوپین', names: ['لوپین', 'lupin', 'lupine'] },
  { token: 'sulphites', label: 'سولفیت', names: ['سولفیت', 'سولفور', 'sulphite', 'sulfite', 'sulphites', 'sulfites', 'sulfiet'] },
];

const NORM_LEXICON = ALLERGEN_LEXICON.map((e) => ({ token: e.token, label: e.label, names: e.names.map(normalizeText).filter(Boolean) }));

/**
 * The canonical EU-14 allergen chip tokens this system recognizes on the PROFILE side (the same ids the onboarding
 * chips + the deterministic hard gate use). SINGLE SOURCE for the §3 write allowlist: UsersService.addAllergies
 * accepts ONLY these, so a crafted/buggy client can never pollute the global Allergy table with arbitrary strings
 * or write an inert non-canonical token that the gate would silently ignore.
 */
export const CANONICAL_ALLERGEN_TOKENS: ReadonlySet<string> = new Set(ALLERGEN_LEXICON.map((e) => e.token));

/**
 * Returns the distinct EU-14 allergens named in the text, as canonical chip tokens + Persian labels. Order is
 * the lexicon order (peanut before nut so "بادام‌زمینی" resolves to peanut, not nut). Over-detection is acceptable
 * (the confirm step lets the user reject); a MISS is the only costly error, so the name lists are generous.
 *
 * Matching rule (guardian-hardened, BOTH scripts): a name matches only on a WHOLE-WORD boundary, never inside a
 * longer word. ASCII-Latin single words use \b (+ optional plural -s) so 'nut' ≠ coconut/butternut/nutmeg, 'fish'
 * ≠ shellfish/jellyfish, 'egg' ≠ eggplant. Persian/multi-word names use a UNICODE letter-boundary (the name must
 * be flanked by a non-letter or a string edge) so 'تن'(tuna) ≠ تنور(oven), 'شیر'(milk) ≠ شیرینی(sweets), 'جو'
 * (barley) ≠ جوجه(chicken). A matched non-Latin name is consumed from the working text so a longer allergen does
 * not leak into a shorter one (peanut 'بادام زمینی' is stripped before nut 'بادام' is scanned).
 */
export function extractStatedAllergens(text: unknown): ExtractedAllergen[] {
  const t = normalizeText(text);
  if (!t) return [];
  const out: ExtractedAllergen[] = [];
  const seen = new Set<string>();
  let scan = t; // mutated for non-Latin matches so a longer name cannot leak into a shorter one
  for (const e of NORM_LEXICON) {
    for (const name of e.names) {
      if (!name) continue;
      const latinWord = /^[a-z]+$/.test(name); // single ASCII word
      let hit: boolean;
      if (latinWord) {
        hit = new RegExp(`\\b${name}s?\\b`).test(scan); // ASCII word boundary + optional plural -s
      } else {
        // Persian / multi-word: name must be flanked by a non-letter or a string edge (\b is ASCII-only and never
        // sits between two Persian letters, so it cannot be used here). Names hold only letters/spaces — safe in a regex.
        hit = new RegExp(`(^|[^\\p{L}])${name}([^\\p{L}]|$)`, 'u').test(scan);
      }
      if (hit) {
        if (!seen.has(e.token)) {
          seen.add(e.token);
          out.push({ token: e.token, label: e.label });
        }
        if (!latinWord) scan = scan.split(name).join(' '); // consume the mention before later overlapping tokens
      }
    }
  }
  return out;
}
