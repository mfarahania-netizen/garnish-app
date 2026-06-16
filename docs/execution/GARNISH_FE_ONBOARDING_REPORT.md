# GARNISH-FE-ONBOARDING — Execution Report
**Sprint:** Track 5 Reset · Sprint D — build the complete first-run onboarding flow (frontend)
**Branch:** `exec/garnish-fe-onboarding`  ·  **Baseline:** `master` @ `e17ca24d` (built on `17c04542`)
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder screenshot review**
**Date:** 2026-06-17

---

## 1. Summary
Built a single, continuous, standalone **`/onboarding`** flow as fresh React + Mantine on the GES
tokens, to `home-screen-design-exploration/project/Garnish Onboarding Flow.dc.html`. The bundle
runtime is **never imported** and the folder stays **gitignored** (not bundled). **Backend
untouched** (`apps/server` diff empty). Files: `app/onboarding/{page.jsx, useOnboarding.js,
steps.js}`, plus the `/onboarding` route in `App.jsx` and a coverage re-map.

## 2. The flow — 7 screens (the mockup groups the 10 content pieces)
The approved mockup is a **7-screen** flow ("۷ گام") that groups the brief's 10 content pieces.
All 10 are present, in order, RTL:

1. **Welcome** — گارنیش leaf mark + "ذائقه‌ات رو یاد می‌گیرم و کنارت آشپزی می‌کنم" + primary
   «بزن بریم» + "قبلاً حساب داری؟ ورود".
2. **Context** — routine/time «کارِ روزمره‌ات…» + who «معمولاً برای کی می‌پزی؟» + how-many
   «تعداد نفرات» stepper.
3. **Diet** — food pattern «چه‌جور غذایی…» + **allergens with severity** (non-medical safety
   framing) + **dislikes**.
4. **Goals** (optional) — «هدفِ اصلیت با غذا چیه؟», multi-select, **wellness-only**.
5. **Last touches** — skill «آشپزیت در چه حدیه؟» + **budget BAND** «بودجهٔ هفتگی؟ — فقط یک بازه».
6. **Food DNA reveal** — calm `FoodDnaRing` (forming tone) + «در حال شکل‌گیری» + traits derived
   from the user's real answers. The ONE earned **Celebrate** (arc fill + a single pulse), both
   disabled under `prefers-reduced-motion`.
7. **Account** — موبایل + گذرواژه + the **required** consent line with terms/privacy links.

**Shared shell** (steps 2–5): a back «قبلی»/chevron, a «گام N از ۴» label, a «فعلاً رد کن» skip,
a 4-segment progress bar, and an «ادامه» CTA. **Per-step validation:** «ادامه» is gated on the
step's primary answer (step 2 = routine, step 3 = diet pattern); optional steps (goals, last
touches) and «رد کن» always advance.

## 3. Wiring (real APIs; nothing fabricated)
Every profile/preferences/consent endpoint is **JWT-guarded** and the account is created **last**,
so steps 1–6 hold answers in **flow state only**. On the account step:
- **Auth → the real path** (AuthContext → `POST /auth/register` then `POST /auth/login`). The real
  contract is **phone-based** (`09…` + password ≥ 6); the mockup's *email* field has **no
  endpoint**, so wiring it would be a dead/fabricated form. **Deliberate deviation:** the account
  step collects **موبایل + گذرواژه** (client rule ≥ 8 chars, matching the mockup copy and stricter
  than the backend's 6) wired to the live endpoint. Consent line + terms/privacy kept verbatim.
- **Consent → `POST /users/consent`** with `personalization` (the purpose that **gates the taste
  profile** in the behavior engine) **+** `core`. Granted only when the user checks consent.
- **Preferences → `PUT /users/preferences`** with the **DTO-supported** fields only:
  `diet` (pattern), `allergies` (JSON array), `skillLevel`, `budget` (band id), `healthGoals`
  (JSON array). Fields the DTO doesn't model (household, routine, serving-count, dislikes, allergen
  severity) are **kept in flow state, not sent to any invented endpoint**.
- **Reveal ring** — the number is a **local completeness preview computed from the user's real
  answers** (a sanctioned "computed preview", never a hardcoded %), shown in the honest **forming**
  state; the **server maturity** (`GET /profile`) drives the Home ring after onboarding.
- The **question engine** (`GET /profile/next-question` · `POST /profile/answer`) **exists** but is
  a dynamic, server-driven sequence; per the brief, the fixed mockup-content flow persists via
  preferences/consent (the dynamic adaptive-question UI is a later phase).
- A signed-in user hitting `/onboarding` is **redirected to `/`** (never forced back through it).

**States:** per-step validation; submit shows «لطفاً صبر کن…» and disables; auth failure renders a
Persian error with retry; consent/preferences are best-effort post-signup (the account already
exists) — never blocking, never fabricated.

