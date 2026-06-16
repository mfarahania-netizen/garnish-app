# GARNISH-DS-ALIGN-L4-20 — React component library → approved GES Component Kit

**Branch:** `exec/garnish-ds-align-l4-20` · **Baseline:** master `8b5dff60` (after SEC-PRELAUNCH-19) ·
**Scope:** Track 5 / S20 — FRONTEND shared components only. Opens the frontend realization track.

> First sprint of Track 5. Builds the **foundation**: reconciles the existing React GES components and adds the
> missing kit primitives so the real shared library matches the approved **Component Pattern Library v1**
> (`docs/design/COMPONENT_PATTERN_LIBRARY_v1.md`). **No page rewrites** — page/feature alignment is S21–S22.

---

## Phase 0 — intake (confirmed)

- **Baseline green** in the isolated worktree (build 0; server 191 suites / 1412 tests, 0 skips; coverage green).
- **Existing library inventoried (17 primitives + barrel):** Button, CardShell, SectionHeader, StatusBadge,
  BottomSheet, ActionShelf, TimerChip, AIWhisper, AISheet, AICompanion, WhyChip, WhySheet, NutritionBadge,
  AllergenMark, EmptyState, LoadingSkeleton, ErrorState. **Finding: these 17 are already token-pure, RTL-correct,
  reduced-motion aware, and honest** (NutritionBadge carries source/confidence + never invents a number;
  AllergenMark non-dismissible/non-medical; AI components carry the glyph+"AI" disclosure + kind-refusal). No drift
  to fix in them — verified, not rewritten.
- **Drift found (outside `ges/`):** `components/RecipeCard.jsx` was full of hardcoded hex / per-type gradients /
  glass (`#FF6B35`, `#2ECC71`, `rgba(255,255,255,…)`, `#1A237E`, …), ad-hoc `whileHover` motion (not from
  `lib/motion`), and hardcoded `direction:'ltr'` + physical `top/left/right`. `components/SectionSlider.jsx` used
  the Mantine `orange` named color + a hardcoded `32` margin.
- **Missing kit primitives (kit defines 25 rows; library lacked):** Bottom Navigation, Recipe Card (canonical),
  Recommendation Card, Cook Step, Grocery Row, Merge Chip, Meal Slot Card, Notification Row, Preference Memory Row,
  Food DNA Step Card, Weekly Food Story Card — plus the signature **Food DNA ring** and the UI primitives the
  sprint named (chips, inputs, top bar, bottom nav, gamification strip, avatar, progress).
- **Confirmed frontend-only**, no page rewrites this sprint, no backend change.

## 1. (A) Reconciled to the kit

- **`components/RecipeCard.jsx`** — token-pure rewrite, **public API + behavior preserved** (`{ recipe, onClick }`,
  `navigate('/recipe/:id')`, `trackEvent('recipe_view', …)`): removed every hardcoded hex/gradient/glass and the
  ad-hoc `whileHover`; now a **4:3 branded placeholder** (calm brand tint + type glyph) with the `--g-scrim-photo`
  token, a 2-line title clamp, **≤3 meta chips** (was 4), difficulty mapped to **semantic state tones**, the whole
  card a real focusable `<button>` with `pressResponse`, and **logical RTL** (`insetInlineStart`/`insetBlockEnd` —
  no physical left/right/`ltr`). Because pages keep the same component + API, they keep working (and pick up the
  correct visuals); page composition is aligned in S21.
- **`components/SectionSlider.jsx`** — saffron via `--g-color-food-saffron` (was Mantine `orange`), token spacing,
  SectionHeader scale, logical alignment. API (`{ title, recipes }`) + Swiper behavior unchanged.
- **17 existing `ges/` primitives** — audited token-pure / RTL / reduced-motion / contract-honest; **no changes
  needed** (kit-aligned already).

## 2. (B) Missing kit primitives added (19 new — library now covers all 25 kit rows)

Signature + the sprint's required set, all presentational, token-pure, RTL-logical, reduced-motion, a11y:

- **`FoodDnaRing`** (signature) — calm maturity ring, band states **empty / forming / developing / mature**; a
  *qualitative* indicator, **not a % anxiety bar**, no medical framing; honest empty copy; settle-only motion.
- **`CookStep`** (PL 17) — step dots + **≥22px** 2-line instruction + media + inline ingredient refs + timer slot +
  **≥56px** bottom prev/next (logical start/end).
- **`MealSlotCard`** (PL 21) — empty / **suggested (pending-confirm)** / filled / locked / error; AI fills are
  **never auto-committed** (explicit Confirm/Decline), **confidence badge + Why chip on every AI fill**.
- **`GamificationStrip`** — streak + achievement, **PRIVATE** (no rank/leaderboard/comparison prop exists), **kind
  streak-break** (warm fresh-start, never red shame), streak-freeze state. Small, not the hero.
