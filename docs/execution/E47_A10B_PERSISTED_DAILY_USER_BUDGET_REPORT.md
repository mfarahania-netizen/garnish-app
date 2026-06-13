# E47-A10B — Persisted Daily User Budget Enforcement (R3 mitigation)

**Task:** E47-A10B-PERSISTED-DAILY-USER-BUDGET-ENFORCEMENT · **Date:** 2026-06-14 · **Owner:** AA / EL
**Branch:** `exec/e47-a10b-daily-budget` (not merged — awaiting acceptance) · **Master baseline:** `1b8733f9`
**Scope:** move per-user daily AI budget enforcement from in-memory/process-lifetime toward **DB-backed** enforcement using the A10A `AICallLog` ledger. **Not** billing, **not** monetization, **not** product enablement, **not** live-Gemini default enablement.

---

## ✅ Final verdict: `E47_A10B_PERSISTED_DAILY_BUDGET_PASS`

A new `PersistedDailyBudgetService` sums real-provider token usage per user per UTC day from the ledger and the Orchestrator enforces it **before any live provider call** (fail-closed on lookup error). The default stub path is untouched (no DB query, no enforcement). No schema migration was needed (reused A10A fields). **R3 remains Mitigating** (durable per-call accounting + persisted daily enforcement now exist; per-model cost rates and spend alerting still deferred → not closed). **R4 remains OPEN.**

---

## 1. Existing budget findings (before A10B)
| Question | Finding |
|----------|---------|
| `perRequestMaxTokens` | **8000** |
| `perUserDailyMaxTokens` | **200000** |
| Per-user cap in-memory? | **Yes** — `AiCostControllerService` `Map<userId, tokens>` |
| Resets on process restart? | **Yes** (volatile) |
| Blocked calls counted? | **No** — in-memory `record()` runs only on success |
| Can AICallLog support persisted daily budget? | **Yes** — A10A added `totalTokens` + `usageSource` + (existing) `provider`/`createdAt`/`userId` |

## 2. Persisted daily-budget policy
`PersistedDailyBudgetService.consumedTokensToday(userId)` =
`SUM(COALESCE(totalTokens,0))` over `AICallLog` WHERE `userId = X` AND `createdAt >= start-of-UTC-day` AND `provider <> 'stub-model'` AND `usageSource IN ('provider','estimated')`.
- **UTC day** window (`startOfUtcDay`) — no project timezone policy exists, so UTC is the documented basis.
- **Counts:** real (non-stub) provider token usage — successful live calls + post-provider nutrition-blocked (both carry provider/estimated usage).
- **Excludes (count 0):** stub/deterministic (`provider='stub-model'`), blocked-before-provider and provider errors (`usageSource='unavailable'` → `totalTokens` null), and **other users** (scoped by `userId`).
- **Null safety:** null `totalTokens` → 0 (aggregate COALESCE); **anonymous/null user** → no per-user budget (returns allowed; the per-request cap still guards each call); null-user rows never break the query (never summed).

## 3. Enforcement behavior
In `AiOrchestratorService.run()`, a new step **4.5** runs **after** safety and **before** the model call, but **only when** a budget service is wired **and** `isLiveModelConfigured()` (a live provider):
- checks the persisted daily budget (projected = consumed + `estimatedTokens`);
- **over budget → block before the provider** (`status: blocked_cost`, `guardHits: ['daily_budget']`, reason `daily_budget_exceeded`), no Gemini call;
- **DB lookup error → fail CLOSED** (block; reason `budget_check_unavailable`) — safest for cost; a transient DB issue never results in an unmetered paid call.
- The per-request token cap (step 3, in-memory) is unchanged and still enforced independently.
- **Default/stub path:** `isLiveModelConfigured()` is false → step 4.5 is **skipped entirely** (no DB query, behavior identical to before). Max **one** provider call per request preserved; no streaming/loop/retry.

