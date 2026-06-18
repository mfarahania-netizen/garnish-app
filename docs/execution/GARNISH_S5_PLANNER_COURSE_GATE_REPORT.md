# S5 — MEAL-PLANNING BRAIN: COURSE GATE (P3) — Execution Report
**Surface:** Backend planner logic only (`apps/server/src/meal-plans/planner/*`). **Engine FROZEN** (proven).
**Baseline:** `master` @ `2188214e`  ·  **Merged HEAD:** `97a3b866` (ff-merged to master + pushed)
**Status:** all gates GREEN · core proof PASS · allergy block byte-identical → merged. **STOP for founder verification.**
**Date:** 2026-06-18

> Closes the "sauce shows up as dinner" defect. The fix is planner LOGIC + a pure read-time course
> derivation — **no schema change, no data migration, no re-tagging.**

---

## PHASE 0 — root cause + data (confirmed)
1. **Root cause = planner logic.** `parseMealTypes(["side","condiment"])` matches no
   breakfast/lunch/dinner/snack token → hits the permissive fallback `['breakfast','lunch','dinner']`
   (meal-plan-planner.service.ts:30). The generator fills a main slot purely on `c.mealTypes.includes(meal)`
   (meal-plan-generator.ts:73) → "سس پستو" (category `sauce`, mealType `["side","condiment"]`) became
   eligible as a main. ✓
2. **Allergy pre-filter** (`analyzeRecipeIntegrity` → `assessRecipeFit` → `if (allergenConflict ||
   avoid_allergen) { excludedForAllergy++; continue; }`, lines 55-60) — the candidates reaching the
   generator are already allergy-safe; the course gate sits DOWNSTREAM. ✓
3. **Data (350 active+international, 100% mealType coverage).** dishType→DB `category`. HARD non-main:
   `dessert(38) sweet(9) beverage(11) sauce(5) dip(3) side_dish(14) side(2)`. Clear mains:
   `main_course(135) main(77) stew(28) rice(21) grilled(15) pasta(6) curry stir_fry noodles egg_dish …`.
   Ambiguous (defer to mealType): `soup(29) salad(14) appetizer(20) baked fried`. Main mealType tokens:
   `lunch(264) dinner(255) breakfast(27) brunch(6)`. **No migration needed.**
4. **Brain already does** variety (`usedRecipeIds`), pantry-reuse, fit ordering, `why`, AND an effort
   time-fit (generator lines 78-82 already use `cookingTime` for weekday/weekend) — so 1C's optional
   time-fit ALREADY exists; I only added the missing course gate.

## PHASE 1 — fix (planner only)
- **`course.ts` `deriveCourse({category,categories,mealTypeTokens})` → `{course, mainMealEligible}`** (pure).
  Primary signal = mealType main tokens (reliable, 100% coverage). `category` is a HARD veto
  (sauce/dip/condiment/beverage/drink/dessert/sweet/side_dish/side → never a main, even if mistagged lunch)
  + the sane default for genuinely-unmarked-but-clearly-main recipes. **The permissive fallback is removed:**
  non-main-tokens-only / unknown → NOT a main.
- **Generator gate:** a main meal slot (breakfast/lunch/dinner) accepts a candidate only if
  `mainMealEligible !== false` (undefined → allowed, back-compat); snack/non-main slots ungated; variety +
  pantry-reuse + fit ordering unchanged.
- **Service:** selects `category` + attaches `deriveCourse` to each candidate — applied DOWNSTREAM of the
  allergy HARD-filter (which is byte-identical).
- **1D:** Food-DNA-into-planner NOT wired (deferred to S26). The planner still uses `getLivingUserProfile`
  exactly as today (unchanged).

## PHASE 2 — raw evidence (clean-room worktree @ `97a3b866`)
```
pnpm install                                   # 38s
pnpm --dir apps/server build                   # nest build → ok
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )  # 199 suites / 1501 tests / 0 skipped
pnpm --dir apps/server run recsys:eval         # PASS    ai:eval:regression → PASS
git diff --name-only master...HEAD             # meal-plans/planner/* ONLY (5 files)
```
**Core proof** (`meal-plan-course-gate.spec.ts`): the REAL planner over the REAL corpus (active 200 +
international 150) → **no recipe whose category ∈ {sauce,dip,condiment,beverage,drink,dessert,sweet,
side_dish,side} (or exclusively-non-main mealType) is EVER in a breakfast/lunch/dinner slot**; سس پستو / a
dessert / a beverage explicitly never placed. **No regression:** real mains still fill the week + variety
(distinctRecipes == filled). **Allergy intact:** a declared-allergen main is still HARD-excluded
(`excludedForAllergy > 0`). `deriveCourse` unit tests cover every course type + JSON/plural shapes.

**Scope proof — `git diff --name-only master...HEAD` (planner only):**
```
apps/server/src/meal-plans/planner/course.ts          (new)
apps/server/src/meal-plans/planner/course.spec.ts     (new)
apps/server/src/meal-plans/planner/meal-plan-course-gate.spec.ts  (new)
apps/server/src/meal-plans/planner/meal-plan-generator.ts
apps/server/src/meal-plans/planner/meal-plan-planner.service.ts
```
Frozen-leak check = NONE. The allergy block diff is empty (byte-identical). `getLivingUserProfile` /
candidate-generator / recipe-fit / recipe-integrity / recsys pipeline / gamification / orchestrator — not in
the diff.

---

```
VERDICT BLOCK
=============
SPRINT: S5 — MEAL-PLANNING BRAIN: COURSE GATE (P3)
ROOT CAUSE CONFIRMED (parseMealTypes fallback puts sauce in main slot): Y
DATA MIGRATION RUN: NO (course derived from existing category+mealType): Y
ALLERGY PRE-FILTER BYTE-IDENTICAL (diff) + still HARD-excludes: Y
getLivingUserProfile UNCHANGED: Y
CORE PROOF — no sauce/condiment/beverage/dessert/side EVER in a main slot (corpus test): PASS
REAL MAINS still planned + full week + variety + pantry-reuse preserved: Y
deriveCourse unit tests (all course types): PASS
TIME-FIT (optional): already present (generator weekday/weekend cookingTime) — no new work
FOOD-DNA-INTO-PLANNER: deferred to S26 (NOT done here): Y
BUILD: PASS  SERVER SUITE: 199/1501, skipped=0  recsys/ai-eval: PASS/PASS
SCOPE (diff name-only) = planner (+helper,+tests) ONLY: Y
MERGE+PUSH: DONE @97a3b866
```

## AFTER MERGE — STOP for founder verification (desktop)
1. Weekly plan → «بچین» → every breakfast/lunch/dinner slot is a real main dish — no sauce/dessert/drink
   masquerading as a meal.
2. Repeat (different days/meal sets) → still always real mains; week fills; no repeats within the week.
3. (If allergies declared) allergen dishes still never appear.

(Next on the spine: **S3 — Recipe Richness / coverage-gap surfacing**, then the Track-5 L4 visual realization.)
