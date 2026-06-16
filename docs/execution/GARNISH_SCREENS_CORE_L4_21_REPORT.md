# GARNISH-SCREENS-CORE-L4-21 — core daily screens → approved GES design (on real APIs)

**Branch:** `exec/garnish-screens-core-l4-21` · **Baseline:** master `fad6824e` (after S20/DS-ALIGN) ·
**Scope:** Track 5 / S21 — FRONTEND only, the 5 core daily screens, composing the S20 component library on the
real Track 1–4 APIs. No backend change, no shared-component rewrite, no other pages.

---

## Phase 0 — intake (per screen: correct vs must-change)

| Screen | Already correct | Changed to match the design |
|---|---|---|
| **Home** | tokens, GES skeleton/error states, RecipeCard | added FoodDnaRing (real `profile.maturity.band`), GamificationStrip (`/gamification/me`), AIWhisper (top pick), two `Chip` category rows, empty state; kept all APIs/events |
| **Recipe Detail** | sub-component structure (hero/byline/accordions/similar) | consumes `GET /recipes/:id/full` → fit treatment + WhyChip/WhySheet + AllergenMark (demoted) + AI Sheet entry; NutritionCard → GES NutritionBadge + non-medical caption; **2 hex (gradient) + rgba → tokens** |
| **Discovery** (`recipes/page`) | RecipeCard grid + pagination | rebuilt as Discovery: kit `TextField` search, browse view (Chip rows + rail), active results with **why-lines** (`_search.matchedTerms`), **unmetSearch** captured-intent state; `#FF6B35`/`#1A237E`/rgba → tokens |
| **Meal Plan** | ProposePlanPanel (already proposes-not-auto) | MealSlotCard (filled/empty); proposals rendered as MealSlotCard **`suggested`** with explicit per-slot confirm; **11 hex → 0** |
| **Shopping List** | from-plan + manual add flows | GroceryRow grouped by aisle + MergeChip provenance (computed from plan) + no-shame "گرفتم" group; **4 hex → 0** |
| Category | RecipeCard grid | kit states + SectionHeader; dropped `🍽️` glyph; `#FF6B35`/`navy.9` → tokens |

Confirmed: **frontend-only, every existing API call + analytics event preserved.**

## Real APIs consumed (no backend change)
- `useRecipes()` (`/recipes`), `/recommendations`, **`/recipes/search`** (recipe[] + `_search.matchedTerms`; unmetSearch = empty for q≥2),
  **`GET /profile`** (`maturity.band` ∈ empty|forming|developing|mature → FoodDnaRing), **`GET /gamification/me`**
  (streak/mastery/achievements → GamificationStrip), **`GET /recipes/:id/full`** (authed → `fit.recommendation`
  great_fit/ok/caution/avoid_allergen + `fit.safety.conflictingAllergens` + `fit.reasons`), `/recipes/:id/similar`,
  `/meal-plans/propose` (+ existing add/remove/generate), `/shopping-list/*`. All token-gated calls degrade
  honestly (section hidden) when unavailable.

## Safety / honesty (the brand) — intact
- **Honest fit treatment** on Recipe Detail (StatusBadge tone per recommendation); **allergy DEMOTED, not hidden**
  — `avoid_allergen` shows an AllergenMark + a calm "shown so you decide, with caution" note; the recipe is never
  removed, and declared allergies remain the hard safety signal from the server.
- **Nutrition** always carries the GES NutritionBadge (source/confidence = estimate) + the non-medical caption.
- **Meal plan PROPOSES, never auto-applies** — `/propose` writes nothing; each suggested MealSlotCard requires an
  explicit Confirm to add (E47 Annex).
- **unmetSearch** is a captured-intent moment (honest "we don't have X yet → ask the assistant"), no fabrication.
- **No-shame** shopping ("گرفتم" group, strike not red), kind voice throughout; AI only as disclosed Whisper/Sheet.

## 4 states each
Every data screen renders default / loading (GES LoadingSkeleton) / empty (GES EmptyState with a way forward) /
error (GES ErrorState + retry). Plan/Shopping error states are driven by the in-page data query (`isError`).

## Real imagery
RecipeCard's branded placeholder (S20) is the image treatment everywhere — no letter/emoji recipe glyphs (the
ingredient-picker emojis are decorative affordances inside the add-modal, not recipe imagery).

