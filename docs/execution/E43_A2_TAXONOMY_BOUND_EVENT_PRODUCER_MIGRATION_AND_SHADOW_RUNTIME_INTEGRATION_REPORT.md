# E43-A2 Taxonomy-Bound Event Producer Migration + Shadow Runtime Integration Report

**Task:** E43-A2-TAXONOMY-BOUND-EVENT-PRODUCER-MIGRATION-AND-SHADOW-RUNTIME-INTEGRATION · **Date:** 2026-06-14 · **Owner:** BA / EL
**Type:** core architecture + validation gate (deterministic, offline). **Not** BIP completion, full migration, product, UI, AI-live, or strategy.

## Final verdict
**E43_A2_EVENT_PRODUCER_MIGRATION_GATE_PASS**

A taxonomy-bound migration foundation is in place: the legacy `EventType` enum is bound to 11 canonical families with per-family defaults; a code-grounded inventory of 20 producers + a migration map document the staged path; a pure runtime guard (off/shadow/strict) exists; and exactly one low-risk path (`analytics.service.trackEvent`) is wired in observational shadow mode (default-safe, never drops/alters events, no DB write, redacted logs). No DB migration; no producer emits canonical_v2 yet; R3/R4 unchanged.

## Branch / commit
- **Start master:** `e2d65174`
- **Branch:** `exec/e43-a2-event-producer-migration`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Reality check
Code-grounded targeted static scan of `apps/server/src` found **20 server-side event producers**. `notifications` exists; **`meal-planner`/`planner`/`shopping`/`grocery` server modules do NOT exist** (those events flow frontend→`analytics.trackEvent`; `meal-plans`/`shopping-list` modules + signal processors react). Honest gaps: **no notification send/suppress event log, no admin-action audit producer, no WAT/workflow producer**. No producer emits a `CanonicalEventEnvelope` today. The legacy `EventType` enum has 117 values; 13 canonical/ADR types (e.g. `cook_complete`, `consent_granted`, `workflow_run`) are **planned**, not yet produced.

## Files changed
- **New:** `event-taxonomy.contract.ts` (+spec), `event-producer-inventory.ts` (+spec), `event-envelope-runtime-guard.ts` (+spec), `docs/analytics/E43_A2_EVENT_PRODUCER_MIGRATION_MAP.md`, `docs/qa/analytics/e43_a2_event_producer_migration_results.json`, this report.
- **Modified (minimal):** `apps/server/src/analytics/analytics.service.ts` (observational shadow guard call + a `Logger`), `apps/server/package.json` + root `package.json` (`analytics:eval:event-producers`), `docs/README.md`, `docs/execution/RISK_REGISTER.md`, `docs/execution/WEEKLY_EXECUTION_REVIEW.md`.

## What was added
1. **Taxonomy contract** — binds legacy `EventType` to 11 families; `validateEventType` (strict reject / shadow warn / never silently-OK unknown), `classifyEventFamily`, `getEventTypeMigrationStatus` (`legacy_active` | `canonical_planned` | `unknown`), `EVENT_FAMILY_DEFAULTS` (consent/privacy/retention/visibility/surface), `EventTaxonomyContract`, `KnownEventType`/`EventFamily`.
2. **Producer inventory** — 20 code-grounded records (`targeted_static_scan`) with the required fields, family gaps, and `checkInventoryConsistency`.
3. **Migration map** — `docs/analytics/E43_A2_EVENT_PRODUCER_MIGRATION_MAP.md` (full table + 8 required sections + explicit over-claim prevention).
4. **Runtime guard** — pure `guardEventForRuntime(input, {mode,source,producerId,redactForLogs,...})`: off=skip; shadow=validate/normalize+warn (never blocks, redacts); strict=reject invalid/PII/no-consent/unknown-type; never throws; stable return shape; `resolveRuntimeGuardMode` (env, default shadow).
5. **One shadow integration** — `analytics.service.trackEvent`.
6. **Offline QA gate + artifact** (`analytics:eval:event-producers`).

## What was not changed
No DB schema/migration; no envelope columns on `UserEvent`; no producer rewrite/delete; no recipe/ingredient data; no UI; no AI provider behavior; no notification engine; no planner/shopping redesign; no community/B2B; no destructive retention; no R3/R4 change.

## Taxonomy contract
11 families (recipe/cook/ai/notification/recommendation/grocery/planner/consent/admin/workflow/behavior). `validateEventType('recipe_view','strict')→ok`; unknown→reject (strict) / warn+ok (shadow); `cook_complete`→`canonical_planned` (warned, not legacy). `classifyEventFamily` is deterministic and returns `unknown` for unclassifiable input. `EVENT_FAMILY_DEFAULTS` present for all 11 (consent+admin = audit-long).

## Producer inventory
20 records, unique ids, valid enums, all fields present, internally consistent; coverage `targeted_static_scan` (no "all found" over-claim). Exactly one low-risk first integration candidate (`prod-analytics-trackevent`, shadow_guarded). Family gaps recorded for cook/admin/workflow/notification-suppression. byFamily: behavior 9 · ai 3 · recommendation 2 · recipe 1 · planner 1 · grocery 1 · notification 2 · consent 1.

## Migration map
`docs/analytics/E43_A2_EVENT_PRODUCER_MIGRATION_MAP.md` — producer table (current shape → target canonical event, priority, risk, status, next action), current reality, producers-not-found/folders-missing, high-risk producers (ChatMessage=high: raw user text), low-risk first candidate, family defaults table, remaining gaps, and explicit over-claim prevention (BIP not complete; analytics not fully migrated; contract code-backed; runtime migration staged; shadow-only).

