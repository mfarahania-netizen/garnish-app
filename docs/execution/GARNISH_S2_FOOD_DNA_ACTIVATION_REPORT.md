# S2 — FOOD DNA ACTIVATION EXPERIENCE — Execution Report
**Surface:** New backend read projection + `GET /profile/dna` + frontend Food DNA screen/cards (+ tests).
**Baseline:** `master` @ `135a9fc9`  ·  **Merged HEAD:** `9cf3e3e8` (ff-merged to master + pushed)
**Status:** all gates GREEN · engine FROZEN & `getLivingUserProfile` byte-identical → merged. **STOP for founder verification.**
**Date:** 2026-06-18

> Heavy frontend realization over a complete backend. Phase 0 found two premises wrong; the founder
> authorized a **bounded, additive** wiring (Option 2 — scoped DNA projection) that leaves the audited
> allergy/recsys/AI/gamification paths byte-identical.

---

## PHASE 0 — gap list + the two discrepancies that reshaped the build
- `/food-dna` already existed but only rendered `ProfilePage initialView="dna"` (no dedicated screen). ✓
- **`safeExplanation` was surfaced NOWHERE** in the frontend (grep = 0) — the core L4 explainability gap.
- **Discrepancy 1:** `GET /profile.observed` is an `ObservedSummary` (confidence numbers only);
  `summarizeObservedGraph` drops the per-dimension `safeExplanation`/affinities → `GET /profile` cannot feed
  the screen's explanations.
- **Discrepancy 2:** `getLivingUserProfile` builds the observed graph from `[]` (profile-read.service.ts:110)
  → it never grows from behavior; the brief's loop is unprovable via `GET /profile`.
