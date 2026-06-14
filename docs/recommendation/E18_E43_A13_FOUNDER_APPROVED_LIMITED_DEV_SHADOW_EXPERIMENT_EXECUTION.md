# E18/E43-A13 — Founder-approved Limited Dev Shadow Experiment Execution

**Task:** E18-E43-A13-FOUNDER-APPROVED-LIMITED-DEV-SHADOW-EXPERIMENT-EXECUTION · **Date:** 2026-06-15 · **Type:** internal/dev controlled experiment EXECUTION layer (default-OFF, admin-gated, allow-run-gated, shadow-only).

## 1. Current reality
A5–A12 merged. A7 `RecommendationShadowTrace` table exists; A8 consent-aware orchestrator + online-analysis + retention; A9 dev-traffic simulator + quality/failure/performance; A10 control plane; A11 Recommendation Lab (registry + runner + scorecard + kill switch + promotion gate); A12 Founder-review evidence pack (plan + evidence + safety checklist + rollback proof + dossier). A safe admin guard exists (`AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')`). Dev DB at 350 recipes. A13 adds the first controlled EXECUTION layer — **no migration, no data import**.

## 2. What A13 adds
A Founder-approved, dev-only, SHADOW experiment **execution** layer: a config + access layer, an execution **manifest**, a safe redacted **run ledger**, an **executor** (composes A11 lab runner + A9 dev-traffic batch bounded to the request limit + A8 trace analysis, with optional redacted trace capture), a **result analyzer**, a **rollback drill** + **kill-switch drill** (evidence-backed), an **execution dossier**, a default-OFF **admin-gated controller**, a **408-check** A13 QA gate + artifact, and a dev-only run script. It answers, with honest redacted evidence: *can Garnish run a bounded Founder-approved dev shadow recommendation experiment, capture safe evidence, analyze quality/blockers, prove rollback/kill-switch safety, and produce an execution dossier — without changing real user ranking or response?*

## 3. What A13 does NOT enable
No live ranking change. No user-visible response change. No decision trace exposed to users. No public/unauthenticated endpoint. No product personalization / notification engine / Food DNA / AI personalization / voice / live AI. No autonomous agents. No recipe/ingredient change. No data import. No migration. No destructive retention/prune/delete. No raw PII / recipe body / user text / AI prompt or output / medical or protected labels / DB URLs / secrets persisted. Promotion is never granted; the only next step is a Founder review of results. Does not close R3/R4.

## 4. Founder approval boundary
The Founder approves **dev-only, internal, shadow-only experiment execution + evidence capture** under strict constraints (no live ranking/response change, no production rollout, no personalization, no public endpoint, no raw data exposure, no destructive retention, no R3/R4 closure). Execution requires `approvedBy=founder` on the manifest AND `RECOMMENDATION_EXPERIMENT_EXECUTION_ALLOW_RUN=true`; either missing → blocked.

## 5. Execution manifest
`createLimitedDevShadowExperimentExecutionManifest(input, context)` — Founder approval is mandatory; only registered A11 templates run; `requestLimit = min(requestedRequests, MAX_REQUESTS)` (cap 240); production is blocked; redacted trace write requires `TRACE_WRITE=redacted` AND an explicit manifest opt-in. `liveRankingChangeAllowed` / `userResponseChangeAllowed` / `productUseEnabled` are literal false. Status `blocked` | `ready` | `executed`.

## 6. Run ledger
A safe, in-memory (not DB-backed) redacted ledger — **counters only, no raw IDs / traces / PII**: requestsAttempted/Executed, shadowRunsAllowed/Blocked, tracesAttempted/Written/Rejected, safetyBlocks, consentBlocks, rawLeakBlocks, failuresEscaped. Safety flags (`liveRankingChanged`/`userResponseChanged`/`traceExposedToUser`/`productUseEnabled`) are literal false. Status `not_started` | `running` | `completed` | `blocked` | `failed_safe`.

## 7. Executor
`executeLimitedDevShadowExperiment(manifest, context)` enforces, in order: manifest validity → access gate → kill switch (env kill switch, off mode, production, allow-run) → Founder approval. Any block → zero execution + blocked ledger. Otherwise it runs the A11 lab (lab summary + A8 trace analysis) and the A9 dev-traffic batch **bounded to the request limit** (the run list is honestly sliced — executed count never exceeds the limit), maps the bounded subset into the run ledger, optionally records redacted trace captures (only when `TRACE_WRITE=redacted` + manifest opt-in), and **fails safe** on any unsafe signal (consent bypass / response or ranking mutation / raw leak / escaped failure → `failed_safe`). Offline, deterministic, never throws, never changes live ranking or the user response.

## 8. Result analyzer
`analyzeLimitedDevShadowExperimentExecution(result)` computes allowed-shadow-run rate, block rate, consent/safety block rates, trace redaction pass rate, trace-write acceptance rate, average topK overlap, major divergence rate, weak-input rate, failure escape count, a runtime-safety status, and a readiness status — at most `ready_for_founder_review_of_results` (`blocked` | `executed_observable` | `ready_for_founder_review_of_results`). **Never a production promotion.**

## 9. Rollback drill
`runRecommendationExperimentRollbackDrill(context)` proves (by invoking the kill switch / access gate / manifest) that the layer is safely reversible: env-disable blocks (`MODE=off`), the kill switch blocks, trace writing is env-gated, production stays blocked, and there is no destructive / user-data / live-ranking rollback to perform. `runRecommendationExperimentKillSwitchDrill` separately proves the kill switch blocks on kill-on/off/production and does not over-block a clean dev run.

## 10. Internal endpoint/service status
A dev-only controller exposes `POST /internal/recommendation-shadow/experiment-execution/run` and `GET /internal/recommendation-shadow/experiment-execution/summary`, each guarded by `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND the in-handler access gate. Both return **403** by default (mode off) and in production/service-only; `run` additionally requires `ALLOW_RUN=true` (else 403) and accepts only a registered `templateKey` (regex + registry; else 400). Never public/unauthenticated; returns redacted summaries only.

## 11. Dossier
`generateLimitedDevShadowExperimentExecutionDossier(result)` → `verdict` (`blocked` | `executed_observable` | `failed_safe`), summary, run ledger, quality analysis, rollback drill, blockers/warnings, `nextDecisionRequired: 'founder_review_results'`, and forbidden next actions (`enable_production_ranking`, `enable_user_facing_personalization`, `enable_ai_autonomy`). No raw data; no overclaim; no production approval.

## 12. Remaining gaps
Internal/dev execution only — no public endpoint, no UI; shadow batches are offline/synthetic (A9 dev-traffic) and never touch the live ranking/response path; trace capture is redacted-only and env-gated. Readiness is at most `ready_for_founder_review_of_results`.

## 13. Future A14 path
A14 would be a **Founder review of the executed results** (the `nextDecisionRequired`), and only after an explicit Founder decision could any further, still-bounded step be considered. No live ranking change may occur without explicit further Founder approval. R3/R4 remain governing risks for any live AI/ranking product rollout.

## 14. Overclaim prevention
A13 is an internal/dev limited shadow experiment execution layer only. It does not change live ranking, does not change the user response, does not expose traces to users, does not create a public endpoint, does not enable product personalization; promotion is never granted; retention is dry-run only; a Founder review of results is required for any next step. R3 & R4 remain **Mitigating (not Closed)**. BIP v1 not complete.
