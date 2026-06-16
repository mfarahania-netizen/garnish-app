# GARNISH-FE-RESET-A — Execution Report
**Sprint:** Track 5 Reset · Sprint A — wipe the broken UI layer + build a clean infrastructure & app SHELL (no content pages)
**Branch:** `exec/garnish-fe-reset-a`  ·  **Baseline:** `master` @ `2b55418a` (on top of feat `366d55c4`)
**Status:** verification GREEN · **HELD at founder request — NOT merged/pushed** (see *Decision points*)
**Date:** 2026-06-16

---

## 1. Summary
The entire frontend UI layer was deleted and replaced with a clean, correct, token-pure **app shell only** — a real TopBar with a **working hamburger Drawer**, a 5-tab BottomNav, RTL + Vazirmatn + GES tokens, the provider chain, react-router routing, one trivial placeholder route, and an in-shell 404. **No content pages were built.** The healthy backend-connected data/logic layer was preserved untouched. Backend runtime/logic untouched.

Two **wipe-induced gate conflicts** surfaced that the sprint brief did not anticipate (both are governance gates that enforce frontend structure). Each was brought to the founder and resolved per their explicit decision (see §6).

---

## 2. WIPE — deleted UI layer (146 files)
- `src/app/**` — every page: home, recipe + recipe/components, recipes, auth, category, plan (+components), shopping-list (+components), favorites, onboarding, cook, food-dna, achievements, settings, and the entire admin UI (`admin/**`) + the `_ges` gallery.
- `src/components/**` — `ges/**` (40 primitives), `shopping/**`, and the root components: `RecipeCard`, `SectionSlider`, `ConsentModal`, `DirectionalIcon`, `ProtectedRoute`.
- `src/layouts/MainLayout.jsx` — the old half-working shell.
- Each feature's **UI parts** — `components/` and `pages/` for add-recipe, ai-chat, meal-planner, notifications, profile, support; plus every feature `index.js` barrel (re-exported deleted UI).
- `src/App.css` — old page-level styles (and the legacy `@font-face`, re-wired — see §3).

`git diff --name-status master`: **146 D**, 7 A, 6 M.

## 3. PRESERVE — healthy backend-connected logic layer (intact, untouched)
Verified present and unmodified vs master:
- `src/lib/**` — `apiClient.js` (axios + JWT interceptor + 401), `analytics-init.js`, `eventTaxonomy.js`, `motion.js`.
- `src/hooks/**` — all 9 query hooks (`useRecipes`, `useFavoritesQuery`, `useProfileQuery`, `usePreferencesQuery`, `useShoppingListQuery`, `useMealPlannerQuery`, `useNotificationsQuery`, `useSupportQuery`, `useAnalytics`).
- `src/context/**` — `AuthContext.jsx`, `RecipeContext.jsx`, `ThemeContext.jsx`.
- `src/styles/**` — `tokens.css`, `base.css` (GES tokens + RTL helpers — clean, never the problem).
- `src/theme/garnish-theme.js` — Mantine adapter bound to tokens (sanctioned saffron-ramp adapter block; zero banned hex).
- Each feature's `services/` + `hooks/` (+ `context/`) — 19 files preserved.
- `src/main.jsx` + build config (`vite.config.js` deps unchanged). Entire `apps/server/**` runtime/logic untouched.

**Ambiguous files KEPT and noted** (deleting healthy logic is worse than keeping):
- `src/i18n/**` (infra; not wired by the minimal shell), `src/data/**` (static constants), `src/context/ThemeContext.jsx` + feature `context/` dirs (state logic imported by preserved hooks), `src/assets/**` (unreferenced images/template svgs).
- **Pre-existing orphaned stubs (NOT introduced by this sprint, left as-is):** `features/{meal-planner,notifications,profile}/hooks/use{MealPlanner,Notifications,Profile}.js` each `export … from '../context/XxxContext'` — those context modules **never existed on `master`** (confirmed via `git ls-tree`). They are orphaned (no importer; build green) and were broken before the wipe. The healthy query hooks live in `src/hooks/use*Query.js`. Out of scope to fix here; a content sprint that rebuilds those features should wire or remove them.

