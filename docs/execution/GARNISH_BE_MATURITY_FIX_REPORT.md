# GARNISH-BE-MATURITY-FIX — Execution Report
**Task:** Correct taste-profile maturity so onboarding alone can't read as ~40–75%.
**Branch:** `exec/garnish-be-maturity-fix`  ·  **Baseline:** `master` @ `cc4f8812`
**Merged HEAD:** `9d466c98`
**Status:** verification GREEN → ff-merged to master + pushed · **STOP for founder review**
**Date:** 2026-06-17
**Scope:** the maturity computation + its tests ONLY. (This is an explicitly-authorized, scoped backend
change; the rest of the backend stays frozen.)

---

## 1. The bug (old formula + worked example)
`apps/server/src/behavior-engine/profile/read/living-profile.ts` `maturityFor`:
```
overallScore = declaredCoverage * 0.6 + observedConfidence * 0.4
```
with `declaredCoverage = declaredCount / consentEligibleCount` (`declared/declared-profile.builder.ts:138`).

Onboarding answers only a handful of the consent-eligible dimensions, and because the denominator is small
the ratio **saturates fast** — 4–5 answers push `declaredCoverage` to ~0.6–1.0. With `observedConfidence = 0`
(cold start: the user has cooked/searched/saved **nothing**), the old formula still produced:
- `declaredCoverage 0.75, observed 0` → **0.45 → developing (45%)**
- `declaredCoverage 1.0, observed 0` → **0.60 → developing (60%)**

That contradicts the core principle: **real knowledge of a user must come from OBSERVED behavior over time,
not a few self-declared answers.** A user who has only onboarded must read **forming / low**.

**Single formula, no second path.** `maturityFor` is the only user-facing maturity computation; it is called
by both `composeLivingProfile` (legacy) and `composeLivingUserProfile` (UNIFY-06 — the `/profile` path via
`getLivingUserProfile`). Every other `*0.6/*0.4` in the server is an unrelated subsystem (signals, ranking,
reward, lab scorecards). Consumers of `maturity.overallScore` are only the Home/Profile/Drawer ring (frontend)
and the Admin Food-DNA band aggregation (`analytics-intelligence`, read-only) — ranking/reco/gamification/
shopping/briefing read the profile's **dimensions/allergies**, not the score, so lowering it changes no
ranking/reco/safety behavior.

## 2. The corrected composition (declared = small prior; observed dominant)
```
declaredPrior = min(0.20, declaredCoverage * 0.30)   // declared-only ⇒ ≤0.20, INSIDE the forming band (<0.35)
observed      = clamp(observedConfidence, 0, 1)        // the dominant driver of progression
overallScore  = min(1, declaredPrior + observed * 0.80)
```
- A fully-declared, **zero-behavior** profile can never exceed **forming**, no matter how many onboarding
  questions were answered (kills the inflation).
- `developing` / `mature` are reachable **only** as `observedConfidence` genuinely grows (real
  cooks/searches/saves/ratings).
- `band()` thresholds (empty<0.1 / forming<0.35 / developing<0.7 / mature) and `trustGuidance` strings are
  **unchanged** — only the composition feeding them changed. `declaredCoverage` itself (used in analytics
  metadata) is **not** modified — only how maturity composes it.

## 3. Worked example of the new cold start (demo)
Computed from the shipped formula:
```
NEW maturity (declared = min(.20, cov*.30); observed*.80 dominant):
   18%  forming      cold start: onboarded, 0 behavior (cov .6, obs 0)
   20%  forming      cold start: fully declared, 0 behavior (cov 1, obs 0)
    0%  empty        truly empty (cov 0, obs 0)
   42%  developing   some real behavior (cov .6, obs .3)
   82%  mature       lots of real behavior (cov .6, obs .8)

For contrast, the OLD formula at cold start:
  45%  developing   (cov .75, obs 0)  <-- the bug
  60%  developing   (cov 1.0, obs 0)  <-- the bug
```
A brand-new onboarding-only user now reads **forming ~15–20%**, and the number climbs only as real behavior
accrues. (The same is asserted by the new unit + end-to-end tests below.)

