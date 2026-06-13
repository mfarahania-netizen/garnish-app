# E43-W6 — Event Envelope Code Contract — Report

**Date:** 2026-06-13 · **Task:** `E43-W6-EVENT-ENVELOPE-CODE-CONTRACT` · **Branch:** `master`
· **Authority:** Constitution A1.4 + `docs/adr/ADR-0001-canonical-event-envelope.md` (schemaVersion 2).

> Goal: a typed, testable canonical event envelope schema + validation layer + PII guard for future BIP,
> AI logs, recommendation, notification, WAT, GDPR export/erasure, and analytics ingestion. Infrastructure
> only — **no UI, no AI Core, no BIP predictions, no ranking changes, no DB migration.**

---

## 1. Files changed
| File | Action |
|------|--------|
| `apps/server/src/analytics/event-envelope.schema.ts` | **created** — the code contract (types, enums, schema descriptor, validator, PII guard) |
| `apps/server/src/analytics/event-envelope.schema.spec.ts` | **created** — 32 tests (8 canonical examples + accept/reject/PII/backward-tolerance) |

No other module modified. The `analytics/` directory uses direct imports (no barrel/`index.ts`), so **no export-index change was required** (per the "only if the project pattern requires it" rule). No unrelated files touched.

## 2. Exports created (all required exports present)
- `CanonicalEventEnvelopeSchema` — machine-readable contract descriptor (`schemaVersion: 2`, `backwardTolerant: true`, per-field rules).
- `CanonicalEventEnvelope` — the TypeScript interface for a normalized envelope.
- `ConsentPurposeEnum`, `PrivacyClassEnum`, `VisibilityEnum`, `RetentionPolicyEnum` — plus `ActorTypeEnum`, `SourceEnum`.
- `validateEventEnvelope(input, options?)` — backward-tolerant, never-throwing validator returning `{ valid, value, errors[] }`.
- `assertNoPIIInMetadata(metadata, options?)` — throws `PIIDetectedError` (also exported) on PII; no-op when clean.
- Supporting types: `ActorType`, `Source`, `Visibility`, `ConsentPurpose`, `PrivacyClass`, `RetentionPolicy`, `EnvelopeValidationIssue`, `EnvelopeValidationResult`.

**Implementation choice:** zero external dependency (no zod/joi added). Dependency choices are an EL/Founder call; this mirrors the existing zero-dep `config/env.validation.ts`. Uses only TypeScript + the already-present toolchain.

## 3. Schema summary (mirrors ADR-0001 §4)
Required: `eventId`, `eventType`, `actorType` (user|system|agent|admin), `actorId`, `source` (web-pwa|server|cron|ops-workflow), `consentPurpose` (core|analytics|personalization|b2b_aggregate|community), `schemaVersion` (positive int), `occurredAt`, `receivedAt` (ISO-8601).
Conditional: `surface` **required when `source === 'web-pwa'`** (optional otherwise); `subjectType`/`subjectId` and `objectType`/`objectId` are optional but **paired** (both-or-neither).
Optional with defaults applied: `visibility` → `private`, `privacyClass` → `P1-pseudonymous`, `retentionPolicy` → `standard-365d`.
Optional structured JSON: `context` (object), `metadata` (object, **PII-free**).
**Backward tolerance (ADR §14):** unknown input fields are ignored; missing defaulted fields are filled; but missing **required** fields and bad enum values still fail (unknown fields never rescue an invalid event). `consentPurpose` has **no default** → missing it is an error.

## 4. PII guard behavior (`assertNoPIIInMetadata`) — deterministic, no NLP (ADR §6)
- **Key denylist** (normalized: lowercased, separators stripped, so `phone_number`/`phoneNumber`/`e-mail` all match): contact (email/phone/mobile/tel/fax/whatsapp), address/location (address/postalCode/geo/lat/lng/coordinates), identity (name/fullName/firstName/lastName/username/displayName/nickname), free user text (messageText/rawText/text/note/comment/content/body/description/bio), and high-risk secrets (ssn/nationalId/passport/creditCard/cvv/iban/ip/password/secret/apiKey/token).
- **Value scan** (every string, recursively through objects/arrays): rejects email-pattern values and phone-like values (8–15 digits made only of phone glyphs — so UUIDs, alphanumeric ids, and >15-digit numbers do **not** false-positive).
- **Allowlist**: `{ allowlist: [...] }` exempts specific (normalized) keys that legitimately collide with the denylist (e.g. a non-PII `name`).
- On violation: throws `PIIDetectedError` carrying `issues[]` with exact paths (e.g. `metadata.a.email`). `validateEventEnvelope` calls it internally and folds any PII issues into `errors` (so validation returns `valid:false` rather than throwing).

