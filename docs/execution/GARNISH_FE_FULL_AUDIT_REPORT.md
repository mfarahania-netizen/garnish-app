# GARNISH-FE-FULL-AUDIT — Execution Report
**Sprint:** Track 5 Reset · Sprint P (final) — Full-App Audit + first web smoke-test net
**Branch:** `exec/garnish-fe-full-audit`  ·  **Baseline:** `master` @ `8f1e6a40`
**Merged HEAD:** `cdd50942`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder review**
**Date:** 2026-06-17

> This is an audit, not a "zero bugs" certificate. The build is unusually disciplined, but
> real findings exist and are listed honestly in §6 (Fixed) and §7 (REMAINING — not fixed).

---

## 1. What this sprint delivered
1. **The first web test net** (the app had **zero** web tests): Vitest 4 + @testing-library/react 16
   + jsdom 26, a dedicated `vitest.config.js`, a shared provider harness, and **15 test files / 69
   tests** — one smoke test per screen (14) + a `ges/format` unit test. All green.
2. **A 3-lens adversarial whole-app audit** (honesty/safety · tokens-RTL-a11y · mockup-fidelity+nav),
   run as a background workflow over all 14 screens + chrome + primitives.
3. **Deterministic design-fidelity + nav + console sweeps** (hex grep, RTL physical-prop grep, route
   graph, debug-statement grep).
4. **Fixes** for every safe finding; an **honest REMAINING list** for what was intentionally not changed.

## 2. The smoke-test net
- **Toolchain:** Vitest 4.1.9 + RTL 16.3 + jsdom 26.1; `vitest.config.js` (jsdom, globals, no PWA plugin);
  `src/test/setup.js` (jest-dom + jsdom stubs for matchMedia/ResizeObserver/IntersectionObserver/scroll
  **+ an in-memory localStorage/sessionStorage** so the real `AuthProvider` mounts under test — test-env
  only, production `AuthContext` untouched); `src/test/renderWithProviders.jsx` mirrors `App.jsx` providers.
- **Coverage:** every screen, every top-level state — loading / error / empty / ready, plus the
  step-machine (Onboarding 8 steps), denied/awaiting (Admin), and finished/no-steps (Cook) variants. Each
  test mocks the screen's data hook (no network, deterministic) and asserts the state renders without
  throwing **and** shows a real Persian landmark.
- **Result:** `pnpm --dir apps/web test` → **15 files / 69 tests passed**, in both the local and clean-room runs.
- These are **smoke tests** (render + state correctness), not behavioral/interaction or visual-regression
  tests — see §7.

## 3. Deterministic audit results
| Dimension | Result |
|---|---|
| Banned non-brand hex `#FF6B35/#1A237E/#4CAF50` (all `apps/web/src`, incl. tests) | **0** |
| Raw hex sweep | Only the sanctioned saffron ramp (`theme/garnish-theme.js`) + token defs (`tokens.css`/`base.css`) + 1 brand-700 hex in a `BottomNav.jsx` comment |
| RTL physical props (`marginLeft`/`left:`/… in JS + CSS) | **0** — logical props only |
| Console cleanliness | Only `ErrorBoundary` + catch-block `console.error`; no stray `console.log`/`debugger` |
| Nav/connectivity | Every `navigate()`/`Link`/tab target resolves **except** `/support` (see §7); `/admin` intentionally unlinked |
| Stale `features/*` orphan hooks | Confirmed **not imported** by any of the 14 screens (off the user path; tree-shaken) |

## 4. Adversarial audit verdict
**Zero blockers, zero majors** across all three lenses. The honesty/safety lens confirmed every prior
binding decision still holds (budget band not number; weekly streak; Admin real-vs-awaiting-pilot off the
status flag; no fabricated provenance/per-cuisine mastery/fit badge; English `fit.reasons`/`explanation`/`why`
never rendered; allergen demote-not-hide; AI disclosed+hedged+saffron+proposes-not-auto; consent revocable;
no leaderboard/FOMO; kind grace). Findings were all minor/nit.

## 5. Honesty / safety
No new data surfaces were added (no new endpoints; coverage gate green, no remap needed). The two honesty
fixes (§6) *remove* a potential over-claim and a potential English leak. Backend untouched (incl. its `.gitignore`).

## 6. Findings FIXED before merge
**Honesty**
- **Onboarding reveal ring** caption «بلوغ ذائقه» → «شروعِ شناخت». The reveal % is a local
  answer-completeness ratio (`engaged/8`), **not** the server `maturity.overallScore` that the same caption
  means on Home/Profile — relabelled so a question-count is never read as a taste-maturity score.
- **`faCategory`**: an unmapped, non-Persian category key now **drops** (returns `''`, callers already
  `.filter(Boolean)`) instead of humanizing to de-keyed English. Allergens still humanize unknowns
  (`faAllergen`) — for safety we never drop an allergen token.