- **`Chip`** (filter/category/trait), **`TextField`** (text/search, RTL caret, error), **`SelectField`**,
  **`Stepper`** (typing-is-a-last-resort quantity control), **`TopBar`**, **`BottomNav`** (PL 3 — data-driven tabs,
  labels always visible, active=saffron tint, badge≤9, role=tablist; supports the app's 5-tab RTL nav while noting
  the kit's ≤4 guidance), **`Avatar`**, **`ProgressBar`**.
- Remaining kit rows for completeness: **`RecommendationCard`** (PL 16 — RecipeCard + mandatory Why + reason, never
  fabricated), **`GroceryRow`** (PL 19, strike not color-only), **`MergeChip`** (PL 20, shows the math / surfaces
  unit conflicts), **`NotificationRow`** (PL 22, honest paused state), **`PreferenceMemoryRow`** (PL 23,
  stated/inferred tag), **`FoodDnaStepCard`** (PL 24, dots not %, allergy-step privacy + confirm),
  **`WeeklyFoodStoryCard`** (PL 25, **no pre-C1 share affordance** — absent, not a teaser).

All exported from the `ges/` barrel (`components/ges/index.js`).

## 3. (C) Component gallery

- **`app/_ges/page.jsx`** — an internal, **admin-gated** (`<AdminRoute>` in `App.jsx`) gallery rendering every GES
  primitive in its states (RTL). Fixed bars (ActionShelf / BottomNav) preview inside a bounded `transform` frame.
  This is the verifiable, dev-only kit reference S21+ composes from. (One lazy route added in `App.jsx`.)

## 4. Token / contract / boundary compliance

- **No hardcoded non-brand hex** in `components/ges/**`, `RecipeCard.jsx`, `SectionSlider.jsx`, or the gallery
  (grep clean). No raw `rgba`, no `whileHover`/ad-hoc motion, no physical-direction CSS, no `Math.random` in the
  touched/added files.
- **Safety/honesty contracts intact:** NutritionBadge (source/confidence, never a fake number/zero), AllergenMark
  (non-dismissible, non-medical), AI disclosure glyph + kind-refusal, MealSlot no-auto-commit, Gamification has **no
  leaderboard/comparison/shame prop**, WeeklyStory has **no share affordance** pre-C1.
- **RTL-correct + reduced-motion** in every new component (logical properties only; motion via `lib/motion`
  presets through `withReducedMotion`).
- **Boundaries:** no new dependency (frozen-lockfile install, 0 changes), 0 new ingredient IDs, no medical framing,
  no PII, `runtime-shadow/**` untouched/not imported, **no backend change**, tokens.css/base.css unchanged (no
  token gap).
- **Page alignment is S21–S22** — this sprint only made the shared components correct.

---

## PHASE 2 — isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-ds-align-l4-20
HEAD is now at fad6824e feat(DS-ALIGN-L4-20): GES component library matches approved Component Kit

$ pnpm --dir ../garnish-verify install --frozen-lockfile
Done in 42.9s                         # frozen lockfile → NO dependency changes

$ pnpm --dir ../garnish-verify/apps/server exec prisma generate
✔ Generated Prisma Client

$ pnpm --dir ../garnish-verify build            # web (vite) + server (nest)
garnish-app:build: dist/assets/ges-6zlAuLDj.js   88.04 kB │ gzip: 14.51 kB   # the GES library + gallery chunk
garnish-app:build: ✓ built in 3.35s
Tasks:    2 successful, 2 total                  # exit 0

$ pnpm --dir ../garnish-verify coverage:check
COVERAGE GATE PASSED. (warnings/debt above are non-blocking)

$ pnpm --dir ../garnish-verify test
server:test: Test Suites: 191 passed, 191 total
server:test: Tests:       1412 passed, 1412 total     # 0 skips (= baseline; frontend adds no server tests)

$ git -C ../garnish-verify status --short            # only docs/qa + coverage.generated regen churn (NOT committed)
$ git -C ../garnish-verify diff --name-only master..HEAD   # 24 files (below)
$ git worktree remove ../garnish-verify --force ; git worktree prune ; rm -rf ../garnish-verify
```

**Diff vs master (24 files — all frontend):** `apps/web/src/App.jsx` (one gallery route),
`apps/web/src/app/_ges/page.jsx` (gallery), `apps/web/src/components/RecipeCard.jsx`,
`apps/web/src/components/SectionSlider.jsx`, `apps/web/src/components/ges/index.js` (barrel) + **19 new
`apps/web/src/components/ges/*.jsx`** primitives. **No `apps/server/**`, no page/feature rewrites, no styles change.**

**Scope-proof:** diff confined to `apps/web/src/components/**` + the gallery + one route line; kit primitives present
(FoodDnaRing, CookStep, MealSlot, chips/inputs/top-bar/bottom-nav/gamification-strip/avatar/progress, + the rest of
the 25 rows); no hardcoded non-brand hex (grep); honesty/safety contracts intact; RTL + reduced-motion; no new dep;
runtime-shadow untouched; server tests 1412 / 0 skips; build green.

---

## REQUIRED VERDICT BLOCK

```
DS_ALIGN_L4_20 RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
Components reconciled to kit (18 existing aligned): ok (17 ges primitives verified token-pure + RecipeCard/SectionSlider token-purified, APIs preserved)
Missing kit primitives added: FoodDNA ring=yes, Cook Step=yes, Meal Slot=yes, chips/inputs/top-bar/bottom-nav/gamification-strip/avatar/progress=present (Chip, TextField, SelectField, Stepper, TopBar, BottomNav, GamificationStrip, Avatar, ProgressBar) + RecommendationCard/GroceryRow/MergeChip/NotificationRow/PreferenceMemoryRow/FoodDnaStepCard/WeeklyFoodStoryCard (full 25-row kit)
GES-tokenized: no hardcoded non-brand hex in components = yes (grep clean)
Safety/honesty contracts intact: NutritionBadge caption + source/confidence, AllergenMark non-dismissible, AI disclosure+kind-refusal, no leaderboard/shame prop = yes
RTL-correct + reduced-motion in components = yes
Component gallery route (verifiable): added (/_ges, admin-gated)
Frontend-only: no page/feature rewrites, no backend change (diff confined to components) = yes
Boundaries: new-dep=NONE, newIngredientIDs=0, medical-framing=NONE, PII=none, runtime-shadow untouched = yes
Coverage gate: green
Merge/push: exec/garnish-ds-align-l4-20 → master ff/pushed (commit fad6824e + report)
Verdict: DS_ALIGN_L4_20_PASS
```
