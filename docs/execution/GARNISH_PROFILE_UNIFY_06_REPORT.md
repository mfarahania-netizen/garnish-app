# GARNISH-PROFILE-UNIFY-06 — One Living Profile (Declared ⊕ Observed), Additively

> Execution report. Branch `exec/garnish-profile-unify-06` (off master `c2b7c8b4`).
> Architecture correction: unify the S2 declared subsystem and the observed `UserFoodIdentityGraph`
> into ONE composed living profile **by composition + reconciliation, additively** — without mutating
> the observed contract or touching frozen `runtime-shadow/**`. **Backend only — NO UI.**

## Phase 0 — Intake: consumer split + plan

`UserFoodIdentityGraph` consumers (grep), split:
- **FROZEN `runtime-shadow/**` (do NOT touch):** `recommendation-shadow-a8-service.ts`,
  `recommendation-shadow-input-provider.ts` (+`.types.ts`), `recommendation-shadow-profile-feed.ts`
  (+`.types.ts`), `recommendation-shadow-runtime.types.ts`.
- **Other (also not modified — would only break if the observed contract changed):** the profile engine
  itself (`user-food-identity-graph.{builder,types}.ts`, `profile-qa-gate.ts`), `signals/signal-qa-gate.ts`,
  and `recommendation/intelligence/**` (decision types/qa-gate/fixtures/shadow-scorer).

**Plan (additive):** introduce a NEW composition layer ABOVE both subsystems — a cross-layer reconciler +
a `LivingUserProfile` that references the existing observed graph + declared profile. Change nothing in
the observed graph's output type or `runtime-shadow/**`.

## Phase 1 — Unification (composition + reconciliation)

### B. Cross-layer reconciliation — `profile/reconciliation/profile-reconciliation.ts` (pure)
For the overlapping dimensions `dietary_pattern`, `allergies`, `effort`, `skill`, `reconcileProfile`
classifies each as `agreement` / `declared_observed_conflict` / `declared_only` / `observed_only` /
`unknown` and applies a conservative precedence policy:
- **Agreement** (e.g. declared vegan + observed plant-forward) → higher confidence.
- **Conflict WITHOUT erasure** (e.g. declares vegetarian but observed opens chicken) →
  `declared_observed_conflict`: **both evidences preserved**, safe explanation, **NO auto-overwrite**
  (`reconciledValue` stays the declared value), `preservesBothEvidences=true`.
- **SAFETY precedence (the hard rule):** declared **allergies** and **hard dietary restrictions**
  (vegetarian/vegan/pescatarian/halal/kosher) are `precedence:'declared_safety'`, `safetyCritical`, and
  **ALWAYS respected regardless of observed behavior** — a declared allergy is **NEVER removed** by
  observed engagement (`reconciledValue` = the declared allergen set, `confidence=1`). Soft preferences
  (effort/skill) **blend** by confidence; conflicts are surfaced, not auto-resolved.
- Reuses the existing conflict-resolution philosophy (never erase evidence; safe limitations). It reads
  the observed graph **by reference** and never mutates it; it emits **no sensitive demographic values**.

### A. `LivingUserProfile` — `profile/read/living-profile.ts`
ONE owner-facing composed model (`version: 2`): `observed` (a PII-free **summary** of the existing graph,
by reference) + `declared` (unchanged) + `reconciled` + `maturity` (spanning both layers) +
`perDimensionConfidence` (declared+observed+reconciled) + `provenance` (which source drove each reconciled
value). `composeLivingUserProfile` is pure and never mutates either input.

### C. Single consumption contract (canonical entry point)
**`ProfileReadService.getLivingUserProfile(userId)`** — the ONE method every future feature
(recommendation, AI, notifications, planner, shopping) calls to get the unified profile with confidence
+ provenance + uncertainty. It builds the observed graph via the **existing** builder (shadow/cold-start
when unhydrated), passing **no declared/sensitive data into it**, and is **NOT** wired into frozen
runtime-shadow. (`getLivingProfile` is kept as a back-compat alias.)

### D. Unified owner read
`GET /profile` (jwt, owner-scoped) returns the unified `LivingUserProfile`. The 3 profile endpoints stay
registered `deferred:E-profile-ui` (unchanged); coverage gate stays green (endpoints unchanged at 98).

### QA / eval
New **reconciliation QA gate** (`profile-reconciliation-qa-gate.spec.ts`): agreement,
conflict-without-erasure, **allergy-safety-precedence**, sparse/zero-data, **observed-graph-NOT-mutated**
(deep-equal before/after), and **sensitive-data-non-leak** (no age/income in the observed summary or
reconciled output). The existing **observed 11-dim gate** (`profile-qa-gate.spec.ts`) and **declared
gate** (`declared-profile-qa-gate.spec.ts`) are **unchanged and green**.

