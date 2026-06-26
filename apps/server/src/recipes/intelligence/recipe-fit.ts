/**
 * Recipe "fit for you" + safety check (GARNISH-RECIPE-L4-07) — pure, deterministic, NON-medical.
 *
 * Reuses the UNIFIED living profile (getLivingUserProfile) — does NOT build a parallel recommender and
 * does NOT touch frozen runtime-shadow. Per-recipe explainable assessment:
 *  - ALLERGEN SAFETY is a HARD filter: a declared allergy (the profile's reconciled, safety-critical
 *    allergy set) is NEVER softened/overridden — any overlap with the recipe's allergens (declared ∪
 *    derived) flags `avoid_allergen`.
 *  - dietary-pattern match (declared restriction respected), effort & skill fit, disliked-ingredient
 *    warnings. Informational only — allergen data is not a safety guarantee; no medical/diet claims.
 */
import { looseMatch, norm, toStringArray } from '../../ai/tools/grounding-utils';
import { famousTier } from '../../ai/tools/famous-dishes';
import { allergensConflict } from './recipe-integrity';

const MEAT_TOKENS = ['chicken', 'beef', 'lamb', 'pork', 'meat', 'poultry', 'fish', 'seafood', 'shrimp', 'مرغ', 'گوشت', 'ماهی', 'میگو', 'گوسفند'];
const VEG_RESTRICTIONS = new Set(['vegetarian', 'vegan']);
// pork is forbidden under halal, kosher, and an explicit no_pork constraint — enforced via Recipe.containsPork
// (authoritative, from gris.dietary) with an ingredient/title token fallback.
// Comprehensive pork carriers for the general-European launch corpus — the token fallback must be reliable
// because Recipe.containsPork is @default(false) and most recipes are not yet authored, so the flag alone
// would miss pork in un-authored recipes (a halal/kosher HARD-invariant leak). Over-flagging is safe.
const PORK_TOKENS = [
  'pork', 'ham', 'bacon', 'lard', 'lardon', 'prosciutto', 'pancetta', 'chorizo', 'salami', 'pepperoni',
  'mortadella', 'speck', 'guanciale', 'gammon', 'bratwurst', 'frankfurter', 'wurst', 'pork rind', 'pork sausage',
  // advisor audit: plain 'sausage' + Dutch 'worst' (rookworst/leverworst) were missing for the EUROPEAN corpus;
  // over-flag is the safe direction here (a chicken-sausage false-positive only over-restricts, never serves
  // pork). NOTE: deliberately NOT adding Persian سوسیس/کالباس — those are typically halal (chicken/beef) in the
  // Iran market, so flagging them as pork would wrongly hide halal food. The real fix is authoring the
  // authoritative Recipe.containsPork flag; these tokens are only a best-effort fallback.
  'sausage', 'worst',
  'gelatin', 'gelatine', 'خوک', 'ژامبون', 'بیکن', 'ژله خوکی',
];
const NO_PORK_CONSTRAINTS = new Set(['no_pork', 'halal', 'kosher']);

export type FitRecommendation = 'great_fit' | 'ok' | 'caution' | 'avoid_allergen' | 'avoid_constraint';

export interface RecipeSafetyCheck {
  allergenConflict: boolean;
  conflictingAllergens: string[];
  dietaryRestrictionConflict: boolean;
  dietaryRestriction: string | null;
  /** observance/cultural constraint (e.g. no-pork for halal/kosher) violated by this recipe. */
  culturalConflict: boolean;
  culturalConstraint: string | null;
  safe: boolean;
  /** safe, non-medical wording; informational. */
  wording: string;
}

export interface RecipeFitAssessment {
  recipeId: string;
  recommendation: FitRecommendation;
  fitScore: number; // 0..1
  safety: RecipeSafetyCheck;
  dietaryMatch: 'match' | 'mismatch' | 'unknown';
  effortFit: 'fit' | 'stretch' | 'unknown';
  skillFit: 'fit' | 'stretch' | 'unknown';
  dislikedIngredientWarnings: string[];
  reasons: string[];
  explanation: string;
  nonMedical: true;
}

function profileDim(profile: any, layer: 'declared' | 'reconciled', key: string): any {
  return profile?.[layer]?.dimensions?.[key] ?? null;
}

function recipeAllergenSet(recipe: any, derivedAllergens: string[]): string[] {
  const declared = toStringArray(recipe?.allergens).map((a) => a.toLowerCase());
  return [...new Set([...declared, ...derivedAllergens.map((a) => a.toLowerCase())])];
}