**A11y**
- **NotFound** «بازگشت به خانه» (the 404's sole affordance) → a real **≥44px** tap target (was a ~25px text line).
- **Assistant** chat thread → `aria-live="polite"` + `aria-busy` so a screen-reader hears the reply and the
  «در حال فکر…» thinking state on each turn.
- **Profile `KnownRow`** → dropped the row-level `aria-label="ویرایش"` that masked the meaningful
  preference/allergen text; the visible content is now the accessible name.
- **Loading announcements** made consistent: `role="status"`/`aria-busy`/`aria-label` on the 10 top-level
  skeleton loaders that lacked one (matching Achievements' existing pattern).

## 7. REMAINING — NOT fixed (honest list)
These are deliberately left for a founder/design decision or a future sprint — none are safety/honesty breaches:

1. **BottomNav vs Home mockup (IA decision — needs sign-off).** The approved Home mockup put «دستیار» (AI
   assistant) as a primary bottom tab; the shipped bar uses خانه/برنامه/کشف/علاقه‌مندی‌ها/پروفایل, demoting
   the AI assistant to the drawer («دستیار آشپزی») + the Recipe AISheet. Not a dead-end. **Decide:** restore
   «دستیار» to a primary tab, or record this as the intended IA.
2. **`/support` soft dead-end.** Drawer item «کمک و پشتیبانی» → `/support` has no route and lands on the
   in-shell "coming soon" 404 (honest copy + a way home). It's the only nav target without a real route.
   **Decide:** build a support page, or drop the item until support exists.
3. **AIWhisper labelled "AI"** (nit). The Home whisper is an engine-backed top-pick, not LLM-generated text;
   it's disclosed + hedged, so defensible — left as-is.
4. **`useHomeData` `useMemo`** (nit). Its dep array includes whole React-Query objects (fresh identity each
   render), so the memo recomputes every render — wasted work, **no** correctness impact. Left to avoid risk
   on the most-trafficked screen.
5. **Smoke-test workarounds not yet harmonized** (test-infra debt). Now that `setup.js` provides
   `localStorage`, the per-file `AuthContext` mocks / local Storage shims the authoring agents added are
   redundant (guarded/harmless). A cleanup pass could drop them so every screen test exercises the real
   `AuthProvider`. Tests pass; left to avoid churn.
6. **Test depth.** This is a render/state **smoke** net, not interaction/behavioral or visual-regression
   coverage (no user-event flows, no snapshot/pixel diffing). Good next layers: a few interaction tests on
   the highest-risk flows (consent revoke-on-failure, meal-plan accept, allergen demotion) + a visual pass.
7. **Pre-existing stale `features/*` orphan hooks** remain in the tree (see [[garnish-stale-feature-hooks]])
   — off the user path; out of scope here.

## 8. Clean-room verification (isolated worktree, detached @ `cdd50942`)
```
git worktree add --detach ../gv-p cdd50942
pnpm install --frozen-lockfile          # frozen — lockfile valid WITH the new test deps
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm --dir apps/web test                # Test Files 15 passed (15); Tests 69 passed (69)
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 191/191 ; Tests: 1412/1412 ; skips 0
git diff --name-only master cdd50942 -- apps/server   # EMPTY (backend untouched)
```
**Changed set vs master = 35 files**, all `apps/web/**` (test infra + smoke net + the 14 audit-fix source
files), `docs/coverage/coverage.generated.json` (scanner re-recorded the recipe scope dir), and
`pnpm-lock.yaml` (test deps). **No `apps/server` change (incl. its `.gitignore`).**

---

## VERDICT
```
FE_FULL_AUDIT RESULT: PASS (with an honest REMAINING list — NOT a "zero bugs" claim)
Clean install (worktree): frozen install ok (new test deps), build exit 0, coverage green
Web smoke net: 15 files / 69 tests passed (was 0 web tests) — render + every state per screen
Server tests: suites 191/191, tests 1412/1412, skips 0 — backend diff EMPTY (untouched, incl .gitignore)
Adversarial audit: 0 blockers, 0 majors across 3 lenses; all safe minors/nits FIXED
Design fidelity: 0 banned non-brand hex (grep), 0 RTL physical props, console clean
Nav/connectivity: all targets resolve except /support (soft 404, flagged) ; /admin unlinked by design
Honesty/safety contracts: all prior decisions hold; 2 honesty edges fixed (reveal caption, faCategory)
A11y fixes: NotFound 44px, Assistant aria-live, Profile KnownRow name, 10 loaders role=status
REMAINING (not fixed, by design / needs sign-off): BottomNav IA vs mockup, /support route,
  AIWhisper label, useHomeData memo, test-workaround harmonization, deeper test layers
Merge/push: exec/garnish-fe-full-audit → master (ff, pushed) @ cdd50942
Verdict: FE_FULL_AUDIT_PASS
```

---

**This completes the Track-5 screen-by-screen rebuild (C-FIX → O) + the final audit (P). The app now has its
first web test net and a documented remaining-work list. Awaiting founder review of §7 decisions.**
