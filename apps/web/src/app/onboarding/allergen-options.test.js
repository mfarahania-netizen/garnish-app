import { describe, it, expect } from 'vitest';
import { ALLERGEN_OPTIONS } from './steps';

/**
 * DRIFT GUARD (guardian): the onboarding/Settings allergen chips MUST be exactly the server's canonical
 * EU-14 chip tokens (CANONICAL_ALLERGEN_TOKENS in apps/server/.../allergen-extractor.ts). If a chip id is not a
 * canonical token, the deterministic hard allergy gate can't canonicalize it → a declared allergy silently fails.
 * This list is duplicated here intentionally (cross-package import isn't available); keep BOTH in sync.
 */
const CANONICAL_EU14_CHIP_IDS = [
  'gluten', 'dairy', 'egg', 'nut', 'peanut', 'shellfish', 'fish', 'soy', 'sesame', 'mustard', 'celery', 'lupin', 'sulphites',
];

describe('ALLERGEN_OPTIONS ↔ canonical EU-14 tokens (no chip/gate drift)', () => {
  it('every chip id is a canonical EU-14 token (the hard gate can filter it)', () => {
    const ids = ALLERGEN_OPTIONS.map((o) => o.id);
    for (const id of ids) expect(CANONICAL_EU14_CHIP_IDS).toContain(id);
  });

  it('covers the full declarable EU-14 set (molluscs folded into shellfish)', () => {
    const ids = ALLERGEN_OPTIONS.map((o) => o.id).sort();
    expect(ids).toEqual([...CANONICAL_EU14_CHIP_IDS].sort());
  });

  it('every chip has a non-empty Persian label', () => {
    for (const o of ALLERGEN_OPTIONS) expect(typeof o.label === 'string' && o.label.length > 0).toBe(true);
  });
});
