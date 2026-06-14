# E43-A3 SignalObservation Engine + Signal Registry v1 Report

**Task:** E43-A3-SIGNAL-OBSERVATION-ENGINE-AND-SIGNAL-REGISTRY-V1 · **Date:** 2026-06-14 · **Owner:** BA / EL
**Type:** behavioral-intelligence foundation (pure, deterministic, offline). **Not** BIP completion, product, UI, AI-live, prediction, or graph.

## Final verdict
**E43_A3_SIGNAL_OBSERVATION_ENGINE_GATE_PASS**

The first behavioral-interpretation layer is in place: a typed, forbidden-signal-guarded registry (44 signals / 10 families), a pure deterministic extraction engine, a transparent confidence model, safe explainability, and a 103-check offline QA gate. Pure (no DB writes), consent-gated, P2-preserving, leak-free, with no medical/diagnostic/protected-attribute inference. No migration, no runtime wiring, no product change; R3/R4 unchanged.

## Branch / commit
- **Start master:** `7b74ee06`
- **Branch:** `exec/e43-a3-signal-observation-engine`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
A legacy `SignalRegistryService` (`signal.registry.ts`) and ALL relevant Prisma models (`SignalObservation`, `UserBehaviorSignal`, `UserEngagementSnapshot`, `UserHealthSnapshot`, `UserIdentitySnapshot`, `UserRetentionSnapshot`, `UserFeatureVector`) already exist. Per the DB rules this means **no migration**; the new v1 layer is **pure** (writes nothing) and **additive** (hyphenated `signal-*.ts`, distinct from the dotted legacy registry). The runtime `SignalObservation` type is richer than and distinct from the legacy persisted row.

## Files changed
- **New (behavior-engine/signals):** `signal-types.ts`, `signal-registry.ts` (+spec), `signal-confidence.ts` (+spec), `signal-explainability.ts` (+spec), `signal-observation-engine.ts` (+spec), `signal-qa-gate.ts` (+spec).
- **New (docs):** `docs/behavior/E43_A3_SIGNAL_REGISTRY_V1.md`, `docs/qa/behavior/e43_a3_signal_observation_results.json`, this report.
- **Modified:** `apps/server/package.json` + root `package.json` (`behavior:eval:signals`); `docs/README.md`, `RISK_REGISTER.md`, `WEEKLY_EXECUTION_REVIEW.md`; **optional hardening** `apps/server/src/analytics/event-envelope.schema.ts` + `.spec.ts` (redact circular-ref/depth guard).

## What was added
A typed `SIGNAL_REGISTRY` (44 signals), a forbidden-signal guard, a pure `extractSignalObservations` engine, a transparent confidence model, safe explainability builders, and a 103-check offline gate + artifact + scripts.

## What was not changed
No DB schema/migration; no persistence (engine is pure); no runtime wiring; no recommendation ranking; no notification engine; no AI personalization; no UserFoodIdentityGraph; no prediction; no UI; no recipe/ingredient data; no destructive retention; no R3/R4 change.

## Schema / migration status
**No DB migration required for E43-A3; pure signal engine and QA gate only.** All signal/snapshot Prisma models already exist; the engine reads nothing and writes nothing (mock/no Prisma in tests).

## Signal registry
44 signals across 10 families (taste/effort/skill/routine/reco/notif/planner/grocery/ai/onboarding). Each entry: `signalKey, family, description, allowedEventFamilies, allowedEventTypes, direction, valueType, confidencePolicy, privacyClass, consentPurpose, retentionPolicy, forbiddenInferences, explainabilityTemplate, status`. 37 `active_v1` + 7 `planned` (sources not yet emitted as canonical events). Guarded by `scanForForbiddenSignals` (no medical/diagnostic/protected term in any user-facing field); status grounded in the taxonomy; no `b2b_aggregate`; only `ai.safety_boundary_trigger` is P2-sensitive (a system-boundary signal — never a label about the user).

## Signal extraction engine
`extractSignalObservations(events, options)` — pure, deterministic (ordered by signalKey), **no DB/network/throw**. Validates/normalizes events, maps eventType→signals via the registry, groups evidence per user+signal, computes scores, and emits `SignalObservation` records (strength −1..1, confidence 0..1, evidence count + opaque eventIds + safe source eventTypes, recency/consistency/frequency, explanation, limitations, version 1). Consent-gated (never fabricates consent), **never downgrades P2**, skips/redacts invalid+PII events, supports planned-source events offline (`includePlannedSignals`).

