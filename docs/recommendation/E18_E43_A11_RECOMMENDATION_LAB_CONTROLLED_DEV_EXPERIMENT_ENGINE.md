# E18/E43-A11 — Recommendation Lab / Controlled Dev Experiment Engine

**Task:** E18-E43-A11-RECOMMENDATION-LAB-CONTROLLED-DEV-EXPERIMENT-ENGINE · **Date:** 2026-06-15 · **Type:** internal/dev controlled-experiment engine (default-OFF, admin-gated, shadow-only).

## 1. Current reality
A5–A10 merged. A7 `RecommendationShadowTrace` table exists; A8 consent-aware orchestrator + online-analysis + retention-readiness services exist; A9 dev-traffic simulator + quality/failure/performance modules exist; A10 internal/dev control plane + promotion gate exist. A safe admin guard exists (`AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')`). Dev DB at 350 recipes. A11 adds a controlled dev experiment engine — **no migration, no new data import**.

## 2. What A11 adds
An INTERNAL/DEV-only **experiment engine** that runs bounded, named shadow recommendation experiments and turns them into a quality scorecard + promotion-readiness decision — WITHOUT changing live ranking or the user response. Components: a config + access layer, a config validator, a fixed experiment **registry** (5 named templates, no arbitrary code), an experiment **runner** (composes A9 dev-traffic simulation + A8 read-only online analysis + A8 retention dry-run), a **quality scorecard**, a **safety kill-switch**, a **promotion gate** (`allowed` always false), a **report generator**, and a default-OFF admin-guarded **controller** — assembled into one **319-check** A11 QA gate + artifact.

## 3. What A11 does NOT enable
No live ranking change. No user-visible response change. No decision trace exposed to users. No public/unauthenticated endpoint. No product personalization / notification engine / Food DNA / AI snapshot / voice / live AI. No autonomous agents. No recipe/ingredient change. No new data import. No new migration. No destructive retention/prune/delete. No raw PII / raw recipe body / raw user text / raw AI prompt or output / medical or protected labels / DB URLs / secrets persisted. `promotionGate.allowed` is **always false**. Does not close R3/R4.

## 4. Lab modes
`RECOMMENDATION_LAB_MODE=off|service_only|dev_internal_api` (default `off`; invalid→off), `RECOMMENDATION_LAB_ALLOW_DRY_RUN=true|false` (default `false`; only literal `true` enables), `RECOMMENDATION_LAB_MAX_REQUESTS=240` (invalid/out-of-range→240, cap 2000), `RECOMMENDATION_LAB_MAX_TRACE_READ=500` (invalid→500, cap 5000), `RECOMMENDATION_LAB_KILL_SWITCH=off|on` (default `off`). off → nothing exposed/runnable; service_only → internal/test service calls only (no HTTP route); dev_internal_api → admin-guarded HTTP route, non-production only.

## 5. Access model
`evaluateRecommendationLabAccess(context)` → `{allowed, mode, reason, requiresAdmin, adminVerified, environment, publicEndpointExposed:false}`. Fail-closed: off→blocked; production + dev_internal_api→blocked (hard lockout); service_only→internal calls only (HTTP not exposed); dev_internal_api→requires admin (or internal call) in non-production. `publicEndpointExposed` is structurally always false. The full 3-mode × 4-environment × admin × internal matrix is exhaustively asserted in the gate.

## 6. Experiment registry
A fixed, in-code set of 5 named templates — **no dynamic/arbitrary experiment code**: `a11-shadow-dev-balanced` (baseline balanced), `a11-shadow-dev-strict` (tighter readiness bar), `a11-cold-start-profile-check` (cold-start fallback stays safe + low-confidence, no fabrication), `a11-consent-blocking-check` (missing-consent requests always blocked, fail-closed), `a11-trace-redaction-check` (every persisted shadow trace passes redaction). Each carries a goal, required inputs, allowed mode, max requests, quality profile, expected blockers, and `nextGate = A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT`. Only registered keys are runnable.

## 7. Config validator
`validateExperimentConfig(config, labConfig, environment)` blocks unsafe/over-bound configs: missing/invalid `experimentKey`, invalid mode, `dry_run` while `allowDryRun=false`, `requestCount` over `maxRequests`, `userSampleSize` over 200, unknown contexts (allow-list of 7 known surfaces), trace write without `requireConsent`, unknown/unsafe quality profile, **any** production execution, and engaged kill switch. There is no `liveRankingChange` config field by design — it cannot be requested.

