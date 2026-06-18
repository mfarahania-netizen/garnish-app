/**
 * Course derivation (S5 — MEAL-PLANNING BRAIN: COURSE GATE) — pure, deterministic, READ-TIME ONLY.
 *
 * Fixes the "sauce shows up as dinner" defect WITHOUT any schema change or data migration: it derives a
 * course + main-meal-eligibility from the recipe's EXISTING `category` (the dishType vocab the importer
 * writes — main_course/stew/sauce/dessert/…) + `categories` + `mealType` tokens. It is an ADDITIVE
 * restriction layered on the already-allergy-safe candidates — it only ever EXCLUDES a non-main from a
 * main meal slot, never loosens anything.
 *
 * The reliable primary signal is the mealType token (100% populated; sauces carry side/condiment with no
 * lunch/dinner token); `category` is a hard veto (a sauce mistagged with lunch is still never a main) plus
 * the sane default for a genuinely-unmarked-but-clearly-main recipe. The permissive "unknown → any main
 * meal" fallback (the bug) is removed: non-main tokens only / unknown → NOT a main.
 */
import { norm, toStringArray } from '../../ai/tools/grounding-utils';

/** mealType tokens that mean "this can be a main meal". */
const MAIN_MEAL_TOKENS = new Set(['breakfast', 'lunch', 'dinner', 'brunch']);
/** categories that are NEVER a main meal, no matter the mealType (hard veto). */
const NON_MAIN_CATEGORIES = new Set(['sauce', 'dip', 'condiment', 'beverage', 'drink', 'dessert', 'sweet', 'side_dish', 'side']);
/** categories that are clearly a main course (used as the sane default for genuinely-unmarked recipes). */
const CLEAR_MAIN_CATEGORIES = new Set(['main_course', 'main', 'stew', 'rice', 'kebab', 'pizza', 'pasta', 'grilled', 'street_food', 'curry', 'stir_fry', 'noodles', 'egg_dish', 'roasted', 'fried', 'baked', 'bread', 'flatbread', 'vegetable_dish']);

export interface CourseResult {
  /** a short label for explainability — 'main' | the non-main category | 'accompaniment'. */
  course: string;
  /** true iff this recipe may fill a breakfast/lunch/dinner MAIN slot. */
  mainMealEligible: boolean;
}

/** True iff the slot is a main meal (breakfast/lunch/dinner) — snack/dessert slots are not gated. */
export function isMainMealSlot(meal: unknown): boolean {
  const m = norm(meal);
  return m === 'breakfast' || m === 'lunch' || m === 'dinner';
}

export function deriveCourse(input: { category?: unknown; categories?: unknown; mealTypeTokens?: unknown }): CourseResult {
  const cats = [norm(input.category), ...toStringArray(input.categories).map(norm)].filter(Boolean);
  const tokens = toStringArray(input.mealTypeTokens).map(norm).filter(Boolean);

  const hasMainToken = tokens.some((t) => MAIN_MEAL_TOKENS.has(t));
  const hardNonMainCat = cats.find((c) => NON_MAIN_CATEGORIES.has(c));
  const isClearMainCat = cats.some((c) => CLEAR_MAIN_CATEGORIES.has(c));

  let mainMealEligible: boolean;
  if (hardNonMainCat) mainMealEligible = false;                       // sauce/dessert/beverage/side — never a main
  else if (hasMainToken) mainMealEligible = true;                     // has a real main-meal mealType token
  else if (tokens.length === 0 && isClearMainCat) mainMealEligible = true; // unmarked but clearly a main (sane default)
  else mainMealEligible = false;                                      // non-main tokens only / unknown → NOT a main (kills the permissive fallback)

  const course = hardNonMainCat ? hardNonMainCat : mainMealEligible ? 'main' : cats[0] || 'accompaniment';
  return { course, mainMealEligible };
}
