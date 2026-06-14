# E18/E43-A5 — Recommendation Decision Intelligence v1

> The SHADOW recommendation decision brain: UserFoodIdentityGraph + candidates + exposure/outcome
> history → RecommendationDecisionTrace (transparent shadow scoring + attribution + safe Why). Pure,
> deterministic, privacy-safe, non-creepy. Changes NO live ranking and enables NO product behavior.

## 1. Current reality
- E43-A1..A4 merged: Event Envelope, taxonomy/producer migration, SignalObservation Engine, and the
  UserFoodIdentityGraph (pure, not persisted, not wired).
- An existing recommendation pipeline exists (`recommendation/{pipeline,ranking-model,exposure,
  evaluation,explainability,taste-affinity}`). E43-A5 is **additive** under `recommendation/intelligence/`
  and does NOT modify or wire into that live pipeline. **No DB migration.**

## 2. What Recommendation Decision Intelligence v1 IS
- `scoreRecommendationCandidates(graph, candidates, context, history, options)` → a deterministic
  `RecommendationDecisionTrace` (per-candidate score, transparent breakdown, decision, evidence, Why).
- Pure exposure + outcome attribution.
- A safe Why Engine with reason codes + an anti-manipulative scanner.
- A 12-user × 30-candidate × 8-history simulation and a 208-check offline QA gate.

## 3. What it is NOT
- NOT a live ranking change. NOT product personalization. NOT persisted / wired into runtime / UI.
- NOT a prediction model. NOT notification engine / Food-DNA / AI-personalization / voice enablement.
- NOT medical/diagnostic/strict-diet/protected-attribute inference. NOT BIP v1 completion.
- `productUseEnabled: false` and readiness `safeForProductUse: false` are invariants.

## 4. Decision trace model
`RecommendationDecisionTrace` { decisionId, userId, graphVersion, generatedAt, mode, candidateCount,
rankedCandidateIds, candidates[], globalContext, attribution, confidence, safety, explainability,
productUseEnabled:false, version:1 }. Each `RecommendationCandidateDecision` carries score (0..1),
confidence, rank, decision (`recommend_shadow|soft_suppress|block|insufficient_evidence`),
`scoreBreakdown` (9 transparent terms), evidence lineage, and a safe `why`.

## 5. Shadow scoring model
For each candidate: tasteFit, effortFit (context-sensitive weekday/weekend), skillFit (don't
over-push beginners), routineFit, noveltyFit (helps explorers only), feedbackFit (from outcome
attribution) — minus fatiguePenalty (exposure), safetyPenalty (candidate flags), confidencePenalty
(weak profile / sparse metadata). `score = clamp(positiveNorm − penalties, 0, 1)`. Deterministic
ranking by decision class → score desc → candidateId.

## 6. Weight policy (transparent — no black-box ML)
tasteFit 0.22 · effortFit 0.16 · skillFit 0.12 · routineFit 0.12 · feedbackFit 0.18 · noveltyFit 0.08
(positive-fit sum = 0.88) · fatiguePenalty 0.16 (combined exposure+fatigue) · safetyPenalty 0.20 cap ·
confidencePenalty 0.06 (small — so a weak profile lowers *confidence*, not mainly *score*). All weights
are documented constants and unit-tested.

## 7. Exposure attribution
`buildExposureAttribution` → per-recipe { totalExposures, recentExposures (windowed), bySurface,
repeatExposurePenalty, fatigueScore, exposureIdsUsed }. Pure, no DB, no raw payloads.

## 8. Outcome attribution
`buildOutcomeAttribution` → per-recipe { saves, dismisses, cooks, clicks, pos/neg feedback,
feedbackScore (−1..1), cookConversionScore, dismissPenalty, recencyScore (stale decay), outcomeIdsUsed }.
Windowed; pure; no DB; no raw payloads.

## 9. Why Engine
`generateRecommendationWhy(candidateDecision)` → { primaryReason, supportingReasons, limitations,
reasonCodes }. Reason codes: `taste_match, effort_fit, skill_fit, routine_fit, positive_feedback,
negative_feedback, novelty_fit, repeat_success, recent_overexposure, fatigue_risk,
insufficient_evidence, safety_boundary, cold_start_fallback`. Text is evidence-based, short, and
asserted safe.

## 10. Safety and non-creepy explanation rules
`isSafeWhy` rejects creepy/identity ("we know you…", "you are the kind of person"), medical/protected
(reuses the A3 forbidden-term guard incl. standalone "medical"), and **manipulative** phrasing
("you need this", "act now", "you always fail", "because you are…"). Unsafe templates can never ship
(assert-on-build). Why output is shadow-only, not user-facing until separately approved.

## 11. Multi-user simulation summary
12 synthetic UserFoodIdentityGraphs (A4 personas + small ranking seeds), 30 candidates, 8
exposure/outcome histories. Result: **12 distinct ranking fingerprints, 0 collapsed; 12 context-shift
cases** (weekday vs weekend). Proven: overexposed → penalized; dismissed → lower; cooked-success →
boosted; novelty helps explorers more than beginners; quick-weekday prefers low effort on weekdays;
high-skill ranks complex higher on weekends; cautious beginner is not pushed to the most advanced
dish; notification-fatigued never affects ranking via the notification dimension; no
medical/protected/creepy output.

## 12. Readiness contract
`{ status: not_ready | shadow_ready | runtime_gate_ready, reason, requiredInputs, missingInputs,
confidence, safeForProductUse: false, nextIntegrationStep }`. `runtime_gate_ready` means ready for a
FUTURE gated integration task (consent + safety review) — **never** live ranking, and
`safeForProductUse` stays false.

## 13. Remaining integration gaps
Shadow only — not wired into live ranking; not persisted; ingredient/cuisine identity approximate
(graph name-lists empty in v1 → tasteFit uses exploration/repetition proxies); readiness is
contract-only; a future gated A6 (consent + safety + experiment) is required before any runtime use.

## 14. Over-claim prevention
Recommendation Decision Intelligence v1 is **code-backed** (shadow scoring + exposure/outcome
attribution + Why Engine). This does **not** change live recommendation ranking, enable product
personalization, enable a notification engine, enable AI personalization, enable Food-DNA runtime
personalization, enable a voice assistant, or complete BIP v1. **R3 & R4 remain Mitigating, not Closed.**