## Confidence model
Transparent: `confidence = evidenceSufficiency × recency × weightedQuality`, capped at 0.95 unless explicit feedback ≥1 AND evidence ≥ minEvidenceCount (→ ≤0.99). Recency = exponential half-life decay; consistency = directional agreement (contradiction lowers it); frequency = saturating volume; explicit feedback raises it. Every term is a named, unit-tested function — verified: empty→0, weak→low, repeated→higher, decay lowers, feedback raises, contradiction lowers, cap holds.

## Privacy / consent behavior
Personalization signals are emitted only from personalization-consented events; analytics signals accept analytics/personalization; core accepts any; incompatible evidence is dropped (no silent consent). P2-sensitive is never downgraded (a P2 source upgrades a P1 signal). No `b2b_aggregate`. Observations carry no raw metadata/user text.

## Explainability behavior
Every observation carries a short, safe, evidence-based explanation built from the registry template + a generic evidence note, asserted safe by `assertSafeExplanation` (rejects "we know you…", "you are the kind of person", medical/diagnosis/condition, and protected-attribute phrasing). Limitations are generic and non-creepy (no raw forbidden terms).

## Artifact validation
`docs/qa/behavior/e43_a3_signal_observation_results.json`: `offline-deterministic`; `totalChecks 103 / passed 103 / failed 0` across registry_completeness (50) · forbidden_absence (4) · event_mapping (18) · confidence_scoring (8) · contradiction (3) · recency_decay (3) · privacy_consent (6) · explainability_safety (4) · artifact_redaction (3) · deterministic_ordering (2) · no_db_network (2); full summaries (registry/extraction/confidence/privacyConsent/explainability/deterministicOrdering); `dbMigrationRequired false`; `dbWritesDuringGate 0`; `networkCallsDuringGate 0`; `redactedFailureDetails []`. No PII/secret/medical label.

## Static scans
- Forbidden medical/protected terms in `behavior-engine/signals` + behavior docs/artifact: appear **only** in the guard denylist definitions (`FORBIDDEN_INFERENCE_TERMS`/`FORBIDDEN_BASELINE`/`FORBIDDEN_EXPLANATION_PATTERNS`), rejection-assertion tests, and the registry doc — **never** as an actual signal or user-facing inference.
- Secret scan of behavior dirs + artifact → no matches. No tracked `.env`.

## Tests / build
| Command | Result |
|---|---|
| `analytics:eval:event-envelope` (A1) | ✅ 78 (incl. new redact circular/depth tests) |
| `analytics:eval:event-producers` (A2) | ✅ 63 |
| `behavior:eval:signals` (A3, server + root) | ✅ 54 specs; gate **103/103** |
| `pnpm --dir apps/server test` (full) | ⚠️ **478/482** — the 4 failures are exactly the known **R19** legacy specs; no behavior/signal/analytics failure |
| `pnpm build` | ✅ green |

## Adversarial review (4 lenses + synthesis)
Ran a 4-lens review before commit — **registry-safety PASS, engine-privacy PASS, confidence-explainability PASS, scope-leak PASS; `anyBlocking: false`.** Lenses independently confirmed: no forbidden/sensitive/medical signal (forbidden terms only in the guard denylist + rejection tests); engine pure/deterministic/never-throws with consent gating + P2-never-downgraded + PII-free observations; confidence transparent with the 0.95/0.99 caps holding; redact circular/depth hardening correct. **Folded in 2 minor defense-in-depth hardenings** of the safety guard: generalized the creepy-phrasing regex (now also catches "you seem/look like the kind/type of person") and added a standalone `condition` forbidden term — both with regression tests. No INFO finding required action (the "confidence cap unreachable" note was a misread — the gate proves explicit-feedback+repeated evidence reaches 0.99).

## Docs / risk updates
README links the A3 report + registry doc + artifact (states engine code-backed, BIP not complete, no recommendation/notification/AI-personalization change). RISK_REGISTER + WEEKLY have the E43-A3 entry (strengthens R15/R1). **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
- Engine is pure — no persistence to `SignalObservation`/`UserBehaviorSignal` yet (staged follow-up).
- Not wired into runtime; no recommendation/notification/AI consumption.
- No UserFoodIdentityGraph, no prediction layer (out of scope).
- 7 signals are `planned` (sources not yet emitted as canonical events).
- Confidence/decay is v1 (conservative cap).

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
- no AI personalization product enablement
- no voice assistant enablement
- no R3/R4 closure
- no strategy change

## Stop condition
Stop here. Do not merge. Do not start E43-A4, recommendation, notification, Food DNA, AI snapshot, UI, R18, R19, or voice.
