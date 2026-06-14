# E43-A1 Canonical Event Envelope Code Contract and Ingest Gate Report

**Task:** E43-A1-CANONICAL-EVENT-ENVELOPE-CODE-CONTRACT-AND-INGEST-GATE · **Date:** 2026-06-14 · **Owner:** BA / EL
**Type:** core architecture + validation gate (deterministic, offline). **Not** product rollout, UI, AI-live, or strategy.

## Final verdict
**E43_A1_EVENT_ENVELOPE_CODE_CONTRACT_GATE_PASS**

The Canonical Event Envelope (ADR-0001, schemaVersion 2) is now a producer-ready, typed, tested code contract with a thin pure ingest boundary, broadened deterministic PII/secret rejection, backward-tolerant legacy normalization (that never fabricates consent), and deterministic artifact redaction. A deterministic offline contract gate proves it (46/46 checks, 0 DB/live). No DB migration, no live wiring, no out-of-scope change; R3/R4 remain Mitigating.

## Branch / commit
- **Start master:** `fba2eb8b`
- **Branch:** `exec/e43-a1-event-envelope`
- **Commit:** `<filled at commit>`
- **Master changed?** No — review branch only; merge is Founder-gated.

## Files changed
**Reality check first (mandatory):** E43-W6 had already landed `event-envelope.schema.ts` (schemaVersion 2, all enums, `validateEventEnvelope`, `assertNoPIIInMetadata`, 32 passing tests). This task therefore **extended that contract additively — it did not overwrite it** — and added the missing pieces (examples, ingest gate, broadened PII, legacy normalization, redaction, the eval gate + artifact). Honest gap note: the schema/spec files were *modified*, not *created*, because they already existed.

- **Extended:** `apps/server/src/analytics/event-envelope.schema.ts`, `apps/server/src/analytics/event-envelope.schema.spec.ts` (+22 tests; 32 pre-existing preserved).
- **New:** `apps/server/src/analytics/event-envelope.examples.ts`, `apps/server/src/analytics/event-envelope.ingest-gate.ts`, `apps/server/src/analytics/event-envelope.ingest-gate.spec.ts`, `docs/qa/analytics/e43_a1_event_envelope_contract_results.json`, this report.
- **Scripts:** `apps/server/package.json` + root `package.json` (added `analytics:eval:event-envelope`).
- **Docs:** `docs/README.md`, `docs/execution/RISK_REGISTER.md`, `docs/execution/WEEKLY_EXECUTION_REVIEW.md`.
- **Optional hardening (small + safe, explicitly invited by the task):** `docs/execution/E47_A12_AI_INTERNAL_PILOT_READINESS_FAILURE_INJECTION_GATE_REPORT.md` (prose `guard_order (8)→(9)` to match the artifact); `apps/server/src/ai/eval/live-smoke/live-smoke.spec.ts` + `chat-adapter-smoke.spec.ts` (persist artifact only on `status==='executed'`).

## What was added
- **Exports now complete** per the contract: `CanonicalEventEnvelopeSchema`, `CanonicalEventEnvelope`, `ConsentPurposeEnum`, `PrivacyClassEnum`, `VisibilityEnum`, `RetentionPolicyEnum`, `ActorTypeEnum`, **`EventSourceEnum`** (alias of the pre-existing `SourceEnum`), `validateEventEnvelope`, `assertNoPIIInMetadata`, **`normalizeLegacyEventEnvelope`**, **`redactEventEnvelopeForArtifact`**.
- **Canonical result shape:** `validateEventEnvelope` now returns `{ ok, value, errors, warnings }` (`valid` kept as a back-compat alias of `ok`); emits a **non-fatal warning** on schemaVersion drift (backward tolerance, ADR §14).
- **Broadened deterministic PII/secret value detectors** (on top of the existing email/phone/key-denylist): JWT, Bearer token, API keys (`sk-/pk-/AIza/ghp/gho/glpat/xoxb`), private-key blocks, DB connection strings (`postgres/mysql/mongodb/redis/mssql...`), **embedded Iranian mobile** (`09…/+98…/0098…`), and **long free-form text**. Reuses the same denylist as `ai/logging/ai-call-log.service.ts` for one consistent policy.
- **`normalizeLegacyEventEnvelope`** — backward-tolerant mapping of the current `UserEvent` shape onto a canonical envelope; infers `source/surface/subject/timestamps/schemaVersion` with explicit **warnings**; **never fabricates consent** (no caller default + no legacy consent ⇒ rejected); **drops untrusted legacy `payload`** (does not copy it into metadata).
- **`redactEventEnvelopeForArtifact`** — deterministic, never-throws, log/artifact-safe redaction (denylisted keys masked, secret/PII substrings scrubbed, structure preserved).
- **`event-envelope.ingest-gate.ts`** — `ingestEventEnvelope(input, options)`: strict canonical → `mode:'canonical'`; `{strict:false}`/`allowLegacy` → legacy normalization → `mode:'legacy-normalized'`; otherwise `mode:'rejected'`. **Pure: no DB write, no network, never throws.** Always returns a redacted, leak-free copy of the input.
- **15 canonical examples** (the 6 required + 6 specified + 3 bonus) spanning every enum value, plus 2 legacy fixtures.
- **Offline contract gate** (`analytics:eval:event-envelope`) writing the redacted artifact.

