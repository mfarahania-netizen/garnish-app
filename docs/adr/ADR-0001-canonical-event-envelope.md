# ADR-0001 — Canonical Event Envelope

- **Status:** Accepted (design). Code contract (`event-envelope.schema.ts`) lands in W6 per Constitution A1.4.
- **Date:** 2026-06-13
- **Owner:** BA (Accountable) / EL (Responsible)
- **Source:** Constitution Part 4 + Amendment A1.4 (v4§8 PII-free policy).
- **Supersedes:** nothing. **Additive** to the existing `event-taxonomy.ts` (100+ eventTypes stay).

> This ADR is the design of record. It introduces no new strategy; it makes Part 4 implementable and
> testable. It does **not** itself add columns or change ingestion — those are the W6 deliverables it
> references.

## 1. Context
The product already emits 100+ event types via `apps/server/src/analytics/event-taxonomy.ts` and
persists them to `UserEvent`. As BIP, AI Core, Recommendation, INE, Community, B2B, and WAT layers come
online, every one of them needs to read/write events with consistent **identity, privacy, consent, and
retention** semantics. Today those semantics are implicit and per-call, which blocks safe aggregation
(K-anonymity), GDPR erasure, and cross-layer analytics.

## 2. Problem
We need one packet shape that:
- preserves the existing eventTypes (no breaking change),
- carries who/what/where each event is about,
- encodes consent purpose, privacy class, and retention so downstream pipelines can enforce policy
  mechanically (e.g. only `b2b_aggregate` + `privacyClass ≤ P1` enter the K≥100 line),
- keeps metadata **free of PII**, and
- is versioned and backward-tolerant.

## 3. Decision
Adopt a single **Canonical Event Envelope** (`schemaVersion: 2`) as the shape for all events going
forward. It is a **superset** of the current shape — new fields are added via additive migration; readers
are backward-tolerant. The taxonomy enum remains the single source of `eventType`.

## 4. Schema (full)
| Field | Type | Rule |
|-------|------|------|
| `eventId` | UUIDv7 | time-ordered; idempotency key in ingest |
| `eventType` | enum (taxonomy) | snake_case; new type = PR on the enum with BA approval |
| `actorType` | `user`\|`system`\|`agent`\|`admin` | separates human from automated (needed for WAT/eval) |
| `actorId` | string | for agent = `ops:<workflowId>`; for system = service name |
| `subjectType` / `subjectId` | string | "about whom" — usually a user; basis of erasure |
| `objectType` / `objectId` | string | the target object: recipe/plan/list/notif/post/submission… |
| `context` | JSON | small structured slot: `{ meal?, slot?, circleId?, experimentArm? }` (keys documented in docs/events) |
| `source` | `web-pwa`\|`server`\|`cron`\|`ops-workflow` | origin |
| `surface` | string | product surface (home/briefing/planner/cook_mode/grocery/chat/onboarding/admin…) |
| `visibility` | `private`(default)\|`circle`\|`public` | `circle`/`public` only C1+; analytics over `private` is aggregated-only |
| `consentPurpose` | `core`\|`analytics`\|`personalization`\|`b2b_aggregate`\|`community` | must be a subset of the user's active consents, else ingest rejects |
| `schemaVersion` | integer | this doc = `2`; readers backward-tolerant |
| `occurredAt` / `receivedAt` | ISO timestamp | client time / server time (skew + PWA offline detection) |
| `metadata` | JSON | **free, but PII-free**; for WAT: `{ runId, stepId }` |
| `privacyClass` | `P0-public`\|`P1-pseudonymous`(default)\|`P2-sensitive` | sensitive = allergy/health-goal; drives aggregation path |
| `retentionPolicy` | `standard-365d`(default)\|`audit-long`\|`ephemeral-30d` | per-type policy table in docs |

## 5. Field definitions
See the table above. `subjectId` is the GDPR erasure key. `actorId` for agents is namespaced `ops:*`.
`context` keys are an allow-list maintained in `docs/events`.

## 6. Privacy rules
- `metadata` MUST NOT contain PII (no name/phone/email/free user text). Ingest rejects or flags
  violations (`assertNoPIIInMetadata`).
- `privacyClass` defaults to `P1-pseudonymous`. `P2-sensitive` (allergy/health-goal) never enters
  individual comparison or B2B aggregation.

## 7. Consent rules
- `consentPurpose` must be a subset of the user's **active** consents (ConsentLog) or ingest rejects
  the event (v4§5-rule5). Consent purposes: `core` (always), `analytics`, `personalization`,
  `b2b_aggregate`, `community`.

## 8. Retention rules
- `standard-365d` (default) — pruned by the existing 365-day cron.
- `audit-long` — ModerationAction / consent / erasure logs; append-only, **excluded** from the cron.
- `ephemeral-30d` — debug.

## 9. Migration strategy (additive only — A1.4)
1. Add new columns **nullable**. 2. Backfill defaults. 3. Switch ingest validation on. 4. Make fields
required **only after** existing flows are migrated. 5. **No breaking migration before W13.**

## 10. Examples
1. **recipe_viewed** — `{ actorType:'user', subjectType:'user', objectType:'recipe', surface:'home', consentPurpose:'analytics', privacyClass:'P1-pseudonymous', retentionPolicy:'standard-365d' }`
2. **cook_complete** — `{ actorType:'user', objectType:'recipe', surface:'cook_mode', consentPurpose:'core', privacyClass:'P1-pseudonymous' }`
3. **ai_answer_feedback** — `{ actorType:'user', objectType:'ai_message', surface:'chat', consentPurpose:'personalization', metadata:{ snapshotHash:'…' } }`
4. **notif_suppressed** — `{ actorType:'system', objectType:'notif', source:'cron', consentPurpose:'core', metadata:{ reason:'fatigue' } }`
5. **cooked_share** — `{ actorType:'user', objectType:'post', visibility:'private', consentPurpose:'community' }`
6. **workflow_run** — `{ actorType:'agent', actorId:'ops:meal-suggest', source:'ops-workflow', consentPurpose:'core', metadata:{ runId:'…', stepId:'…' } }`

## 11. Rejected options
- Free metadata with no rule → rejected (PII/erasure risk).
- Separate community event schema → rejected (fragments the pipeline).
- Separate WAT logs → rejected (use the same envelope with `actorType:agent`).
- Events without versioning → rejected (no backward tolerance).

## 12. Consequences
- BIP reads only the envelope; `visibility:private` never enters individual comparison.
- AI Core links each `AICallLog` to a source `eventId`; `ai_guard_block` is its own system event.
- B2B aggregation reads only `consentPurpose:b2b_aggregate` + `privacyClass ≤ P1` into the K≥100 line.
- GDPR erasure deletes by `subjectId` (audit-long rows tombstone the `subjectId`).

## 13. Owner
BA (Accountable) / EL (Responsible).

## 14. Versioning policy
`schemaVersion` is a positive integer (this doc = 2). Readers are backward-tolerant: unknown fields are
ignored, missing optional fields use defaults. Bumping `schemaVersion` requires EL + F sign-off (RACI).

---
**Code contract (W6):** `apps/server/src/analytics/event-envelope.schema.ts` will export
`CanonicalEventEnvelopeSchema`, `CanonicalEventEnvelope`, `ConsentPurposeEnum`, `PrivacyClassEnum`,
`VisibilityEnum`, `RetentionPolicyEnum`, `validateEventEnvelope(input)`, `assertNoPIIInMetadata(metadata)`.