## 4. Test changes + new regression test
- **New** `read/living-profile.spec.ts` (8 tests):
  - **Regression:** declared-only / cold start (`cov` 0.5–1.0, observed 0) → band **forming**, overallScore
    in [0.1, 0.25].
  - declared alone can NEVER reach developing/mature for ANY coverage (`overallScore < 0.35`).
  - truly empty (0,0) → empty / 0.
  - observed is the dominant axis — forming → developing → mature as confidence grows (monotonic).
  - observed alone (no declared) still drives the score up.
  - trustGuidance matches the corrected band.
  - **end-to-end** via `composeLivingUserProfile(declared, null)` (real builder, cold-start observed) →
    forming, ≤0.25, never developing/mature; legacy `composeLivingProfile` honors the same.
- Existing `profile-read.service.spec.ts` assertions (`overallScore > 0`, band ∈ set) stay green.
- `maturityFor` is now exported (for direct unit testing) — no behavior change.

## 5. Clean-room verification (isolated worktree, detached @ `9d466c98`)
```
git worktree add --detach ../garnish-verify 9d466c98
pnpm install --frozen-lockfile          # ok
pnpm --dir apps/server exec prisma generate   # ok
pnpm build                              # Tasks: 2 successful, 2 total → exit 0
pnpm coverage:check                     # COVERAGE GATE PASSED → exit 0
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )
                                        # Test Suites: 192/192 ; Tests: 1420/1420 ; skips 0
```
Server suites went 191→**192** (+ `living-profile.spec.ts`), tests 1412→**1420** (+8), **0 skips**.

### Scope-proof — committed diff vs master (what merges)
```
git diff --name-only master HEAD
  apps/server/src/behavior-engine/profile/read/living-profile.spec.ts
  apps/server/src/behavior-engine/profile/read/living-profile.ts
# grep allerg|rank|recommend|reco|analytics|schema|prisma → none
```
Only the maturity computation + its test. **No allergy/safety filter, ranking, recommendation, analytics
semantics, or Prisma schema change.** (The clean-room run also regenerates `docs/qa/*.json` gate-result logs
and `docs/coverage/coverage.generated.json` as a test side-effect; those are uncommitted run artifacts,
discarded with the worktree — they are NOT part of the merged change.)

## 6. Honest note — the onboarding REVEAL ring is a SEPARATE number (not changed by this fix)
The **Home/Profile/Drawer** Food-DNA ring is server-driven (`maturity.overallScore`) and now reads the
corrected low forming value. The **onboarding reveal ring** (step 6) is a **frontend-local** number —
`revealValue = engaged / 8` (fraction of onboarding questions answered, labeled «شروعِ شناخت» =
answer-completeness, NOT taste maturity). **This backend fix does not change the reveal ring** — answering
6/8 questions still shows ~75% there. Making the reveal also read a low maturity is a separate frontend change
(fits the upcoming frontend batch); the founder should decide whether the reveal shows the corrected server
maturity or stays as answer-completeness.

---

## VERDICT
```
BE_MATURITY_FIX RESULT: PASS
Clean install (worktree): build exit 0, coverage green, server tests suites 192/192, tests 1420/1420, skips 0
Root cause confirmed (declared*0.6 + observed*0.4 with saturating coverage → cold start 40–75%) = yes
Corrected: declared = small bounded prior (cold-start contribution ≤ ~0.20), observed dominant = yes
Cold start (onboarding-only, 0 behavior) now reads forming, overallScore ~0.15–0.20 = yes, demo shown
developing/mature reachable only as observedConfidence grows = yes
All maturity paths updated consistently (no second stale formula) = yes (single maturityFor, both compose fns)
New regression test (declared-only = forming ≤ ~0.25) added & green = yes
Scope: git diff touches ONLY maturity + tests (no allergy/ranking/reco/analytics/schema) = yes, diff shown
Allergy-safety & other guard tests untouched & green = yes
Server tests ≥ 1412 / 0 skips = yes (1420 / 0)
Merge/push: exec/garnish-be-maturity-fix → master ff, pushed, commit 9d466c98
Verdict: BE_MATURITY_FIX_PASS
```

---

**Next (founder):** hard-refresh, re-run onboarding. The **Home/Profile ring** should now read a low forming
number (~15–25%) and climb only with real cooking. The **reveal ring** will still reflect answer-completeness
until the separate frontend change (see §6). Then the frontend batch (back button, dead buttons, drawer
duplicate links, oversized picks cards, shopping-list delete + categories).