## Additive-proof
- **NO change under `runtime-shadow/**`** (git diff confirmed).
- **NO change to `user-food-identity-graph.types.ts`** — the observed output contract is untouched
  (composition by reference; the unified model is a new layer above it).
- Observed 11-dim QA gate + declared QA gate present, unchanged, passing.
- No new ingredient IDs; no schema migration.

## Clean-install verification (Phase 2, verbatim)

```
$ rm -rf node_modules apps/server/node_modules apps/web/node_modules packages/shared/node_modules  → rm exit=0
$ pnpm install --frozen-lockfile                          → Done in 55.5s ; install exit=0
$ pnpm --dir apps/server exec prisma generate (NOT npx)   → prisma exit=0
$ pnpm build                                              → Time: 28.9s ; build exit=0
$ pnpm coverage:check
  scanned: models=52 recipeFields=37 endpoints=98(internal 9) routes=17 events=B117/F116
  coverage: mapped=59 internal=15 admin=39 deferred=11 must-render=2 | UNMAPPED=0 UNREGISTERED=0 orphanEndpoints=30 orphanEvents=1
  COVERAGE GATE PASSED. ; coverage exit=0
$ pnpm test
  Test Suites: 153 passed, 153 total
  Tests:       1210 passed, 1210 total ; test exit=0
$ git status --short        (coverage.generated.json = empty CRLF re-touch, restored; qa artifacts omitted)
  ?? docs/execution/GARNISH_PROFILE_UNIFY_06_REPORT.md

# ── additive scope-proof ──
$ git diff --name-only master    (only the composition layer — 6 files)
  apps/server/src/behavior-engine/profile/read/living-profile.ts
  apps/server/src/behavior-engine/profile/read/profile-read.service.ts
  apps/server/src/behavior-engine/profile/read/profile.controller.ts
  apps/server/src/behavior-engine/profile/reconciliation/profile-reconciliation.ts (+ 2 specs)
$ git diff --name-only master | grep 'runtime-shadow/'              → NONE — runtime-shadow untouched
$ git diff --name-only master | grep 'user-food-identity-graph.types.ts' → NONE — observed contract unchanged
observed 11-dim gate present: profile/profile-qa-gate.spec.ts ; declared gate: declared/declared-profile-qa-gate.spec.ts
allergy-safety-precedence test present: reconciliation/*.spec.ts (allergy_never_removed)
```

## Confirmations
- **display/UI = NONE**; **medical-claims = NONE** (declared goals are preferences); **live-AI-default
  = OFF**; **runtime-shadow = untouched**; **newIngredientIDs = 0**.
- **Privacy:** sensitive declared data (age/income/gender/household/goals) stays P2/consent-gated/banded,
  is **not** fed into the observed graph or runtime-shadow, and **does not leak** into the observed
  summary or reconciled output (QA-gate asserted).
- **tests:** 153 suites / 1210 tests, **0 skips** (was 151/1202; +2 reconciliation suites, +8 tests).

## Files added / changed
**Added:** `profile/reconciliation/profile-reconciliation.ts` (+spec, +qa-gate spec); report + QA artifact.
**Changed (composition layer only):** `profile/read/living-profile.ts` (added `LivingUserProfile` +
`composeLivingUserProfile` + `summarizeObservedGraph`; kept legacy exports),
`profile/read/profile-read.service.ts` (canonical `getLivingUserProfile`), `profile/read/profile.controller.ts`.

## Merge / push
`exec/garnish-profile-unify-06` → `master` via `git merge --ff-only`, pushed to `origin/master`.

## Verdict

```
PROFILE_UNIFY_06 RESULT: PASS
Clean install: build exit 0, coverage:check green, tests Test Suites 153/153, Tests 1210/1210, skips 0
Unified model: LivingUserProfile composes observed+declared+reconciled+maturity = built (composeLivingUserProfile, version 2)
Reconciliation: agreement=ok, conflict-without-erasure=ok (both evidences preserved, no overwrite), allergy-safety-precedence=ok (declared allergy never removed; test allergy_never_removed)
Single consumption contract (canonical entry point): ProfileReadService.getLivingUserProfile(userId)
Additive-proof: runtime-shadow change=NONE; observed-graph output contract change=NONE; observed 11-dim gate=green&unchanged; declared gate=green&unchanged
Privacy: sensitive declared data NOT leaked into observed/runtime-shadow/non-owner paths = yes (QA-gate: no_sensitive_in_observed, no_sensitive_in_reconciled, observed_graph_not_mutated)
Boundaries: display/UI=NONE, medical-claims=NONE, live-AI-default=OFF, newIngredientIDs=0
Coverage gate: green (endpoints registered deferred:E-profile-ui; unchanged at 98)
Merge/push: exec/garnish-profile-unify-06 → master (ff-only + pushed)
Verdict: PROFILE_UNIFY_06_PASS
```
