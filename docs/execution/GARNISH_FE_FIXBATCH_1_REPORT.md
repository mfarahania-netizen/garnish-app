# GARNISH-FE-FIXBATCH-1 — Execution Report
**Sprint:** Track 5 Reset · Sprint Q — Frontend Fix Batch (6 fixes)
**Branch:** `exec/garnish-fe-fixbatch-1`  ·  **Baseline:** `master` @ `624194e9`
**Merged HEAD:** `cc0f3804`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17
**Scope:** frontend only (`apps/web`); backend frozen + untouched. Mockups in
`home-screen-design-exploration/project/` used READ-only (bundle runtime never imported).

---

## The 6 fixes (root cause → change, render vs mockup)

### FIX 1 — back affordance on every pushed route
**Root cause:** shell sub-screens relied on the shared TopBar (hamburger + bell only) — no back; Admin had none.
**Change:** `TopBar` now shows a **back chevron** (`IconChevronRight`, RTL-correct) on every pushed route and the
hamburger only on the 5 bottom-nav tabs (the tab set is derived from `navConfig.BOTTOM_TABS` so it can't drift).
Back pops history but **falls back to Home on a cold deep-link** (no prior in-app entry), so it's never a no-op.
Added a matching 44px back chevron to Admin. Recipe (`navigate(-1)`), Cook (X→recipe), and every Onboarding step
(QuestionShell / Reveal / Account) already had working back.
**Render:** every pushed screen (settings/notifications/achievements/shopping/assistant/food-dna/admin) shows a
back chevron at the inline-start; tabs keep the hamburger (drawer still reachable). Browser back doesn't white-screen.

### FIX 2 — recipe «برای من تنظیمش کن» opens the IN-CONTEXT AI sheet (proposes-not-auto)
**Root cause:** the sheet's `onAsk` did `navigate('/assistant')` — every option dumped the user into the generic
assistant.
**Change:** `AISheet` rewritten as a disclosed (AI glyph + "AI"), hedged, **in-context** sheet. Servings is a real
stepper **proposal** applied only on **«بله، اعمال کن»** (or **«بی‌خیال»**) — the recipe then shows
«تنظیم‌شده برای N نفر» (honest serving-target note; no fabricated per-ingredient rewrite). Swap/time are honest
in-context notes (handled step-by-step in Cook Mode), never a navigation. `navigate('/assistant')` is **gone**
(grep = 0); AISheet no longer imports `useNavigate`.
**Render:** tapping «برای من تنظیمش کن» opens a bottom sheet on the recipe; never leaves the page; never auto-applies.

### FIX 3 — drawer «پروفایل من» ≠ «شناسهٔ ذائقه»
**Root cause:** targets were already distinct (`/profile` vs `/food-dna`), but `ProfilePage` used
`useState(initialView)` and React reused the same instance across the two routes (no remount), so the view never
switched → both looked like Profile.
**Change:** distinct route **keys** (`key="profile"` / `key="dna"`) force a remount per route, so each opens its
intended view; the internal profile↔DNA toggle still works.
**Render:** «پروفایل من» → the Profile screen; «شناسهٔ ذائقه» → the Food-DNA breakdown («تفکیکِ ابعاد»). Distinct.

### FIX 4 — picks compact 16:9
**Root cause:** RecipeCard media was `aspect-ratio:16/9` (matches the mockup) but rendered near-square in the
founder's session — the property wasn't being honored (cache/engine quirk).
**Change:** replaced with the **bulletproof `padding-top:56.25%`** technique — the height is derived from the width
in every engine/cache state, so the media is always short+wide 16:9; the small low-opacity branded glyph is kept;
overlays (save / fit badge / allergen scrim) stay `absolute inset:0`.
**Render:** the 3 «برای تو، امشب» picks are now short+wide, same proportion as the rails. Shared RecipeCard →
rails/favorites/discover/plan unaffected (all already 16:9).

### FIX 5 — shopping: deletable + grouped by aisle
**Root cause:** backend `ShoppingItem.category` is empty → the existing grouping dumped everything into «سایر»; and
there was no delete.
**Change:** (a) a per-row **trash** control wired to `remove()` → `DELETE /shopping-list/items/:id` (optimistic +
revert on failure; removed items drop out of total/done/groups; from-plan resets it). (b) a client-side Persian
**name→aisle inferrer** used when the backend category is absent (produce / protein / grain / dairy), with
«سایر» only for true unknowns; plant «milks» (شیر بادام/سویا/جو دوسر/نارگیل/برنج) are **not** mislabelled dairy.
No-shame checked state + the honest «روی حسابت محفوظه» kept.
**Render:** items group under aisle headings (میوه و سبزی / گوشت و پروتئین / غلات و حبوبات / لبنیات / …) and each
row has a trash button; checking off is still shame-free.

### FIX 6 — onboarding reveal: no misleading «۷۵٪»
**Root cause:** the reveal ring showed `engaged/8` (answer-completeness) which read as a knowledge score right
after a few questions.
**Change:** `FoodDnaRing` gains `showValue={false}` + `centerIcon`; the reveal shows a **calm forming ring with a
leaf, no number**, the warm copy «ذائقه‌ات داره شکل می‌گیره» + «از همین چند پاسخ، این‌طور شروع کردیم به شناختت:»
+ the trait chips. The now-dead `revealValue` computation was removed from the hook.
**Render:** the reveal is a warm "we've started" moment — no percentage. (The real, now-corrected-low maturity %
lives on Home/Profile and grows with real cooking.)

## Button / action audit (screen → control → wired-to / placeholder)
- **Chrome:** TopBar hamburger→drawer (tabs) · back→history/Home (pushed) · logo→`/` · bell→`/notifications`.
  Drawer: پروفایل من→`/profile` · شناسهٔ ذائقه→`/food-dna` · برنامهٔ هفتگی→`/plan` · لیست خرید→`/shopping-list` ·
  دستیار آشپزی→`/assistant` · بازنگری ذائقه→`/onboarding` · تنظیمات→`/settings` · اعلان‌ها→`/notifications` ·
  **کمک و پشتیبانی→`/support` = calm "coming soon" in-shell 404 (known, see Remaining)** · خروج→logout→`/`.
- **Home:** search→`/discover` · DNA card→toast(به‌زودی) · whisper→recipe · meal/cuisine chips→`/discover` ·
  picks/rails→`/recipe/:id` · save→toast · occasion→toast(به‌زودی).
- **Recipe:** back→history · save/share→toast · «برای من تنظیمش کن»→**in-context AISheet** · «جایگزین؟»→toast
  (cook-mode hint) · «به برنامه»→toast(به‌زودی) · «بپز»→`/cook/:id` · AISheet servings→apply/dismiss · swap/time→note.
- **Cook:** close→`/recipe/:id` · prev/next→steps · «کمک»→AI help sheet · finish→`/` · rate→toast.
- **Plan:** propose/accept slots→real writes · shopping→`/shopping-list` · card→`/recipe/:id`.
- **Shopping:** row→toggle check · **trash→remove** · «از روی برنامه»→from-plan · add→addManual.
- **Favorites:** card→`/recipe/:id` · unsave→real · empty suggestions→save/open · «کشفِ دستورها»→`/discover`.
- **Assistant:** send/retry/reset/feedback→real (`POST /ai/chat`).
- **Settings:** prefs/consent/notif→real · export/delete→real · theme/lang→«به‌زودی».
- **Notifications:** row→`/recipe/:id` · mark-all→real · prefs→`/settings`.
- **Achievements:** retry→refetch · «یه دستور پیدا کن»→`/discover`.
- **Admin:** back→history/Home · range chips→setDays · refresh→refetchAll · export→JSON · denied→`/`.
- **Onboarding:** every step back/skip/continue · reveal back · account submit/toggle (validate-on-submit).

No dead/absurd jumps remain; unbuilt destinations land on a calm toast or the "coming soon" 404, never a crash.

## Honesty / safety
Recipe AI sheet disclosed + hedged + proposes-not-auto (no generic-assistant dump, no auto-apply); allergen
demote-not-hidden intact; nutrition caption intact; reveal shows **no** misleading score; the aisle inferrer is an
organizational heuristic only (never touches allergen flagging; the item name is always shown). No fabricated data,
no raw enum keys.

## Adversarial review (3 lenses) — findings fixed before merge
**0 blockers, 0 majors.** Fixed: Admin back 40→44px; back never a no-op on a cold deep-link (TopBar + Admin
history fallback); TopBar tab set derived from navConfig; plant-milk not mislabelled dairy; dead `revealValue`
removed; FoodDnaRing JSDoc; recipe `baseServings ??`. Left (out of scope / no-bug): `/support` → calm 404
(pre-existing), servings clamp ≥1.

## Clean-room verification (isolated worktree, detached @ `cc0f3804`)
```
git worktree add --detach ../garnish-verify cc0f3804
pnpm install --frozen-lockfile          # ok
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
pnpm --dir apps/web test                # Test Files 18 passed; Tests 81 passed
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites 192/192 ; Tests 1420/1420 ; skips 0
grep -rnE "#(FF6B35|1A237E|4CAF50)" apps/web/src ; echo exit=$?   # exit=1 (no matches → 0 non-brand hex)
git diff --name-only master cc0f3804 -- apps/server   # EMPTY (backend untouched, incl .gitignore)
```
**Changed set (13 files), all `apps/web/src`:** App.jsx, shell/TopBar.jsx, app/admin/page.jsx,
app/onboarding/page.jsx, app/recipe/[id]/page.jsx, app/shopping-list/{page.jsx,useShopping.js,shoppinglist.smoke.test.jsx},
components/ges/{AISheet.jsx,AISheet.test.jsx,FoodDnaRing.jsx,RecipeCard.jsx}, app/onboarding/useOnboarding.js.
New web tests: AISheet propose-not-auto guard + shopping delete guard. **Server tests unchanged (backend untouched).**

---

## VERDICT
```
FE_FIXBATCH_1 RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage green, server tests suites 192/192, tests 1420/1420, skips 0
FIX1 back affordance on every pushed route + every onboarding step (browser back ok) = yes
FIX2 buttons audited — all wired/placeholdered; recipe «شخصی‌سازی» opens in-context AI sheet (proposes-not-auto), not generic assistant = yes
FIX3 drawer «پروفایل من» ≠ «شناسهٔ ذائقه» (distinct targets) = yes
FIX4 picks cards compact 16:9 (short+wide, small glyph, not tall/huge) = yes
FIX5 shopping: items deletable + grouped by aisle (not one «سایر») + no-shame check + MergeChip kept = yes
FIX6 onboarding reveal: NO percentage; forming ring + traits + warm copy = yes
Honesty/safety intact (AI disclosed+proposes-not-auto, allergen demoted, nutrition caption, no fabricated data, no raw enum) = yes
Zero non-brand hex across apps/web/src (grep) = yes
No regression to working screens = yes (81 web tests, 192/1420 server)
bundle runtime NOT imported/bundled = yes · RTL+Vazirmatn+reduced-motion+AA+44px = yes
Frontend-only, backend untouched (incl server .gitignore) = yes
Render (in words): back chevron on every pushed screen; recipe personalize opens an in-context propose-not-auto sheet; drawer profile vs Food-DNA distinct; picks short+wide 16:9; shopping deletable + aisle groups; reveal has no % — RTL throughout, console clean
Merge/push: exec/garnish-fe-fixbatch-1 → master ff, pushed, commit cc0f3804
Verdict: FE_FIXBATCH_1_PASS
```

---

**Next: founder review; then the onboarding-questions research track (separate), then dark mode + LTR + L4 polish.**
