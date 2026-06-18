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

  const slots: ProposedSlot[] = [];
  const usedRecipeIds = new Set<string>();
  const plannedIngredients = new Set<string>();
  const cuisineByDay: Record<number, Set<string>> = {};
  let requested = 0;

  for (let day = 0; day < days; day++) {
    cuisineByDay[day] = new Set();
    for (const meal of meals) {
      requested += 1;
      const weekend = isWeekend(day);

      const mainSlot = isMainMealSlot(meal);
      const scored = candidates
        // S5 COURSE GATE: a main meal slot (breakfast/lunch/dinner) only accepts a main-eligible recipe —
        // a sauce/condiment/side/dessert/drink can NEVER be placed AS a main. (undefined → allowed, so
        // callers that don't derive course are unaffected.) Applied DOWNSTREAM of the allergy HARD-filter.
        .filter((c) => c.mealTypes.includes(meal) && !usedRecipeIds.has(c.recipeId) && (!mainSlot || c.mainMealEligible !== false))
        .map((c) => {
          let score = c.fitScore;
          const reasons: string[] = [];
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
        })
        .sort((a, b) => b.score - a.score || a.c.recipeId.localeCompare(b.c.recipeId));

      if (scored.length === 0) continue; // honest: leave the slot empty rather than repeat/fabricate
      const pick = scored[0];
      const why = [
        ...pick.c.fitReasons.slice(0, 2),
        ...pick.reasons,
      ].filter(Boolean).join('; ') || 'best available fit';
      slots.push({ dayOfWeek: day, mealType: meal, recipeId: pick.c.recipeId, title: pick.c.title, fitScore: Number(pick.score.toFixed(3)), why });
      usedRecipeIds.add(pick.c.recipeId);
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