## Runtime guard
Pure, side-effect-free, never throws. off→`{allowed:true,status:'skipped'}`; shadow→accepts canonical / normalizes legacy (with caller consent) / observes failures — **always allowed:true**, always redacts; strict→rejects invalid/PII/no-consent/unknown-type (`allowed:false`). Internal try/catch guarantees a guard fault can never break a producer.

## Runtime integration
`AnalyticsService.trackEvent` → `observeWithRuntimeGuard(data)`: **observational only**. It builds a candidate from `{type, userId, page}` (legacy `payload` deliberately NOT forwarded — PII-safe), calls the guard, and logs a single **redacted** `debug` line when the event is not yet canonical. It **never drops or alters** the event, performs **no DB write**, and is wrapped in try/catch. Default mode `shadow` (env `EVENT_ENVELOPE_RUNTIME_GUARD_MODE=off|shadow|strict`); even `strict` does not drop events here (staged migration). Integration tests prove: flow intact (UserEvent still written + returned), no extra DB writes, redacted logs, quality-reject short-circuit unchanged, off-mode silent.

## Artifact validation
`docs/qa/analytics/e43_a2_event_producer_migration_results.json`: `offline-deterministic`; `totalChecks 21 / passed 21 / failed 0` (taxonomy 6 · inventory 7 · runtime_guard 6 · integration 1 · artifact_safety 1); taxonomySummary (11 families, 117 legacy + 13 planned); producerInventorySummary (coverage targeted_static_scan, 20 producers, byFamily/Priority/Status, gaps); runtimeGuardSummary (all modes verified); runtimeIntegrationSummary (observational, dropsEvents false, newDbWrites 0, logsRedacted true, default shadow); migrationMapSummary; piiRedactionSummary (leaks 0); `dbMigrationRequired false`; `dbWritesDuringGate 0`; `runtimeModeDefault shadow`; `redactedFailureDetails []`. No raw PII/JWT/Bearer/API-key/private-key/DB-conn-string/user-text.

## Static scans
- Secret scan of `docs/qa/analytics` + `docs/analytics` → **no matches**.
- Secret scan of new production `.ts` (taxonomy contract / inventory / runtime guard / analytics.service) → **no matches** (regex patterns in the guard are detector literals, not real secrets).
- Wiring scan confirms `guardEventForRuntime`/`EVENT_ENVELOPE_RUNTIME_GUARD_MODE` appear only in the guard + analytics.service (no stray wiring).
- No tracked `.env`.

## Tests / build
| Command | Result |
|---|---|
| `pnpm --dir apps/server analytics:eval:event-envelope` (A1) | ✅ green (76 — pattern also runs the A2 runtime-guard spec; harmless overlap) |
| `pnpm --dir apps/server analytics:eval:event-producers` (A2) | ✅ 63/63 specs; gate **21/21** checks |
| `pnpm analytics:eval:event-producers` (root) | ✅ forwards to server |
| `pnpm --dir apps/server test` (full) | ⚠️ **422/426** — the 4 failures are exactly the known **R19** legacy specs; no analytics/producer/AI failure |
| `pnpm build` | ✅ green |

## Adversarial review (4 lenses + synthesis)
Ran a 4-lens review before commit. **inventory-grounding PASS** (all 20 producers verified against real source — no fabrication), **guard+integration-safety PASS** (guard pure/never-throws; integration observational, default shadow, never drops/alters, no DB write, redacted debug silent at default), **scope+leak PASS** (no DB migration/UI/recipe change; R3/R4 Mitigating; artifact leak-free; only synthetic fixtures match secret patterns). The **taxonomy lens (+ synthesis) raised one blocking finding:** `classifyEventFamily` returned `'unknown'` for 4 *known* canonical-planned types (`cooked_share`, `b2b_aggregate_snapshot`, `community_post_published`, `circle_recipe_share`), violating the "classify every eventType" promise. **Folded in:** added a precise canonical-planned family-override map (`cooked_share→cook`, `circle_recipe_share→recipe`, `community_post_published→recipe`, `b2b_aggregate_snapshot→workflow`) + regression tests (the 4 cases **and** a guarantee that *every* canonical-planned type classifies to a real family). **Minor (not fixed — out of A2 modify-scope, already handled):** `redactEventEnvelopeForArtifact` (in the A1-merged `schema.ts`) has no circular-ref depth guard; a circular input would `RangeError`, but the runtime guard's and analytics.service's `try/catch` both catch it safely — noted as a follow-up, not touched (avoids modifying merged code).

## Docs / risk updates
README links the A2 report + migration map + A2 artifact (states contract code-backed, runtime migration staged, BIP not complete, analytics not fully migrated). RISK_REGISTER change-history entry (strengthens R15/R1; **R3 & R4 unchanged — Mitigating, not Closed**). WEEKLY E43-A2 entry.

## Remaining integration gaps
- Only **1 of 20** producers is shadow-guarded; 19 are `not_started`. No producer emits `canonical_v2` yet.
- DB envelope columns + runtime emission are future additive/Founder-gated steps (no DB migration here).
- Notification suppressed-log (Layer 10), admin audit, WAT `workflow_run` (Layer 14) producers do not exist and must be built.
- Shadow integration is observational (never enforces), even in strict mode.

## Side-effect confirmations
- no live AI default
- no product rollout
- no UI
- no recipe import
- no ingredient change
- no DB migration
- no destructive retention/prune/delete
- no community/public/B2B enablement
- no R3/R4 closure
- no strategy change

## Stop condition
Stop here. Do not merge. Do not start E43-A3, UI, R18, R19, notifications, planner, shopping, AI snapshot, or voice.
