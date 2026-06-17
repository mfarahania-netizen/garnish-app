# GARNISH-FE-FIX-CARDHEIGHT-COOKHEADER-RECIPESLINK — Execution Report
**Sprint:** Track 5 Reset · Sprint S — three decisive fixes (short picks · cook chrome · recipes drawer link)
**Branch:** `exec/garnish-fe-fix-cardheight-cookheader-recipeslink`  ·  **Baseline:** `master` @ `cf9969a3`
**Merged HEAD:** `ecbe244a`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17 · **Scope:** frontend only. Backend frozen + untouched.

---

## FIX 1 — picks card SHORT fixed height (not a 16:9 aspect ratio)
**Before:** `RecipeCard` media used `aspectRatio: '16 / 9'`, so a full-width pick was physically tall on mobile.
**After:** a new **`mediaHeight`** prop sets a SHORT FIXED height on the media Box (`blockSize: mediaHeight`,
`overflow:hidden`), default **140px** for full-width picks and **110px** for `compact` cards (rails/grids), with
`width: 100%`. The branded glyph stays a small FIXED size (`glyphSize` 44/34). The empty-state `StarterCard`
(home) 16:9 → fixed **140px** too, so no near-square card remains. `RecipeRail` keeps its 188px width → 110px
banners (≈ its prior size). **No `aspectRatio`/`padding-top` left in `RecipeCard.jsx`** (grep below). Founder-
approved deviation from the mockup's tall hero — picks are now short wide banners.

## FIX 2 — Cook Mode wears the standard app shell (TopBar + BottomNav)
**Before:** `/cook/:id` was a chrome-less standalone immersive route.
**After:** `/cook/:id` is wrapped in `AppShell` (its own route block, kept **public** — not behind `RequireAuth`,
the same access level as Recipe Detail), so Cook Mode now has the app **TopBar** (hamburger + bell + logo + the
back chevron, since it's a pushed route) and the **BottomNav** footer. The cook `Column` became a flex fill
(AppShell already provides the centred 480 column + chrome); the redundant in-cook **X close was removed** (the
TopBar back chevron is the single back), and a title + step-counter sub-header + progress bar remain. Cook
content is untouched: step-by-step, the duration timer, AI step-help («پاسخِ AI ممکن است اشتباه کند»), and the
finish celebrate. **Back path:** recipe →بپز→ cook →back→ recipe →back→ Home — never re-enters cook (last
sprint's `navigate(-1)`-with-fallback loop fix is intact; TopBar back uses the same pop-with-home-fallback).

## FIX 3 — «رسپی‌ها» drawer link → all-recipes page
**Phase-0 finding:** the all-recipes page did **NOT** exist (no `app/recipes/`, no `/recipes` route, no
`RecipesPage`) — contrary to the brief's "the page still exists". So I **built** a minimal one rather than
fabricate a link to nothing.
- New `app/recipes/page.jsx` (`RecipesPage`) — the full catalogue via **real** `GET /recipes?page&limit`
  pagination (24/page; next offered while a full page returns — honest, no fabricated total), a 2-col
  `RecipeCard` grid opening the recipe detail, with loading / empty / error+retry states. Route `/recipes` added
  inside `RequireAuth` + `AppShell`.
- Added **«رسپی‌ها»** to `DRAWER_PRIMARY` (`IconChefHat` → `/recipes`); it routes + closes the drawer like the
  others. The existing items (user header, distinct «پروفایل من»/«شناسهٔ ذائقه», the rest, red logout) are unchanged.
- `GET /recipes` was already a registered/consumed endpoint (Home rails) → no coverage change.

## Tests
- Updated the cook smoke test: asserts the title + «مرحلهٔ ۱ از ۳» sub-header (the X close was removed; the app
  TopBar — not present in the isolated render — now owns back).
- Added a `RecipesPage` smoke test (grid from mocked `GET /recipes` / empty / error+retry).
- **19 test files / 84 tests** green.

## Clean-room verification (isolated worktree, detached @ `ecbe244a`)
```
git worktree add --detach ../garnish-verify ecbe244a
pnpm install --frozen-lockfile                       # ok
pnpm --dir apps/server exec prisma generate          # ok
pnpm build                                           # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                                  # COVERAGE GATE PASSED → exit 0
pnpm --dir apps/web build                            # vite build → ok
pnpm --dir apps/web test                             # Test Files 19 passed; Tests 84 passed
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                                     # Test Suites 192/192 ; Tests 1420/1420 ; skips 0
grep -rnE "aspectRatio|padding-top:56|56.25" apps/web/src/components/ges/RecipeCard.jsx ; echo $?  # exit=1 (none left)
grep -rnE "#(FF6B35|1A237E|4CAF50)" apps/web/src ; echo $?                                          # exit=1 (0 non-brand hex)
git diff --name-only master ecbe244a -- apps/server  # EMPTY (backend untouched, incl .gitignore)
```
**Changed set (8 files), all `apps/web/src`:** `App.jsx`, `app/cook/[id]/{page.jsx,cook.smoke.test.jsx}`,
`app/home/page.jsx`, `app/recipes/{page.jsx,recipes.smoke.test.jsx}` (new), `components/ges/RecipeCard.jsx`,
`shell/navConfig.js`. Server tests unchanged (backend untouched).

---

## VERDICT
```
FE_FIX_CARDHEIGHT_COOKHEADER_RECIPESLINK RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage green, server tests suites 192/192, tests 1420/1420, skips 0, web smoke 84/84
FIX1 picks card: media is SHORT fixed height (140px picks / 110px rails), physically short+wide (not tall/huge) = yes; no aspect-ratio/padding-top left in card (grep exit=1) = yes; rails still correct = yes; glyph small fixed-size = yes
FIX2 Cook Mode: has app TopBar (hamburger+bell+logo+back) AND bottom nav = yes; back path recipe→بپز→cook→back→recipe→back→Home (no loop) = yes; cook content (steps/timer/AI/celebrate) intact = yes
FIX3 drawer «رسپی‌ها» link added → opens all-recipes page + closes drawer = yes (built the missing /recipes page); existing drawer items unchanged = yes
No regression to Home/Recipe/Cook/drawer = yes (84 web tests, 192/1420 server)
Zero non-brand hex across apps/web/src (grep exit=1) = yes
bundle runtime NOT imported/bundled = yes · RTL + ≥44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes
Render (in words): picks are short wide banners (140px) like the rails (110px), small fixed glyph, no near-square card; Cook Mode shows the app TopBar (back/hamburger/bell/logo) + BottomNav with a title+step sub-header, back goes recipe→Home (no loop), cook content intact; the drawer has a new «رسپی‌ها» item opening the paginated all-recipes page; RTL throughout; console clean
Merge/push: exec/garnish-fe-fix-cardheight-cookheader-recipeslink → master ff, pushed, commit ecbe244a
Verdict: FE_FIX_CARDHEIGHT_COOKHEADER_RECIPESLINK_PASS
```

---

**Next: Support page, then onboarding-questions research track, then dark mode + LTR + L4 polish.**
