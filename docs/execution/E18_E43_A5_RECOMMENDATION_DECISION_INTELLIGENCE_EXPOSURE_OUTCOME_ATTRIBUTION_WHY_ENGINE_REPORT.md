# E18/E43-A5 Recommendation Decision Intelligence + Exposure/Outcome Attribution + Why Engine Report

**Task:** E18-E43-A5-RECOMMENDATION-DECISION-INTELLIGENCE-EXPOSURE-OUTCOME-ATTRIBUTION-WHY-ENGINE · **Date:** 2026-06-14 · **Owner:** BA / EL
**Type:** recommendation-intelligence foundation (pure/shadow, deterministic, offline). **Not** a live ranking change, product personalization, or BIP completion.

## Final verdict
**E18_E43_A5_RECOMMENDATION_DECISION_INTELLIGENCE_GATE_PASS**

A pure SHADOW decision brain is in place: UserFoodIdentityGraph + candidates + exposure/outcome history → a deterministic `RecommendationDecisionTrace` with transparent weighted scoring, pure exposure/outcome attribution, and a safe (non-creepy, non-medical, non-manipulative) Why Engine. A 12-user × 30-candidate × 8-history simulation yields 12 distinct, non-collapsed rankings. No live ranking change, no DB writes, no product enablement; R3/R4 unchanged.

## Branch / commit
- **Start master:** `9af62d74`
- **Branch:** `exec/e18-e43-a5-recommendation-decision-intelligence`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
An existing recommendation pipeline exists (`recommendation/{pipeline,ranking-model,exposure,evaluation,explainability,taste-affinity}`). E18/E43-A5 is **additive + pure** under `recommendation/intelligence/`, reuses the A4 graph + A3 explainability guards read-only, and **does not modify or wire into** the live pipeline. No `RecommendationDecisionTrace` Prisma model exists → **no migration**.

## Files changed
- **New (recommendation/intelligence):** `recommendation-decision.types.ts`, `recommendation-shadow-scorer.ts` (+spec), `recommendation-exposure-attribution.ts` (+spec), `recommendation-outcome-attribution.ts` (+spec), `recommendation-why-engine.ts` (+spec), `recommendation-decision-simulation-fixtures.ts`, `recommendation-decision-qa-gate.ts` (+spec).
- **New (docs):** `docs/recommendation/E18_E43_A5_..._V1.md`, `docs/qa/recommendation/e18_e43_a5_..._results.json`, this report.
- **Modified:** root + server `package.json` (`recommendation:eval:decision-intelligence`); `docs/README.md`, `RISK_REGISTER.md`, `WEEKLY_EXECUTION_REVIEW.md`.

## What was added
A typed decision-trace model; a transparent shadow scorer; pure exposure + outcome attribution; a safe Why Engine (13 reason codes + anti-manipulative scanner); a 12×30×8 simulation; a 208-check offline QA gate + artifact + scripts; a readiness contract.

## What was not changed
No live recommendation ranking; no existing recommendation module; no DB schema/migration; no persistence; no UI; no recipe/ingredient data; no notification/Food-DNA/AI/voice; no prediction; no R3/R4 change.

## Schema / migration status
**No DB migration required for E18/E43-A5; pure shadow recommendation decision engine and QA gate only.**

## Decision trace model
`RecommendationDecisionTrace` (decisionId/userId/graphVersion/generatedAt/mode/candidateCount/rankedCandidateIds/candidates/globalContext/attribution/confidence/safety/explainability/`productUseEnabled:false`/version:1); per-candidate decision with score (0..1), confidence, rank, decision class, 9-term `scoreBreakdown`, evidence lineage, and safe `why`.

## Shadow scoring engine
Transparent weighted score: `clamp(Σ weightedFits/0.88 − (fatigue+safety+confidence penalties), 0, 1)`. Pure, deterministic (decision class → score desc → candidateId), no DB/network/throw. Context-sensitive effort (weekday→low, weekend→complex); novelty helps explorers only; safety flags soft-suppress/block; sparse metadata lowers confidence + warnings (no crash).

## Exposure attribution
`buildExposureAttribution` → per-recipe recent counts, repeat penalty, fatigue, bySurface, ids. Pure; no fabrication (unmatched recipe → zeros); never throws.