function recipeHasMeat(recipe: any, allergens: string[]): boolean {
  const ingNames = Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((i: any) => String(i?.name ?? '')) : [];
  const hay = [...ingNames, ...allergens, String(recipe?.title ?? ''), ...toStringArray(recipe?.categories)].map(norm);
  return hay.some((h) => MEAT_TOKENS.some((m) => h.includes(m.toLowerCase())));
}

function recipeContainsPork(recipe: any): boolean {
  if (recipe?.containsPork === true) return true; // authoritative flag (from gris.dietary)
  const ingNames = Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((i: any) => String(i?.name ?? '')) : [];
  const hay = [...ingNames, String(recipe?.title ?? '')].map(norm);
  return hay.some((h) => PORK_TOKENS.some((m) => h.includes(m.toLowerCase())));
}

/** The user's no-pork constraint, if any — from the declared cultural_constraints OR a halal/kosher pattern. */
function userNoPorkConstraint(profile: any): string | null {
  const cultural = toStringArray(profileDim(profile, 'declared', 'dietary.cultural_constraints')?.value).map((c) => c.toLowerCase());
  const hit = cultural.find((c) => NO_PORK_CONSTRAINTS.has(c));
  if (hit) return hit;
  const pattern = profileDim(profile, 'reconciled', 'dietary_pattern')?.reconciledValue;
  return typeof pattern === 'string' && NO_PORK_CONSTRAINTS.has(pattern) ? pattern : null;
}

/** HARD safety check — declared allergies are never softened. */
export function recipeSafetyCheck(recipe: any, profile: any, derivedAllergens: string[] = []): RecipeSafetyCheck {
  const allergSet = recipeAllergenSet(recipe, derivedAllergens);
  // the reconciled allergy set is the declared, safety-critical set (always respected)
  const profileAllergies = toStringArray(profileDim(profile, 'reconciled', 'allergies')?.reconciledValue).map((a) => a.toLowerCase());
  // SAFETY (advisor audit): CANONICAL exact match, not bidirectional substring. The old looseMatch entangled
  // distinct allergens (shellfish⊃fish, peanuts⊃nut) — over-hiding a restricted user's safe dishes invisibly.
  const conflicting = allergensConflict(allergSet, profileAllergies);

  const dietaryRestriction = (() => {
    const v = profileDim(profile, 'reconciled', 'dietary_pattern')?.reconciledValue;
    return typeof v === 'string' && (VEG_RESTRICTIONS.has(v) || v === 'pescatarian' || v === 'halal' || v === 'kosher') ? v : null;
  })();
  const dietaryRestrictionConflict = Boolean(dietaryRestriction && VEG_RESTRICTIONS.has(dietaryRestriction) && recipeHasMeat(recipe, allergSet));

  // observance constraint (no-pork for halal/kosher/no_pork) — a HARD values constraint; pork is never served.
  const culturalConstraint = userNoPorkConstraint(profile);
  const culturalConflict = Boolean(culturalConstraint && recipeContainsPork(recipe));

  const allergenConflict = conflicting.length > 0;
  const safe = !allergenConflict; // dietary/observance mismatch is a preference/values conflict, not an unsafe flag
  const wording = allergenConflict
    ? `Contains ingredients linked to your declared allergy/intolerance (${conflicting.join(', ')}). This is flagged for your safety and is informational, not a guarantee — always check the full ingredient list.`
    : culturalConflict
      ? `Appears to contain pork, which is outside your declared "${culturalConstraint}" requirement.`
      : dietaryRestrictionConflict
        ? `This recipe appears to include items outside your declared "${dietaryRestriction}" pattern.`
        : 'No declared allergy conflict detected (informational only — always verify ingredients).';

  return { allergenConflict, conflictingAllergens: conflicting, dietaryRestrictionConflict, dietaryRestriction, culturalConflict, culturalConstraint, safe, wording };
}