- **Discrepancy 3 (during wiring):** the brief's `UserEvent → extractSignalObservations` chain yields ZERO
  (UserEvents aren't canonical envelopes; an adapter = forbidden "new logic"). The **real populated source**
  is the persisted `SignalObservation` table (written by the existing recipe/meal-plan/recommendation/
  shopping signal-processors).
- **Founder decision:** Option 2 — a NEW hydrated projection; **`getLivingUserProfile` stays byte-identical**
  (it feeds the allergy HARD-filter + ~19 audited paths; the evals use fixtures and would not catch a change).

## PHASE 1 — build (additive; engine reused unchanged)
**Backend** — `getLivingUserProfile` untouched:
- `food-dna-projection.ts` (pure `projectFoodDna`): reshapes the four user-facing dimensions
  (taste/effort/skill/routine) + their engine `safeExplanation`/`summary`/metrics + maturity into a PII-free
  DTO. Computes nothing new; null graph → honest cold-start (no fabricated traits).
- `ProfileReadService.getFoodDnaProjection`: hydrates the observed graph from the user's REAL persisted
  `SignalObservation`s via the EXISTING loader (`createPrismaShadowProfileFeedPort.loadObservations 'rebuild'`)
  + the EXISTING `buildUserFoodIdentityGraph` + `maturityFor` — all unchanged. No persisted obs → cold-start.
- `GET /profile/dna` (owner-scoped, JWT).
**Frontend:**
- New `app/food-dna/page.jsx` + `useFoodDna.js`: the dedicated screen — real maturity ring
  (band/score/`trustGuidance`, no hardcoded %), the four dimensions each surfacing the engine's
  `safeExplanation` + PII-free metrics + confidence + an honest "how this grows" line, an honest cold-start
  banner, and the REAL onboarding question engine (`/profile/next-question` + `/profile/answer`, looped, with
  the "declared is only a ≤20% prior" framing). Loading / error / cold-start states; token-pure, RTL, motion.
- `App.jsx`: `/food-dna` → `FoodDnaPage`. Home Food DNA card shows the REAL `/profile/dna` maturity (falls
  back to `/profile` when unavailable) and deep-links into the screen.

## PHASE 2 — raw evidence (clean-room worktree @ `9cf3e3e8`)
```
pnpm install                                   # 36.2s
pnpm --dir apps/server build                   # nest build → ok      pnpm --dir apps/web build → ok (PWA)
( cd apps/web && pnpm exec vitest run )        # Tests 110 passed (skipped=0)
( cd apps/server && pnpm exec jest --maxWorkers=2 --workerIdleMemoryLimit=600MB )  # 197 suites / 1488 tests / 0 skipped
pnpm --dir apps/server run recsys:eval         # PASS    ai:eval:regression → PASS
pnpm coverage:check                            # COVERAGE GATE PASSED (registered GET /profile/dna)
grep -rniE "#FF6B35|#1A237E|#4CAF50" apps/web/src ; echo $?  # empty (exit 1)
git diff --name-only master...HEAD             # S2-only (below); FROZEN_LEAK=NONE
```
**Loop proof:** backend test seeds persisted `SignalObservation`s → the REAL builder raises observed
confidence → `maturityFor` raises the band above cold-start → `GET /profile/dna` reflects it; the frontend
test shows the screen renders the higher band + dimensions. A tripwire test + the diff prove
`getLivingUserProfile` still passes `[]` (no hydration leaked into the audited path).

**Scope proof — `git diff --name-only master...HEAD` (no frozen engine file):**
```
apps/server/src/behavior-engine/profile/read/food-dna-projection.ts        (new)
apps/server/src/behavior-engine/profile/read/food-dna-projection.spec.ts   (new)
apps/server/src/behavior-engine/profile/read/profile-read.service.ts       (additive: getFoodDnaProjection)
apps/server/src/behavior-engine/profile/read/profile.controller.ts         (additive: GET /profile/dna)
apps/web/src/App.jsx · apps/web/src/app/food-dna/{page.jsx,useFoodDna.js,food-dna.smoke.test.jsx} (new)
apps/web/src/app/home/page.jsx · tools/coverage/coverage.registry.json
```

---

```
VERDICT BLOCK
=============
SPRINT: S2 — FOOD DNA ACTIVATION EXPERIENCE
PHASE-0 GAP LIST: no dedicated screen; safeExplanation surfaced nowhere; GET /profile.observed = summary (no safeExplanation); observed built from [] (never grows); brief's extractSignalObservations(UserEvent) chain = empty
BACKEND ENGINE UNTOUCHED (diff proves frozen): Y  (getLivingUserProfile byte-identical; candidate-generator/allergy/recsys/gamification/orchestrator unchanged)
GET /profile PII-free (verified): Y   §1D thin projection added: yes — additive GET /profile/dna (NOT a getLivingUserProfile change)
DNA SCREEN renders 4 dimensions + engine safeExplanations (no invented traits): Y
MATURITY ring shows REAL band (no hardcoded %): Y
COLD-START honest forming state (no fake %): Y
ONBOARDING wired to real /profile/next-question + /profile/answer: Y (on the DNA screen)
L4 RUBRIC (token-pure · RTL · motion · 3 states · mobile+desktop · explainability via engine safeExplanation/trustGuidance): pass
LOOP PROOF (persisted SignalObservation → observed↑ → maturity↑ → screen reflects): PASS
BUILDS: PASS  WEB TESTS: 110/110 skipped=0  SERVER: 197/1488 skipped=0  recsys/ai-eval: PASS/PASS
NON-BRAND-HEX: empty
SCOPE = DNA projection + GET /profile/dna + screen + home card + coverage registry (+tests) ONLY: Y
MERGE+PUSH: DONE @9cf3e3e8
```

## Deliberately NOT bundled (separate, gated)
Wiring the hydrated observed graph INTO the audited recsys/allergy runtime (i.e. changing
`getLivingUserProfile`) is a separate, gated change (backlog **S26 / pilot**, with full allergy-safety
regression). This sprint keeps that path byte-identical.

## AFTER MERGE — STOP for founder verification (desktop + mobile)
1. Open Food DNA → four dimensions with honest explanations, a REAL maturity ring (not a fixed 20%), honest
   cold-start if new.
2. Answer an onboarding question → accepted; maturity stays honestly low (declared = small prior).
3. Cook/save a few real dishes → reopen → DNA has grown (observed stronger, band higher).
4. Home card shows the same real maturity + deep-links here.
