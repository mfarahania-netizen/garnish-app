# Meal-Plan + Shopping-List → World-Class — Audit & Roadmap

Synthesis of a 4-agent deep audit (meal-plan backend, shopping backend, frontend/UX, world-class benchmarking) run 2026-06-28. Goal (founder mandate): make these two features the **most delightful** part of the app — minimal yet precise, professional, exemplary UX — bug-free, complete, world-class, back **and** front.

## Verdict
The foundation is **honest and safe** (no fake success states, strong allergy/publish gating, real optimistic-revert) — rare and worth keeping. But it is **minimal-correct, not delightful**: a handful of real correctness bugs, a too-thin data model that blocks the world-class features, and almost no "delight layer" (motion, imagery, completion moments, direct manipulation). NN/g rule that orders everything: *usability before delight* — fix the loop first, then add the spring animations.

---

## Part A — REAL BUGS (fix first; correctness/integrity)

### Backend — meal-plan
- **B1 [قطعی] Timezone week-boundary.** `getStartOfWeek` uses server-local time; `weekStart` stored as DateTime. Cross-TZ (Iran/NL vs UTC server) a slot can be written into a different week than is read → **slot silently vanishes**. The single most material bug before Europe. (`utils/date.utils.ts`, `meal-plans.service.ts`)
- **B3 [احتمالاً] `savePlan` doesn't canonicalize mealType** (only `addMealSlot`/`removeMealSlot` do) → a client can persist `«شام»`/`«Dinner»`, grid keys English → slot renders empty. Same class the canon fix targeted, still reachable.
- **B7 No `@@unique([mealPlanId, dayOfWeek, mealType])` on MealSlot** → `savePlan` can write duplicate slots → corrupt grid.
- **B8 `savePlan` runs publish gate but NOT the allergy gate** (slot + AI paths do) → bulk save can persist an allergen-conflicting recipe. Inconsistent.
- **B5 First-concurrent-write race** in `addMealSlot` (findFirst+create) → spurious 500 on the first parallel slot add. Fix with `upsert`.

### Backend — shopping
- **B2 [قطعی] No `@@unique([userId])` on ShoppingList** + create-if-missing with no tx → two concurrent first requests create **two lists** → items split/"disappear" non-deterministically. Highest-risk latent bug.
- **B1 [قطعی] PATCH is broken — can't edit an item.** `toggleItem` ignores the body (which advertises name/amount/isChecked) and just flips the boolean → **no edit path exists**, and check is non-idempotent.
- **B3 [قطعی] `addItems` has zero dedupe** despite callers' docs claiming it → «خیار اضافه کن» twice = two rows; recipe added twice = duplicated ingredients; category lands null → all under «سایر».
- **B4 Over-matching remove** (bidirectional substring) → «نون» also deletes «نون خامه‌ای»; silent over-deletion, no undo.
- **B6 No transactions** anywhere (`buildFromPlan`, remove-loop).

### Frontend / UX
- **No manual per-slot add on the meal plan** (empty slots are dead `—`) → the only way to fill a slot is propose/accept or AI chat. The single worst friction; table-stakes missing.
- **Filled slots are immutable** (delete-then-re-propose only) — no swap/move/edit.
- **`buildFromPlan` silently wipes the user's check-offs** (`setOverrides({})` + refetch) — data-losing surprise.
- **Double safe-area inset** between the sticky page bars and BottomNav (≈34px dead space on notched iPhone).
- **7-day grid: days 4–7 off-screen** with no scroll hint, no "today" auto-scroll-into-view → later days easy to miss on mobile.
- `acceptAll` fires up to 21 sequential POSTs with no progress; check-off has no in-flight lock.

---

## Part B — DATA MODEL upgrades (unlock the world-class features)

**MealSlot** is too thin. Add: `@@unique([mealPlanId, dayOfWeek, mealType])`; `servings Int?` (per-slot portions); `status` + `cookedAt` (mark-cooked → the engagement loop); `position Int` (stable order); `recipe onDelete: SetNull`. Normalize `Recipe.mealType` (single ambiguous String today → drives pool-filter fragility) to a constrained set / `String[]`.

**ShoppingItem / ShoppingList**: `@@unique([userId])` on ShoppingList; `@@index([shoppingListId])` on items (none today). Add to item: `ingredientId` (dictionary FK — already computed in the aggregator then **thrown away**), `category` enum, `source` (`manual`/`recipe:<id>`/`plan` — so re-sync replaces plan items without nuking manual ones), `checkedAt`, `sortOrder`, structured `quantityValue Float?` + unit.

---

## Part C — WORLD-CLASS roadmap (the delight, after the fixes)

