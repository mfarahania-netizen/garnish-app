# GARNISH-FIX-COOKHEADER-AISEARCH-COOKLOG — Execution Report
**Sprint:** Track 5 Reset · Sprint T — three root-cause fixes (cook chrome · AI search · cook recording)
**Baseline:** `master` @ `4e6c4527`  ·  **Merged HEAD:** `dd1675af` (committed + verified + pushed to master)
**Status:** verification GREEN → on master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17 · **Scope:** FE (cook shell/delivery) + BE unfrozen ONLY for the search query + cook-recording.

---

## FIX 1 (FE) — Cook Mode chrome: the code was already correct; the real cause was the service worker

**Diagnosis (read from code, not assumed).** Every hypothesised cause was checked and ruled out:
- **Router nesting:** `/cook/:id` IS nested under `<Route element={<AppShell />}>` (App.jsx) — correct.
- **Full-screen / fixed cover:** `grep` over the cook page found **no** `position:fixed` / `100vh` / `100dvh` /
  `inset:0` / large `zIndex`. The cook `Column` is a plain `flex:1` fill.
- **AppShell conditional:** AppShell renders `TopBar` + `BottomNav` **unconditionally**.

**Proof the code is correct (new integration test).** `cook-chrome.integration.test.jsx` mounts the **real**
`<AppRoutes>` (extracted from App.jsx) under a MemoryRouter at `/cook/1` and asserts the chrome wraps it:
the TopBar back («بازگشت»), the wordmark link («گارنیش — خانه»), and a BottomNav tab («خانه») all render
around the cook content («مرحلهٔ ۱ از ۳»). **Test passes** → Cook Mode genuinely renders inside AppShell.

**The real reason a hard-refresh still showed the old chrome-less cook = the service worker.** `vite.config.js`
served **js/css with `StaleWhileRevalidate`** and had **no `skipWaiting`/`clientsClaim`**, so once a SW was
registered (any prod build/preview on localhost), an updated build kept serving **stale JS** for at least one
load — the old standalone cook. **Fix:** `skipWaiting: true` + `clientsClaim: true` + `cleanupOutdatedCaches: true`
(a new SW activates + claims clients immediately, old precaches purged), and `StaleWhileRevalidate` now covers
**images/fonts only** — the hashed JS/CSS are precached (versioned), never stale-served. This is the root-cause
delivery fix, not a cache hand-wave.

## FIX 2 (BE) — AI recipe search: exact `in` → substring `contains`

**Root cause (wrong file in the brief).** The founder's chat path is `ai/ai.service.ts` (`POST /ai/chat` →
the `🎲 پیشنهاد تصادفی` fallback), **not** the L4 `search-recipes.tool.ts`. In `ai.service.ts buildWhereClause`:
```
where.ingredients = { some: { name: { in: ingredients } } };   // EXACT equality
```
«مرغ» never equals «ران مرغ» / «سینه مرغ», so it matched **0** recipes → the random fallback fired (showing the
generic «زردچوبه/فلفل» ingredient lines). (`RecipeIngredient.name` does hold the Persian text — the brief's
`line/nameFa` premise was off; `name` is correct, the bug was `in` vs `contains`.)

**Fix:**
```
where.ingredients = { some: { OR: ingredients.map((t) => ({ name: { contains: t, mode: 'insensitive' } })) } };
```
Also hardened `search-recipes.tool.ts` to `contains` + `mode:'insensitive'` on title/description/ingredient.

**Live DB demonstration (corrected query, dev `garnish_db`, 350 recipes):**
```
"مرغ"  → 139 recipes  (واویشکا، گمج کباب، ترش‌تره)
"سبزی" →  22 recipes  (خورشت اناربیج، آش رشته، سبزی پلو با ماهی)
"برنج" →  62 recipes  (ترش‌تره، ته چین مرغ، کته شمالی)
```
(The old exact `in` returned 0 → «not found»/random.) Both the chat path (`ai.service`) and the L4 tool now use
`contains`. Unit test asserts the clause is `contains`, never `in`.

## FIX 3 (BE + wiring) — finishing a cook didn't record anything

