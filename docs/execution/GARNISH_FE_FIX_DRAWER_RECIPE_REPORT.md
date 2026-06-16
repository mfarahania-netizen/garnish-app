# GARNISH-FE-FIX-DRAWER-RECIPE — Execution Report
**Sprint:** Track 5 Reset · Sprint C-FIX — fix the hamburger drawer + 3 Recipe Detail bugs
**Branch:** `exec/garnish-fe-fix-drawer-recipe`  ·  **Baseline:** `master` @ `3a7accdb`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Two screenshot-review fixes, frontend-only, on the GES tokens against the handoff-bundle mockups
(`home-screen-design-exploration/project/`). The bundle runtime is **never imported** and the
folder stays **gitignored** (not bundled). **Backend untouched** (`apps/server` diff empty).

## 2. PART A — Hamburger drawer (rebuilt to the mockup)
**Root cause of the prior state:** the drawer was a flat logo-header + 9-item list with **no user
header and no logout**; the "items appear three times" reads as a stale build — the source mapped
the list once. Rather than patch, the drawer was **rebuilt to the approved mockup** as a single
clean panel, so the structure is now unambiguous (each destination rendered exactly once):

- **User header** — circular avatar (name initial) + name (from `AuthContext.user`) + a taste line
  «ذائقه: <band> ٪» built from **GET /profile** `maturity.band`/`overallScore` (query shares
  Home's `['home','profile']` cache key — deduped, no extra round-trip). Custom close ✕.
- **One grouped nav, each item ONCE** — primary (پروفایل من · شناسهٔ ذائقه · برنامهٔ هفتگی ·
  لیست خرید · دستیار آشپزی), divider, secondary (تنظیمات · اعلان‌ها · کمک و پشتیبانی). Each is a
  real `react-router` link → routes **and** closes the drawer; active destination reads saffron.
- **«خروج» logout** — pinned to the bottom in the GES danger token (`--g-color-state-danger-fg`),
  wired to `AuthContext.logout` (close → logout → navigate `/`); shown only when signed in.
- RTL, opens from the **right** (Mantine `position="left"` under `dir="rtl"`), focus-trapped,
  ESC/overlay-close, scroll-lock (Mantine Drawer). Header + bottom respect the safe-area insets.
- `navConfig`: `DRAWER_ITEMS` → `DRAWER_PRIMARY` + `DRAWER_SECONDARY`.

## 3. PART B — Recipe Detail (3 issues)
- **ISSUE 1+2 (clipped hero / broken "۱:۲ … 📷" title bar).** Both were the hero `<img>` rendering
  a **bad/relative `imageUrl`** as the browser's broken-image glyph + alt text. New `HeroMedia`:
  `onError` swaps to the branded **placeholder** (never a broken 📷), and `alt=""` keeps the hero
  decorative (the real title is the heading **below** the hero — unchanged, correct) so no
  broken-alt text can flash. Hero now a **consistent 248px** (no short/cut strip). The top bar
  (back `‹` RTL-correct / share / bookmark) now respects the **top safe-area** via
  `calc(space + env(safe-area-inset-top))` — previously an inline `padding` overrode the
  `g-safe-top` class, so the controls jammed under the status bar.
- **ISSUE 3 (raw `main_course` tag).** New `faCategory` (in `home/lib/reasons.js`) maps
  course/meal-type/diet/cuisine enums → Persian (`main_course`→«غذای اصلی», `side_dish`→«مخلفات»,
  `dessert`→«دسر», …); a Persian tag passes through; an **unknown** machine key is humanized
  (snake_case → spaced) so a raw key is **never** shown. Categories localized + de-duped in
  `useRecipeDetail`. `faDifficulty` extended with common variants (beginner/intermediate/advanced).
- Untouched (kept): ingredients + «جایگزین؟», nutrition + «اطلاعات عمومی، نه توصیهٔ پزشکی»,
  steps/tips/faq, fit + allergen banner, AI sheet, byline, «بپز» action shelf.

## 4. Token purity / a11y / RTL
Zero banned hex (`#FF6B35`/`#1A237E`/`#4CAF50` grep = 0). No raw color literals in the changed
files — only `var(--g-*)` tokens. Logical RTL only. ≥44px targets; visible focus; reduced-motion
respected; no new dependency; no new CSS keyframe.

## 5. Clean-room verification (isolated worktree, detached @ `e17ca24d`)
```
git worktree add --detach ../garnish-verify e17ca24d
pnpm install --frozen-lockfile           # Done in 30.6s (frozen)
pnpm --dir apps/server exec prisma generate    # ok
pnpm build                               # Tasks: 2 successful, 2 total (web vite + server) → exit 0
pnpm coverage:check                      # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                         # Test Suites: 191 passed, 191 total
                                         # Tests:       1412 passed, 1412 total ; Snapshots: 0 ; skips: 0
git diff --name-only master e17ca24d -- apps/server   # EMPTY (backend untouched)
# dist has NO support.js/_ds_bundle/x-import and NO jujeh-kabab (bundle not bundled); variable font IS bundled.
```

### Scope-proof
- Changed set vs master = `shell/{NavDrawer.jsx,navConfig.js}`, `app/recipe/[id]/{page.jsx,useRecipeDetail.js}`,
  `app/home/lib/reasons.js`, `components/ges/format.js`, `docs/coverage/coverage.generated.json`.
  **No other page. No `apps/server` change.**
- Drawer: single grouped list (each item once) + user header + red logout. Recipe: no broken
  image/alt, safe-area top bar, no raw enum tag.

## 6. Render — in words (founder's screenshot is the next step)
**Drawer:** opens from the right — avatar + name + «ذائقه: …٪» at top, one clean grouped list
(no repeats), red «خروج» at the bottom; tap routes + closes. **Recipe Detail:** hero is a clean
photo-or-placeholder (no broken 📷, no "۱:۲" strip) at a proper height, back/share/bookmark sitting
below the status bar; the dish title reads «پلنتا با قارچ» below the hero with **Persian** tags
(«غذای اصلی · …», no `main_course`). RTL + Vazirmatn; clean console expected.

---

## VERDICT
```
FE_FIX_DRAWER_RECIPE RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
DRAWER: nav rendered ONCE (single grouped list) = yes; user header (avatar+name+maturity from /profile) = yes; red «خروج» logout wired to AuthContext logout = yes; RTL + opens from right + focus-trapped + links route+close = yes
RECIPE hero: bad/relative imageUrl → branded placeholder (no broken 📷 / no alt "۱:۲" strip) = yes; consistent 248px height + top safe-area on back/share/bookmark = yes; real title below hero unchanged = yes
RECIPE tags: category enums localized to Persian (main_course→«غذای اصلی»); no raw enum key anywhere = yes
Untouched recipe parts (ingredients/«جایگزین؟», nutrition+caption, steps/tips/faq, «بپز») kept = yes
bundle runtime NOT imported, design bundle NOT bundled = yes
Zero non-brand hex (no #FF6B35/#1A237E/#4CAF50) = yes, grep
RTL + Vazirmatn + reduced-motion + AA + >=44px = yes
Frontend-only: only drawer + Recipe Detail (+ shared localizer); backend untouched = yes (apps/server diff empty)
Merge/push: exec/garnish-fe-fix-drawer-recipe → master (ff, pushed)
Verdict: FE_FIX_DRAWER_RECIPE_PASS
```

---

**Next: Cook Mode (entered from «بپز»), then onboarding/profile — screenshot-gated.**
