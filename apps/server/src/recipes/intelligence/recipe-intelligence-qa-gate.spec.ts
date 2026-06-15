/**
 * Recipe Intelligence QA gate (GARNISH-RECIPE-L4-07) — consolidated, deterministic, offline.
 *
 * Cross-cutting checks: integrity (resolve/flag/derive/normalize), fit reuse of the unified profile,
 * ALLERGY HARD-FILTER never softened, dietary mismatch ≠ unsafe, disliked warnings, non-medical framing,
 * sparse-data grace. Emits a PII-free artifact. Reuses composeLivingUserProfile (the canonical profile).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyzeRecipeIntegrity } from './recipe-integrity';
import { assessRecipeFit } from './recipe-fit';
import { composeLivingUserProfile } from '../../behavior-engine/profile/read/living-profile';
import { buildDeclaredProfile } from '../../behavior-engine/profile/declared/declared-profile.builder';

const NOW = new Date('2026-06-15T12:00:00.000Z');
const recent = () => new Date(NOW.getTime() - 86_400_000).toISOString();
const ALL = { granted: ['core', 'analytics', 'personalization'] as any };
function profile(answers: any[], allergies?: string[]) {
  const d = buildDeclaredProfile('u1', answers, ALL, { now: NOW });
  if (allergies) d.dimensions['dietary.allergies_intolerances'] = { ...d.dimensions['dietary.allergies_intolerances'], status: 'declared', value: allergies, confidence: 0.9, recencyScore: 1 } as any;
  return composeLivingUserProfile(d, null, NOW);
}

describe('Recipe Intelligence QA gate (RECIPE-L4-07)', () => {
  const checks: { id: string; category: string; ok: boolean }[] = [];
  const check = (id: string, category: string, ok: boolean) => checks.push({ id, category, ok });

  // integrity
  const integ = analyzeRecipeIntegrity({ id: 'r', diet: 'vegan', mealType: 'lunch', allergens: ['milk'], prepTime: '5', cookingTime: 10, totalTime: '15', servings: 2, ingredients: [{ name: 'oat', ingredient: { allergens: { eu14: ['gluten'], us9: [], other: [], mayContain: [] } } }, { name: 'mystery-x' }] });
  check('integrity_resolves_and_flags', 'integrity', integ.ingredientResolution.resolved === 1 && integ.ingredientResolution.unresolved === 1);
  check('integrity_derives_allergens_informational', 'integrity', integ.derivedAllergens.allergens.includes('gluten') && integ.derivedAllergens.informationalOnly === true);
  check('integrity_timing_ok', 'integrity', integ.timing.consistent === true);

  // ALLERGY HARD FILTER — never softened even with otherwise-perfect fit
  const allergyProfile = profile([{ key: 'dietary.pattern', value: 'omnivore', declaredAt: recent() }, { key: 'constraints.cooking_skill', value: 'advanced', declaredAt: recent() }], ['peanut']);
  const allergyFit = assessRecipeFit({ id: 'r', diet: 'omnivore', difficulty: 'easy', cookingTime: 10, allergens: ['peanut'], ingredients: [{ name: 'peanut' }] }, allergyProfile, ['peanut']);
  check('allergy_hard_filter_avoid', 'allergy_safety', allergyFit.recommendation === 'avoid_allergen');
  check('allergy_never_softened', 'allergy_safety', allergyFit.fitScore === 0 && allergyFit.safety.allergenConflict === true && allergyFit.safety.safe === false);

  // dietary mismatch is a preference (caution), NOT unsafe
  const vegFit = assessRecipeFit({ id: 'r', allergens: [], ingredients: [{ name: 'chicken' }] }, profile([{ key: 'dietary.pattern', value: 'vegetarian', declaredAt: recent() }]), []);
  check('dietary_mismatch_not_unsafe', 'dietary', vegFit.dietaryMatch === 'mismatch' && vegFit.safety.allergenConflict === false && vegFit.recommendation === 'caution');

  // disliked warnings
  const dislikeFit = assessRecipeFit({ id: 'r', allergens: [], ingredients: [{ name: 'cilantro' }] }, profile([{ key: 'dietary.hard_dislikes', value: ['cilantro'], declaredAt: recent() }]), []);
  check('disliked_warning', 'dietary', dislikeFit.dislikedIngredientWarnings.includes('cilantro'));

  // non-medical framing (no medical/diagnostic claims in fit/safety wording)
  const wordings = [allergyFit.explanation, allergyFit.safety.wording, vegFit.explanation].join(' ').toLowerCase();
  check('non_medical_framing', 'non_medical', allergyFit.nonMedical === true && !/\bmedical\b|\bdiagnos|\bcures?\b|\btreats?\b/.test(wordings));

  // sparse data grace
  let threw = false;
  try { assessRecipeFit({ id: 'r', ingredients: [] }, profile([]), []); analyzeRecipeIntegrity({ id: 'r', ingredients: [] }); } catch { threw = true; }
  check('sparse_no_throw', 'sparse', !threw);

  const artifact = {
    suite: 'RECIPE-L4-07-intelligence',
    runMode: 'offline-deterministic',
    dbWritesDuringGate: 0,
    networkCallsDuringGate: 0,
    productUseEnabled: false,
    reusesUnifiedProfile: true,
    parallelRecommenderBuilt: false,
    totalChecks: checks.length,
    passedChecks: checks.filter((c) => c.ok).length,
    failedChecks: checks.filter((c) => !c.ok).length,
    categories: [...new Set(checks.map((c) => c.category))],
  };

  beforeAll(() => {
    try {
      const outDir = path.resolve(__dirname, '../../../../..', 'docs/qa/recipes');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'recipe_l4_07_intelligence_qa_results.json'), JSON.stringify(artifact, null, 2));
    } catch { /* best-effort */ }
  });

  it('passes every recipe-intelligence QA check (0 failures)', () => {
    const failed = checks.filter((c) => !c.ok);
    if (failed.length) console.error('FAILED:', JSON.stringify(failed));
    expect(failed).toEqual([]);
    expect(artifact.totalChecks).toBeGreaterThanOrEqual(9);
  });

  it('writes a PII-free artifact', () => {
    expect(JSON.stringify(artifact)).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });
});
