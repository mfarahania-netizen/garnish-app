# E18/E43-A7 — Scoring Input Provider + Trace Persistence + Experiment Readiness

**Task:** E18-E43-A7-SCORING-INPUT-PROVIDER-TRACE-PERSISTENCE-AND-EXPERIMENT-READINESS · **Date:** 2026-06-14 · **Type:** runtime-readiness (shadow/experiment, default-OFF).

## 1. Current reality
A5 built the pure shadow decision engine; A6 wired it beside the live pipeline (`RecommendationPipelineService.getRecommendations` → after-ranking hook → `RecommendationShadowRuntimeService.observe`), default-OFF, no provider, no persistence. The A4 graph is pure/offline (not persisted); candidates are recipeIds at the hook; `userId` is available; the Recipe table holds safe metadata (title/region/difficulty/cookingTime/mealType/allergens — never used for body/steps here). No existing model stored shadow traces.

## 2. What A7 adds
- **Scoring-input provider** (`buildRecommendationShadowInputs`) — assembles a SAFE A5 input bundle (candidates + graph + history) from a request via an optional `ShadowDataPort`; the only IO surface.
- **Prisma data port** (`createPrismaShadowDataPort`) — bounded, read-only, safe-projection reads (candidate metadata + recent exposures); graph returns null (→ cold-start fallback); consent never fabricated.
- **Trace redaction** (`redactRecommendationShadowTrace`) — projects the A6 result to a minimized trace (fingerprints + overlap + reason codes + counts + status); strips everything else; cleanliness-guarded.
- **Trace store** (`Noop` + `Prisma` adapters) — persists ONLY the redacted trace, ONLY when `TRACE_WRITE_MODE=redacted`; failures swallowed.
- **Experiment** (`assignRecommendationShadowExperiment`) — deterministic, default-OFF participation gate; never affects product.
- **Metrics** (`summarizeRecommendationShadowMetrics`) — pure aggregation for offline analysis; no network.
- **Additive Prisma model** `RecommendationShadowTrace` (new table, no FK, default writes OFF).
- Service composition in `RecommendationShadowRuntimeService.observe` (A6 path preserved).

## 3. What A7 does NOT enable
No live ranking change. No user-visible response change. No decision trace exposed to users. No product personalization. No live AI. No notification/Food-DNA/AI/voice. BIP v1 not complete.

## 4. Scoring input provider
`buildRecommendationShadowInputs(requestContext, liveCandidates, options)` → `{ inputs, readiness, consent, context, graphSource }`. Maps live candidates to safe `RecommendationCandidate`s (title ≤120 chars, bounded tag arrays; never body/steps). Consent is a hard gate (no fabrication). Graph: provided (port) or a documented **cold-start fallback** (A4 builder on empty observations — low confidence, never a fabricated profile). Pure given the port; never throws.

## 5. Input readiness
`{ status: not_ready | partial | ready_shadow, missingInputs, availableInputs, confidence, canScore, canPersistTrace, reason }`. No consent or no candidates → `not_ready` (cannot score). Consent + candidates → at least `partial` (can score safely at lowered confidence). Full graph + confidence ≥ 0.5 → `ready_shadow`.

## 6. Trace redaction
Output fields: decisionId? / userId? / requestId? / experimentKey? (each dropped if it would carry an unsafe value), liveFingerprint, shadowFingerprint, topKOverlap, rankShiftCount, majorDivergence, reasonCodes (closed enum), summary counts, readiness/safety status, generatedAt, `productUseEnabled:false`, version. Removes candidate titles/body/steps/explanations/raw metadata/PII/user-text/AI-output/secrets. A final `isRedactedTraceClean` guard scans the whole serialized trace.

## 7. Trace store
`RecommendationShadowTraceStore.writeTrace(trace, mode)`. `NoopRecommendationShadowTraceStore` (default) never writes. `PrismaRecommendationShadowTraceStore` writes ONLY in `redacted` mode and ONLY a clean trace (cleanliness guard), to the additive table, with no raw-content columns; any DB error is swallowed to `{written:false, errorKind}` (no raw message). A write failure never breaks the live request.

## 8. Experiment assignment
`assignRecommendationShadowExperiment(userId, { mode, experimentKey, sampleRate })` → deterministic (FNV hash of `key:userId`), default-OFF, `affectsProduct:false`. `off` → never assigned; rate 0 → never; rate 1 → always; partial rate splits the population reproducibly. No protected attributes, no randomness.

## 9. Runtime integration behavior
`observe()`: resolve A6 + A7 config; if mode off → zero-overhead return (never touches port/store). Else: default-OFF experiment gate; assemble inputs (A7 data-port path, else A6 provider path, else none); run the A6 gate; if `TRACE_WRITE_MODE=redacted` and a store is present and readiness permits → redact + persist; record metrics; return the (discarded) result. **No DB read/write in default-off mode.** Every A7 step is isolated — input-build, scoring, and trace-write failures are swallowed; the live response and ranking are never affected.

## 10. Metrics
`summarizeRecommendationShadowMetrics(results)` → runs attempted/allowed, blocked-by-reason, traces written/failed, average topK overlap, major-divergence count, weak-input count, unsafe-explanation count, average confidence, missing-input frequencies. No external analytics, no network, no user-facing output.

## 11. DB migration status
**Additive** migration `20260614020000_e18_a7_recommendation_shadow_trace` — a single `CREATE TABLE "RecommendationShadowTrace"` + 3 indexes. No FK, no cascade, no changes to existing tables, no backfill, non-destructive. Default writes OFF. Retention: redacted rows only; pruning/retention is an operational concern (no destructive prune added here — recommend a periodic age-based cleanup by `createdAt` when collection is enabled).

## 12. Safety boundaries
Env gates (safe defaults): `RECOMMENDATION_SHADOW_RUNTIME_MODE=off`, `..._SAMPLE_RATE=0`, `..._TRACE_WRITE_MODE=off`, `..._EXPERIMENT_MODE=off`, `..._EXPERIMENT_KEY=a7-shadow-v1`. Invalid values resolve to safe defaults. No raw recipe body/steps, user text, AI prompt/output, PII, or medical/protected labels ever cross the boundary or get persisted. `rankingChangedForUser` / `productUseEnabled` always false.

## 13. Future A8 path
A8 may: feed a real persisted user graph (replacing the cold-start fallback), plumb consent from the request, run an offline live-vs-shadow analysis over collected traces, and only then (consent + safety + cost review, still R3/R4-gated) consider any gated live experiment. No live ranking change in A7 or before A8 approval.

## 14. Overclaim prevention
A7 is shadow/experiment-readiness only. It does not change live ranking, does not change the user response, does not expose traces to users, does not enable product personalization, and trace persistence is redacted + env-gated. R3 & R4 remain Mitigating (not Closed). BIP v1 not complete.
