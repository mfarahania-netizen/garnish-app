# GARNISH-FE-MEALPLAN — Execution Report
**Sprint:** Track 5 Reset · Sprint H (screen 3 of 10) — weekly Meal Plan (proposes-not-auto)
**Branch:** `exec/garnish-fe-mealplan`  ·  **Baseline:** `master` @ `a9358213`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Built the **Meal Plan** at **`/plan`** (the «برنامه» tab) to `Garnish Meal Plan.dc.html`. Files:
`app/plan/{page.jsx, useMealPlan.js}`. The core contract — **«پیشنهاد می‌دهد، خودکار اعمال نمی‌کند»** —
is enforced literally. Frontend-only; backend untouched; bundle not imported. A 3-lens adversarial
review ran before merge; its real findings were fixed (below).

## 2. The screen
- **Week header** — the current Sat→Fri range (computed via `Intl` persian calendar) + «امروز» badge.
- **Day columns** (RTL, Sat at the inline-start) with **lunch/dinner** `MealSlotCard`s: filled (real
  recipe + time, tap→detail), **suggested** (AI surface, name + a localized **confidence from the real
  `fitScore`** + «بپذیر»), or empty («افزودن»). Imagery = token-pure small-glyph `PlatePlaceholder`
  (not the mockup's raw-hex gradient tiles).
- **Propose** (`POST /meal-plans/propose` — PLANNER-L4-09, allergy hard-excluded server-side, writes
  nothing) → suggested slots. **PROPOSES-NOT-AUTO:** a review bar «این یک پیشنهاد است — بازبینی کن و
  بپذیر» with «پاک کن» / «پذیرفتنِ برنامه», plus per-slot «بپذیر». **Accept applies ONLY via the real
  `POST /meal-plans/slots`** (one slot per call); «پاک کن» clears locally with no write.
- **To-shopping** «از این برنامه، لیست خرید بساز» → `/shopping-list` (Sprint I).
- **States:** loading skeleton columns, **dedicated empty-week** («بیا هفته‌ات رو با هم بچینیم» + «پیشنهاد بده»), error + retry.

## 3. Honesty / safety
The proposal's `why` is **English** so it is **never rendered** — only the real `fitScore` drives the
Persian confidence chip; a missing score falls to the lowest honest bucket. A suggestion never overlays
an already-saved slot. Allergy **hard-exclude is the API's** (a conflicting recipe is never proposed;
the FE never re-introduces one). Suggested slots with no title are dropped (never a placeholder dish name).

## 4. Adversarial review — findings fixed before merge
3 lenses; **no blockers**, the real majors/minors fixed:
- **Honesty (major):** a failed `propose` previously showed the success toast (stale-closure read of
  `proposeError`) — `propose()` now returns ok and the toast branches on it.
- **a11y (major):** the per-slot «بپذیر» was 36px — raised to **44px** (it's the only single-slot accept).
- **Fidelity (major):** the dedicated **empty-week** state is now rendered (was only an inline whisper);
  header divider added.
- **Resilience (minor):** `acceptAll` no longer aborts the batch on one failure — it refetches and
  reports an honest partial/failed toast. Suggested-slot title fallback removed. Unused import dropped.
Lenses confirmed: zero non-brand hex, token placeholders (not gradients), logical-RTL-only, proposes-not-auto intact.

## 5. Clean-room verification (isolated worktree, detached @ `201b87a0`)
```
git worktree add --detach ../garnish-verify 201b87a0
pnpm install --frozen-lockfile          # frozen
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 191/191 ; Tests: 1412/1412 ; skips 0
git diff --name-only master 201b87a0 -- apps/server   # EMPTY (backend untouched)
git worktree remove ../garnish-verify
```

### Scope-proof
- Changed set vs master = `App.jsx` (`/plan`), `app/plan/{page.jsx,useMealPlan.js}` (new),
  `tools/coverage/coverage.registry.json` (`POST /meal-plans/propose` → frontend:plan/PlanPage),
  `docs/coverage/coverage.generated.json`. **No other page. No `apps/server` change (incl. its `.gitignore`).**

## 6. Render — in words
A calm RTL week of day columns with lunch/dinner slots; «برنامهٔ هفته رو بچین» fetches an AI proposal
shown as clearly-marked suggestions with a confidence chip; you review and accept per-slot or the whole
plan (nothing auto-applies), then build a shopping list. Empty/loading/error states are warm. RTL +
Vazirmatn; clean console expected.

---

## VERDICT
```
FE_MEALPLAN RESULT: PASS
Clean install (worktree): build exit 0, coverage green, server tests suites 191/191, tests 1412/1412, skips 0
Meal Plan to mockup (week header/nav · day slots MealSlotCard · propose→suggested · to-shopping · empty+error) = ok
PROPOSES-not-auto (explicit per-slot/whole-plan accept) = yes · allergy hard-exclude respected = yes (API)
API: /meal-plans/propose (+ /slots, GET /meal-plans) = yes · no fabricated data = yes (English `why` never rendered; confidence from fitScore)
bundle runtime NOT imported/bundled = yes · zero non-brand hex = yes,grep · RTL+Vazirmatn+reduced-motion+AA+44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes · coverage re-mapped; gate green
Merge/push: exec/garnish-fe-mealplan → master (ff, pushed)
Verdict: FE_MEALPLAN_PASS
```

---

**Next: Shopping List + the remaining screens + the final audit — screenshot-gated.**