## 4. BUILD — the clean shell
**Providers (`src/App.jsx`):** `ErrorBoundary` (outermost — catches provider errors, token-styled fallback) › `DirectionProvider` (`initialDirection="rtl"`) › `QueryClientProvider` › `MantineProvider` (GES theme via preserved `garnish-theme.js`, Vazirmatn-first font stack, `respectReducedMotion`) › `AuthProvider` › `RecipeProvider` › `BrowserRouter`. Routes: `/` → `Placeholder`, `*` → in-shell `NotFound`, both nested under `AppShell`.

**`src/shell/` (new, 7 files):**
- `AppShell.jsx` — mobile column (max 480px) centred on canvas; sticky TopBar, scrolling `<Outlet/>` main, sticky BottomNav; `useDisclosure` drives the drawer.
- `TopBar.jsx` — 3-slot grid: bell (notifications, inline-start/right) · centred logo → `/` · hamburger (inline-end/left) → opens the drawer. aria-labelled, ≥44px.
- `NavDrawer.jsx` — **Mantine `Drawer`** (focus-trap, ESC, overlay-click close, scroll-lock, ARIA) with 9 real router links (خانه/کشف/برنامه/لیست خرید/علاقه‌مندی‌ها/پروفایل/دستاوردها/تنظیمات/پشتیبانی); each routes **and** closes; active item = saffron accent bar + saffron icon + brand-700 bold label; `zIndex=400` (above nav/topbar). In RTL, Mantine maps `position="left"` to the inline-start (right) edge — the conventional RTL menu side.
- `BottomNav.jsx` — 5 tabs (RTL: خانه / برنامه / کشف / علاقه‌مندی‌ها / پروفایل); active = saffron indicator bar + brand-600 icon + brand-700 label; inactive = text-secondary (AA).
- `Placeholder.jsx` — centred logo + «به‌زودی» + muted sub-line (deliberately minimal; **not** Home).
- `NotFound.jsx` — in-shell «۴۰۴ / صفحه پیدا نشد / این بخش هنوز ساخته نشده است» + «بازگشت به خانه».
- `navConfig.js` — single source for the two nav lists.

**Font:** `index.css` trimmed to a single self-hosted `@font-face` Vazirmatn (`/fonts/Vazirmatn-Regular.ttf`, `font-display:swap`); tokens own the family stacks, `base.css` applies them via `:lang(fa)` with `<html lang="fa" dir="rtl">`.
**Tokens:** GES tokens only — saffron `#EA6C0A` brand for active/brand, warm-neutral surfaces, the 3 shadows, logical RTL properties, ≥44px targets, visible focus (`base.css :focus-visible`), reduced-motion respected. `vite.config.js` PWA `theme_color` `#FF6B35` → `#EA6C0A`.
**No new dependency.**

## 5. Shell render — in words (derived from the green build + code + adversarial review; I could not capture a headless screenshot in this environment — that is the founder's next step)
A centred mobile column on a warm off-white canvas (`#FAF7F2`), hairline-framed. **TopBar** (white, 56px, sticky, hairline bottom border): bell on the right, گارنیش wordmark centred, hamburger on the left — all in Vazirmatn. Tapping the hamburger slides a **white Drawer** in from the right (RTL-natural) over a dimmed/blurred overlay; its header shows the logo + a close button; below, 9 Persian nav rows with icons — the current route (خانه) marked with a saffron start-edge bar, saffron icon and bold label. Tapping a row navigates and closes the drawer; ESC or tapping the overlay closes it. The **main area** shows the centred placeholder: the گارنیش logo, «به‌زودی», and a calm muted line. The **BottomNav** (white, sticky, soft top shadow, safe-area padded) shows 5 Persian tabs; the active tab (خانه) carries a small saffron indicator bar with a saffron icon and bold label, the others muted. Navigating to any not-yet-built route (e.g. برنامه) keeps the shell and shows the in-shell 404 with that tab highlighted — proving routing + active states work. No raw English reaches the user. On mount, no console errors are expected: Auth no-ops without a stored token; Recipe fires a background recipes query that fails silently with no backend and is ignored by the shell.