## What was not changed
No DB schema/migration; no `analytics.service` runtime behavior; no live wiring of the gate; no UI; no recipe/ingredient data; no AI provider behavior (only two test-only artifact-write guards); no destructive retention; no community/public/B2B feature; no R3/R4 status change.

## Schema / migration status
**No DB migration required for E43-A1; code contract and ingest gate only.** The envelope is a code/type contract validated in memory. Adopting it for persistence (additive nullable columns on `UserEvent`, backfill) is a later, additive, Founder-gated step per ADR §9 — not in this task.

## Validation behavior
- Valid → `{ ok:true, value:<CanonicalEventEnvelope>, errors:[], warnings:[…] }` (defaults applied for visibility/privacyClass/retentionPolicy; unknown fields ignored).
- Invalid → `{ ok:false, value:null, errors:[…], warnings:[…] }`. **Never throws** for normal bad input.
- schemaVersion drift (e.g. `1`) → still `ok:true` with a `warnings[]` advisory.

## PII / metadata policy
`assertNoPIIInMetadata` rejects (deterministically): denylisted keys (email/phone/name/address/free-text/secret-ish), and **values** matching email / phone (incl. embedded Iranian) / JWT / Bearer / API-key / private-key / DB-connection-string / long free-text. Allowlist supported. Allowed metadata stays small + structured (`{runId,stepId}`, `{snapshotHash}`, `{experimentArm}`, `{suppressedReason}`, counters/flags). **False-positive safety:** the full server suite stays green (357/361, only R19), proving the shared-guard change did not break AI/cost metadata; the existing clean-fixture tests (`bigNumberId` 19-digit, uuid, hashes) still pass.

## Canonical examples
15 valid envelopes in `event-envelope.examples.ts`: `recipe_viewed`, `cook_complete`, `ai_answer_feedback`, `notif_suppressed`, `cooked_share` (visibility=private), `workflow_run` (actorType=agent) + `recommendation_impression`, `recommendation_dismissed`, `grocery_item_merged`, `consent_granted` (audit-long), `ai_guard_block` (P2-sensitive, audit-long), `admin_diagnostic_view` (admin, audit-long) + bonus `b2b_aggregate_snapshot` (b2b_aggregate), `community_post_published` (public, P0-public), `circle_recipe_share` (circle). Coverage spans every enum value of actorType / source / visibility / consentPurpose / privacyClass / retentionPolicy. All validate `ok` with correct consent/privacy/visibility/retention.

## Ingest gate behavior
- Strict valid → accepted, `mode:'canonical'`.
- Strict invalid (e.g. missing consentPurpose) → rejected, `value:null`, errors populated, redacted copy attached.
- `{strict:false}` legacy → normalized + accepted (`mode:'legacy-normalized'`, warnings emitted) only when consent is supplied/inferable; **legacy without a consent default → rejected** (no silent consent).
- PII-in-metadata → rejected on every path; the rejection's `redacted` copy is leak-free.
- **No DB write / no network** anywhere (pure boundary). Documented 3-phase integration recommendation (log-only → additive migration → enforce) lives in the gate file header — **adoption deferred (Founder-gated)** per E43-W6.