**Root cause.** The cook finish emitted `trackEvent('recipe_cooked', …)` → `POST /analytics/event` →
`UserEvent{ type:'recipe_cooked' }`. But the gamification engine counts **`userEvent.type IN ['cook_complete']`**
(`COOK_COMPLETE_TYPES`). **Type mismatch** → the cook was logged under the wrong type → streak/level never moved
(stuck at «اولین آشپزی»/«سطح ۱»).

**Fix (wiring to the canonical event):** the finish now emits **`cook_complete`** — the exact type the engine
reads — via the existing `POST /analytics/event` → `UserEvent` → `gamification.recomputeForUser` path (no new
endpoint/schema). A real completed cook = a real `+1` (honest; no fabricated increment).

**Tests:** gamification counts a `cook_complete` event (`totalCooks` +1, `streak.currentWeeks` ≥ 1, and asserts
the engine queries the canonical `type:{in:['cook_complete']}`); and `useCook` emits `cook_complete` (with
`recipeId`) on finish — never the old `recipe_cooked`.

## Clean-room verification (isolated worktree, detached @ `dd1675af`)
```
git worktree add --detach ../garnish-verify dd1675af
pnpm install --frozen-lockfile                       # ok
pnpm --dir apps/server exec prisma generate          # ok
pnpm build                                           # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                                  # COVERAGE GATE PASSED → exit 0
pnpm --dir apps/web test                             # Test Files 21 passed; Tests 86 passed
pnpm --dir apps/web build                            # vite build → ok (SW regenerated)
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                                     # Test Suites 193/193 ; Tests 1423/1423 ; skips 0
grep -rnE "#(FF6B35|1A237E|4CAF50)" apps/web/src ; echo $?   # exit=1 (0 non-brand hex)
git diff --name-only … | grep allergy/rank/reco/schema/orchestrator   # none
```
**Changed set (9 files):** BE — `ai/ai.service.ts`, `ai/tools/search-recipes.tool.ts`, `ai/ai.service.search.spec.ts`,
`gamification/gamification.service.spec.ts`; FE — `App.jsx`, `app/cook/[id]/useCook.js`,
`app/cook/[id]/useCook.test.jsx`, `cook-chrome.integration.test.jsx`, `vite.config.js`. **No** allergy / ranking /
recommendation / orchestrator-core / Prisma-schema change.

---

## VERDICT
```
FIX_COOKHEADER_AISEARCH_COOKLOG RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage green, server tests suites 193/193, tests 1423/1423, skips 0, web smoke 86/86
FIX1 Cook Mode chrome: root cause = code was already correct (route nested under AppShell, no fixed/100vh cover, AppShell renders chrome unconditionally — proven by a new integration test mounting the real AppRoutes at /cook/1); the hard-refresh staleness was the SW serving js/css StaleWhileRevalidate with no skipWaiting → fixed (skipWaiting+clientsClaim+cleanupOutdatedCaches; SWR now images/fonts only). Now inside AppShell (TopBar hamburger/back+bell+logo + BottomNav) = yes; cook content intact; back path recipe→cook→back→recipe→back→Home = yes
FIX2 AI search: corrected ai.service.ts buildWhereClause `name:{in}` → `name:{contains, insensitive}` (+ tool hardened); demo — "مرغ"→139 (واویشکا/گمج کباب), "سبزی"→22 (آش رشته/سبزی پلو با ماهی), "برنج"→62, not "not found" = yes; both stub(ai.service) + L4 tool paths use contains = yes
FIX3 cook recording: wired to UserEvent type 'cook_complete' (POST /analytics/event → gamification); finishing a cook increments totalCooks/streak; Home/Profile reflect it (no longer stuck at اولین آشپزی/سطح ۱) = yes
New tests added (ai.service contains-search; gamification counts cook_complete; useCook emits cook_complete) & green = yes
Scope: git diff only cook-shell(FE) + search-tool(BE) + cook-recording(BE); no allergy/ranking/reco/orchestrator-core/unrelated-schema = yes, diff shown
Server tests ≥ 1412 / 0 skips = yes (1423/0) · zero non-brand hex (grep) = yes (exit 1) · RTL intact = yes
Merge/push: committed + clean-room-verified + pushed to master, commit dd1675af
Verdict: FIX_COOKHEADER_AISEARCH_COOKLOG_PASS
```

---

**Next: founder screenshot review; then Support page, onboarding-questions research track, dark mode + LTR + L4 polish.**