## 6. Decision points (wipe-induced gate conflicts — founder-decided)
The brief assumed the wipe wouldn't affect the gates. Two gates enforce *frontend structure* and the wipe legitimately broke them. Both were surfaced to the founder; both resolutions were chosen by the founder ("reconcile → stop before push").

**(a) Coverage gate (`tools/coverage/` — not backend).** `coverage:check` is a frontend-render/route gate. The wipe deleted the recipe-detail page and inline API callers, producing **30 blocking UNMAPPED** (21 `Recipe.*` detail-render fields + 9 endpoints). Master was green (UNMAPPED=0); the wipe caused all 30 (confirmed by running the gate on `master` in the worktree). **Resolved** by moving the 30 into the gate's **own non-blocking debt states**, each reason preserving the original frontend target for mechanical re-mapping when content sprints rebuild:
  - 21 `Recipe.*` recipe-detail fields → `must-render` (debt: "intended for FE, not yet surfaced").
  - 9 endpoints (`recipes/:id`, `recipes/:id/similar`, `recipes/search`, `recommendations`, `meal-plans/propose`, `shopping-list/from-plan`, `upload/avatar`, `users/consent`, `notifications/ine/preview`) → `deferred:E-fe-reset-a`.
  - Result: UNMAPPED 30→0 (mapped 66→36, must-render 0→21, deferred 14→23). Tooling only; no backend, no dep.

**(b) Backend guardrail test (`apps/server/src/security/sec-prelaunch-19.spec.ts`, R17).** The **only** failing server test. R17 `fs`-reads 4 frontend surfaces and requires each to import `useRecipeContext`; the wipe deleted 3 (`AddFromFavoritesModal`, `AddFromPlanModal`, `RecipePickerModal`); only `AIChatContext` survives. R17's actual intent — RecipeContext exists + wired at the app root, no missing-context crash — is unaffected and still asserted (R17 tests 1 & 2 pass; `RecipeProvider` is deliberately kept in the chain). Because this file lives under `apps/server/` (explicitly fenced "backend untouched"), the founder was asked and **authorized** a surgical update to **only** R17's surface list — keep the surviving consumer, drop the 3 wiped surfaces with a re-map note. Backend runtime/logic untouched; only this frontend-structure guardrail's file list changed. Server suite: 1411/1412 → **1412/1412**.

> Net "backend" footprint: **zero runtime/logic change**; one frontend-structure guardrail **test** file edited under explicit founder authorization. Disclosed here for full transparency.

## 7. Clean-room verification (isolated worktree)
Worktree created **detached at the branch tip** (`--detach`) because the branch is checked out in the primary worktree; the tree is byte-identical to the branch.

```
git worktree add --detach ../garnish-verify exec/garnish-fe-reset-a   # detached @ 07990db9 (code tip)
cd ../garnish-verify
pnpm install --frozen-lockfile        # reused 1082/1084, added 0 downloaded → Done in 32.5s
pnpm --dir apps/server exec prisma generate   # Generated Prisma Client v5.22.0 → exit 0
pnpm build                            # Tasks: 2 successful, 2 total (web vite + server) → exit 0
pnpm coverage:check                   # UNMAPPED=0 UNREGISTERED=0 → COVERAGE GATE PASSED → exit 0
pnpm test                             # Test Suites: 191 passed, 191 total
                                      # Tests:       1412 passed, 1412 total ; Snapshots: 0 ; skips: 0 → exit 0
git status --short                    # only regenerated artifacts (coverage.generated.json + docs/qa/*_results.json
                                      #   written by the eval/coverage tooling on run) — not source changes
git diff --name-only master           # the wipe + shell + reconciles (158 source paths) [+ regenerated artifacts]
git worktree remove ../garnish-verify
```
*Verification ran on code tip `07990db9`. The subsequent commits are docs/generated-only — `chore` refresh of `docs/coverage/coverage.generated.json` (committed in sync per repo convention) and this report — neither is a build/test/coverage input, so the gates hold at the final tip.*

