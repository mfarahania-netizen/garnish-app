# E43-A4 — UserFoodIdentityGraph v1 + Behavioral Profile Snapshot Readiness

> The user-level behavioral graph: SignalObservations → multi-dimensional profile snapshot → downstream
> readiness contracts. Pure, deterministic, explainable, privacy-safe. A FOUNDATION — it does not
> complete BIP v1, persist anything, or enable any product behavior.

## 1. Current reality
- E43-A1/A2/A3 are merged: Event Envelope contract, taxonomy + producer migration + runtime guard, and
  the SignalObservation Engine + Signal Registry v1 (44 signals / 10 families).
- A legacy `behavior-engine/identity/` (timeline + identity-dimension builders) and snapshot Prisma
  models already exist. E43-A4 is **additive** (`behavior-engine/profile/`), **pure** (no DB writes),
  and does not overwrite legacy code. **No DB migration.**

## 2. What UserFoodIdentityGraph v1 IS
- `buildUserFoodIdentityGraph(observations, options)` → a typed graph with 11 dimensions, transparent
  confidence aggregation, conflict resolution, evidence lineage, freshness/recency, graph-level
  privacy, safe explanations, and six downstream readiness contracts.
- A 12-persona multi-user simulation proving different users → meaningfully different graphs.
- A 157-check offline QA gate.

## 3. What it is NOT
- NOT BIP v1 completion. NOT a prediction model. NOT persisted. NOT wired into runtime. NOT a
  recommendation-ranking / notification-engine / Food-DNA / AI-personalization / voice change. NOT
  medical/diagnostic/strict-diet inference. NOT a protected-attribute labeler. NOT product-enabled
  (`safeForProductUse` is always false; `productUseEnabled: false`).

## 4. Dimension model
11 dimensions, each with a shared base (`status` empty→weak→emerging→usable→strong, `confidence`,
`evidenceCount`, dominant/positive/negative signals, `contradictions`, `summary`, `safeExplanation`,
`limitations`) plus dimension-specific scalar fields:
`taste, effort, skill, routine, recommendationBehavior, notificationBehavior, plannerBehavior,
groceryBehavior, aiInteraction, onboardingColdStart, safetyBoundaries`.
`safetyBoundaries` is **limitations-only** — a system-side record, never a label about the user.

## 5. Signal-to-dimension mapping
Each signal maps to a dimension by family prefix (`taste.*`→taste, `reco.*`→recommendationBehavior, …),
with `ai.safety_boundary_trigger` split out of `ai`→`safetyBoundaries`. Name-list fields
(ingredient/cuisine affinities) require a recipe-data join and are **empty in v1** (documented
limitation); differentiation comes from computable scalar scores + status + confidence + contributing
signals.

## 6. Confidence aggregation
Per-dimension confidence = recency-weighted mean of contributing observation confidences (stale evidence
down-weighted). Graph `confidence.overall` = evidence-weighted mean across dimensions. Status follows a
documented threshold ladder. Transparent and unit-tested; intentionally conservative.

## 7. Conflict resolution
Detects and records (never erases) contradictions; lowers confidence via a penalty multiplier; splits by
context where appropriate. Rules: low-consistency single signals; effort quick+complex → **context split**
(not a contradiction); notification open+dismiss → contradiction (timing-fit weak); AI help-seeking +
negative feedback → tension; onboarding-adventurous vs conservative behavior → behavior wins. Evidence
IDs are always preserved.

## 8. Freshness / recency
Per-dimension latest-evidence timestamp + recency score (exponential half-life). Graph `freshness`
reports an aggregate recency score and `staleDimensions` (non-empty dimensions whose latest evidence has
decayed below threshold).

## 9. Privacy and consent
Highest privacy class wins; **P2 is never downgraded**; consent purposes are derived from real evidence
(never fabricated); `b2b_aggregate` is rejected (graph blocked); strict mode blocks on empty/incompatible
consent while shadow/offline allows a weak graph; `containsMedicalOrProtectedInference` is always false; a
graph-wide scanner (`scanGraphForForbidden`) rejects any forbidden medical/protected term or creepy
phrasing in any graph text (anti-laundering).

## 10. Downstream readiness contracts
Six contracts — recommendation, notification, aiSnapshot, foodDna, plannerGrocery, voiceIntent — each
with `status` (`not_ready`/`weak`/`ready_shadow`/`ready_for_runtime_gate`), reason, required/missing
dimensions, confidence, and **`safeForProductUse: false` (invariant in v1)**. Readiness may reach
`ready_shadow`/`ready_for_runtime_gate` but **never** enables product use, ranking changes, a notification
send engine, AI personalization, or a voice assistant.

## 11. Multi-user simulation summary
12 synthetic personas (quick-weekday, weekend-explorer, cautious-beginner, high-skill, notif-fatigued,
notif-responsive, planner-heavy, grocery-friction, AI-help-seeking, AI-negative, onboarding-vs-behavior,
mixed/contradictory). Result: **12 distinct profile fingerprints, 0 collapsed**; confidence varies with
evidence quality; contradictions lower confidence / split context; notification, recommendation, and AI
snapshot readiness differ across users. No two profiles collapse to a generic output. No protected
attributes, no medical labels, no raw PII.

## 12. Remaining integration gaps
- Graph is **pure** — not persisted (no `UserFoodIdentityGraph` table) and **not wired into runtime**.
- Readiness is a **contract only**; `safeForProductUse` is always false.
- No prediction layer; no recommendation/notification/Food-DNA/AI-personalization/voice change.
- Ingredient/cuisine identity (name-list fields) needs a recipe-data join (staged; empty in v1).
- Confidence/decay model is conservative v1.

## 13. Over-claim prevention
UserFoodIdentityGraph v1 and behavioral profile snapshot readiness are **code-backed**. This does **not**
complete BIP v1, enable product personalization, change recommendation ranking, enable a notification
engine, enable AI personalization, enable Food-DNA runtime personalization, enable a voice assistant, or
add DB persistence. **R3 & R4 remain Mitigating, not Closed.**
