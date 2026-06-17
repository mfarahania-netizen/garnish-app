# GARNISH-FE-COOK — Execution Report
**Sprint:** Track 5 Reset · Sprint G (screen 2 of 10) — immersive Cook Mode
**Branch:** `exec/garnish-fe-cook`  ·  **Baseline:** `master` @ `238c659b`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Built **Cook Mode** as a standalone immersive route **`/cook/:id`** (like `/recipe/:id`), to
`Garnish Cook Mode.dc.html`. The **«بپز»** button in Recipe Detail now navigates here. Files:
`app/cook/[id]/{page.jsx, useCook.js}`. Frontend-only; backend untouched; bundle not imported. A
3-lens adversarial review ran before merge; its real findings were fixed (below).

## 2. The screen
- **Step-by-step** over the recipe's **real** steps (`GET /recipes/:id/full` via `useRecipeDetail`):
  big number tile + step text, «مرحلهٔ N از M», progress bar, prev/next («بعدی»/«پایان»).
- **Timer** — when a step's text contains a real duration («۶ تا ۷ دقیقه» → 7m, «۲ ساعت» → 120m) a
  countdown start/pause/reset appears, parsed from the real step (no fabricated durations); reduced-motion safe.
- **«کمک برای این مرحله»** — a disclosed (glyph + «AI») bottom sheet anchored to the current step,
  grounded on the real **`GET /ai/recipes/:id/technique?step=`** (1-based); honors the backend's
  honest-degradation contract (renders only `resultStatus==='ok'`), Persian-only defensive render
  (never raw English/`[object Object]`), honest fallback, and the mandatory «پاسخِ AI ممکن است اشتباه کند.».
- **Finish** — the ONE earned **Celebrate** (pulse + pop, reduced-motion-gated) + «آفرین — نوشِ جان!».
  Records a **real** `recipe_cooked` analytics event (logged-in) — «پختت رو ثبت کردیم» — and shows the
  **current** streak factually («رشتهٔ فعلیت: N هفتهٔ پیاپی», weekly). **No fabricated "added to streak"**
  (there is no FE cook-write endpoint; the mockup's «به رشتهٔ ۴ روزه‌ات اضافه شد» day-claim was dropped).
  «تمام» → Home; «یک نظر بده» feedback.
- **States** — loading skeleton, error + retry/back, no-steps guard. Exit ✕ → back to the recipe.

## 3. Adversarial review — findings fixed before merge
3 lenses (honesty/AI · tokens/RTL/a11y · mockup-fidelity); **no blockers**, the real majors/minors fixed:
- **AI honesty:** the step param is **1-based** (verified against `explain-recipe-step.tool.ts`) — the
  initial 0-based index made step 1 always `step_out_of_range`; now `step + 1`.
- **AI honesty:** honor `resultStatus` — only render an `ok` result; any degraded status → honest fallback
  (no degraded payload masquerading as a confident grounded answer).
- **Render purity:** `extractFa` strips stray Latin fragments (Persian-only).
- **Correctness:** finish side effects moved out of the `setState` updater (no StrictMode double-fire of `recipe_cooked`).
- **a11y:** the AI Drawer now has a real accessible name via Mantine `title` (Mantine v9 spreads a bare
  `aria-label` onto Root, not the dialog) + an accessible close button.
Lenses confirmed: zero non-brand hex, logical-RTL-only (back=ChevronRight/next=ChevronLeft), ≥44px targets,
earned-only reduced-motion-gated Celebrate, faithful to the mockup (sanctioned deltas: standalone immersive
route, real data, honest streak copy in weeks).

## 4. Clean-room verification (isolated worktree, detached @ `9915c907`)
```
git worktree add --detach ../garnish-verify 9915c907
pnpm install --frozen-lockfile          # Done in 28.9s (frozen)
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total (web + server) → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 191/191 ; Tests: 1412/1412 ; skips 0
git diff --name-only master 9915c907 -- apps/server   # EMPTY (backend untouched)
git worktree remove ../garnish-verify
```

### Scope-proof
- Changed set vs master = `App.jsx` (standalone `/cook/:id`), `app/cook/[id]/{page.jsx,useCook.js}` (new),
  `app/recipe/[id]/page.jsx` («بپز» → `/cook/:id`; dropped one now-unused import),
  `tools/coverage/coverage.registry.json` (`/ai/recipes/:id/technique` → frontend:cook/CookPage),
  `docs/coverage/coverage.generated.json`. **No other page. No `apps/server` change (incl. its `.gitignore`).**

## 5. Render — in words
A calm full-screen cook flow: one big step at a time with a progress bar, a real countdown when a step
has a duration, a disclosed AI help sheet grounded to the current step (with the «ممکن است اشتباه کند»
hedge), and an earned finish celebrate that records the cook + shows your current weekly streak — never a
fabricated one. RTL + Vazirmatn; clean console expected.

---

## VERDICT
```
FE_COOK RESULT: PASS
Clean install (worktree): build exit 0, coverage green, server tests suites 191/191, tests 1412/1412, skips 0
Cook Mode to mockup (one-step nav / timer / step AI help / finish Celebrate+streak+feedback / states) = ok
«بپز» from Recipe Detail enters cook = yes · AI disclosed+grounded+«ممکن است اشتباه کند» = yes · earned-only Celebrate = yes
API: /recipes/:id/full steps (+ grounded /ai/recipes/:id/technique, /gamification/me) = yes · no fabricated data = yes (no false streak increment; honest-degradation honored)
bundle runtime NOT imported/bundled = yes · zero non-brand hex = yes,grep · RTL+Vazirmatn+reduced-motion+AA+44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes · coverage gate green
Merge/push: exec/garnish-fe-cook → master (ff, pushed)
Verdict: FE_COOK_PASS
```

---

**Next: Meal Plan + the remaining screens + the final audit — screenshot-gated.**