export function assessRecipeFit(recipe: any, profile: any, derivedAllergens: string[] = []): RecipeFitAssessment {
  const safety = recipeSafetyCheck(recipe, profile, derivedAllergens);
  const reasons: string[] = [];

  // dietary match
  let dietaryMatch: RecipeFitAssessment['dietaryMatch'] = 'unknown';
  const dietPattern = profileDim(profile, 'reconciled', 'dietary_pattern')?.reconciledValue;
  if (dietPattern) {
    dietaryMatch = safety.dietaryRestrictionConflict ? 'mismatch' : 'match';
    reasons.push(dietaryMatch === 'match' ? `fits your "${dietPattern}" pattern` : `may not fit your "${dietPattern}" pattern`);
  }

  // effort fit (recipe cookingTime vs reconciled effort)
  let effortFit: RecipeFitAssessment['effortFit'] = 'unknown';
  const effort = profileDim(profile, 'reconciled', 'effort')?.reconciledValue;
  const cookMin = typeof recipe?.cookingTime === 'number' ? recipe.cookingTime : null;
  if (effort && cookMin != null) {
    const wantsQuick = effort === 'prefers_quick' || effort === 'under_15' || effort === '15_30';
    effortFit = wantsQuick && cookMin > 45 ? 'stretch' : 'fit';
    if (effortFit === 'stretch') reasons.push('longer than your usual cooking time');
  }

  // skill fit (recipe difficulty vs reconciled/declared skill)
  let skillFit: RecipeFitAssessment['skillFit'] = 'unknown';
  const skill = profileDim(profile, 'declared', 'constraints.cooking_skill')?.value ?? profileDim(profile, 'reconciled', 'skill')?.reconciledValue;
  const difficulty = norm(recipe?.difficulty);
  if (skill && difficulty) {
    const hard = difficulty.includes('hard') || difficulty.includes('سخت') || difficulty.includes('advanced');
    skillFit = skill === 'beginner' && hard ? 'stretch' : 'fit';
    if (skillFit === 'stretch') reasons.push('more advanced than your stated skill');
  }

  // disliked-ingredient warnings
  const dislikes = toStringArray(profileDim(profile, 'declared', 'dietary.hard_dislikes')?.value).map((d) => d.toLowerCase());
  const ingNames: string[] = Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((i: any) => String(i?.name ?? '')) : [];
  const dislikedIngredientWarnings: string[] = [...new Set(ingNames.filter((n) => dislikes.some((d) => looseMatch(n, d))))];
  if (dislikedIngredientWarnings.length) reasons.push(`includes ingredients you dislike: ${dislikedIngredientWarnings.join(', ')}`);

  // cuisine-style lean (declared traditional/modern) — SOFT: boosts the preferred region, gently lowers the other,
  // but NEVER hides it (the rule: a lean, not a filter; only allergy/observance hard-exclude).
  let styleFit: 'match' | 'mismatch' | 'neutral' = 'neutral';
  const cuisineStyle = String(profileDim(profile, 'declared', 'context.cuisine_style')?.value ?? '');
  const region = String(recipe?.region ?? '').toLowerCase();
  if ((cuisineStyle === 'traditional' || cuisineStyle === 'modern') && (region === 'persian' || region === 'international')) {
    const wantPersian = cuisineStyle === 'traditional';
    styleFit = (wantPersian && region === 'persian') || (!wantPersian && region === 'international') ? 'match' : 'mismatch';
    if (styleFit === 'mismatch') reasons.push('a different style than your usual — still shown, just ranked lower');
  }

  // recommendation + score (allergen conflict dominates — never softened)
  let recommendation: FitRecommendation;
  let fitScore: number;
  if (safety.allergenConflict) {
    recommendation = 'avoid_allergen';
    fitScore = 0;
    reasons.unshift('declared allergy conflict (safety — not overridden)');
  } else if (safety.culturalConflict) {
    recommendation = 'avoid_constraint';
    fitScore = 0;
    reasons.unshift(`contains pork — outside your declared "${safety.culturalConstraint}" requirement`);
  } else {
    let score = 0.6;
    if (dietaryMatch === 'match') score += 0.2;
    if (dietaryMatch === 'mismatch') score -= 0.3;
    if (effortFit === 'fit') score += 0.1;
    if (effortFit === 'stretch') score -= 0.1;
    if (skillFit === 'fit') score += 0.1;
    if (skillFit === 'stretch') score -= 0.1;
    if (styleFit === 'match') score += 0.12;   // lean toward the chosen style…
    if (styleFit === 'mismatch') score -= 0.08; // …without hiding the other (base 0.6 keeps it well above 0)
    const fame = famousTier(recipe?.title); // surface the beloved classics in the cold-start slate (curated popularity prior)
    if (fame === 2) score += 0.15;
    else if (fame === 1) score += 0.08;
    score -= dislikedIngredientWarnings.length * 0.15;
    fitScore = Math.max(0, Math.min(1, Number(score.toFixed(2))));
    recommendation = safety.dietaryRestrictionConflict || dislikedIngredientWarnings.length ? 'caution' : fitScore >= 0.8 ? 'great_fit' : 'ok';
  }

  const explanation = safety.allergenConflict
    ? safety.wording
    : reasons.length ? `Fit assessment: ${reasons.join('; ')}.` : 'No strong personal signals yet — shown as a general suggestion.';

  return {
    recipeId: String(recipe?.id ?? ''),
    recommendation,
    fitScore,
    safety,
    dietaryMatch,
    effortFit,
    skillFit,
    dislikedIngredientWarnings,
    reasons,
    explanation,
    nonMedical: true,
  };
}