## 4. Budget-block response behavior
A daily-budget block returns `status: blocked_cost`; the chat layer maps it to the existing safe, deterministic rate-limit message ("too many requests, try again later"). **No internal budget values** (consumed/limit) are leaked to the user — the numeric reason codes live only in the PII-safe AICallLog metadata.

## 5. AICallLog / ledger behavior
The budget-blocked path writes a normal ledger row via the existing `finish()`: `status: blocked_cost`, `usageSource: 'unavailable'`, `totalTokens: null`, `estimatedCost: null`, `guardHits: ['daily_budget']`, `metadata: { reasons: ['daily_budget_exceeded'|'budget_check_unavailable'] }`. No provider tokens are attributed to a blocked call (so a block never inflates the day's consumption).

## 6. Tests / build results
- **AI unit suite: 113/113 (19 suites)** — incl. new `persisted-daily-budget.spec.ts` (**13** tests): UTC-day boundary; query scoping (userId, day, exclude stub+unavailable); null-sum→0; under/over budget; null user (no query); LIVE under→called / over→blocked / DB-error→fail-closed; default-skip; no-service-preserves-behavior; per-request cap independent; injection short-circuits before the budget query; no secret in the ledger row.
- Deterministic eval gate: green (within the suite).
- Default chat smoke: skips safely (4/4).
- **`pnpm build`:** green (both apps).
- Direct-Gemini grep: **provider-only**. `.env` untracked; no key/secret in diff.

## 7. Migration status
**None** — no schema change. Reused the A10A `AICallLog` ledger fields (`totalTokens`, `usageSource`, `provider`, `createdAt`, `userId`). `prisma generate` not required (no model change).

## 8. Live smoke result
**Not separately re-run** to keep live calls minimal (per the task's "live smoke optional"). The enforcement is fully covered by unit tests against the **real** Orchestrator + real guards + mock provider/Prisma (under/over/fail-closed/default-skip), and real live provider calls were already proven in A7/A8/A10A (the A10A live probe confirmed `usageSource='provider'` token capture end-to-end — the exact data this budget sums).

## 9. Race / concurrency caveat
The check is **query-then-call** (read consumption, then call). Concurrent requests for the same user can both pass the check before either's row is written (a TOCTOU race), so the cap can be transiently overshot by a few in-flight calls. **Acceptable for the dev/beta baseline.** Future hardening (documented, not built): transactional quota reservation or an atomic counter; this is part of the R3-closure work, gated on Founder approval.

## 10. R3 status recommendation
**R3 remains Mitigating (not closed).** A10B adds *persisted, restart-surviving, per-user daily* enforcement on top of A10A's durable accounting — a real strengthening. It is **not closed** because: per-model USD cost rates are still absent (`estimatedCost` null), there is no aggregate spend alerting, and enforcement is best-effort (TOCTOU race; fail-closed). **R4 remains OPEN.**

## 11. Remaining gaps
- No per-model cost rates / USD metering (estimatedCost null by design).
- No spend alerting / aggregate org budget.
- Best-effort concurrency (no transactional reservation).
- Per-request in-memory cap and the persisted daily budget are separate mechanisms (per-request remains in-memory; acceptable — it's a single-call bound).

## 12. Confirmations (what was NOT done)
- ✅ No live-Gemini default enablement (enforcement runs only when live is already configured; default stub untouched).
- ✅ No billing / no subscription / no faked costs (token budget only).
- ✅ No streaming · no model-driven tools · no agents/LangGraph · no vision · no medical/diet advice · no guards weakened.
- ✅ No schema migration · no UI · no recipe import · no destructive retention · no erasure/export/retention change · no `.env`/secret committed.
- ✅ R3 not closed.

## 13. Not claimed
Billing complete · exact cost accounting · live Gemini product-enabled · AI Core complete · R3 closed — **none** claimed.

**Stopping after this report. Not merged — awaiting Founder/Reviewer approval.**
