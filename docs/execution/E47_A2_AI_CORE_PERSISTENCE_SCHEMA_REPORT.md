# E47-A2 — AI Core Persistence Schema — Report

**Date:** 2026-06-13 · **Task:** `E47-A2-AI-CORE-PERSISTENCE-SCHEMA` · **Branch:** `master`
· **Authority:** Constitution E47 (AI Core auditability).

> Goal: add **minimal, additive** Prisma persistence for AI Core (AICallLog, ChatMessage, UserFact) and
> make AICallLog **database-backed**, without changing product scope. No Gemini, no live LLM, no legacy
> chat routing, no autonomous agents, no vision, no medical advice, no UI.

---

## 1. Files changed
**Schema / migration:**
- `apps/server/prisma/schema.prisma` — added 3 models + 3 back-relations on `User` (virtual, no column change on `User`).
- `apps/server/prisma/migrations/20260613150000_add_ai_core_persistence/migration.sql` — new additive migration (applied).

**Code (modified):**
- `apps/server/src/ai/logging/ai-call-log.service.ts` — **replaced the in-memory sink with DB-backed persistence** (`prisma.aICallLog.create`), with metadata PII-redaction + error sanitization; never throws.
- `apps/server/src/ai/orchestrator/ai-orchestrator.service.ts` — `finish()` is now async and persists a record on **every** terminal path; passes provider, split input/output tokens, sanitized error code/message, and conversationId.
- `apps/server/src/ai/ai-core.module.ts` — imports `PrismaModule`; registers `ChatMessageService` + `UserFactService`.
- `apps/server/src/ai/ai-core.types.ts` — added `conversationId` to `AiCallRequest`; removed the obsolete in-memory `AICallRecord` type.

**Code (created):**
- `apps/server/src/ai/chat/chat-message.service.ts` — minimal ChatMessage create/list (role-validated).
- `apps/server/src/ai/facts/user-fact.service.ts` — UserFact upsert/get/list with a **sensitive-key guard** (rejects health/medical/allergy keys).
- Specs: `logging/ai-call-log.service.spec.ts`, `chat/chat-message.service.spec.ts`, `facts/user-fact.service.spec.ts`; updated `orchestrator/ai-orchestrator.service.spec.ts`.

No UI/admin/recipe/ingredient/migration-import files touched.

## 2. Prisma models added / modified
**Added (3):**
- **`AICallLog`** — `id`, `userId?` (FK→User, `onDelete: SetNull` so audit survives erasure / tombstones), `eventId?`, `conversationId?`, `surface?`, `model`, `provider`, `status`, `latencyMs?`, `estimatedInputTokens?`, `estimatedOutputTokens?`, `estimatedCost?`, `guardHits Json`, `toolCalls Json`, `metadata Json`, `errorCode?`, `errorMessage?`, `createdAt`. Indexes: `(userId, createdAt)`, `(status)`, `(conversationId)`.
- **`ChatMessage`** — `id`, `userId` (FK→User, `onDelete: Cascade`), `conversationId`, `role`, `content`, `contentSafetyStatus?`, `model?`, `aiCallLogId?`, `createdAt`. Indexes: `(userId, createdAt)`, `(conversationId, createdAt)`.
- **`UserFact`** — `id`, `userId` (FK→User, `onDelete: Cascade`), `key`, `value Json`, `source`, `confidence?`, `expiresAt?`, `createdAt`, `updatedAt`. Unique `(userId, key)`; index `(userId)`.

**Modified:** `User` gained 3 virtual back-relations (`aiCallLogs`, `chatMessages`, `userFacts`) — proper relations (avoiding the R16 missing-FK pattern). No existing model/column altered; no existing chat/fact table existed (no duplication).

## 3. Migration
- **Name:** `20260613150000_add_ai_core_persistence`.
- **Generated** via `prisma migrate diff` (live DB → schema) and **applied** with `prisma migrate deploy` (production-safe; **no reset**). The DB was confirmed in-sync (`migrate status` = "up to date") before and after. `prisma generate` succeeded (new delegates `aICallLog`/`chatMessage`/`userFact` present).
- **Additive only?** **Yes** — SQL is `CREATE TABLE` ×3 + `CREATE INDEX` + `ADD FOREIGN KEY` on the new tables only. No `DROP`/`ALTER COLUMN`/`DELETE`/`TRUNCATE`. No required backfill; all new columns are nullable or defaulted. No conflict with existing data.
- **Rollback:** Prisma is forward-only (the repo keeps no down-migrations, matching convention). Manual rollback if ever needed: `DROP TABLE "UserFact","ChatMessage","AICallLog" CASCADE;` (drops the 3 new tables + their FKs; no other table is affected).