---

## PHASE 2 — isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-screens-core-l4-21
HEAD is now at 22fcf785 feat(SCREENS-CORE-L4-21): align 5 core daily screens to GES kit on real APIs

$ pnpm --dir ../garnish-verify install --frozen-lockfile
Done in 30.5s                         # frozen lockfile → NO dependency changes

$ pnpm --dir ../garnish-verify/apps/server exec prisma generate
prisma ok

$ pnpm --dir ../garnish-verify build            # web (vite) + server (nest)
garnish-app:build: ✓ built in 3.25s
Tasks:    2 successful, 2 total                  # exit 0

$ pnpm --dir ../garnish-verify coverage:check
coverage: mapped=66 internal=15 admin=46 deferred=14 must-render=0 | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED. (warnings/debt above are non-blocking)

$ pnpm --dir ../garnish-verify test
server:test: Test Suites: 191 passed, 191 total
server:test: Tests:       1412 passed, 1412 total     # 0 skips (= baseline; frontend adds no server tests)

$ git -C ../garnish-verify status --short            # only docs/qa + coverage.generated regen churn (NOT committed)
$ git -C ../garnish-verify diff --name-only master..HEAD   # 8 files (below)
$ git worktree remove ../garnish-verify --force ; git worktree prune ; rm -rf ../garnish-verify
```

**Diff vs master (8 files — all frontend, within the 5 screen areas):**
`app/home/page.jsx`, `app/recipe/[id]/page.jsx`, `app/recipe/[id]/components/NutritionCard.jsx`,
`app/recipes/page.jsx`, `app/plan/page.jsx`, `app/plan/components/ProposePlanPanel.jsx`,
`app/shopping-list/page.jsx`, `app/category/[keyword]/page.jsx`. **No `apps/server/**`, no shared `components/**`,
no hooks, no other pages, no layout.**

**Scope-proof:** hardcoded hex removed (grep `#hex|rgba(` over all 6 page files + NutritionCard + ProposePlanPanel
= 0 matches; plan 11→0, shopping 4→0, recipe 2→0); kit composed (grep FoodDnaRing/GamificationStrip/MealSlotCard/
GroceryRow/MergeChip/NutritionBadge/AllergenMark/WhyChip/Chip/TextField across the pages = present on every screen);
fit treatment + allergen demoted-not-hidden + nutrition badge+caption + proposes-not-auto + unmetSearch + no-shame
present; 4 states each; real imagery via branded placeholder; APIs preserved; RTL + reduced-motion; no new dep;
server tests 1412 / 0 skips; build green. (Web has no render-test runner — pre-existing infra gap; the vite build
is the runnable frontend gate, as in prior sprints.)

---

## REQUIRED VERDICT BLOCK

```
SCREENS_CORE_L4_21 RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
Screens aligned to design: Home=ok, Recipe Detail=ok, Discovery/Search=ok, Meal Plan=ok, Shopping=ok (+Category)
Composed from S20 kit (FoodDnaRing/GamificationStrip/MealSlotCard/GroceryRow/NutritionBadge/AllergenMark/etc.) = yes
Tokenized: hardcoded hex removed (plan 11→0, shopping 4→0, recipe 2→0) = yes (grep 0 hex/rgba in all touched page+component files)
Safety/honesty intact: fit treatment + allergen demoted-not-hidden + nutrition badge+caption + proposes-not-auto + unmetSearch + no-shame = yes
4 states each (default/loading/empty/error) = yes
Real imagery/placeholder (no letter glyphs) = yes
Frontend-only: APIs preserved, no shared-component/backend/other-page change = yes
Boundaries: new-dep=NONE, newIngredientIDs=0, medical-framing=NONE, PII=none, runtime-shadow untouched, RTL+reduced-motion = yes
Coverage gate: green
Merge/push: exec/garnish-screens-core-l4-21 → master ff/pushed (commit 22fcf785 + report)
Verdict: SCREENS_CORE_L4_21_PASS
```

> **Next:** S22 builds the missing screens (onboarding/Food DNA flow, Cook Mode, notifications, preferences,
> weekly story) and aligns remaining secondary pages.
