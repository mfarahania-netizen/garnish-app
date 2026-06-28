/**
 * Intelligent weekly meal-plan generator (GARNISH-PLANNER-L4-09) — pure, deterministic.
 *
 * Given allergy-SAFE, fit-scored candidate recipes (the service pre-filters allergen conflicts via the
 * unified profile + S07 assessRecipeFit) + week constraints, propose a thought-through weekly plan:
 *  - variety/balance: no recipe repeats in the week; avoid the same cuisine on consecutive days,
 *  - effort fit: weekday slots prefer quick recipes, weekends allow more involved ones,
 *  - pantry/leftover reuse: prefer recipes that share ingredients already planned (reduce waste/cost),
 *  - every slot carries a WHY. Deterministic (no randomness; stable tie-break by recipeId).
 *
 * PROPOSES ONLY — it returns a proposal and writes nothing. The user accepts via the existing slot CRUD.
 */
import { isMainMealSlot } from './course';
import { isFamiliarDish } from './familiarity';

export interface PlanCandidate {
  recipeId: string;
  title: string;
  mealTypes: string[]; // eligible slots: 'breakfast' | 'lunch' | 'dinner' (normalized)
  cuisine: string | null;
  categories: string[];
  ingredients: string[]; // normalized ingredient names
  cookingTime: number | null;
  fitScore: number; // 0..1 from assessRecipeFit (allergen-conflicting candidates are NOT passed in)
  fitReasons: string[];
  /** S5 course gate: may this recipe fill a breakfast/lunch/dinner MAIN slot? (undefined = unknown → allowed,
   *  for back-compat with callers that don't derive course). A sauce/dessert/drink/side is false. */
  mainMealEligible?: boolean;
  /** S5: short course label for explainability ('main' | 'sauce' | 'dessert' | …). */
  course?: string;
}

export interface PlanConstraints {
  days?: number; // default 7
  meals?: string[]; // default ['lunch','dinner']
  weekdayQuickMaxMin?: number; // weekday prefers cookingTime <= this (default 30)
  householdSize?: number;
  /** FI-STEP-1.3: recipeIds the user recently declined/removed — excluded from the proposal (additive;
   *  default empty → byte-identical to before). DOWNSTREAM of the allergy HARD-filter (candidates are safe). */
  excludeRecipeIds?: Set<string>;
}

export interface ProposedSlot {
  dayOfWeek: number;
  mealType: string;
  recipeId: string;
  title: string;
  fitScore: number;
  why: string;
}

export interface PlanProposal {
  days: number;
  meals: string[];
  householdSize: number;
  slots: ProposedSlot[];
  summary: { filled: number; requested: number; distinctRecipes: number; distinctCuisines: number };
  notApplied: true; // proposal only — never written by the generator
  limitations: string[];
}

const isWeekend = (day: number) => day === 5 || day === 6; // 0=Sat..6=Fri convention; treat 5,6 as weekend-ish