## 4. Honesty / safety
Wellness framing only — **no medical / diet-as-medical** anywhere; allergens are **non-medical
safety** flags («اطلاع‌رسانی، نه توصیهٔ پزشکی») driving the hard filter. **Budget is a BAND**, never
a number. **Consent is required** (gates submit) + honest (real purpose that gates the profile;
real terms/privacy links). The reveal ring is a **calm maturity ring, not a %-anxiety bar**, its
number **real (derived from answers), never fabricated**. No invented ingredient IDs; no raw enum
keys shown.

## 5. Token purity / a11y / RTL
Zero banned hex (`#FF6B35`/`#1A237E`/`#4CAF50` grep = 0). No raw color literals in `app/onboarding/**`
— only `var(--g-*)` tokens (cream-on-saffron = `--g-color-text-inverse`). Logical RTL props only.
≥44px targets; `aria-pressed`/`role="checkbox"`+`aria-checked`/`aria-label`s; visible focus;
reduced-motion respected (celebrate gated); no new dependency; no new CSS keyframe (FoodDnaRing +
framer-motion only).

## 6. Clean-room verification (isolated worktree, detached @ `af6dea9b`)
```
git worktree add --detach ../garnish-verify af6dea9b
pnpm install --frozen-lockfile           # Done in 32.5s (frozen)
pnpm --dir apps/server exec prisma generate    # ok
pnpm build                               # Tasks: 2 successful, 2 total (web vite + server) → exit 0
pnpm coverage:check                      # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                         # Test Suites: 191 passed, 191 total
                                         # Tests:       1412 passed, 1412 total ; Snapshots: 0 ; skips: 0
git diff --name-only master af6dea9b -- apps/server   # EMPTY (backend untouched)
# dist has NO support.js/_ds_bundle/x-import and NO jujeh-kabab (bundle not bundled); variable font IS bundled.
git worktree remove ../garnish-verify
```

### Scope-proof
- Changed set vs master = `App.jsx`, `app/onboarding/{page.jsx,useOnboarding.js,steps.js}` (new),
  `tools/coverage/coverage.registry.json`, `docs/coverage/coverage.generated.json`.
  **No other page. No `apps/server` change (incl. its `.gitignore`).**
- Onboarding built to the mockup (7 screens / 10 content pieces, shared shell, validation);
  preferences/consent/auth wired; budget-band + consent-required + reveal-not-fabricated +
  wellness-only; bundle runtime not imported / not bundled; zero non-brand hex; server tests
  191/191, 1412/1412, 0 skips; build green.

## 7. Render — in words (founder's screenshot is the next step)
Welcome is a centered leaf mark + headline + «بزن بریم». The question steps share a calm chrome
(back · «گام N از ۴» · «رد کن» · 4-dot progress) with saffron-on-select option cards, an allergen
selector that adds a «شدت برای ایمنی» (ملایم/شدید) panel under the chosen flags, a serving stepper,
dislike pills, a multi-select goals grid, and a skill + **budget-BAND** grid («فقط یک بازه»). The
reveal is the calm saffron ring filling to a number derived from the answers, «در حال شکل‌گیری»,
and trait chips. The account step is موبایل + گذرواژه (eye toggle) + the required consent checkbox
with bold شرایط استفاده / حریم خصوصی links, then «ثبت‌نام و شروع». RTL + Vazirmatn; clean console.

---

## VERDICT
```
FE_ONBOARDING RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 191/191, Tests 1412/1412, skips 0
Flow built to mockup (welcome/time/who+howmany/food/allergens/dislikes/goal-optional/skill+budget/FoodDNA-reveal/account) = ok (mockup groups the 10 pieces into 7 screens)
Shared shell: progress + «قبلی» + «ادامه»/«رد کن», one cluster per step, per-step validation = yes
Wellness-only (NO medical/diet-as-medical); allergens = non-medical safety framing = yes
Budget = a BAND (no exact number) = yes
Consent required + honest (line + terms/privacy links; profile consent-gated via personalization) = yes
Food DNA reveal = calm ring (NOT a %anxiety bar), number real-or-forming (NOT fabricated; local completeness from real answers), Celebrate respects reduced-motion = yes
APIs wired: preferences/consent/auth/profile (question engine exposed but fixed-content flow persists via preferences/consent per brief) = yes
No fabricated data / no invented ingredient IDs / no raw enum keys = yes
bundle runtime NOT imported / NOT bundled = yes
Zero non-brand hex (no #FF6B35/#1A237E/#4CAF50) = yes, grep
RTL + Vazirmatn + reduced-motion + AA + >=44px = yes
Frontend-only: only onboarding + route + coverage; backend untouched (incl. server .gitignore) = yes
Render (in words): welcome / calm question chrome + 4-dot progress / budget-BAND / required consent + terms-privacy / calm reveal ring (answer-derived) / wellness framing / RTL / clean console
Coverage: re-mapped honestly (consent + preferences → frontend:onboarding/OnboardingPage); gate green
Merge/push: exec/garnish-fe-onboarding → master (ff, pushed)
Verdict: FE_ONBOARDING_PASS
```

---

**Next: Cook Mode + Profile — screenshot-gated.**
