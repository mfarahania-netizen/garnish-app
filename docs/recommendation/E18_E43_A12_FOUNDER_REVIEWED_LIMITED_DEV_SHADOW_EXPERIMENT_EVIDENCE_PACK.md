# E18/E43-A12 — Founder-reviewed Limited Dev Shadow Experiment Evidence Pack

**Task:** E18-E43-A12-FOUNDER-REVIEWED-LIMITED-DEV-SHADOW-EXPERIMENT-EVIDENCE-PACK · **Date:** 2026-06-15 · **Type:** internal/dev Founder-review evidence system (default-OFF, admin-gated, read-only / dry-run).

## 1. Current reality
A5–A11 merged. A7 `RecommendationShadowTrace` table exists; A8 consent-aware orchestrator + online-analysis + retention services exist; A9 dev-traffic simulator + quality/failure/performance modules exist; A10 internal control plane (read-only summary + promotion gate) exists; A11 Recommendation Lab (registry + runner + scorecard + kill switch + promotion gate) exists. A safe admin guard exists (`AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')`). Dev DB at 350 recipes. A12 adds an evidence system on top — **no migration, no data import**.

## 2. What A12 adds
An INTERNAL/DEV-only **evidence system** that makes the lab usable for a real Founder review decision: a config + access layer, a Founder-review **experiment plan model**, an **evidence pack generator** that integrates A11 (lab summary), A10 (control-plane summary), A9 (simulation artifact), and A8 (redacted online trace analysis + retention dry-run), a **safety checklist engine**, a **rollback + kill-switch proof engine** (evidence-backed, not asserted), a **dossier generator** (Founder-facing verdict + allowed decision options), a default-OFF **admin-gated controller/service**, a **Founder decision placeholder model**, and one **392-check** A12 QA gate + artifact. It answers, with reproducible redacted evidence: *is the shadow recommendation engine ready for a Founder-reviewed limited dev shadow experiment — without any live ranking / user-response change?*

## 3. What A12 does NOT enable
No live ranking change. No user-visible response change. No decision trace exposed to users. No public/unauthenticated endpoint. No product personalization / notification engine / Food DNA / AI personalization / voice / live AI. No autonomous agents. No recipe/ingredient change. No data import. No migration. No destructive retention/prune/delete. No raw PII / recipe body / user text / AI prompt or output / medical or protected labels / DB URLs / secrets persisted. A12 is **Founder-review evidence only**; it never self-promotes. `promotionAllowed` is **always false**. A Founder decision is always required. Retention is dry-run only. Does not close R3/R4.

## 4. Founder review plan
`createFounderReviewExperimentPlan(input, context)` turns a request into a bounded, constrained plan: scope must be `dev_shadow_only`; the template must be a registered A11 template (else `blocked`); `maxRequests` is bounded (≤ 240); `requiredApprovals` always includes `founder`; `liveRankingChangeAllowed` / `userResponseChangeAllowed` / `promotionAllowed` are literal `false`; production planning is blocked. Output status is `blocked` | `ready_for_founder_review` with constraints, allowed/disallowed actions, safety preconditions, and the evidence required.

## 5. Evidence pack
`generateFounderReviewEvidencePack(plan, context, { inputs })` assembles already-gathered, redacted evidence: `labSummary` (A11), `controlPlaneSummary` (A10), `simulationSummary` (A9 artifact), `traceAnalysisSummary` (A8), `retentionDryRunSummary` (A8 dry-run) + rollback proof + safety checklist + promotion review + Founder decision placeholder. A missing input is **not a crash** — it lowers `evidenceCompleteness`, sets `evidenceComplete=false`, and adds a blocker/warning. `productUseEnabled` / `liveRankingChangedForUser` / `userVisible` are literal `false`; `version` is 1.

## 6. Safety checklist
`evaluateFounderReviewSafetyChecklist(pack)` runs the non-negotiable checks: no live ranking change, no user response change, no product personalization, no public/unauthenticated endpoint, admin/dev-only, no raw trace/recipe-body/user-text/AI-prompt-output exposure, no PII, no medical/protected labels, no destructive retention, R3/R4 remain Mitigating, kill switch verified, rollback documented, retention dry-run only, Founder approval required. It also runs a redaction/leak scan over the gathered evidence. **Any critical failure → `blocked`**; otherwise `pass` / `pass_with_warnings`.

## 7. Rollback proof
`generateRecommendationRollbackProof(context)` produces *evidence* (by actually invoking the A11 kill switch) that the stack is safely reversible: the kill switch blocks on env-on / off-mode / production / requested live-ranking-or-response mutation / requested raw-exposure / requested public-access / requested destructive-retention, and does **not** over-block a clean dev run. It records that there is no live ranking/response change to roll back, disabling is env-only (no deploy, no destructive op), and retention is dry-run only (Founder-approval required).

## 8. Dossier generator
`generateFounderReviewDossier(pack)` distills the pack into a Founder-facing decision dossier: a `verdict` (`blocked` | `ready_for_founder_review` | `not_ready`), an executive summary, evidence completeness, safety + quality status, blockers/warnings, `requiredFounderDecision: true`, the **only** allowed decision options, and the forbidden options. No overclaim, no production approval, no self-promotion.

## 9. Internal endpoint/service status
A dev-only controller exposes `GET /internal/recommendation-shadow/founder-review/summary` and `POST /internal/recommendation-shadow/founder-review/evidence-pack`, each guarded by `AuthGuard('jwt')` + `RolesGuard` + `@Roles('admin')` AND the in-handler access gate. Both return **403** by default (mode off) and in production/service-only; they operate only in `dev_internal_api` + non-production + admin. `evidence-pack` accepts only a registered `templateKey` (validated regex + registry lookup; otherwise 400). Never public/unauthenticated; returns redacted summaries only. The `RecommendationFounderReviewService` is also usable service-only (internal/tests).

## 10. Founder decision options
The dossier offers exactly three allowed decisions: `reject`, `request_more_evidence`, `approve_limited_dev_shadow_experiment`. Even on `approve_limited_dev_shadow_experiment`, the allowed actions after approval are limited to a Founder-approved, synthetic/dev limited shadow experiment (still no live ranking change) — captured by the Founder decision placeholder.

## 11. Forbidden decision options
The dossier explicitly enumerates forbidden options that A12 can never produce or enable: `enable_production_ranking`, `enable_user_facing_personalization`, `enable_ai_autonomy`. These remain forbidden regardless of any evidence.

## 12. Remaining gaps
Internal/dev evidence only — no public endpoint, no UI; shadow batches are offline/synthetic; trace analysis is observational over redacted traces; promotion is founder-review readiness only. The evidence pack reflects the dev DB + synthetic dev traffic, not production traffic.

## 13. Future A13 path
A13 (`A13_FOUNDER_APPROVED_LIMITED_DEV_SHADOW_EXPERIMENT_EXECUTION`) — a Founder-approved, consent-gated, safety-reviewed limited dev shadow experiment **execution** (still synthetic/dev, still no live ranking change before explicit further approval) — is the only next step, and only after an explicit Founder decision on this evidence pack. R3/R4 remain governing risks for any live AI/ranking product rollout.

## 14. Overclaim prevention
A12 is an internal/dev Founder-review evidence system only. It does not change live ranking, does not change the user response, does not expose traces to users, does not create a public endpoint, does not enable product personalization; `promotionAllowed` is false; a Founder decision is required; retention is dry-run only. R3 & R4 remain **Mitigating (not Closed)**. BIP v1 not complete.
