# E47-A10A — Persisted AI Cost/Usage Ledger (R3 mitigation)

**Task:** E47-A10A-PERSISTED-AI-COST-LEDGER-R3-MITIGATION · **Date:** 2026-06-14 · **Owner:** AA / EL
**Branch:** `exec/e47-a10a-cost-ledger` (not merged — awaiting acceptance) · **Master baseline:** `331788bb`
**Scope:** durable per-AI-call usage/cost accounting to mitigate **R3**. **Not** billing, **not** monetization, **not** product enablement — a safety/governance cost-control foundation.

---

## ✅ Final verdict: `E47_A10A_AI_COST_LEDGER_PASS`

Every orchestrator terminal path now writes durable usage/cost ledger fields onto the `AICallLog` row, with honest token provenance (`provider`/`estimated`/`unavailable`) and **no fabricated cost** (`estimatedCost` stays null until a per-model rate table exists). Erasure stays compatible (ledger lives on the existing SetNull `AICallLog`). **R3 → Mitigating** (durable usage accounting persisted); it stays open-for-closure because precise cost metering and a *persisted* per-user daily budget are intentionally deferred.

---

## 1. Existing cost-controller findings (before A10A)
| Question | Finding |
|----------|---------|
| Per-call token cap | **8000** (`AiCostControllerService`, `DEFAULT_PER_CALL_TOKEN_LIMIT`) |
| Per-user token cap | **200000** |
| Limits in-memory or persisted? | **In-memory only** (`Map<userId, tokens>`); not persisted; not actually per-day (process-lifetime) |
| Usage estimated or provider-returned? | Estimated by default; Gemini `usageMetadata` was partially read (prompt/candidates/total) but **provenance was not tracked** |
| Did AICallLog store usage/cost? | Partially — `estimatedInputTokens`, `estimatedOutputTokens`, `estimatedCost` (always null); **no** `totalTokens`/`usageSource`/`costIsEstimated`/`currency`/`schemaVersion` |

## 2. Schema / migration summary
**Approach: extend `AICallLog`** (it already *is* the per-call accounting row; `userId` is `onDelete: SetNull` → erasure-safe; written on every terminal path). No new table → no duplication, inherits erasure-safety.

Migration `20260614000000_e47_a10a_ai_cost_ledger` — **additive only** (inspected before applying; `migrate deploy` clean; `migrate status` = up to date):
```sql
ALTER TABLE "AICallLog" ADD COLUMN "costIsEstimated" BOOLEAN, ADD COLUMN "costSchemaVersion" INTEGER,
  ADD COLUMN "currency" TEXT, ADD COLUMN "totalTokens" INTEGER, ADD COLUMN "usageSource" TEXT;
CREATE INDEX "AICallLog_provider_model_createdAt_idx" ON "AICallLog"("provider","model","createdAt");
```
No DROP / DELETE / TRUNCATE / reset. (`prisma generate` hit a transient Windows `EPERM` on the runtime DLL rename, but the **TS client types regenerated** with all new fields and the existing v5.22.0 engine is identical — build/tests/queries all pass.)

## 3. Ledger model / fields (on `AICallLog`)
Existing + new (all nullable, additive): `userId` (SetNull), `aiCallLogId`=row id, `provider`, `model`, `surface`, `status`, `estimatedInputTokens`, `estimatedOutputTokens`, **`totalTokens`**, **`usageSource`** (`provider`|`estimated`|`unavailable`), `estimatedCost` (=estimatedCostUsd, null until rates), **`costIsEstimated`**, **`currency`** (`USD`), **`costSchemaVersion`** (1), `latencyMs` + `createdAt` (timing), `metadata` (PII-guarded), `errorCode`/`errorMessage` (sanitized).

## 4. Cost policy (`src/ai/cost/ai-cost-policy.ts`)
`perRequestMaxTokens` (8000), `perUserDailyMaxTokens` (200000), `currency` (USD), `modelRatesUsdPer1k` (**empty placeholder** → no cost computed), `liveModelAllowed` (env-gated, default false), `schemaVersion` (1). `estimateCostUsd()` returns a number **only** when a per-model rate exists, else **null** (no faked precision). The in-memory `AiCostControllerService` now sources its default limits from this policy (single source of truth). **No paid billing / no subscription logic.**

