/**
 * Recipe integrity & normalization (GARNISH-RECIPE-L4-07) — pure, deterministic.
 *
 * Per-recipe integrity report (admin/internal): resolves ingredient refs against the 1008 dictionary
 * (via the dictionary entry already joined onto each RecipeIngredient — never fabricates a link),
 * derives allergens from resolved ingredients (INFORMATIONAL, not a safety guarantee), normalizes
 * diet/categories/mealType/occasion to controlled vocabularies (flags non-canonical), and sanity-checks
 * timings + servings. NO medical claims; missing data stays missing.
 */
import { toStringArray, norm } from '../../ai/tools/grounding-utils';

export const DIET_VOCAB = ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian', 'mediterranean', 'keto', 'low_carb', 'paleo', 'halal', 'kosher'];
export const MEALTYPE_VOCAB = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface IntegrityReport {
  recipeId: string;
  ingredientResolution: { total: number; resolved: number; unresolved: number; unresolvedNames: string[]; coveragePct: number };
  derivedAllergens: { allergens: string[]; source: 'resolved_ingredient_dictionary'; informationalOnly: true };
  declaredAllergens: string[];
  vocabulary: { diet: VocabCheck; mealType: VocabCheck; categories: CategoryCheck; occasion: CategoryCheck };
  timing: { prepMin: number | null; cookMin: number | null; totalMin: number | null; consistent: boolean | null; note: string };
  servings: { value: number | null; sane: boolean };
  overallStatus: 'ok' | 'warnings' | 'incomplete';
  warnings: string[];
}

interface VocabCheck { value: string | null; normalized: string | null; canonical: boolean }
interface CategoryCheck { values: string[]; nonCanonical: string[] }

/** Dictionary allergen Json shape is {eu14:[],us9:[],other:[],mayContain:[]}; flatten to a clean set. */
export function extractDictionaryAllergens(allergensJson: unknown): string[] {
  if (!allergensJson || typeof allergensJson !== 'object') return [];
  const out = new Set<string>();
  for (const key of ['eu14', 'us9', 'other', 'mayContain']) {
    const arr = (allergensJson as Record<string, unknown>)[key];
    for (const a of Array.isArray(arr) ? arr : []) if (typeof a === 'string' && a.trim()) out.add(a.trim().toLowerCase());
  }
  return [...out].sort();
}

function parseMinutes(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const m = value.match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

function vocabCheck(value: unknown, vocab: string[]): VocabCheck {
  const v = typeof value === 'string' && value.trim() ? value.trim() : null;
  if (!v) return { value: null, normalized: null, canonical: true }; // absent is allowed (missing stays missing)
  const n = norm(v);
  return { value: v, normalized: n, canonical: vocab.includes(n) };
}

function categoryCheck(value: unknown, vocab?: string[]): CategoryCheck {
  const values = toStringArray(value);
  const nonCanonical = vocab ? values.filter((x) => !vocab.includes(norm(x))) : [];
  return { values, nonCanonical };
}

/**
 * Analyze a presented recipe (with `ingredients[].ingredient` dictionary join when resolved).
 * Pure — no DB. The service layer may add best-effort name-match suggestions for unresolved names.
 */
export function analyzeRecipeIntegrity(recipe: any): IntegrityReport {
  const ingredients: any[] = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const resolvedIngredients = ingredients.filter((i) => i?.ingredient || i?.ingredientId);
  const unresolved = ingredients.filter((i) => !i?.ingredient && !i?.ingredientId);
  const unresolvedNames = unresolved.map((i) => String(i?.name ?? '')).filter(Boolean);

  // derived allergens (informational) from the resolved dictionary entries
  const derived = new Set<string>();
  for (const i of resolvedIngredients) {
    for (const a of extractDictionaryAllergens(i?.ingredient?.allergens)) derived.add(a);
  }

  const prepMin = parseMinutes(recipe?.prepTime);
  const cookMin = parseMinutes(recipe?.cookingTime);
  const totalMin = parseMinutes(recipe?.totalTime);
  let consistent: boolean | null = null;
  let timingNote = 'insufficient timing data';
  if (totalMin != null && (prepMin != null || cookMin != null)) {
    const sum = (prepMin ?? 0) + (cookMin ?? 0);
    consistent = Math.abs(sum - totalMin) <= Math.max(5, totalMin * 0.2); // 20% or 5min tolerance
    timingNote = consistent ? 'prep+cook ≈ total' : `prep+cook (${sum}m) differs from total (${totalMin}m)`;
  }

  const servingsVal = typeof recipe?.servings === 'number' ? recipe.servings : null;
  const servingsSane = servingsVal == null ? true : servingsVal > 0 && servingsVal <= 100;

  const diet = vocabCheck(recipe?.diet, DIET_VOCAB);
  const mealType = vocabCheck(recipe?.mealType, MEALTYPE_VOCAB);
  const categories = categoryCheck(recipe?.categories);
  const occasion = categoryCheck(recipe?.occasion);

  const warnings: string[] = [];
  if (unresolvedNames.length) warnings.push(`${unresolvedNames.length} ingredient(s) unresolved against the dictionary`);
  if (!diet.canonical) warnings.push(`non-canonical diet value: ${diet.value}`);
  if (!mealType.canonical) warnings.push(`non-canonical mealType value: ${mealType.value}`);
  if (consistent === false) warnings.push('timing inconsistency (prep+cook vs total)');
  if (!servingsSane) warnings.push('implausible servings');

  const total = ingredients.length;
  const overallStatus: IntegrityReport['overallStatus'] = total === 0 ? 'incomplete' : warnings.length ? 'warnings' : 'ok';

  return {
    recipeId: String(recipe?.id ?? ''),
    ingredientResolution: {
      total,
      resolved: resolvedIngredients.length,
      unresolved: unresolved.length,
      unresolvedNames,
      coveragePct: total ? Math.round((resolvedIngredients.length / total) * 100) : 0,
    },
    derivedAllergens: { allergens: [...derived].sort(), source: 'resolved_ingredient_dictionary', informationalOnly: true },
    declaredAllergens: toStringArray(recipe?.allergens).map((a) => a.toLowerCase()),
    vocabulary: { diet, mealType, categories, occasion },
    timing: { prepMin, cookMin, totalMin, consistent, note: timingNote },
    servings: { value: servingsVal, sane: servingsSane },
    overallStatus,
    warnings,
  };
}