## Outcome attribution
`buildOutcomeAttribution` → per-recipe saves/dismisses/cooks/clicks/feedback, feedbackScore (−1..1), cookConversionScore, dismissPenalty, recency decay, ids. Windowed; pure; never throws.

## Why Engine
`generateRecommendationWhy` → primary + supporting reasons + limitations + reason codes (13-code enum). `isSafeWhy` rejects creepy/identity, medical/protected (A3 guard incl. standalone "medical"), and **manipulative** phrasing; unsafe templates assert-fail (can't ship). Shadow-only; not user-facing until approved.

## Multi-user simulation
12 graphs (A4 personas + small collision-avoiding ranking seeds) × 30 candidates × 8 histories → **12 distinct ranking fingerprints, 0 collapsed, 12 context-shift cases**. Verified: overexposed penalized; dismissed lowered; cooked-success boosted; novelty helps explorers > beginners; quick-weekday prefers low effort on weekdays; high-skill ranks complex higher on weekends; cautious beginner not pushed to the most advanced; notification-fatigued never affects ranking via the notification dimension; no medical/protected/creepy output.

## Readiness contract
`{ status: not_ready|shadow_ready|runtime_gate_ready, reason, requiredInputs, missingInputs, confidence, safeForProductUse:false, nextIntegrationStep }`. `runtime_gate_ready` = ready for a FUTURE gated integration (consent + safety review), never live ranking.

## Artifact validation
`e18_e43_a5_recommendation_decision_intelligence_results.json`: `offline-deterministic`; `totalChecks 209 / passed 209 / failed 0` across 15 families; `simulationSummary` 12 users / 30 candidates / 8 histories / 12 distinct / 0 collapsed / 12 context shifts; `productUseEnabled false`; `dbMigrationRequired false`; `dbWritesDuringGate 0`; `networkCallsDuringGate 0`; `redactedFailureDetails []`. No raw PII / user text / payloads / AI prompts-or-outputs / secrets / medical-protected labels.

## Static scans
Forbidden medical/protected terms in `recommendation/intelligence` + docs/artifact appear **only** in the Why-engine denylist, the gate's own scanner regex, rejection-assertion tests, and the doc — never as an actual recommendation explanation. Secret scan → no matches. No tracked `.env`.

## Tests / build
A1 78 · A2 63 · A3 54 · A4 49 · A5 **209/209** gate (34 specs) · full suite **561/565** (4 = exactly the known **R19**) · build green.

## Adversarial review (4 lenses + synthesis)
4-lens review before commit — **scorer-correctness pass_with_minor, attribution PASS, why-safety PASS, scope/leak/no-ranking PASS; `anyBlocking: false`.** Lenses independently confirmed: pure/deterministic scorer with documented weights (no hidden ML); attribution never fabricates; Why Engine rejects creepy/medical/manipulative phrasing; existing recommendation pipeline untouched (no live-ranking wiring); `productUseEnabled`/`safeForProductUse` false; artifact leak-free; 12 distinct/0 collapsed rankings; R3/R4 Mitigating. **Folded in 1 major correctness fix:** the weekday `effortFit` formula conflated *attitude* (dislikes quick meals) with *time availability* — a quick-meal-disliker could be served a 90-min recipe on a Tuesday. Reworked so **weekday caps effort low-to-moderate (time dominates)** with the quick-preference only modulating within that band; added a regression check (quick-disliker still gets low-effort on weekday). Targeted persona checks (quick-weekday, high-skill weekend) still hold.

## Docs / risk updates
README links the A5 report + decision-intelligence doc + artifact (shadow-only, no live ranking, no product personalization). RISK_REGISTER + WEEKLY have the E18/A5 entry. **R3 & R4 remain Mitigating, not Closed.**

## Remaining integration gaps
Shadow only — not wired into live ranking, not persisted; ingredient/cuisine identity approximate (graph name-lists empty in v1 → tasteFit uses exploration/repetition proxies); readiness contract-only; a future gated A6 (consent + safety + experiment) is required before any runtime use.

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
- no live recommendation ranking change
- no notification engine enablement
- no Food DNA runtime personalization
- no AI personalization product enablement
- no voice assistant enablement
- no R3/R4 closure
- no strategy change

## Stop condition
Stop here. Do not merge. Do not start notification, Food DNA, AI snapshot, UI, R18, R19, voice, or E18/E43-A6.