export function generateMealPlan(candidates: PlanCandidate[], constraints: PlanConstraints = {}): PlanProposal {
  const days = constraints.days ?? 7;
  const meals = constraints.meals ?? ['lunch', 'dinner'];
  const weekdayQuickMax = constraints.weekdayQuickMaxMin ?? 30;
  const householdSize = constraints.householdSize ?? 1;
  const excludeRecipeIds = constraints.excludeRecipeIds ?? new Set<string>(); // recently-declined (additive)

  const slots: ProposedSlot[] = [];
  const usedRecipeIds = new Set<string>();
  const useCount = new Map<string, number>(); // how many times each recipe is placed → spread week-repeats evenly when a meal's distinct pool is thin
  const plannedIngredients = new Set<string>();
  const cuisineByDay: Record<number, Set<string>> = {};
  let requested = 0;

  for (let day = 0; day < days; day++) {
    cuisineByDay[day] = new Set();
    for (const meal of meals) {
      requested += 1;
      const weekend = isWeekend(day);

      const mainSlot = isMainMealSlot(meal);
      const scoreOne = (c: PlanCandidate) => {
        let score = c.fitScore;
        const reasons: string[] = [];
        // familiarity: a well-known/beloved dish leads over an obscure regional one — matters most for a new user with
        // no taste history (where every fitScore is ~neutral, so this is what makes the plan feel sensible, not random).
        if (isFamiliarDish(c.title)) { score += 0.4; reasons.push('a familiar favourite'); }
        // effort fit: weekday prefers quick, weekend tolerates longer
        if (c.cookingTime != null) {
          if (!weekend && c.cookingTime <= weekdayQuickMax) { score += 0.15; reasons.push('quick for a workday'); }
          else if (!weekend && c.cookingTime > weekdayQuickMax) { score -= 0.1; }
          else if (weekend && c.cookingTime > weekdayQuickMax) { score += 0.05; reasons.push('a more involved weekend cook'); }
        }
        // pantry/leftover reuse: shares ingredients already planned
        const reused = c.ingredients.filter((i) => plannedIngredients.has(i));
        if (reused.length) { score += Math.min(0.2, reused.length * 0.05); reasons.push(`reuses ${reused.slice(0, 2).join(', ')}`); }
        // variety: penalize same cuisine on the same day
        if (c.cuisine && cuisineByDay[day].has(c.cuisine)) score -= 0.15;
        return { c, score, reasons };
      };
      const sortByScore = (a: { c: PlanCandidate; score: number }, b: { c: PlanCandidate; score: number }) => b.score - a.score || a.c.recipeId.localeCompare(b.c.recipeId);
      // S5 COURSE GATE (downstream of the allergy HARD-filter): a main slot only accepts a main-eligible recipe —
      // a sauce/condiment/side/dessert/drink can NEVER be placed AS a main. (undefined → allowed.)
      const baseOk = (c: PlanCandidate) => c.mealTypes.includes(meal) && !excludeRecipeIds.has(c.recipeId) && (!mainSlot || c.mainMealEligible !== false);
      // PASS 1 — distinct (no repeat anywhere in the week).
      let scored = candidates.filter((c) => baseOk(c) && !usedRecipeIds.has(c.recipeId)).map(scoreOne).sort(sortByScore);
      // PASS 2 — the meal's DISTINCT pool is exhausted (e.g. the corpus has only a few breakfasts). Allow a WEEK-repeat
      // rather than leave the slot blank (founder bug: 3 breakfasts came back empty). Never repeat the SAME dish in one
      // day, and spread repeats least-used-first so the small pool cycles evenly instead of hammering one dish.
      if (scored.length === 0) {
        const sameDayIds = new Set(slots.filter((s) => s.dayOfWeek === day).map((s) => s.recipeId));
        scored = candidates.filter((c) => baseOk(c) && !sameDayIds.has(c.recipeId)).map(scoreOne)
          .sort((a, b) => ((useCount.get(a.c.recipeId) || 0) - (useCount.get(b.c.recipeId) || 0)) || sortByScore(a, b));
      }
      if (scored.length === 0) continue; // truly nothing eligible for this meal → honest empty
      const pick = scored[0];
      const why = [
        ...pick.c.fitReasons.slice(0, 2),
        ...pick.reasons,
      ].filter(Boolean).join('; ') || 'best available fit';
      slots.push({ dayOfWeek: day, mealType: meal, recipeId: pick.c.recipeId, title: pick.c.title, fitScore: Number(pick.score.toFixed(3)), why });
      usedRecipeIds.add(pick.c.recipeId);
      useCount.set(pick.c.recipeId, (useCount.get(pick.c.recipeId) || 0) + 1);
      for (const ing of pick.c.ingredients) plannedIngredients.add(ing);
      if (pick.c.cuisine) cuisineByDay[day].add(pick.c.cuisine);
    }
  }

  const limitations: string[] = [];
  if (slots.length < requested) limitations.push(`${requested - slots.length} slot(s) left empty — not enough distinct safe recipes for full variety (no repeats/fabrication).`);

  return {
    days,
    meals,
    householdSize,
    slots,
    summary: {
      filled: slots.length,
      requested,
      distinctRecipes: new Set(slots.map((s) => s.recipeId)).size,
      distinctCuisines: new Set(candidates.filter((c) => usedRecipeIds.has(c.recipeId)).map((c) => c.cuisine).filter(Boolean)).size,
    },
    notApplied: true,
    limitations,
  };
}

export interface SwapRequest {
  dayOfWeek: number;
  meal: string;
  excludeRecipeIds: Set<string>; // current slot recipe + recently-declined + anything already shown for this slot
  weekdayQuickMaxMin?: number;
}

/**
 * FI-STEP-1.3 — per-slot «یکی دیگه». Returns the next-best SAFE, course-valid candidate for ONE slot only
 * (no week regenerate), reusing the SAME course gate + effort-fit scoring as generateMealPlan. `candidates`
 * are already allergy-filtered by the service. Returns null if nothing else qualifies (honest — no repeat).
 */
export function proposeSwapForSlot(candidates: PlanCandidate[], req: SwapRequest): ProposedSlot | null {
  const weekend = isWeekend(req.dayOfWeek);
  const weekdayQuickMax = req.weekdayQuickMaxMin ?? 30;
  const mainSlot = isMainMealSlot(req.meal);

  const scored = candidates
    // identical course gate + slot eligibility as generateMealPlan (sauce/dessert never a main; downstream of allergy)
    .filter((c) => c.mealTypes.includes(req.meal) && !req.excludeRecipeIds.has(c.recipeId) && (!mainSlot || c.mainMealEligible !== false))
    .map((c) => {
      let score = c.fitScore;
      const reasons: string[] = [];
      if (c.cookingTime != null) {
        if (!weekend && c.cookingTime <= weekdayQuickMax) { score += 0.15; reasons.push('quick for a workday'); }
        else if (!weekend && c.cookingTime > weekdayQuickMax) { score -= 0.1; }
        else if (weekend && c.cookingTime > weekdayQuickMax) { score += 0.05; reasons.push('a more involved weekend cook'); }
      }
      return { c, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.c.recipeId.localeCompare(b.c.recipeId));

  if (scored.length === 0) return null;
  const pick = scored[0];
  const why = [...pick.c.fitReasons.slice(0, 2), ...pick.reasons].filter(Boolean).join('; ') || 'best available fit';
  return { dayOfWeek: req.dayOfWeek, mealType: req.meal, recipeId: pick.c.recipeId, title: pick.c.title, fitScore: Number(pick.score.toFixed(3)), why };
}