## 5. Test cases added (32 tests, all passing)
- **8 canonical examples** (ADR §10): `recipe_viewed`, `cook_complete`, `ai_answer_feedback`, `notif_suppressed`, `cooked_share` (visibility=private), `workflow_run` (actorType=agent) — all valid; plus **(7) invalid: missing `consentPurpose`** and **(8) invalid: PII in metadata**.
- `validateEventEnvelope` **accepts** all valid examples; applies defaults; preserves provided enums + paired ids.
- `validateEventEnvelope` **rejects**: missing identity fields, bad `actorType`/`source` enums, `web-pwa` without `surface` (and confirms cron/ops-workflow don't need surface), non-positive/non-integer `schemaVersion`, malformed timestamps, unpaired subject/object, invalid visibility/privacyClass/retentionPolicy, non-object root/metadata/context.
- `assertNoPIIInMetadata`: catches denylisted keys (email/phone/name/address/messageText/rawText), email/phone **values**, raw free-text keys, nested PII; does **not** false-positive on ids/hashes/UUIDs/long numerics; honors the allowlist; exposes offending paths.
- **Backward tolerance**: unknown extra fields ignored (still valid); an unknown field does **not** rescue a missing required field.

## 6. Test result
`pnpm --dir apps/server exec jest src/analytics/event-envelope.schema.spec.ts` → **Test Suites: 1 passed; Tests: 32 passed, 0 failed.**

> Targeted run by design: the **full server suite remains blocked by pre-existing failures (R19)** — 4 unrelated specs (`recipes.controller`/`recipes.service` DI, `ranking.service:192`, `feature-store` mock) and lint/format debt (R20). Those are tracked, CI-non-blocking, and out of scope here; this new spec is fully green on its own.

## 7. Build result
`pnpm --filter ./apps/server run build` (`nest build`) → **green**, no errors. Compiled artifact present at `dist/src/analytics/event-envelope.schema.js`.

## 8. DB migration
**None made.** This is a pure code contract. The DB (`UserEvent`: id/userId/type/timestamp/sessionId/page/duration/payload/enrichment) is unchanged. Per ADR §9 / the task's migration rule, adopting the envelope at ingest will require an **additive, nullable** migration (new envelope columns on `UserEvent`) — that is **proposed, not executed**, and is **gated on Founder approval** (see §10). No breaking migration; no requirement that existing events conform immediately.

## 9. Remaining risks
- **Not yet wired into ingestion.** The contract exists but `analytics.service`/ingest does not call `validateEventEnvelope` yet — adopting it is the next step (and should start in **log-only / non-rejecting** mode).
- **`eventType` not cross-checked against the taxonomy.** Validator requires a non-empty snake_case string but does not (yet) enforce membership in `event-taxonomy.ts` (kept decoupled for backward tolerance). A future option: a soft-warn check against the taxonomy enum.
- **PII guard is heuristic by design** (deterministic key/email/phone rules, no NLP). It will not catch personal data hidden in innocuously-named free-form values; the real defense remains "don't put free user text in metadata." Denylist/allowlist may need tuning as real metadata shapes appear.
- **Consent-subset enforcement is downstream.** The contract validates that `consentPurpose` is a valid enum; checking it against the user's *active* consents (ConsentLog) happens at ingest, not here (ADR §7).

## 10. Exact next recommended infrastructure task
**`E43-W6.2 — Envelope ingest adoption (log-only) + additive migration proposal`:**
1. Wire `validateEventEnvelope` into `analytics.service` ingest in **log-only mode** (record validation failures via metrics/logs; do **not** reject events yet) so we measure conformance without breaking current flows.
2. Author (but do not apply) an **additive, nullable** Prisma migration adding the envelope columns to `UserEvent` (`eventId`, `actorType`, `actorId`, `subjectType/Id`, `objectType/Id`, `context`, `source`, `surface`, `visibility`, `consentPurpose`, `schemaVersion`, `occurredAt`/`receivedAt`, `metadata`, `privacyClass`, `retentionPolicy`) + backfill defaults — **submit for Founder approval before running** (no breaking migration before W13, ADR §9).
3. Only after migration + backfill: flip ingest validation to **reject** invalid new events, and enforce `consentPurpose ⊆ active ConsentLog`.

(Alternative if the Founder prefers a different sequence: E7 error/logging hardening or the R19 spec-fix ticket to unblock the full test gate.)

## 11. Status
**E43-W6 code contract: COMPLETE & VERIFIED** (32 tests green, build green, no DB change). Stopping per directive after this report.
