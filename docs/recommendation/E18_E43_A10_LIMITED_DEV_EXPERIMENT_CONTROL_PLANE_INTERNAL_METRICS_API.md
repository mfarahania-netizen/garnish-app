# E18/E43-A10 — Limited Dev Experiment Control Plane + Internal Metrics API

**Task:** E18-E43-A10-LIMITED-DEV-EXPERIMENT-CONTROL-PLANE-INTERNAL-METRICS-API · **Date:** 2026-06-14 · **Type:** internal/dev control-plane readiness (default-OFF, admin-guarded).

## 1. Current reality
A5–A9 merged. A7 `RecommendationShadowTrace` table exists; A8 online-analysis + retention-readiness services exist; A9 quality/failure/performance modules + dev-traffic simulator exist. A safe admin guard exists (`AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')`). Dev DB at 350 recipes. A10 adds an internal/dev control plane — no migration.

## 2. What A10 adds
An INTERNAL/DEV-only, read-only control plane to inspect shadow recommendation quality + experiment readiness: a config layer, an access model, a summary service (composing A8 online analysis + A8 retention dry-run + A9 simulation quality/buckets/performance + a safe A9-artifact reader), a promotion-gate evaluator, and a default-OFF admin-guarded controller — assembled into one 234-check A10 QA gate + artifact.

## 3. What A10 does NOT enable
No live ranking change. No user-visible response change. No decision trace exposed to users. No public endpoint. No product personalization. `promotionGate.allowed` always false. No live AI. No notification/Food-DNA/AI/voice. No destructive retention. No new migration. Does not close R3/R4.

## 4. Control-plane modes
`RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE=off|service_only|dev_internal_api` (default `off`; invalid→off), `..._REQUIRE_ADMIN=true|false` (default `true`), `..._MAX_TRACE_READ=500` (invalid/out-of-range→500, cap 5000). off → nothing exposed; service_only → internal/test service calls only (no HTTP route); dev_internal_api → admin-guarded HTTP route, non-production only.

## 5. Access model
`evaluateRecommendationShadowControlPlaneAccess(context)` → `{allowed, mode, reason, requiresAdmin, adminVerified, environment, publicEndpointExposed:false}`. Fail-closed: off→blocked; production + dev_internal_api→blocked (hard lockout); service_only→internal calls only (HTTP not exposed); dev_internal_api→requires admin (or internal call) in non-production. `publicEndpointExposed` is structurally always false.

## 6. Internal endpoint status
A dev-only controller `GET /internal/recommendation-shadow/control-plane/summary` is registered, guarded by `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND the access gate. It returns **403** by default (mode off) and in production/service-only; it returns the redacted summary only in `dev_internal_api` + non-production + admin. It is never public/unauthenticated, never returns raw data, and is not linked from public API docs.

## 7. Trace summary
Reuses the A8 online-analysis service over redacted `RecommendationShadowTrace` rows (bounded by `maxTraceRead`): traceCount, averageTopKOverlap, majorDivergenceRate, mostCommonReasonCodes, weakInputRate, sampleSizeWarning. Read-only, no raw trace body, empty-table safe, no network.

## 8. Simulation artifact reader
Safely reads the A9 artifact (`e18_e43_a9_..._results.json`): missing → warning (no crash); never trusts it blindly — re-checks `promotionAllowed false`, `productUseEnabled false`, `liveRankingChangedForUser false`, `networkCallsDuringGate 0`, `redactedFailureDetails` empty; surfaces `reChecksPassed`.

## 9. Promotion gate
`evaluateRecommendationShadowPromotionGate(input)` → `{allowed:false, status: blocked|not_ready|dev_experiment_design_ready, blockers[], warnings[], nextRequiredGate:'A11_FOUNDER_APPROVED_LIMITED_DEV_EXPERIMENT'}`. `allowed` is structurally always false. Hard blockers: unsafe explanation, raw leak, consent bypass, live response/ranking mutation, incomplete trace redaction, default-off DB IO, network call, failed quality thresholds, destructive/non-founder-gated retention, artifact re-check failure / artifact claiming promotion. Always warns `R3_R4_remain_mitigating_not_closed`.

## 10. Failure buckets
The control-plane summary surfaces the A9 12-bucket classification (code, count, severity, next action) — counts only, no raw examples.

## 11. Retention summary
Reuses A8 retention readiness: dry-run only, eligible count, opaque sample IDs, `destructiveOperationUsed:false`, `requiresFounderApproval:true`. Never deletes.

## 12. Safety boundaries
Default-OFF; production lockout; admin-required; no public endpoint; no user-facing output; no raw trace/user/recipe/AI data; `promotionGate.allowed`/`productUseEnabled`/`liveRankingChangedForUser`/`publicEndpointExposed`/`userVisible` always false; retention dry-run only; R3/R4 not closed.

## 13. Remaining gaps
Internal/dev read-only only (no UI); trace analysis observational over redacted traces; promotion is design-readiness only; A11 (Founder-approved limited dev experiment) required before any live ranking change.

## 14. Future A11 path
A11 may design a Founder-approved, consent-gated, safety-reviewed limited dev experiment with real (still non-ranking-affecting) shadow collection + a gated retention executor — all R3/R4-gated, no live ranking change before explicit approval.

## 15. Overclaim prevention
A10 is internal/dev control-plane readiness only. It does not change live ranking, does not change the user response, does not expose traces to users, does not create a public endpoint, does not enable product personalization; `promotionGate.allowed` is false; retention is dry-run only. R3 & R4 remain Mitigating (not Closed). BIP v1 not complete.
