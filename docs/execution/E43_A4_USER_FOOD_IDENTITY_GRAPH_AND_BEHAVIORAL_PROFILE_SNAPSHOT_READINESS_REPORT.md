# E43-A4 UserFoodIdentityGraph + Behavioral Profile Snapshot Readiness Report

**Task:** E43-A4-USER-FOOD-IDENTITY-GRAPH-AND-BEHAVIORAL-PROFILE-SNAPSHOT-READINESS · **Date:** 2026-06-14 · **Owner:** BA / EL
**Type:** behavioral-intelligence foundation (pure, deterministic, offline). **Not** BIP completion, prediction, product, UI, AI-live, ranking, notification, Food-DNA, or voice.

## Final verdict
**E43_A4_USER_FOOD_IDENTITY_GRAPH_GATE_PASS**

UserFoodIdentityGraph v1 + behavioral profile snapshot readiness are code-backed: a typed 11-dimension graph built deterministically from SignalObservations, with transparent confidence, conflict resolution (no evidence erasure), evidence lineage, graph-level privacy (P2-preserving, anti-laundering), safe explanations, and six downstream readiness contracts (`safeForProductUse` always false). A 12-persona simulation yields 12 distinct, non-collapsed profiles. Pure (no DB writes), no runtime wiring, no product enablement; R3/R4 unchanged.

## Branch / commit
- **Start master:** `aaea9ee3`
- **Branch:** `exec/e43-a4-user-food-identity-graph`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
Legacy `behavior-engine/identity/` (timeline + identity-dimension builders) and snapshot Prisma models already exist. E43-A4 is **additive** (`behavior-engine/profile/`), **pure** (writes nothing), and does not overwrite legacy code. No `UserFoodIdentityGraph` Prisma model exists → **no migration**.

## Files changed
- **New (behavior-engine/profile):** `user-food-identity-graph.types.ts`, `user-food-identity-graph.builder.ts` (+spec), `profile-dimension-aggregation.ts` (+spec), `profile-conflict-resolution.ts` (+spec), `profile-privacy-gate.ts` (+spec), `profile-readiness-contracts.ts` (+spec), `profile-simulation-fixtures.ts`, `profile-qa-gate.ts` (+spec).
- **New (docs):** `docs/behavior/E43_A4_USER_FOOD_IDENTITY_GRAPH_V1.md`, `docs/qa/behavior/e43_a4_user_food_identity_graph_results.json`, this report.
- **Modified:** root + server `package.json` (`behavior:eval:profile`); `docs/README.md`, `RISK_REGISTER.md`, `WEEKLY_EXECUTION_REVIEW.md`; and (folded-in adversarial-review hardening) `apps/server/src/behavior-engine/signals/signal-registry.ts` — added standalone `medical` to the shared `FORBIDDEN_INFERENCE_TERMS` denylist + reworded one A3 description that hedged with "(non-medical)" so it stays clean.

## What was added
A typed `UserFoodIdentityGraph` (11 dimensions); a pure deterministic builder; transparent confidence/freshness aggregation; conflict resolution; graph-level privacy + anti-laundering scanner; six readiness contracts; a 12-persona simulation; a 157-check offline QA gate + artifact + scripts.

## What was not changed
No DB schema/migration; no persistence (pure builder); no runtime wiring; no prediction; no recommendation ranking; no notification engine; no Food-DNA personalization; no AI personalization; no voice; no UI; no recipe/ingredient data; no destructive retention; no R3/R4 change.

## Schema / migration status
**No DB migration required for E43-A4; pure graph builder and QA gate only.**

## UserFoodIdentityGraph model
Typed graph: userId, graphVersion 1, generatedAt, source signal count + observation ids, 11 dimensions, confidence (overall + byDimension + weakest/strongest), evidence (observation ids / signal keys / latest-evidence per dimension), freshness (recency + stale dimensions), limitations, six downstream readiness contracts, and privacy (highest class, consent purposes used, sensitive-system-boundary flag, `containsMedicalOrProtectedInference: false`).

## Dimension aggregation
Each dimension shares a base (status ladder empty→strong, confidence, evidence, dominant/positive/negative signals, contradictions, safe summary/explanation, limitations) plus specific scalar fields. `safetyBoundaries` is limitations-only (system-side; never a user label). Name-list fields (ingredient/cuisine) are empty in v1 with a documented recipe-data-join limitation.

## Confidence / freshness model
Per-dimension confidence = recency-weighted mean of contributing observation confidences; graph overall = evidence-weighted mean across dimensions; status via a documented threshold ladder. Freshness = exponential half-life recency per dimension + aggregate score + stale-dimension detection. Transparent and unit-tested.

## Conflict resolution
Records contradictions (never erases evidence), lowers confidence via a penalty multiplier, and splits by context where appropriate: effort quick+complex → context split (not a contradiction); notification open+dismiss → contradiction (timing-fit weak); AI help-seeking + negative feedback → tension; onboarding-adventurous vs conservative behavior → behavior wins; internally-inconsistent single signals (low consistencyScore) flagged. Evidence IDs preserved throughout.