### Scope-proof
- **Logic layer preserved:** `apiClient`/9 hooks/services/auth+recipe+theme context/tokens all present (listed §3). ✔
- **UI layer wiped:** 146 deletions (`git diff --name-status master`). ✔
- **Clean shell:** TopBar + **working** Mantine Drawer (focus-trap/ESC/overlay-close, links route + close), BottomNav 5 tabs, routing (`/` + `*`), RTL + Vazirmatn wired. ✔
- **Zero banned hex:** `grep -rniE '#FF6B35|#1A237E|#4CAF50' apps/web` (src+config, excl node_modules/dist) = **0**. ✔ (Only raw hex in source is the sanctioned `garnish-theme.js` saffron-ramp adapter block.)
- **No content pages:** only `shell/Placeholder` + `shell/NotFound` + chrome. ✔
- **Web build exits 0**, **no new dep**, **backend runtime untouched** (`git diff --name-only master -- apps/server` = only the one authorized R17 test). ✔
- **Server tests** 1412/1412, **0 skips**, 0 fail. **Coverage** green.

## 8. Why not merged
The founder selected **"Reconcile registry → STOP before push"**, so the merge/push is intentionally **held** for review of the two reconciliations (coverage registry + R17 guardrail) and the shell. On approval: `git checkout master && git merge --ff-only exec/garnish-fe-reset-a && git push`.

---

## VERDICT
```
FE_RESET_A RESULT: PASS (verification green) — HELD: not merged/pushed per founder "STOP before push"
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
Logic layer PRESERVED: apiClient/hooks/services/auth/context/tokens intact = yes (listed §3)
UI layer WIPED: old pages + components + page-styles deleted = yes (146 deletions)
Clean shell built: TopBar with WORKING hamburger drawer = yes, BottomNav 5 tabs = yes, routing = yes (/ + in-shell 404)
RTL + Vazirmatn rendering correctly = yes (DirectionProvider rtl + html dir=rtl; self-hosted @font-face, theme font stack)
Zero hardcoded non-brand hex (no #FF6B35/#1A237E/#4CAF50) = yes (grep = 0; only sanctioned saffron-ramp adapter block)
NO content pages built (shell + placeholder only) = confirmed
Backend untouched = runtime/logic yes; ONE frontend-structure guardrail test (sec-prelaunch-19 R17) edited under explicit founder authorization (§6b)
Shell render (in words): see §5 — TopBar(bell/logo/hamburger) · drawer opens from right (RTL), 9 links route+close, focus-trapped · BottomNav 5 tabs, saffron active · placeholder «به‌زودی» · in-shell 404 · Vazirmatn RTL · no console errors expected on mount
Boundaries: new-dep=NONE, backend-runtime-change=NONE (one authorized guardrail-test edit)
Coverage gate: green (UNMAPPED=0; 30 wipe-orphaned mappings reconciled to must-render/deferred, founder-approved)
Merge/push: NOT merged — HELD for founder review per AskUserQuestion decision ("reconcile → STOP before push"); ff-merge exec/garnish-fe-reset-a → master ready on approval
Verdict: FE_RESET_A_PASS (HELD pending founder review/approval to merge)
```

---

**Next sprint builds ONE content page (Home), to be screenshot-reviewed by the founder before proceeding.** From here every screen is screenshot-gated by the founder and reviewed before the next is built.