## 4. Persistence behavior
- **AICallLog** is written for **every** orchestrator terminal path — success (`ok`) and all blocked statuses (`blocked_injection`/`blocked_cost`/`blocked_safety`/`blocked_nutrition`) and `error`. `guardHits` and `toolCalls` are stored as **JSON arrays**.
- **Privacy in logging:** `metadata` is checked with `assertNoPIIInMetadata` (the event-envelope PII guard); if PII is detected it is **redacted** (`{ redacted: true, reason: 'pii_detected' }`), never stored raw. `errorMessage` is **sanitized** (emails / API keys `sk-`/`AIza`/`ghp` / `Bearer` / JWT redacted; length-capped to 500). **Prompt text is never persisted.** A DB write failure is swallowed (logged) so auditing never breaks the AI call.
- **ChatMessage:** minimal create/list; role validated to `user|assistant|system|tool`.
- **UserFact:** upsert of **non-sensitive** facts only; keys matching health/medical/allergy/diabetes/etc. patterns are **rejected** (`SensitiveFactRejectedError`) — no health inference in A2.
- Orchestrator still **fails fast** (throws `MissingBehavioralContextError`) when the snapshot is missing/invalid — and in that case **nothing is persisted** and the model is not called.

## 5. Tests added & results
**9 AI Core spec suites, 35 tests, all passing**, no live LLM, no DB needed (Prisma mocked):
- Orchestrator (DB-backed): fail-fast persists nothing + no model call; **persists a successful call** (asserts `aICallLog.create` with status `ok`, provider/model, split tokens, JSON guard/tool arrays, latency); **persists blocked** cost / injection / safety / nutrition calls (each asserts the persisted `status`).
- AICallLog service: persists success + blocked; **PII metadata redacted** (email not stored); clean metadata passes through; **errorMessage sanitized** (email + key redacted); never throws on DB failure.
- ChatMessage: create (role-valid), reject invalid role, list-by-conversation ordering.
- UserFact: upsert non-sensitive; **reject sensitive keys** (allergy/health/medical/diabetes/blood-pressure); get + list.
- Tool Registry still exposes **exactly the four** approved tools; guards + cost specs unchanged and green.

**Result:** `Test Suites: 9 passed; Tests: 35 passed.` (`prisma migrate deploy` + `prisma generate` succeeded.)

## 6. Build result
- `prisma generate` → success (after stopping the dev backend that held the Windows query-engine lock; see §8). `prisma migrate status` → "up to date".
- `pnpm --filter ./apps/server run build` (`nest build`) → **green**. Full `pnpm build` (turbo web + server) → green.
- Full server test suite remains blocked by pre-existing **R19/R20** (unrelated; kept open). The AI Core specs are green on their own.

## 7. PII / privacy risks
- **AICallLog metadata**: guarded by `assertNoPIIInMetadata` + redaction — low risk. The denylist is heuristic (no NLP), so an unusually-named free-text value could slip through; mitigated by the orchestrator only ever passing guard-category `reasons` (safe labels) into metadata today.
- **errorMessage**: sanitized + capped, but is heuristic; provider error strings should be reviewed as real providers are added (A3).
- **ChatMessage.content** stores message text by design (chat needs it). A1/A2 do not yet route real chat through it (A3); `contentSafetyStatus` is the hook to mark guarded content. No medical/vision claim expansion.
- **UserFact** stores only non-sensitive preference facts (sensitive keys rejected); GDPR erasure is covered by `onDelete: Cascade` for ChatMessage/UserFact and `SetNull` tombstoning for AICallLog.

## 8. What remains for E47-A3
- Wire `ChatMessageService` into the chat flow and link each assistant message to its `AICallLog` (`aiCallLogId`); route the **legacy** `AiService`/chat path through the orchestrator.
- Swap `StubModelProvider` for the real **Gemini** provider behind the same interface (streaming for chat only); fill `estimatedCost` via a cost table.
- Populate `eventId` by emitting a canonical event envelope per AI call; hydrate `BehavioralContextSnapshot` from the behavior engine; enforce `consentPurpose ⊆ active consents`.
- Add limited RAG/retrieval + FactStore reads; eval-suite gate (unsafe < 0.1%).
- Operational note: the local dev **backend was stopped** to release the Prisma engine lock for `prisma generate`; restart with the dev script when resuming local work.

## 9. Confirmation (scope)
- **No Gemini provider wired** (stub model only). **No live LLM call** (tests mock Prisma + model).
- **No autonomous agents**, **no multi-agent/LangGraph**, **no vision**, **no medical/diet advice** (guards still block these).
- **No legacy chat routing yet.** **No UI changes. No admin changes.** **No recipe/ingredient re-import.**
- **Migration is additive only**; no destructive change; no required backfill.

## 10. Status
**E47-A2 AI Core persistence schema: COMPLETE & VERIFIED** (additive migration applied, 35 tests green, build green). Stopping after this report.
