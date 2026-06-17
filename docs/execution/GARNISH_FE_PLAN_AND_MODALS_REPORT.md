# FE-PLAN-AND-MODALS — Execution Report
**Surface:** Frontend only (`apps/web`). **Backend FROZEN** (0 `apps/server` changes — proven below).
**Baseline:** `master` @ `c70d6219`  ·  **Merged HEAD:** `9d52d261` (ff-merged to master + pushed)
**Status:** all gates GREEN → merged · **STOP for founder screenshots (desktop)**
**Date:** 2026-06-18

---

## PHASE 0 — confirmations (read from current code)
1. `app/plan/useMealPlan.js`: `MEALS = [{key:'lunch'…},{key:'dinner'…}]` (line 14, lunch+dinner only);
   `propose` sends `meals: ['lunch','dinner']` (line 74); has propose/acceptSlot/acceptAll/clearProposal,
   **no delete/remove**. ✓
2. `app/plan/page.jsx`: top "دستیار" button = dead `showToast('دستیارِ برنامه به‌زودی')` (line 123); week row
   `className="g-norail"` + `overflowX:'auto'` (line 129, scrollbar hidden); filled `SlotCard` = open-only,
   no delete affordance. ✓
3. Bottom sheets with NO width cap on `styles.content` → full-viewport-width on desktop: `AISheet.jsx`
   (line 60), the recipe add-to-plan picker `Drawer` (`recipe/[id]/page.jsx` line 148), the cook AI-help
   `Drawer` (`cook/[id]/page.jsx` line ~214). `NavDrawer.jsx` is `position="left"` size **306** — a side
   drawer, already narrower than the cap. ✓
4. Picker meal options `PLAN_MEALS = [{lunch},{dinner}]` — no breakfast (`recipe/[id]/page.jsx` line 139). ✓
5. Backend contracts exist (untouched): `@Delete('slots/:dayOfWeek/:mealType')` (meal-plans.controller:32);
   `@Post('propose')` accepts `{ meals?: string[]; days?: number }` (line 51-53) + the planner normalizes
   `breakfast`/`صبحانه` (meal-plan-planner.service.ts:24, generator mealTypes includes `breakfast`);
   `@Post('slots')` (line 26). ✓
6. `mealplan_remove` is an accepted type — `behavior-engine/signals/signal-observation-engine.ts`
   `NEGATIVE_EVENTS` (line 63). Fired on a successful delete. No invented types. ✓

All confirmations PASS (no discrepancies).

## PHASE 1 — per-fix
- **FIX 1 — delete a meal.** `useMealPlan.removeSlot(dayOfWeek, mealType)` → `DELETE
  /meal-plans/slots/:day/:meal`, optimistic cache edit + **rollback on failure**, returns a boolean.
  `plan/page.jsx` adds a 36px token-styled trash button (`aria-label="حذف از برنامه"`) on each **filled**
  slot (a sibling of the open button, not nested). Tap → `removeSlot` → success toast «از برنامه حذف شد»
  ONLY on success / honest «حذف نشد، دوباره تلاش کن» on failure; `mealplan_remove` fires once per real
  delete, never on failure.
- **FIX 2 — breakfast.** `MEALS` gains صبحانه as the first row; `propose()` requests
  `['breakfast','lunch','dinner']`; the recipe picker offers صبحانه. Empty breakfast slots keep the honest
  empty affordance — no fabricated recipe.
- **FIX 3 — desktop reachability.** New scoped `.g-weekscroll` (thin, token-styled, always-visible
  scrollbar) replaces `.g-norail` on the week row, so all 7 days (شنبه…جمعه) are reachable with a mouse.
  `.g-norail` (shared by the rails) is unchanged.
- **FIX 4 — dead button removed.** The redundant `showToast('دستیارِ برنامه به‌زودی')` header button is
  gone; one clear «برنامهٔ هفته رو بچین» entry point remains.
- **FIX 5 — cap all bottom sheets.** New shared `components/ges/sheet.js` `bottomSheetStyles()` caps every
  bottom Drawer/Modal content to ≤480px + centers it (`marginInline:auto`, the cap always wins). Applied to
  **AISheet**, the **recipe picker**, and the **cook AI-help** drawer. **NavDrawer is intentionally exempt**
  — it is a 306px `position="left"` side drawer (already within the cap and edge-anchored by design;
  centering a side menu would misplace it). Documented in `sheet.js`.

## PHASE 2 — raw evidence (clean-room worktree @ `9d52d261`)
```
pnpm install                          # Done in 38.7s
pnpm --dir apps/web build             # vite build + PWA (sw.js) → exit 0
( cd apps/web && pnpm exec vitest run ) # Test Files 25 passed; Tests 103 passed (skipped=0)
grep -rniE "#FF6B35|#1A237E|#4CAF50" apps/web/src ; echo $?   # non-brand-hex-exit=1 (empty)
git diff --name-only master...HEAD    # apps/web ONLY (10 files)
```
Web tests grew 92→**103** (+11): `sheet.test.js` (cap/center/merge, cap-always-wins) · `useMealPlan.test.jsx`
(breakfast meals, propose body `['breakfast','lunch','dinner']`, `removeSlot` DELETE path + honest
false-on-failure) · `plan.smoke` additions (delete-tap success-toast gating, failed-delete honest error +
no success, dead-button gone, breakfast row renders).

**Scope proof — `git diff --name-only master...HEAD` (apps/web ONLY):**
```
apps/web/src/app/cook/[id]/page.jsx
apps/web/src/app/plan/page.jsx
apps/web/src/app/plan/plan.smoke.test.jsx
apps/web/src/app/plan/useMealPlan.js
apps/web/src/app/plan/useMealPlan.test.jsx
apps/web/src/app/recipe/[id]/page.jsx
apps/web/src/components/ges/AISheet.jsx
apps/web/src/components/ges/sheet.js
apps/web/src/components/ges/sheet.test.js
apps/web/src/index.css
```
**No `apps/server` file appears** — backend untouched.

---

```
VERDICT BLOCK
=============
SPRINT: FE-PLAN-AND-MODALS
BUILD (apps/web): PASS
WEB TESTS: 103/103, skipped=0
FIX1 delete-slot wired (DELETE /meal-plans/slots/:day/:meal) + honest toast + mealplan_remove: Y
FIX2 breakfast row added (plan MEALS + propose meals + picker meal option): Y
FIX3 week reachable on desktop (all 7 days scrollable via .g-weekscroll): Y
FIX4 dead "دستیار" button removed: Y
FIX5 all bottom Drawers/Modals capped to ≤480 & centered (AISheet, picker, cook-help; NavDrawer exempt as a side drawer): Y
NON-BRAND-HEX GREP: empty
FABRICATED TYPES/ENDPOINTS: none
SCOPE (diff name-only) = apps/web ONLY: Y
MERGE+PUSH: DONE @9d52d261
```

---

## AFTER MERGE — founder verification (DESKTOP)
1. Weekly plan → delete a meal → disappears, stays gone after refresh.
2. Weekly plan shows a **صبحانه** row (even if empty), plus ناهار + شام.
3. All 7 days (شنبه…جمعه) reachable on desktop (thin scrollbar).
4. Duplicate top "دستیار" button gone — one clear «بچین» button.
5. «برای من تنظیمش کن» + «به برنامه» → centered mobile sheet (≤480px), not a full-width strip.

**Note (not in this sprint):** the planner can still place an odd item (e.g. a sauce at dinner) — it trusts
recipe `mealType` tags with no `dishType`/course filter. That is the deeper P3 (planner intelligence +
recipe tagging), tracked for a later sprint.
