# E39-1B — Audit-Long Tombstone Foundation — Report

**Date:** 2026-06-13 · **Task:** `E39-1B-AUDIT-LONG-TOMBSTONE-FOUNDATION` · **Scope:** additive schema + foundation service.
**Basis:** [`E39_R16_ERASURE_COVERAGE_AUDIT.md`](E39_R16_ERASURE_COVERAGE_AUDIT.md) · [`E39_1A_SCHEMA_REPAIR_REPORT.md`](E39_1A_SCHEMA_REPAIR_REPORT.md).

## Files changed
- `apps/server/prisma/schema.prisma` — `ConsentLog` + `UserAuditLog` → SetNull (userId nullable); new `ErasureEvent` model; `User.erasureEvents` back-relation.
- `apps/server/prisma/migrations/20260613180000_e39_1b_audit_long_tombstone_foundation/migration.sql` — additive migration (applied).
- `apps/server/src/users/erasure/erasure-audit.service.ts` — foundation `ErasureAuditService` (+ `erasure-audit.service.spec.ts`, 5 tests).
- `apps/server/src/users/users.module.ts` — registers/exports `ErasureAuditService`.
- Docs: this report; audit doc E39-1B section; `RISK_REGISTER.md`; `WEEKLY_EXECUTION_REVIEW.md`.
- **No** deletion flow, **no** export endpoint, **no** retention cron, **no** UI/AI/data changes; `deleteUser` untouched.

## Audit / compliance models inspected
| Model | user relation (before) | onDelete (before) | PII risk | audit-long? | action |
|-------|------------------------|-------------------|----------|-------------|--------|
| ConsentLog | `user User` (required) | **Cascade** | low (userId/type/purpose/ip) | **yes** (consent proof) | → **SetNull** (survive de-linked) |
| UserAuditLog | `user User` (required) | **Cascade** | **yes (ip/userAgent)** | **yes** (audit evidence) | → **SetNull** (survive de-linked); PII-field scrub = E39-1C |
| DataAccessLog | `user User?` | SetNull | yes (ip) | yes | already correct — no change |
| AICallLog | `user User?` | SetNull | metadata PII-guarded | yes | already correct — no change |
| UserSession | `user User` | Cascade (E39-1A) | yes (ip/device) | no (transient) | delete on erasure — correct |
| UserEvent | `user User` | Cascade (E39-1A) | yes (behavior) | no | delete on erasure — correct |

## Chosen tombstone strategy
**Combined B + A (most conservative, additive):**
- **(B) New `ErasureEvent` ledger** — the canonical, **PII-free** proof-of-erasure record. `userId` SetNull (de-links on deletion) + durable **`subjectHash` = sha256(salt + userId)** (non-reversible reference that survives). Written by E39-1C.
- **(A) ConsentLog + UserAuditLog → SetNull** (userId nullable) — consent/audit history **survives** user deletion de-linked, instead of cascade-vanishing (preserving the proof the audit flagged as at-risk).

## Models / fields added or changed
- **`ErasureEvent`** (new): `id`, `userId String?` (FK→User SetNull), `subjectHash`, `action`, `status`, `reason?`, `metadata Json` (PII-free), `createdAt`; indexes `(subjectHash, createdAt)`, `(action, status)`. `User.erasureEvents` back-relation.
- **`ConsentLog`**: `userId String` → `String?`; `user User` → `User?` with `onDelete: SetNull`.
- **`UserAuditLog`**: `userId String` → `String?`; `user User` → `User?` with `onDelete: SetNull`.

## Generated SQL summary
2 `DROP CONSTRAINT` + 3 `ADD CONSTRAINT` (ConsentLog/UserAuditLog re-added as SetNull; ErasureEvent FK), 2 `ALTER COLUMN … DROP NOT NULL` (safe widening), 1 `CREATE TABLE "ErasureEvent"` + 2 `CREATE INDEX`. **No `DROP TABLE` / `DROP COLUMN` / `DELETE` / `TRUNCATE` / `DROP DEFAULT`.** Inspected before applying.

## Migration name / applied
`20260613180000_e39_1b_audit_long_tombstone_foundation` — **applied** (`migrate deploy`); `migrate status` = "Database schema is up to date!".

## Tests / build
- `ErasureAuditService` spec: **5 tests pass** (subjectHash non-reversible + deterministic; PII metadata redacted; reason capped; clean metadata passthrough; null-userId handling).
- `prisma generate`: client types include `erasureEvent` (a same-version native-engine rebind hit the known Windows EPERM because the dev backend holds the binary — **types regenerated, harmless**; not killed per the port-clash directive). `nest build` → **green**.
- **Structural proof (read-only):** 36 FKs reference `User` → 30 Cascade + 6 SetNull (ConsentLog, UserAuditLog, ErasureEvent, DataAccessLog, AICallLog, Recipe.author), **0 Restrict/No-Action** → audit-long records survive de-linked; deletion still not blocked. No user deletion executed.

## How PII is avoided
- `ErasureEvent` stores **no** email/phone/name/raw profile/JWT/session/secret — only `subjectHash` (sha256), action/status/reason (capped), and **PII-checked** metadata (`assertNoPIIInMetadata` → redacted to `{redacted, reason}` on violation).
- `subjectHash` is non-reversible; the raw `userId` (an opaque UUID) is held only in the active `userId` FK column, which SetNulls on deletion.

## How erasure proof will survive deletion
On user deletion (future E39-1C): the `User` row is deleted → `ErasureEvent.userId`, `ConsentLog.userId`, `UserAuditLog.userId` are **SetNull** (rows persist) while `ErasureEvent.subjectHash` remains as the durable, non-reversible reference. Thus "this subject's data was erased, when, and that consent existed" is provable without retaining the user link.

## Remaining gaps for E39-1C (transactional erasure service)
1. Replace bare `deleteUser` with a **`$transaction`** that: writes an `ErasureEvent` (`requested`→`completed`), deletes/anonymizes user data, and **scrubs residual PII** on retained audit-long rows (e.g. null `UserAuditLog.ip/userAgent`, `ConsentLog.ip`).
2. `GET /users/me/export` (GDPR Art. 20).
3. Retention crons (ADR-0001).
4. e2e erasure test (isolated DB): assert no throw, 0 orphan rows, AICallLog/ConsentLog/UserAuditLog tombstoned (userId null), `ErasureEvent` written.

## R16 status
**OPEN.** Schema structure (1A) + audit-long tombstone foundation (1B) are done; closing requires the transactional erasure service + residual-PII scrub + export + retention (E39-1C). Still a G1/beta blocker; GDPR erasure is **not** complete.

## Confirmation (scope)
- **No UI changes. No live Gemini. No recipe/ingredient re-import. No real data deletion. No export endpoint. No retention cron. No full erasure service yet. No unrelated refactor.**
- `deleteUser` untouched; `ErasureAuditService` is foundation-only (records events; deletes nothing).

## Status
**E39-1B audit-long tombstone foundation: COMPLETE & VERIFIED** (additive migration applied, ErasureEvent + ConsentLog/UserAuditLog SetNull, 5 tests green, build green, 0 blocking FKs). Stopping after this report.