## Artifact validation
`docs/qa/analytics/e43_a1_event_envelope_contract_results.json` (deterministic, fixed `generatedAt`): `runMode: offline-deterministic`, `totalChecks 46 / passed 46 / failed 0`, `categoryBreakdown` (schema 7 · examples 15 · pii 14 · ingest_strict 4 · ingest_legacy 3 · redaction 2 · safety 1), `exampleCount 15`, `piiDetectionSummary {vectors 10, detected 10, missed 0, safeAccepted 4}`, `strictModeSummary`, `legacyNormalizationSummary {legacyCases 2, normalized 2, noSilentConsent true, warningsEmitted 8}`, `dbMigrationRequired false`, `dbWritesDuringGate 0`, `redactedFailureDetails []`, `remainingIntegrationGaps [...]`. No raw PII / metadata / JWT / API-key / Bearer / private-key / connection-string / user text (verified by scan + the gate's own leak-free self-test).

## Static scans
- Secret-pattern scan of `docs/qa/analytics/` → **no matches** (artifact clean).
- Scan of `apps/server/src/analytics/` → matches are **exclusively synthetic test fixtures inside `*.spec.ts`** asserting rejection/redaction (the allowed case); none in production `.ts`, no real secret.
- Domain-term scan (`email/phone/metadata/consentPurpose/privacyClass/retentionPolicy`) → expected vocabulary in schema/guards/eval only; no real PII values.

## Tests / build
| Command | Result |
|---|---|
| `pnpm --dir apps/server analytics:eval:event-envelope` | ✅ 62/62 (2 suites); contract gate 46/46 checks |
| `pnpm --dir apps/server test` (full) | ⚠️ 359/363 — the **4 failures are exactly the known R19 legacy specs** (recipes.service, recipes.controller, feature-store.service, ranking.service); no analytics/event-envelope failure |
| `pnpm build` | ✅ green |

## Adversarial review (4 lenses + synthesis)
Ran a 4-lens adversarial review before commit: **schema-correctness PASS**, **redaction/leak-safety PASS**, **scope-lock/discipline PASS** (zero out-of-scope changes; gate not wired to live path; R3/R4 confirmed Mitigating). The **PII-completeness lens** raised one **blocking** finding (also surfaced by the synthesis): the pre-existing `looksLikePhone` flagged *any* bare 8–15 digit numeric string (token counts, epoch-ms timestamps, numeric ids) as a phone — a false-positive class that could mis-redact legitimate metadata (incl. the shared AI-logging guard if a numeric value were ever stringified). **Folded in:** `looksLikePhone` now requires a phone-formatting separator (space/`+`/`()`/`-`/`.`); bare digit-runs are treated as opaque ids, bare Iranian mobiles remain caught by `IRAN_PHONE_EMBEDDED_RE`, and formatted/separated phones remain caught. Added 2 regression tests (bare numerics pass; formatted + Iranian still rejected). All other lens findings were `info`/`minor` (e.g. AWS `AKIA…` keys not in the value patterns — documented limitation, no AWS integration exists).

## Docs / risk updates
- `docs/README.md`: new "Analytics / Event foundation (E43)" entry + analytics QA artifact link.
- `RISK_REGISTER.md`: E43-A1 change-history entry (strengthens R15 consent/PII-at-ingest, R1 no-secret-in-metadata, R16 typed `subjectId` erasure key); **R3 & R4 explicitly unchanged — Mitigating, not Closed**.
- `WEEKLY_EXECUTION_REVIEW.md`: E43-A1 entry. **No BIP-v1-complete / analytics-fully-migrated claim.**

## Remaining integration gaps
- `analytics.service.trackEvent` still writes the legacy `UserEvent` shape; the gate is **not** wired into the live ingest path (Founder-gated log-only adoption deferred per E43-W6).
- No additive nullable envelope columns on `UserEvent` yet (no DB migration in E43-A1).
- Other producers (AICallLog, RecommendationExposure/Attribution, behavior-engine cron) do not yet emit canonical envelopes.
- `eventType` is not cross-checked against `event-taxonomy.ts` (decoupled for backward tolerance).
- PII detection is deterministic/heuristic (no NLP); policy relies on keeping metadata small + structured.

## Side-effect confirmations
- no live AI default
- no product rollout
- no UI
- no recipe import
- no ingredient change
- no destructive retention/prune/delete
- no community/public/B2B feature enablement
- no R3/R4 closure
- no strategy change

## Stop condition
Stop here. Do not merge. Do not start the next task.
