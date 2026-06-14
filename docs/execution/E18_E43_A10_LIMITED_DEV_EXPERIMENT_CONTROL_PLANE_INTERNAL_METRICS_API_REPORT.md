# E18/E43-A10 Limited Dev Experiment Control Plane + Internal Metrics API Report

**Task:** E18-E43-A10-LIMITED-DEV-EXPERIMENT-CONTROL-PLANE-INTERNAL-METRICS-API · **Date:** 2026-06-14 · **Owner:** BA / EL

## Final verdict
**E18_E43_A10_CONTROL_PLANE_INTERNAL_METRICS_GATE_PASS**

A safe internal/dev, read-only control plane lets Garnish inspect shadow recommendation quality, experiment readiness, trace summaries, threshold status, failure buckets, and promotion blockers — behind a default-OFF, admin-guarded, access-gated route — without changing live ranking, the user response, or exposing anything to users.

## Branch / commit
- **Start master:** `47580c79`
- **Branch:** `exec/e18-e43-a10-control-plane-internal-metrics`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
A5–A9 merged; A7 `RecommendationShadowTrace` table exists; A8 online-analysis + retention services + A9 quality/failure/performance + dev-traffic simulator reused. A safe admin guard exists (`AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')`), so a dev-only admin-guarded controller is safe to add. No migration. R19 out of scope.

## Files changed
- **New (`runtime-shadow/control-plane/`):** `recommendation-shadow-control-plane.types.ts`, `recommendation-shadow-control-plane-config.ts`(+spec), `recommendation-shadow-control-plane-access.ts`(+spec), `recommendation-shadow-control-plane-readiness.ts`(+spec), `recommendation-shadow-control-plane.service.ts`(+spec), `recommendation-shadow-control-plane-controller.ts`(+spec), `recommendation-shadow-a10-qa-gate.ts`(+spec).
- **New (docs):** A10 design doc, A10 QA artifact, this report.
- **Modified:** `recommendation.module.ts` (register service + controller), root + server `package.json`, README/RISK/WEEKLY.

## What was added
Config + access model + summary service (composing A8 analysis/retention + A9 simulation quality/buckets/perf + safe artifact reader) + promotion gate + default-OFF admin-guarded controller + 234-check A10 gate.

## What was not changed
Live ranking; user-visible response; existing recommendation behavior; DB schema (no migration); UI; recipes/ingredients; notification/Food-DNA/AI/voice; R3/R4. A9 behavior preserved (32/32).

## Schema / migration status
**No new migration.** Pure read-only control plane over existing modules + the A7 table.

## Control-plane modes
`RECOMMENDATION_SHADOW_CONTROL_PLANE_MODE=off|service_only|dev_internal_api` (default `off`; invalid→off), `..._REQUIRE_ADMIN` (default `true`; only explicit `false` disables), `..._MAX_TRACE_READ=500` (invalid/out-of-range→500, cap 5000).

## Access model
`evaluateRecommendationShadowControlPlaneAccess` — fail-closed: off→blocked; **production + dev_internal_api → hard-blocked**; service_only→internal/test calls only (no HTTP route); dev_internal_api→requires admin (or internal call), non-production only. `publicEndpointExposed` structurally always false (verified across all 3 modes × 4 envs × 2 admin × 2 internal combinations).

