/**
 * Canonical ingredient-text normalization (E11).
 *
 * This MUST reproduce the canonicalization used to build the phase-one
 * `normalized` alias registry, otherwise runtime lookups miss. It was
 * calibrated empirically: this exact transform is idempotent on 100% of the
 * 10,630 registry keys (verified via scripts/dev/resolver-calibration.cjs) and
 * yields 100% combined alias+name coverage over the 1,008 ingredients.
 *
 * Key subtlety discovered during calibration: the registry PRESERVES the
 * Arabic madda (آ U+0622), alef-maksura (ى U+0649), and the hamza forms
 * (ئ U+0626, ؤ U+0624). We must NOT fold those, or we diverge from the keys.
 */
export function normalizeIngredientText(input: string | null | undefined): string {
  if (input == null) return '';
  return String(input)
    .normalize('NFKC')
    // harakat / tashkeel (ً ٌ ٍ َ ُ ِ ّ ْ) + superscript alef (ٰ)
    .replace(/[ً-ْٰ]/g, '')
    // tatweel (ـ)
    .replace(/ـ/g, '')
    // ZWSP/ZWNJ/ZWJ + directional/bidi marks
    .replace(/[​-‏‪-‮]/g, '')
    // Arabic yeh (ي) -> Persian yeh (ی); alef-maksura (ى) is preserved
    .replace(/ي/g, 'ی')
    // Arabic kaf (ك) -> Persian kaf (ک)
    .replace(/ك/g, 'ک')
    // hamza-alef (أ إ) -> bare alef (ا); madda (آ) is preserved
    .replace(/[أإ]/g, 'ا')
    // teh marbuta (ة) -> heh (ه)
    .replace(/ة/g, 'ه')
    // Persian digits (۰-۹) -> ASCII
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    // Arabic-Indic digits (٠-٩) -> ASCII
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