**The ONE loop to perfect first (beats Paprika, matches Plan to Eat):**
> meal-plan slot change → instant, optimistic, RTL-correct update → ONE clean **merged, household-scaled, aisle-categorized** shopping list, live-bound. Any slot add/swap/remove rewrites the list instantly and visibly. (Paprika's #1 criticism is that its plan and list are disconnected — never repeat that.)

**Meal plan — ranked delight ÷ effort:**
1. Manual per-slot add (tap empty → recipe-picker sheet; apply path already exists).
2. One-tap **single-slot swap** (you have propose/accept/swap) — make it animated + optimistic (highest-frequency moment).
3. **Mark-cooked → fade** (Mealime) — trivial, quiet daily delight, feeds `cook_complete` analytics.
4. **Free numeric household size** (NOT 2/4/6 or multiples — Mealime/Paprika's documented frustration).
5. Drag-a-recipe-onto-a-day calendar (Plan to Eat/Notion) — *with visible drag handle + drop-target + redundant tap path + RTL-mirrored direction*.
6. Reusable week templates ("Menus") — fits the rice+khoresh+sabzi weekly rhythm.

**Shopping list — ranked:**
1. Make the merge **legible** (tap item → which recipes/slots it came from, like AnyList).
2. **Satisfying + forgiving check-off** (~100ms fill, strike, sink to "got it" section; **undo**; one success haptic).
3. Custom **store-walk aisle order** (drag to reorder categories) with **Persian-authored** defaults.
4. **Bring!-style icon tiles** for the Persian ingredient set — the signature Europe-launch delight + an open niche local Farsi apps haven't filled.
5. Item edit (qty/unit/aisle) — the broken-PATCH fix unlocks this.
6. **Pantry "already have" subtraction** — `PantryItem` model is **already built, just not wired** into `buildFromPlan` (half-done win).

**The structural MOAT:** multilingual **self-correcting categorization** — categorize بادمجان = aubergine = eggplant identically and learn from corrections (Apple Reminders learns but is locked to device language; AnyList is EN/DE only). Exactly what an Iran→Netherlands general-public launch needs and what competitors structurally can't do.

**Design principles:** optimistic UI everywhere; purposeful 100–500ms eased motion (never linear); one semantic haptic per event paired with color/text; skeleton screens; empty states = "two parts instruction, one part delight" (seed a sample week); RTL is not flip-and-forget (mirror swipe/scroll direction too). **Imagery:** plan tiles are placeholder-glyph-only today → real/AI thumbnails is the #1 visual upgrade.

---

## Part D — Persian / EU specifics (non-negotiable)
- **Week start Saturday (شنبه)** for Persian; Mon/Sun-first for EU locales. [قطعی]
- **Friday (جمعه) = guaranteed rest day; Thursday weekend soft/configurable** (don't hardcode Thu+Fri — politically in flux). [قطعی]
- **Re-author aisles for Persian cooking:** **سبزی (fresh herbs) as its own top category**; rice & grains, saffron/warm spices, dried limes + barberries, torshi/kashk, doogh/Persian feta/full-fat yogurt. Do NOT inherit Western aisles.
- **Validate before building:** Iranians may shop **fresh-daily** (bread, herbs), not one weekly haul → consider a "weekly staples vs fresh-daily" split, but test with users first. [حدسی]
- Competitive reality: **سرآشپز پاپیون** already does recipe→list + scaling in Farsi/RTL (1.9M installs) — the core flow won't wow Iranian users by itself; the **icon-tile polish niche is open**.
- Do NOT build: Flipp-style deals (NA-only, no EU price data, dilutes premium); fixed-multiple servings; a heavyweight cook-mode inside the meal-plan MVP.

---

## Part E — Recommended sequence
1. **Phase 1 — Fix + harden (foundation):** the Part A bugs (TZ, multi-list, broken PATCH, dedupe, savePlan canon+allergy, manual add, buildFromPlan check-off loss, double safe-area) + the Part B data-model migration. Re-run the assistant battery after. *This is what makes it bug-free + complete.*
2. **Phase 2 — Perfect the core loop:** live plan↔list binding + the merged/scaled/categorized list, instant + optimistic + RTL-correct. *This is what makes it correct + professional.*
3. **Phase 3 — Add one signature delight per surface:** meal-plan one-tap animated swap + mark-cooked-fade; shopping Bring!-style icon tiles + satisfying check-off. *This is what makes it delightful.*
4. **Phase 4 — The moat:** multilingual self-correcting categorization.

Sources & full per-agent reports: see the 2026-06-28 audit (4 agents). All competitor feature claims are cited in the benchmarking report.