## Internal endpoint / service behavior
Controller `GET /internal/recommendation-shadow/control-plane/summary`, guarded by `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND the access gate. Returns **403** by default (off), in production, and for service_only HTTP; returns the redacted summary only in `dev_internal_api` + non-production + admin. Never public/unauthenticated; never returns raw trace/user/recipe/AI data.

## Trace summary
A8 online-analysis over redacted traces (bounded by `maxTraceRead`): traceCount, averageTopKOverlap, majorDivergenceRate, mostCommonReasonCodes, weakInputRate, sampleSizeWarning. Read-only, no raw trace body, empty-safe.

## Simulation artifact reader
Reads the A9 artifact safely: missing → warning (no crash); never trusts blindly — re-checks promotionAllowed false / productUseEnabled false / liveRankingChangedForUser false / networkCallsDuringGate 0 / redactedFailureDetails empty; surfaces `reChecksPassed`.

## Promotion gate
`evaluateRecommendationShadowPromotionGate` → `{allowed:false, status, blockers, warnings, nextRequiredGate:'A11_FOUNDER_APPROVED_LIMITED_DEV_EXPERIMENT'}`. `allowed` structurally always false (verified even with perfect input). Hard blockers (tamper-tested): unsafe explanation, raw leak, consent bypass, live response/ranking mutation, incomplete redaction, default-off DB IO, network call, failed thresholds, destructive/non-founder-gated retention, artifact re-check failure / artifact claiming promotion. Always warns R3/R4 remain Mitigating.

## Failure buckets / blockers
Surfaces the A9 12-bucket classification (code, count, severity, next action) — counts only, no raw examples.

## Performance / retention summary
Performance: avg/p95 ms, networkCalls 0, defaultOffDbIoCount 0, estimated DB reads/writes. Retention: dry-run, eligible count + opaque sample IDs, `destructiveOperationUsed:false`, `requiresFounderApproval:true`. Never deletes.

## Artifact validation
`e18_e43_a10_..._results.json`: `offline-control-plane-evaluation`; **234/234**; accessSummary {defaultMode off, productionDevApiBlocked true, publicEndpointExposed false, requiresAdmin true}; promotionGateSummary {allowed false, nextRequiredGate A11}; retentionSummary {destructiveOperationUsed false, requiresFounderApproval true}; runtimeSafetySummary {liveResponseChanged/liveRankingChanged/decisionTraceExposedToUser/publicEndpointExposed all false}; productUseEnabled false; liveRankingChangedForUser false; networkCallsDuringGate 0; redactedFailureDetails []. No raw trace/PII/secret/medical value.

## Static scans
Forbidden terms + raw-content matchers + synthetic fixtures only in denylist/scanner/rejection-test locations; the summary carries no forbidden labels. No real secrets; no tracked `.env`.

## Tests / build
A10 **41 specs / 234-check gate**; A9 gate **32/32**; full server suite **827/831** (4 = exactly R19); `pnpm build` green (controller registration safe). **Adversarial 3-lens review:** see below.

## Adversarial review (3 lenses + synthesis)
Endpoint/access safety, leak/promotion safety, immutability/scope/config — initial synthesis returned **1 BLOCKING** finding (caught a real defensive-coding bug), now **resolved**: the controller's `adminVerified` had a trailing `|| true`, forcing it always true and semantically defeating the access gate's admin check (the framework `RolesGuard('admin')` still enforced admin, so it was not a live auth bypass — but the in-handler gate must reflect the real role). **Fixed:** removed `|| true`; `adminVerified` now reflects the actual verified role. Also folded the hardenings: A9-artifact reader now requires `schemaVersion===1` and treats any missing safety field as untrusted (`reChecksPassed=false` + warning); config `maxTraceRead` requires a positive **integer** within the cap (floats/NaN/out-of-range → safe default); the controller now passes `internalCall:false` explicitly and validates the `experimentKey` format (400 on bad input). The promotion-gate `allowed:false` is already a literal type + literal returns (no throw added — observe/gate never throw). Post-fix: A10 gate 234/234, A9 gate green, build green.

## Docs / risk updates
README links the A10 report, design doc, and artifact. RISK_REGISTER + WEEKLY have the A10 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
Internal/dev read-only only (no UI); trace analysis observational; promotion is design-readiness only; A11 (Founder-approved limited dev experiment) required before any live ranking change. R18/R19/R-E1 unchanged.

## Side-effect confirmations
- no live AI default · no product rollout · no UI · no recipe import · no ingredient change · no destructive retention/prune/delete · no medical/diagnostic/strict-diet inference · no protected-attribute inference · no community/public/B2B enablement · **no live recommendation ranking change** · **no user-visible recommendation response change** · **no decision trace exposed to users** · **no public unauthenticated control-plane endpoint** · no notification engine enablement · no Food DNA runtime personalization · no AI personalization product enablement · no voice assistant enablement · no R3/R4 closure · no strategy change

## Stop condition
Stop here. Do not merge. Do not start notification, Food DNA, AI snapshot, UI, R18, R19, voice, or A11.