## 8. Experiment runner
`runRecommendationLabExperiment(config, context, options)` composes, in order: config validation → kill switch → access gate. If any gate blocks, status is `blocked` with **zero** execution. Otherwise: `shadow_dev` runs the A9 dev-traffic batch (bounded by `maxRequests`), maps its summary into execution + safety + metrics, then runs A8 read-only online trace analysis (`RECOMMENDATION_SHADOW_ONLINE_ANALYSIS_MODE=read_only`) and A8 retention **dry-run** (`RECOMMENDATION_SHADOW_RETENTION_MODE=dry_run`); `dry_run` produces a plan only with zero execution. It is offline, deterministic (`generatedAt` fixed), never throws, never mutates inputs, never changes live ranking/response, never exposes traces, never runs destructive retention. `productUseEnabled` / `liveRankingChangedForUser` are always false.

## 9. Quality scorecard
`computeRecommendationLabScorecard(experiment)` → 8 dimensions (overall, readiness, safety, trace quality, ranking stability, consent compliance, performance, data coverage) + failed-critical-checks + warnings. **Safety violations dominate**: any consent bypass, raw leak, unsafe explanation, response mutation, live-ranking mutation, escaped failure, or default-off DB IO drives safety **and overall to 0**. Otherwise overall is a weighted blend (0.35 safety + 0.15 consent + 0.15 trace quality + 0.1 ranking stability + 0.1 readiness + 0.075 performance + 0.075 coverage). Garbage input fails closed to all-zero. Pure; never throws.

## 10. Safety kill switch
`evaluateRecommendationLabKillSwitch(context)` is the last line of defense — it can only **block**, never enable. Blocks on: env kill switch on, mode off, dev_internal_api in production, requested public access, requested live-ranking mutation, requested user-response mutation, requested destructive retention, requested raw-data exposure, or an invalid context. Pure; never throws (internal error → blocked).

## 11. Promotion gate
`evaluateRecommendationLabPromotionGate(scorecard, experiment)` → `{allowed:false, status: blocked|not_ready|ready_for_founder_review, blockers[], warnings[], requiredFounderDecision:true, nextRequiredGate:'A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT'}`. `allowed` is structurally **always false** — A11 can at most reach `ready_for_founder_review`, never self-promote. Hard blockers: any failed critical check, safety score < 1, blocked experiment, invalid config, kill switch engaged, escaped failures. Readiness/coverage are warnings, not blockers. Always warns `R3_R4_remain_mitigating_not_closed`.

## 12. Report generator
`generateRecommendationLabReport(experiment, scorecard, gate)` produces a safe, human-readable summary — **no raw trace, no raw payload, no PII**: title, experiment key, status, scorecard, blockers, deduped warnings, next actions, and safety notes (shadow-only, no trace exposure, retention dry-run, R3/R4 mitigating). `productUseEnabled` / `liveRankingChangedForUser` always false. Pure; never throws.

## 13. Internal endpoint status
A dev-only controller exposes `GET /internal/recommendation-shadow/lab/summary` and `POST /internal/recommendation-shadow/lab/run`, each guarded by `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND the in-handler access gate. Both return **403** by default (mode off) and in production/service-only; they operate only in `dev_internal_api` + non-production + admin. `run` accepts only a registered `experimentKey` (validated regex + registry lookup; otherwise 400) and runs only that template. Never public/unauthenticated, never returns raw data, never linked from public API docs.

## 14. Safety boundaries
Default-OFF; production hard lockout; admin-required; no public endpoint; no user-facing output; no raw trace/user/recipe/AI data; only 5 fixed registered templates (no arbitrary code); bounded request counts; kill switch cannot be bypassed; `promotionGate.allowed` / `productUseEnabled` / `liveRankingChangedForUser` / `publicEndpointExposed` always false; retention dry-run only; no new migration/import; R3/R4 not closed.

## 15. Remaining gaps & future A12 path · Overclaim prevention
Internal/dev only — no public endpoint, no UI; shadow batches are offline/synthetic and analysis is observational over redacted traces; promotion is founder-review readiness only. A12 (`A12_FOUNDER_REVIEWED_LIMITED_DEV_SHADOW_EXPERIMENT`) — a Founder-reviewed, consent-gated, safety-reviewed limited dev shadow experiment — is required before **any** live ranking change. **Overclaim prevention:** A11 is an internal/dev controlled-experiment engine only. It does not change live ranking, does not change the user response, does not expose traces to users, does not create a public endpoint, does not enable product personalization; `promotionGate.allowed` is false; retention is dry-run only. R3 & R4 remain **Mitigating (not Closed)**. BIP v1 not complete.
