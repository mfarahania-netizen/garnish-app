# GARNISH-ANALYTICS-L4-16 — Analytics Engine: funnels · trends · cohorts · product-intelligence (backend)

**Track:** 4 · Sprint 4.1 (opener) · **Branch:** `exec/garnish-analytics-l4-16` · **Baseline:** master `9f706822`
**Scope:** extend the existing analytics/admin modules — no parallel analytics tower. No migration.

---

## Mission outcome

The admin dashboard now has a real **analytics computation engine** behind it: funnels (stage drop-off),
trends over time, cohort/retention math, and product-intelligence (what our engines actually do). Everything
computable today returns **real numbers**; everything that needs real users returns an explicit honest
`awaiting_pilot` — **never a fabricated value** — and is logged as a Track-7 trigger. Aggregates only (no PII).
Extends `analytics/` + `admin/`; the frozen `runtime-shadow/**` is untouched and never imported.

## What shipped (A–F)

| Part | Where | What |
|---|---|---|
| **A. Funnels** | `intelligence/funnel.ts` (pure) + service | Onboarding (register→diet→allergy→goals) and cook (view→start→complete) funnels — distinct-user counts per stage, drop-off-from-prev + conversion-from-start. An empty funnel is `awaiting_pilot`, not "0%". |
| **B. Trends** | `intelligence/trends.ts` (pure) + service | Time-bucketed series (UTC day / Monday-week) for cooks / searches / plans / saves / AI uses. Deterministic bucketing; empty → `awaiting_pilot`. |
| **C. Cohort & retention** | `intelligence/cohort.ts` (pure) + service | Signup-week cohorts + Wn return retention. Math fully built + tested; pre-pilot returns `awaiting_pilot` (no fabricated curve); fills in automatically at the pilot. |
| **D. Product-intelligence** | `analytics-intelligence.service.ts` | **Food DNA** maturity-band distribution + avg score (reuses `getLivingUserProfile`); **recsys quality** from the S11 offline harness (`runRecommendationEval` — coverage/diversity/fitQuality/allergySafety; CTR/online = honest-null); **briefing** accept/reject/swap rates (briefing events, honest-null until they exist); **INE** would-send/suppress/defer distribution (S6 `runIneSimulation`, dry-run, realSends=0); **gamification** aggregates (streak/achievement/level — private, no leaderboard, no user ids). |
| **E. Conversion/quality rollups** | funnels + recsys | view→cook conversion (cook funnel); recsys fit/diversity from the harness. (Top-searches / unmet-search left honest-null where not persisted.) |
| **F. Owner/admin API** | `admin.controller.ts` + `admin.service.ts` | 4 admin-gated endpoints: `GET /admin/analytics/{funnels,trends,cohorts,product-intelligence}`, shaped for the S13 dashboard; each response marks real vs `awaiting_pilot`. |

## Honest-data policy (the key discipline)

Every metric is REAL or `awaiting_pilot` — proven by tests: with empty data, funnels/trends/cohorts/briefing/
FoodDNA all return `awaiting_pilot` (not a number). Recsys offline metrics are real today (computed from the
catalog); recsys CTR + cohorts + briefing rates flip to real automatically once events/signups exist. No
`Math.random` anywhere. User-dependent metrics are logged as **R-T7-ANALYTICS-USER-METRICS / D15**.

## No parallel / cycle-safe / PII-safe

The recsys-quality and INE metrics reuse the S11 harness + S6 simulator as **pure imports** — deliberately
avoiding a NestJS module cycle (`RecommendationModule` already imports `AnalyticsModule`). The intelligence
files never import `runtime-shadow/**`. Product-intelligence outputs are aggregates only — a test asserts no
raw user id / email / phone / password appears in the payload. `AnalyticsModule` gained a `ProfileModule`
import (cycle-safe: ProfileModule → {Prisma, AiCore}, neither imports Analytics).

## QA gate

`intelligence/analytics-l4-16-qa-gate.spec.ts` — **10/10 checks pass**
(artifact: `docs/qa/analytics/garnish_analytics_l4_16_results.json`): no_runtime_shadow_import, no_randomness,
reuses_living_profile, reuses_s11_harness, reuses_s6_simulator, honest_null_cohorts, honest_null_briefing,
honest_null_funnel, ine_dry_run, pii_safe.

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-analytics-l4-16
HEAD is now at b2dfd438 feat(ANALYTICS-L4-16): analytics computation engine — funnels/trends/cohorts/product-intelligence (honest)

$ pnpm install --frozen-lockfile
Done in 32.1s                          # frozen lockfile → NO dependency changes

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 456ms

$ pnpm build
Tasks:    2 successful, 2 total      # server (nest) + web (vite) — exit 0

$ pnpm coverage:check
coverage: ... admin=43 | UMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm test
server:test: Test Suites: 187 passed, 187 total
server:test: Tests:       1387 passed, 1387 total     # 0 skips (= worktree baseline 1369 + 18 new)

$ git status --short                 # only docs/qa + coverage.generated regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # 15 files, confined to analytics/ + admin/ + coverage + logs + qa
$ git worktree remove ../garnish-verify   # blocked by regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** metrics deterministic (0 `Math.random` in funnel/trends/cohort/service) and HONEST
(absent real-user data → `awaiting_pilot`, proven by a test); funnels/trends/cohorts computed from UserEvent;
product-intelligence reuses `getLivingUserProfile` + the S11 harness + the S6 simulator (grep); aggregates
expose no PII/raw user ids (test); `git diff` confined to `analytics/` + `admin/` (+ coverage + logs + qa),
`runtime-shadow/**` untouched + not imported; no new dep; no new ingredient IDs; Track-7 deferral logged
(R-T7-ANALYTICS-USER-METRICS / D15); coverage green (admin=43).

---

## REQUIRED VERDICT BLOCK

```
ANALYTICS_L4_16 RESULT: PASS
Clean install (worktree): build exit 0, coverage:check green, tests Test Suites 187/187, Tests 1387/1387, skips 0
Funnels: stage drop-off (onboarding, cook) computed from UserEvent = ok
Trends: time-bucketed series (cooks/searches/plans/saves/AI) = ok
Cohort/retention: math built; pre-pilot honest-null ("awaiting real users") = yes
Product-intelligence: FoodDNA band distribution=ok, recsys quality(from S11 harness)=ok, briefing rates=honest-null/ok, INE suppress/defer=ok, gamification dist=ok (private)
HONEST DATA: absent real-user data → null/"awaiting pilot" (NOT faked) = yes; test proves it
Determinism: no Math.random = yes
PII-safe: aggregates only, sensitive fields not exposed = yes (test asserts no user id/email/phone)
Deferred (LOGGED): user-dependent metrics → Track 7 pilot = RISK_REGISTER R-T7-ANALYTICS-USER-METRICS + DECISION_LOG D15
No parallel/shadow: analytics/admin extended; runtime-shadow untouched + not imported = yes
Boundaries: live-AI=NONE, external-API=NONE, new-heavy-dep=NONE, newIngredientIDs=0, medical-claims=NONE, migration=none
Coverage gate: green (endpoints registered=4: /admin/analytics/{funnels,trends,cohorts,product-intelligence})
Merge/push: exec/garnish-analytics-l4-16 → master ff/pushed (commit b2dfd438 + report)
Verdict: ANALYTICS_L4_16_PASS
```
