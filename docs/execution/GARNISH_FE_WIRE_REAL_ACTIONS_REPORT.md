# FE-WIRE-REAL-ACTIONS-AND-INSTRUMENTATION — Execution Report
**Surface:** Frontend only (`apps/web`). **Backend FROZEN** (0 `apps/server` changes — proven below).
**Baseline:** `master` @ `70355f64`  ·  **Merged HEAD:** `e3daf5fa` (ff-merged to master + pushed)
**Status:** all gates GREEN → merged · **STOP for founder screenshots**
**Date:** 2026-06-18

---

## PHASE 0 — confirmations (read from current code)
1. **Favorites hook** — `hooks/useFavoritesQuery.js`: `addFavorite`=`addMutation.mutate` (POST `/favorites/:id`),
   `removeFavorite` (DELETE `/favorites/:id`), `isFavorite(recipeId)` = `favorites.some(f => f.recipeId === recipeId)`,
   invalidates `['favorites']` on success (lines 24-44). ✓
2. **Home save was fake** — `app/home/page.jsx`: `const [saved, setSaved] = useState({})` (was line 184) +
   `toggleSave` = `setSaved(...) + showToast('به ذخیره‌ها اضافه شد')`, **no API call** (was line 198). ✓
3. **Recipe save was fake** — `app/recipe/[id]/page.jsx`: `const [saved, setSaved] = useState(false)` +
   `onClick={() => { setSaved(s=>!s); showToast('به ذخیره‌ها اضافه شد') }}` (was line 213). ✓
4. **Food DNA dead tap** — `app/home/page.jsx`: `<FoodDnaCard onOpen={() => showToast('شناسهٔ ذائقه به‌زودی…')} />`
   (was line 247) while `/food-dna` exists in `App.jsx`. ✓
5. **Add-to-plan stub** — `app/recipe/[id]/page.jsx`: `onClick={() => showToast('به برنامه به‌زودی', …)}` (was line 360). ✓
6. **Telemetry thin** — `grep -r "trackEvent("` = only `ai_feedback` (assistant), `cook_complete` (cook),
   `search_unmet` (discover). ✓
7. **Backend contracts (exist; untouched):** `POST/DELETE/GET /favorites[/:id]` (favorites.controller);
   `POST /meal-plans/slots` body `{ dayOfWeek:number, mealType:string, recipeId:string }` (meal-plans.controller:27,
   reused exactly from `useMealPlan.acceptSlot`); `POST /recommendations/impression` body `{ recipeIds?, recipeId?,
   viewportMs?, visibleRatio?, source? }`, qualifies at `viewportMs>=1000 && visibleRatio>=0.5` (recommendation.controller:40-58);
   `POST /analytics/event` → `userEvent.create` (analytics.controller:24, analytics.service:88). ✓
8. **Honest event vocabulary** — `behavior-engine/signals/signal-observation-engine.ts` `POSITIVE_EVENTS`
   (lines 53-56) contains **`recipe_view`, `favorite_add`, `mealplan_add`** (and `recommendation_impression` is in
   `event-quality.ts` `nonDuplicateEvents`). All emitted types are in the backend's accepted set. **Zero fabricated types.**

All confirmations PASS (no discrepancies).

## PHASE 1 — per-fix
- **FIX 1 — real favorites write.** Home + Recipe import `useFavoritesQuery`; the local `saved` state is **deleted**;
  saved-state derives from `isFavorite(id)`. Tap → `addFavorite`/`removeFavorite` with per-call callbacks:
  the confirmation toast fires **only** in `onSuccess`; on error → revert is automatic (server truth via
  invalidation) + honest error toast («ذخیره نشد، دوباره تلاش کن»). Threaded through `RecipeCard`/`RecipeRail`
  (rails now take `isSaved` fn + `registerImpression`), so Home picks + all 3 rails save for real. A successful
  **add** fires `favorite_add` (POST `/analytics/event`) — once per add, never on failure.
