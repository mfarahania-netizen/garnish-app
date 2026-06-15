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

const MEAT_TOKENS = ['chicken', 'beef', 'lamb', 'pork', 'meat', 'poultry', 'fish', 'seafood', 'shrimp', 'مرغ', 'گوشت', 'ماهی', 'میگو', 'گوسفند'];
const VEG_RESTRICTIONS = new Set(['vegetarian', 'vegan']);

export type FitRecommendation = 'great_fit' | 'ok' | 'caution' | 'avoid_allergen';

export interface RecipeSafetyCheck {
  allergenConflict: boolean;
  conflictingAllergens: string[];
  dietaryRestrictionConflict: boolean;
  dietaryRestriction: string | null;
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

/** HARD safety check — declared allergies are never softened. */
export function recipeSafetyCheck(recipe: any, profile: any, derivedAllergens: string[] = []): RecipeSafetyCheck {
  const allergSet = recipeAllergenSet(recipe, derivedAllergens);
  // the reconciled allergy set is the declared, safety-critical set (always respected)
  const profileAllergies = toStringArray(profileDim(profile, 'reconciled', 'allergies')?.reconciledValue).map((a) => a.toLowerCase());
  const conflicting = allergSet.filter((a) => profileAllergies.some((p) => looseMatch(a, p)));

  const dietaryRestriction = (() => {
    const v = profileDim(profile, 'reconciled', 'dietary_pattern')?.reconciledValue;
    return typeof v === 'string' && (VEG_RESTRICTIONS.has(v) || v === 'pescatarian' || v === 'halal' || v === 'kosher') ? v : null;
  })();
  const dietaryRestrictionConflict = Boolean(dietaryRestriction && VEG_RESTRICTIONS.has(dietaryRestriction) && recipeHasMeat(recipe, allergSet));

  const allergenConflict = conflicting.length > 0;
  const safe = !allergenConflict; // dietary mismatch is a preference conflict, not an unsafe flag
  const wording = allergenConflict
    ? `Contains ingredients linked to your declared allergy/intolerance (${conflicting.join(', ')}). This is flagged for your safety and is informational, not a guarantee — always check the full ingredient list.`
    : dietaryRestrictionConflict
      ? `This recipe appears to include items outside your declared "${dietaryRestriction}" pattern.`
      : 'No declared allergy conflict detected (informational only — always verify ingredients).';

  return { allergenConflict, conflictingAllergens: conflicting, dietaryRestrictionConflict, dietaryRestriction, safe, wording };
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

  // recommendation + score (allergen conflict dominates — never softened)
  let recommendation: FitRecommendation;
  let fitScore: number;
  if (safety.allergenConflict) {
    recommendation = 'avoid_allergen';
    fitScore = 0;
    reasons.unshift('declared allergy conflict (safety — not overridden)');
  } else {
    let score = 0.6;
    if (dietaryMatch === 'match') score += 0.2;
    if (dietaryMatch === 'mismatch') score -= 0.3;
    if (effortFit === 'fit') score += 0.1;
    if (effortFit === 'stretch') score -= 0.1;
    if (skillFit === 'fit') score += 0.1;
    if (skillFit === 'stretch') score -= 0.1;
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
