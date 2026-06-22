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
  { token: 'nut', label: 'آجیل/مغزها', names: ['گردو', 'بادام', 'پسته', 'فندق', 'بادام هندی', 'کاجو', 'نارگیل', 'مغز', 'اجیل', 'tree nut', 'treenut', 'walnut', 'almond', 'pistachio', 'hazelnut', 'cashew', 'pecan', 'noot', 'noten', 'walnoot', 'amandel'] },
  { token: 'dairy', label: 'لبنیات', names: ['شیر', 'لبنیات', 'پنیر', 'ماست', 'خامه', 'کره', 'لاکتوز', 'dairy', 'milk', 'cheese', 'yogurt', 'lactose', 'melk', 'kaas', 'zuivel'] },
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
 * Returns the distinct EU-14 allergens named in the text, as canonical chip tokens + Persian labels. Order is
 * the lexicon order (peanut before nut so "بادام‌زمینی" resolves to peanut, not nut). Over-detection is acceptable
 * (the confirm step lets the user reject); a MISS is the only costly error, so the name lists are generous.
 */
export function extractStatedAllergens(text: unknown): ExtractedAllergen[] {
  const t = normalizeText(text);
  if (!t) return [];
  const out: ExtractedAllergen[] = [];
  const seen = new Set<string>();
  // Strip each matched name from the working text so a longer allergen does not leak into a shorter substring
  // match later (peanut⊃بادام→nut, shellfish⊃fish). Lexicon order puts the more-specific token first.
  let scan = t;
  for (const e of NORM_LEXICON) {
    for (const name of e.names) {
      if (name && scan.includes(name)) {
        if (!seen.has(e.token)) {
          seen.add(e.token);
          out.push({ token: e.token, label: e.label });
        }
        scan = scan.split(name).join(' '); // consume the mention before later (substring-overlapping) tokens scan
      }
    }
  }
  return out;
}