- **FIX 2 — Food DNA route.** `onOpen` → `navigate('/food-dna')`.
- **FIX 3 — add-to-plan.** «به برنامه» opens a minimal token-pure day/meal `Drawer` (7 days `0=Sat..6=Fri` +
  ناهار/شام, default today/dinner) → confirm → `POST /meal-plans/slots { dayOfWeek, mealType, recipeId }` (the
  planner's exact body). Success toast + `mealplan_add` only on success; honest error toast on failure. No new endpoint/DTO.
- **FIX 4 — honest instrumentation.** `recipe_view` fires once on Recipe Detail mount (logged-in, `viewedRef`
  StrictMode guard). `recommendation_impression` via a shared `IntersectionObserver` (`hooks/useImpressionObserver.js`)
  on Home picks + rail cards: a card ≥50% visible for ≥1000ms → batched POST `/recommendations/impression` with the
  **measured** `viewportMs`/`visibleRatio` (never faked, never sub-threshold), de-duped per page session.
- **Honest-copy:** no remaining lying success toast. The other `به‌زودی` stubs (share, occasion, cook-history,
  manual-add, dark/English) were left untouched as specified.

## PHASE 2 — raw evidence (clean-room worktree @ `e3daf5fa`)
```
pnpm install                              # Done in 35.5s
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                                # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                       # COVERAGE GATE PASSED
pnpm --dir apps/web build                 # vite build → ok (incl. SW)
( cd apps/web && pnpm exec vitest run )   # Test Files 23 passed; Tests 92 passed (skipped=0)
( cd apps/server && pnpm exec jest --maxWorkers=2 ) # Test Suites 193/193; Tests 1423/1423; skips 0
grep -rniE "#FF6B35|#1A237E|#4CAF50" apps/web/src ; echo $?   # non-brand-hex-exit=1 (empty)
git diff --name-only master...HEAD        # apps/web ONLY (6 files)
```
New coverage: favorites-success-gated (toast+`favorite_add` only when the mutation succeeds; nothing on a pending
call) · recipe_view fires exactly once on mount · impression observer posts only after ≥1000ms at ≥50% (and not
below threshold / not if the card leaves early).

**Scope proof — `git diff --name-only master...HEAD`:**
```
apps/web/src/app/home/page.jsx
apps/web/src/app/recipe/[id]/page.jsx
apps/web/src/app/recipe/[id]/recipe.actions.test.jsx
apps/web/src/components/ges/RecipeRail.jsx
apps/web/src/hooks/useImpressionObserver.js
apps/web/src/hooks/useImpressionObserver.test.jsx
```
**apps/web ONLY** — no `apps/server` file appears (backend untouched; server tests unchanged at 1423/0).

---

```
VERDICT BLOCK
=============
SPRINT: FE-WIRE-REAL-ACTIONS-AND-INSTRUMENTATION
BUILD (apps/web): PASS
WEB TESTS: 92/92, skipped=0
NEW COVERAGE: favorites-success-gated=Y  recipe_view-once=Y  impression-threshold=Y
NON-BRAND-HEX GREP: empty
SCOPE PROOF (diff name-only): apps/web ONLY = Y
FIX1 favorites-write wired (Home+Recipe): Y
FIX2 food-dna route wired: Y
FIX3 add-to-plan real POST /meal-plans/slots: Y
FIX4 events fired (recipe_view, favorite_add, mealplan_add, recommendation_impression): all four wired
FABRICATED TYPES/ENDPOINTS: none
MERGE+PUSH: DONE @ e3daf5fa
```

---

## AFTER MERGE — founder verification (hard refresh first)
1. Tap save on a Home pick + on a Recipe → both show saved → `/favorites` lists them (unsave works).
2. Tap the Food DNA card on Home → lands on `/food-dna`.
3. Tap «به برنامه» on a recipe → pick day/meal → it lands in the meal plan.
4. Telemetry (server-side): `recipe_view`, `favorite_add`, `mealplan_add`, `recommendation_impression` now fire.

**Next: founder screenshots; then Support page, onboarding-questions research track, dark mode + LTR + L4 polish.**