## Privacy / consent behavior
Highest privacy class wins; **P2 never downgraded**; consent purposes derived from evidence (never fabricated); `b2b_aggregate` blocks the graph; strict mode blocks on empty/incompatible consent (shadow/offline allows a weak graph); `containsMedicalOrProtectedInference` always false; a graph-wide `scanGraphForForbidden` rejects any forbidden medical/protected term or creepy phrasing in any graph text (anti-laundering; circular-safe, depth-capped).

## Downstream readiness contracts
Six contracts (recommendation, notification, aiSnapshot, foodDna, plannerGrocery, voiceIntent), each with status (`not_ready`/`weak`/`ready_shadow`/`ready_for_runtime_gate`), reason, required/missing dimensions, confidence, and **`safeForProductUse: false` (invariant)**. Readiness never implies ranking change, a notification send engine, AI personalization, or a voice assistant.

## Multi-user simulation
12 synthetic personas (quick-weekday, weekend-explorer, cautious-beginner, high-skill, notif-fatigued, notif-responsive, planner-heavy, grocery-friction, AI-help-seeking, AI-negative, onboarding-vs-behavior, mixed/contradictory). Result: **12 distinct fingerprints, 0 collapsed**; confidence varies with evidence quality; contradictions lower confidence / split context; notification, recommendation, and AI readiness differ across users. No protected attributes, no medical labels, no raw PII.

## Artifact validation
`docs/qa/behavior/e43_a4_user_food_identity_graph_results.json`: `offline-deterministic`; `totalChecks 157 / passed 157 / failed 0` across 14 families (graph_completeness 19 · dimension_aggregation 17 · confidence_aggregation 5 · evidence_lineage 5 · conflict_resolution 6 · recency_freshness 3 · privacy_consent 8 · explainability_safety 15 · downstream_readiness 3 · multi_user_simulation 60 · non_collapse_distinctiveness 7 · artifact_redaction 3 · no_db_network 2 · overclaim_prevention 4); `simulationSummary` 12 users / 12 distinct / 0 collapsed; `dbMigrationRequired false`; `dbWritesDuringGate 0`; `networkCallsDuringGate 0`; `productUseEnabled false`; `redactedFailureDetails []`. No raw PII / user text / prompts / outputs / secrets / medical-protected labels.

## Static scans
- Forbidden medical/protected terms in `behavior-engine` + behavior docs/artifact appear **only** in the guard denylist definitions, rejection-assertion tests (incl. the A3 gate self-test), and the registry docs — never as an actual graph/profile/dimension inference.
- Secret scan of behavior dirs + artifact → no matches. No tracked `.env`.

## Tests / build
| Command | Result |
|---|---|
| `analytics:eval:event-envelope` (A1) | ✅ 78 |
| `analytics:eval:event-producers` (A2) | ✅ 63 |
| `behavior:eval:signals` (A3) | ✅ 54 |
| `behavior:eval:profile` (A4, server + root) | ✅ 49 specs; gate **157/157** |
| `pnpm --dir apps/server test` (full) | ⚠️ **527/531** — the 4 failures are exactly the known **R19** legacy specs; no profile/behavior/analytics failure |
| `pnpm build` | ✅ green |

## Adversarial review (4 lenses + synthesis)
4-lens review before commit — **graph-correctness pass_with_minor, privacy/anti-laundering pass_with_minor, simulation/readiness PASS, scope/leak PASS; `anyBlocking: false`.** Lenses independently confirmed: pure/deterministic builder with preserved evidence lineage; P2-never-downgraded + b2b-blocked + anti-laundering scanner; 12 distinct non-collapsed profiles; `safeForProductUse` always false; in-scope, no migration/wiring, R3/R4 Mitigating. **Folded in 3 minor hardenings:** (1) added standalone `medical` to the shared forbidden-term denylist (the scanner now catches "medical advice/history", not just "medical condition") + reworded the one A3 description that hedged "(non-medical)"; (2) `aggregateConfidence` now coerces non-finite / out-of-range upstream `confidence`/`recencyScore` to keep dimension confidence in `[0,1]` (NaN/Infinity-safe); (3) added regression tests for both. No INFO finding required action.

## Docs / risk updates
README links the A4 report + graph doc + artifact (code-backed; contracts only; no product/ranking/notification/AI/voice change). RISK_REGISTER + WEEKLY have the E43-A4 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
Graph is pure — not persisted (no graph table) and not wired into runtime; readiness is a contract only (`safeForProductUse` always false); no prediction layer; ingredient/cuisine identity needs a recipe-data join (staged; empty in v1); confidence/decay conservative v1.

## Side-effect confirmations
- no live AI default
- no product rollout
- no UI
- no recipe import
- no ingredient change
- no DB migration unless explicitly approved and reported (NONE added)
- no destructive retention/prune/delete
- no medical/diagnostic/strict-diet inference
- no protected-attribute inference
- no community/public/B2B enablement
- no recommendation ranking change
- no notification engine enablement
- no Food DNA runtime personalization
- no AI personalization product enablement
- no voice assistant enablement
- no R3/R4 closure
- no strategy change

## Stop condition
Stop here. Do not merge. Do not start recommendation, notification, Food DNA, AI snapshot, UI, R18, R19, voice, or E43-A5.
