# GARNISH-FE-ONBOARDING-ACCESS-DISCOVERY — Execution Report
**Sprint:** Track 5 Reset · Sprint E — make onboarding reachable + build Discovery (frontend)
**Branch:** `exec/garnish-fe-onboarding-access-discovery`  ·  **Baseline:** `master` @ `af6dea9b` (built on `20cac1f7`)
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Two frontend deliverables, both on the GES tokens, against the handoff-bundle mockup. The bundle
runtime is **never imported** and the folder stays **gitignored** (not bundled). **Backend
untouched** (`apps/server` diff empty) — and **no "onboarded" backend field**; access uses only the
real auth / preferences / consent signals.

## 2. PART A — onboarding access (real signals only, no backend field)
- **First-run / logged-out → onboarding.** New `shell/RequireAuth.jsx` wraps the app shell: an
  unauthenticated visitor (no token, or `GET /users/me` invalidates it) is routed to **`/onboarding`**
  instead of being shown an empty Home. A calm loader holds during boot-token validation so
  onboarding never flashes. `/onboarding` and `/recipe/:id` stay public (a shared recipe link still opens).
- **Logged-in re-entry (the #3 requirement, which the Sprint-D guard previously blocked).** Removed
  `OnboardingPage`'s blanket `token → Home` redirect; `useOnboarding` now exposes `authed`. An
  already-signed-in user runs the question steps and the reveal's **«ذخیره و ادامه»** saves consent +
  preferences directly (`finish()`, **skipping the account step**) → Home; the welcome hides the
  «ورود» line when authed. A logged-out user's flow is unchanged (ends in account creation).
- **Menu re-entry:** **«بازنگری ذائقه» → `/onboarding`** added to the drawer's secondary group.
- **Home search → Discovery:** the Home search field now navigates to `/discover` (was a toast).
- **Logged-in but not onboarded (#2):** used the **sanctioned fallback** (authenticated → Home),
  *not* an aggressive preferences-based force-redirect — that risks loops/annoyance and the menu
  re-entry (#3) covers users who skipped. No backend field invented.
- **Post-complete → Home** for both signup and re-entry.

## 3. PART B — Discovery / search (کشف) on the real API
Built to `Garnish Discovery.dc.html` at `app/discover/{page.jsx, useDiscovery.js, categories.js}`,
the `/discover` route inside the (now gated) AppShell:
1. **Search field** — a prominent RTL input («جستجوی غذا، ماده، یا دستور…»), search glyph at the
   start edge, clear ✕; debounced → **`GET /recipes/search?q=…`** (query via axios `params`, never a
   query string — keeps the coverage scanner honest).
2. **Browse (no query)** — «دستهٔ وعده» chips + «دستهٔ غذا» tiles (warm **token** tones, never a gray
   gradient) that run a real search for their term; «محبوب‌ها» + «بر اساس آشپزخونه‌ات» rails of
   **compact 16:9 RecipeCards** with the small-glyph branded placeholder (same as Home — never
   huge/tall/circle/gray/broken). A «نمونهٔ بی‌نتیجه: جستجوی «سوشی» →» link.
3. **Results (active query)** — `RecipeCard`s with **real Persian reasons** from `_search.matchedTerms`
   in the «چرا این؟» WhyChip; **no fabricated fit badge** (search is anonymous-ranked, so we don't
   fake «عالی برای تو»); quick filters (زیر ۱ ساعت / سریع / گیاهی) refine client-side; **allergen
   demote-not-hidden** — a result whose listed ingredients match a declared allergy is moved to the
   bottom under a «برای ایمنی پایین‌تر» divider with the «حاوی … — حساسیتِ اعلام‌شده‌ات» banner
   (real signals only: declared allergies × listed ingredients, conservative token match; never
   hidden, never a fabricated guarantee).
4. **unmetSearch (captured-intent)** — «<q> رو پیدا نکردیم» + «این جستجو رو ثبت کردیم…» + a
   **«درخواستت ثبت شد»** that is **true**: the query is recorded via `trackEvent('search_unmet')` →
   `POST /analytics/event`, which only fires for a signed-in user — and Discovery sits behind the
   auth gate, so the claim is honest, not decorative — plus alternative suggestion chips. No dead end.
5. **States** — loading skeletons, error + single retry. Tapping a result/rail card → Recipe Detail.

## 4. Honesty / safety
No fabricated data or results (honest-empty search → the captured-intent state, which actually
records the demand). No fabricated fit (search has no personalized fit → none shown). Allergen
**demoted-not-hidden** from real signals; never a safety guarantee. WhyChip reasons are real
Persian corpus terms (English/stray tokens filtered) — no raw English/enum. No invented ingredient
IDs. No medical framing. No backend "onboarded" flag.

## 5. Token purity / a11y / RTL
Zero banned hex (`#FF6B35`/`#1A237E`/`#4CAF50` grep = 0). No raw color literals in `app/discover/**`
or `shell/RequireAuth.jsx` — only `var(--g-*)` tokens (the mockup's raw-hex gradient placeholders
were deliberately **not** reproduced; the token-pure `PlatePlaceholder`/`RecipeCard` are used).
Logical RTL props only. ≥44px targets; `aria-pressed`/`aria-label`s; visible focus; reduced-motion
respected; no new dependency.

## 6. Clean-room verification (isolated worktree, detached @ `b974d9a5`)
```
git worktree add --detach ../garnish-verify b974d9a5
pnpm install --frozen-lockfile           # Done in 38.5s (frozen)
pnpm --dir apps/server exec prisma generate    # ok
pnpm build                               # Tasks: 2 successful, 2 total (web vite + server) → exit 0
pnpm coverage:check                      # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                         # Test Suites: 191 passed, 191 total
                                         # Tests:       1412 passed, 1412 total ; Snapshots: 0 ; skips: 0
git diff --name-only master b974d9a5 -- apps/server   # EMPTY (backend untouched)
# dist has NO support.js/_ds_bundle/x-import and NO jujeh-kabab (bundle not bundled); variable font IS bundled.
git worktree remove ../garnish-verify
```

### Scope-proof
- Changed set vs master = `App.jsx`, `shell/RequireAuth.jsx` (new), `shell/navConfig.js`,
  `app/home/page.jsx` (search→discover), `app/onboarding/{page.jsx,useOnboarding.js}`,
  `app/discover/{page.jsx,useDiscovery.js,categories.js}` (new), `tools/coverage/coverage.registry.json`,
  `docs/coverage/coverage.generated.json`. **No other page. No `apps/server` change (incl. its `.gitignore`).**
- Onboarding reachable (first-run/logged-out routing + re-entry, real signals, no backend field);
  Discovery built to the mockup (search/filter/browse/results/unmetSearch); compact 16:9 imagery;
  bundle runtime not imported / not bundled; zero non-brand hex; server tests 191/191, 1412/1412,
  0 skips; build green.

## 7. Render — in words (founder's screenshot is the next step)
Open the app **logged-out** → you land in **onboarding** (not an empty Home); the drawer has
**«بازنگری ذائقه»** to re-run it; finishing returns to Home. Open **کشف**: a search field over a
browse view (meal chips · food tiles · «محبوب‌ها» / «بر اساس آشپزخونه‌ات» rails of compact 16:9
cards). Type a dish → results as cards with a «چرا این؟» chip of real matched terms (no fake
fit badge), refinable by quick filters, with any allergen-conflicting result demoted under «برای
ایمنی پایین‌تر». Search **«سوشی»** → the warm captured-intent state («رو پیدا نکردیم» · «درخواستت
ثبت شد» · suggestions), not a dead end. RTL + Vazirmatn; clean console.

---

## VERDICT
```
FE_ONBOARDING_ACCESS_DISCOVERY RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
Onboarding REACHABLE: logged-out/first-run → /onboarding = yes; re-entry from Settings/profile = yes (drawer «بازنگری ذائقه»); post-complete → Home = yes; NO backend field added (real auth/preferences/consent signals) = yes
Discovery built to mockup: search + filter/chips + browse(category rows + rails) + results(fit+WhyChip real Persian) + unmetSearch captured-intent = ok (no fabricated fit badge — search is anonymous-ranked; WhyChip uses real matchedTerms)
Imagery = compact 16:9 + small-glyph placeholder (no huge/tall/circle/gray/broken) = yes
Honesty/safety: allergen demoted-not-hidden + real Persian reasons (no raw English/enum) + no dead-end + no fabricated results + no invented ingredient IDs = yes
bundle runtime NOT imported / NOT bundled = yes
Zero non-brand hex (no #FF6B35/#1A237E/#4CAF50) = yes, grep
RTL + Vazirmatn + reduced-motion + AA + >=44px = yes
Frontend-only: only onboarding-access + Discovery + primitives; backend untouched (incl. server .gitignore) = yes
Render (in words): logged-out → onboarding + drawer re-entry · Discovery search/browse(compact 16:9)/results(WhyChip real terms)/unmetSearch(recorded) · RTL · clean console
Coverage: re-mapped honestly (/recipes/search → frontend:discover/DiscoveryPage); gate green
Merge/push: exec/garnish-fe-onboarding-access-discovery → master (ff, pushed)
Verdict: FE_ONBOARDING_ACCESS_DISCOVERY_PASS
```

---

**Next: Cook Mode + Profile — screenshot-gated.**