## 5. Runtime integration points
`AiOrchestratorService.finish()` computes ledger fields for **every** terminal path and passes them to `AiCallLogService.record()`:
- **ok** → provider/estimated usage, `totalTokens`, `usageSource` from the provider, `estimatedCost` via policy (null), `costIsEstimated=true`.
- **blocked_injection / blocked_safety / blocked_cost** (pre-provider) → `usageSource='unavailable'`, no tokens, no cost.
- **error** (provider call attempted) → `usageSource='unavailable'`, sanitized error, null cost.
- **blocked_nutrition** (post-provider) → records the **attempted** provider usage.
`AiCallLogService.record()` persists the new fields and **never throws** (swallows DB failure → returns null id).

## 6. Usage / cost estimation policy
- Token provenance: `provider` (real Gemini `usageMetadata`), `estimated` (stub or missing metadata, conservative char/4), or `unavailable` (no provider call).
- Cost: `estimatedCost` = null unless a per-model rate is configured (none today) → `costIsEstimated=true`. **No invented precision.**

## 7. Tests / build results
- **AI unit suite: 100/100 (18 suites)** — incl. new `ai-cost-ledger.spec.ts` (**12** tests) and the cost-policy tests.
- Deterministic eval gate: green (within the suite).
- Chat-adapter smoke (default): skips safely (4/4).
- **`pnpm build`:** green (both apps).
- Direct-Gemini grep: **provider-only**. `.env` untracked; no secret/key in diff.

## 8. Live smoke result (executed, 1 call)
One-shot proof through the real orchestrator + Gemini (mock Prisma → **no DB write**): `status ok`, `provider=gemini`, **`usageSource="provider"`**, real counts (in 11 / out 306 / total 1531), `estimatedCost=null`, `costIsEstimated=true`, `currency=USD`, `costSchemaVersion=1`, latency recorded. Confirms the ledger captures real provider usage end-to-end. (Probe script removed after the run.)

## 9. Erasure compatibility
The ledger lives on `AICallLog` (`userId onDelete: SetNull`) — **user deletion is not blocked**. Re-ran the disposable-DB erasure verify against the **extended** schema: **35/35 PASS** — AICallLog survives de-linked (`userId=null`), bystander intact, 0 orphans, `garnish_db` untouched. No new user FK introduced (all new columns nullable scalars).

## 10. Secret / PII safety
- Ledger `metadata` is PII-guarded (`assertNoPIIInMetadata` → redacted on detection); **prompt text never persisted**.
- `errorMessage` sanitizer **hardened** (A10A): now also strips `key=/api_key=/token=/secret=/password=` values (defense-in-depth) in addition to emails / `sk|pk|AIza|ghp|...` keys / Bearer / JWT, capped 500. Unit-tested: no key/secret survives in the ledger row.

## 11. R3 status recommendation
**R3: OPEN → Mitigating (not closed).** Durable per-call usage/cost accounting is now persisted on every AI call with honest provenance — the core R3 gap (no durable accounting) is mitigated. **Do not close R3**: precise per-model cost metering (`estimatedCost` still null) and a **persisted** per-user *daily* budget enforcement (current cap is in-memory/process-lifetime) remain. **R4 remains OPEN** (unchanged).

## 12. Remaining gaps
- `estimatedCostUsd` null until a per-model rate table is configured (deliberate — no faked precision).
- Per-user budget enforcement is still in-memory (not persisted/daily); the ledger now provides the data to build persisted enforcement next.
- No alerting/quota-block on aggregate spend yet.
- These are the closure conditions for R3 (a later A10x step), gated on Founder approval.

## 13. Confirmations (what was NOT done)
- ✅ No live Gemini default enablement (gated/dev-only; default stub).
- ✅ No billing/monetization; no faked cost numbers.
- ✅ No streaming · no model-driven tool execution · no agents/LangGraph · no vision · no medical/diet advice · no guards weakened.
- ✅ No UI · no recipe import · no destructive retention · no erasure/export/retention behavior change · no `.env`/secret committed.
- ✅ Migration additive-only (no DROP/DELETE/TRUNCATE).

## 14. Not claimed
Live Gemini product-enabled · AI Core complete · billing complete · exact cost accounting (only estimated/provenance-tagged) · streaming · model-driven tools · agents — **none** claimed.

**Stopping after this report. Not merged — awaiting Founder/Reviewer approval.**
