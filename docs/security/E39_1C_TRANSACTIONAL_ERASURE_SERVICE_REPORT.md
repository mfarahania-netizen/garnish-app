# E39-1C — Transactional Erasure Service — Report

**Date:** 2026-06-13 · **Task:** `E39-1C-TRANSACTIONAL-ERASURE-SERVICE` · **Scope:** backend erasure service + `DELETE /users/me` wiring + targeted tests only.
**Basis:** [`E39_R16_ERASURE_COVERAGE_AUDIT.md`](E39_R16_ERASURE_COVERAGE_AUDIT.md) · [`E39_1A_SCHEMA_REPAIR_REPORT.md`](E39_1A_SCHEMA_REPAIR_REPORT.md) · [`E39_1B_AUDIT_LONG_TOMBSTONE_FOUNDATION_REPORT.md`](E39_1B_AUDIT_LONG_TOMBSTONE_FOUNDATION_REPORT.md).

## Goal
Replace the bare `prisma.user.delete()` behind `DELETE /users/me` with a **safe transactional erasure service** for the current authenticated user: revoke sessions, scrub residual PII on the audit-long records that survive de-linked, write a PII-free proof, then delete the user (Cascade + SetNull). No export endpoint, no retention cron, no UI/AI changes.

## Files changed
- **`apps/server/src/users/erasure/erasure.service.ts`** (new) — `ErasureService.eraseUser(userId, actor?)`, the transactional erasure flow.
- **`apps/server/src/users/erasure/erasure.service.spec.ts`** (new) — 7 targeted unit tests (mocked Prisma).
- **`apps/server/src/users/users.service.ts`** — inject `ErasureService`; `deleteUser` now **delegates** to `eraseUser(userId, { actorType: 'self' })` (bare delete removed).
- **`apps/server/src/users/users.module.ts`** — register + export `ErasureService`.
- **Docs:** this report; audit doc E39-1C section; `RISK_REGISTER.md`; `WEEKLY_EXECUTION_REVIEW.md`.
- **Unchanged:** `users.controller.ts` (`DELETE /users/me` still returns the same fixed PII-free message); `schema.prisma` (no migration — see below).

## No schema migration required
The E39-1B report flagged that SetNull does **not** scrub PII columns on the surviving audit-long rows. Before implementing, every target column was confirmed **already nullable**, so the scrub is done in-transaction with no migration:

| Record (survives de-linked) | Residual-PII columns scrubbed | nullable? |
|---|---|---|
| `ConsentLog` | `ip → null` | yes (357) |
| `UserAuditLog` | `ip → null`, `userAgent → null`, `details → null` | yes (416–418) |
| `DataAccessLog` | `ip → null`, `details → null` | yes (430–431) |

Per the task's "if fields are not nullable and contain PII, STOP and propose a minimal schema patch" — **not triggered**; all fields are nullable, so no schema patch was needed or made.

## Erasure flow (`ErasureService.eraseUser`)
1. **Guard:** `user.findUnique` — if absent, return `{ status: 'not_found', erasureEventId: null, summary: {} }` (idempotent-safe; no transaction, no deletion).
2. **`$transaction`** (all-or-nothing):
   1. **Revoke sessions** — `userSession.deleteMany({ where: { userId } })` (explicit; would also cascade).
   2. **Scrub residual PII** — `updateMany` null-outs on `ConsentLog` / `UserAuditLog` / `DataAccessLog` **while the userId link still exists** (SetNull on delete nulls the FK but not these columns).
   3. **Write proof** — `erasureEvent.create` with `action: 'user_erasure'`, `status: 'completed'`, `reason: 'user_requested'`, non-reversible `subjectHash` (`ErasureAuditService.subjectHash`), and **count-only** metadata (`requestedBy` + scrub counts) — no email/phone/name/raw text.
   4. **Delete the user** — `user.delete({ where: { id } })` **strictly last** → schema **Cascade** removes user-linked data (ChatMessage, UserFact, snapshots, events, signals, …); **SetNull** de-links the audit-long rows (incl. the just-written ErasureEvent, whose `subjectHash` persists as the durable proof reference).
3. **Return** a PII-free summary: `{ status: 'erased', erasureEventId, summary: { sessionsRevoked, consentScrubbed, auditScrubbed, accessScrubbed } }`.

**Cascade reliance (by design):** the service does **not** touch ChatMessage / UserFact / AICallLog explicitly — those are governed by the schema (E39-1A Cascade for ChatMessage/UserFact; E39-1B SetNull tombstone for AICallLog) and resolve on `user.delete()`. A unit test asserts these tables are never called explicitly, so the policy lives in one place (the schema) and can't silently drift.

## Wiring
- `UsersService` constructor now injects `PrismaService` + `ErasureService`; `deleteUser(userId)` → `this.erasureService.eraseUser(userId, { actorType: 'self' })`.
- `UsersController.deleteAccount` (`@Delete('me')`, JWT-guarded) is **unchanged** — it calls `deleteUser` (now transactional) and returns the same fixed message `Account and all associated data permanently deleted.` (discards the result → no PII leak).
- Only one `user.delete()` remains in `src/` — inside `ErasureService` (verified by grep). No other self-delete path.

## Tests / build
- **`erasure.service.spec.ts` — 7 tests (mocked Prisma; `$transaction` invokes the callback with a mock tx client; no real DB, no real deletion):**
  1. Step order is `session → consent → audit → access → event → delete`, with `user.delete` **strictly last**; result shape correct.
  2. Residual-PII scrub args exact (`ConsentLog {ip:null}`; `UserAuditLog {ip,userAgent,details:null}`; `DataAccessLog {ip,details:null}`), all scoped by `userId`.
  3. `ErasureEvent` written with `action/status/reason`, deterministic `subjectHash` (= `ErasureAuditService.subjectHash`), and **count-only** metadata.
  4. Cascade-reliance: `chatMessage` / `userFact` / `aICallLog` are **never** called explicitly.
  5. Result object is PII-free (no `@`, no `password/phone/ip/userAgent`; keys = `erasureEventId/status/summary`).
  6. Missing user → `not_found`, no `$transaction`, no `user.delete`.
  7. `UsersService.deleteUser` **delegates** to `eraseUser(userId, { actorType: 'self' })`.
- `npx jest src/users/erasure` → **12/12 green** (7 new + 5 E39-1B `ErasureAuditService`).
- `npx nest build` → **green** (exit 0).
- Full server suite still gated by pre-existing R19/R20 (unrelated) → ran targeted tests per protocol. **No destructive deletion run against real/manual data.**

## R16 status
**OPEN.** Schema (1A) + tombstone foundation (1B) + **transactional erasure service (1C)** are done. Closing R16 still requires:
- **E39-1D** — `GET /users/me/export` (GDPR Art. 20, consent-gated).
- **E39-1E** — retention crons (ADR-0001: `standard-365d` prune, `audit-long` excluded, `ephemeral-30d` debug).
GDPR erasure (Art. 17) is now functionally implemented for the authenticated user; data-portability + retention remain.

## Confirmation (scope)
- **No GDPR export endpoint. No retention cron. No live Gemini. No UI changes. No recipe/ingredient DB re-import. No unrelated refactor. No AI behavior change. No new product features.**
- **No schema migration** (residual-PII columns already nullable — confirmed before implementing).
- **No destructive deletion against non-test data** — tests use mocked Prisma only.

## Status
**E39-1C transactional erasure service: COMPLETE & VERIFIED** (`ErasureService.eraseUser` wired behind `DELETE /users/me`, residual-PII scrub in-transaction, PII-free `ErasureEvent` proof, 7 tests green, build green). Stopping after this report.
