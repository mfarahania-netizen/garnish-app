import * as fs from 'fs';
import * as path from 'path';
import { allergensConflict, canonicalizeAllergens } from './recipe-integrity';

/**
 * CRITICAL regression (final-audit fix): the hard allergy gate was FAILING OPEN on the live corpus because recipes
 * store allergens in PERSIAN while the profile chips are English ids, and the canonicalizer had ZERO Persian keys —
 * the two sides never intersected, so a nut-allergic user was served a nut dish. This test reads the ACTUAL recipe
 * allergen tokens from the shipped corpus and proves each one is caught by its declared chip. The prior
 * "gate-effective" check (canonicalizeAllergens([token]).length>0) was insufficient — it never proved an
 * INTERSECTION with a real recipe token.
 */

// recipe token (as authored, Persian) → the onboarding chip id a user would declare for it.
const CORPUS_TOKEN_TO_CHIP: Record<string, string> = {
  'لبنیات': 'dairy',
  'گلوتن': 'gluten',
  'آجیل': 'nut',
  'تخم‌مرغ': 'egg', // contains a ZWNJ as authored
  'ماهی': 'fish',
  'میگو': 'shellfish',
  'کنجد': 'sesame',
  'سویا': 'soy',
};

function readCorpusTokens(): string[] {
  const file = path.resolve(__dirname, '../../../../../packages/shared/data/recipes_metadata.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const arr: any[] = Array.isArray(data) ? data : data.recipes || Object.values(data);
  const toks = new Set<string>();
  for (const r of arr) for (const a of r.allergens || []) if (typeof a === 'string' && a.trim()) toks.add(a);
  return [...toks];
}

describe('hard allergy gate ↔ REAL recipe corpus (no fail-open)', () => {
  it('every distinct recipe allergen token conflicts with at least one declared chip', () => {
    const CHIPS = ['gluten', 'dairy', 'egg', 'nut', 'peanut', 'shellfish', 'fish', 'soy', 'sesame', 'mustard', 'celery', 'lupin', 'sulphites'];
    const tokens = readCorpusTokens();
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      // a recipe carrying `token` MUST be flagged for SOME declared allergy — else the gate fails open.
      expect(allergensConflict([token], CHIPS).length).toBeGreaterThan(0);
    }
  });

  it('each corpus token conflicts with its SPECIFIC chip (right allergen, not just any)', () => {
    for (const [token, chip] of Object.entries(CORPUS_TOKEN_TO_CHIP)) {
      expect(allergensConflict([token], [chip]).length).toBeGreaterThan(0); // e.g. recipe 'آجیل' vs chip 'nut'
    }
  });

  it('canonicalization is symmetric: the Persian token and its chip fold to a shared canonical token', () => {
    for (const [token, chip] of Object.entries(CORPUS_TOKEN_TO_CHIP)) {
      const recipeCanon = new Set(canonicalizeAllergens([token]));
      const chipCanon = canonicalizeAllergens([chip]);
      expect(chipCanon.some((c) => recipeCanon.has(c))).toBe(true);
    }
  });

  it('does NOT over-block: an unrelated recipe token is not flagged for a different allergy', () => {
    expect(allergensConflict(['ماهی'], ['nut'])).toEqual([]); // fish recipe, nut allergy → no conflict
    expect(allergensConflict(['گلوتن'], ['dairy'])).toEqual([]); // gluten recipe, dairy allergy → no conflict
  });
});
