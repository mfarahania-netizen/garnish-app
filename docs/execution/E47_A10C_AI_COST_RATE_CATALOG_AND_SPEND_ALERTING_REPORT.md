# E47-A10C — AI Cost-Rate Catalog & Spend-Alert Foundation (R3 mitigation)

**Task:** E47-A10C-AI-COST-RATE-CATALOG-AND-SPEND-ALERTING · **Date:** 2026-06-14 · **Owner:** AA / EL
**Branch:** `exec/e47-a10c-rate-catalog-alerts` (not merged — awaiting acceptance) · **Master baseline:** `b7eccfc4`
**Scope:** a versioned, source-tagged cost-rate catalog (honest estimated cost only when verified rates exist) + a DB-backed spend-alert foundation. **Governance/risk only — not billing, not monetization, not subscriptions, not charging, not product live-chat rollout.**

---

## ✅ Final verdict: `E47_A10C_COST_RATE_ALERTING_PASS`

The rate-catalog and spend-alert foundations are implemented, wired, and verified. **No verified provider/model rates are available in this task context, so the production catalog ships EMPTY** — `estimatedCostUsd` stays **null** at runtime (no faked precision) and the cost-threshold alert is inactive; the **token-threshold** daily alert is fully functional. Erasure stays compatible (new table is SetNull). **R3 remains Mitigating** (now: ledger + persisted daily budget + alert foundation + rate-catalog scaffold), **not Closed** — closure needs verified rates + cost-spend alerting + race-proof reservation. **R4 remains OPEN.**

---

## 1. Files changed
| File | Change |
|------|--------|
| `apps/server/src/ai/cost/ai-cost-rate-catalog.ts` | **New** — versioned, source-tagged catalog; **empty** production rates; `getActiveRate`, `estimateCostUsdFromCatalog`. |
| `apps/server/src/ai/cost/spend-alert.service.ts` | **New** — daily token/estimated-cost threshold evaluation, deduped, PII-safe, persists `AiSpendAlert`. |
| `apps/server/src/ai/cost/ai-cost-policy.ts` | + `dailyTokenAlertThreshold` (80% of daily budget) + `dailyEstimatedCostAlertUsd` (null/disabled until rates). |
| `apps/server/src/ai/orchestrator/ai-orchestrator.service.ts` | cost via catalog (null without verified rate); optional `SpendAlertService`; post-live-call alert evaluation (best-effort). |
| `apps/server/src/ai/ai-core.module.ts` | register `SpendAlertService`. |
| `apps/server/prisma/schema.prisma` + migration `20260614010000_e47_a10c_spend_alert` | **New** additive `AiSpendAlert` table (FK SetNull) + `User.aiSpendAlerts` back-relation. |
| `apps/server/scripts/security/erasure-disposable-verify.cjs` | extended to cover `AiSpendAlert` SetNull + updated FK tripwire (37/30/7/0). |
| `*.spec.ts` (catalog, spend-alert) | **+17** targeted tests. |
| docs: this report · RISK_REGISTER · WEEKLY · docs index. |

## 2. Rate-catalog design
**Option B (code/config-backed)** — simpler and safe for this codebase (a DB catalog would be empty anyway with no verified rates). `ai-cost-rate-catalog.ts` defines `AiModelRate` with the full required schema (provider, model, inputRateUsdPer1M, outputRateUsdPer1M, currency, sourceName, sourceRef, verifiedAt, effectiveFrom, effectiveTo, isActive, schemaVersion). `getActiveRate()` picks the most-recent active rate within the effective window; historical rates allowed. **`PRODUCTION_RATE_CATALOG` is empty.**

## 3. Real rates vs test-only rates
**No verified rates were added** (none available in this task context — inventing prices is forbidden). Tests use clearly-labelled **TEST-ONLY fixture rates** ("not production truth"). Therefore runtime `estimatedCostUsd` remains **null** and R3 stays Mitigating, exactly as the task prescribes for the no-verified-rates case.

## 4. Estimated-cost behavior
- Verified active rate + input/output token split → `cost = inputTokens*inputRate/1e6 + outputTokens*outputRate/1e6` (USD).
- No matching rate → **null** (honest unknown).
- Rate exists but **input/output split missing** (only totalTokens) → **null** (no faked precision).
- `costIsEstimated` stays true unless a verified rate produced a precise figure; `currency` from the rate (else policy USD); `usageSource` stays provider/estimated/unavailable honestly. With the empty production catalog, estimatedCost is null on every real call.

## 5. Alerting behavior
DB-backed `AiSpendAlert`. Per-user **daily** thresholds: `token_daily` (default = 80% of the daily token budget = 160000) and `estimated_cost_daily` (default **null/disabled** — activates only when verified rates produce a real daily cost). Severity escalates to `critical` at/above the hard daily limit. **Deduped** to one `triggered` alert per (userId, dayUtc, thresholdType). Anonymous/null user → no alert. **No charging, no paywall, no email/push** — records persist (or are skipped) only.

## 6. AICallLog integration
`finish()` computes `estimatedCost` from the catalog for every terminal path (null today) and stores `currency`/`costIsEstimated`/`totalTokens`/`usageSource`/`costSchemaVersion` (A10A fields). After a **live** call that consumed provider tokens (status ok / blocked_nutrition), the orchestrator evaluates daily alerts via `SpendAlertService` using the persisted daily token sum — **best-effort** (wrapped; a failure never breaks the chat) and **skipped entirely** on the default stub path (no live config).

## 7. Schema / migration summary
Additive migration `20260614010000_e47_a10c_spend_alert`: `CREATE TABLE "AiSpendAlert"` + 2 indexes + FK `userId → User(id) ON DELETE SET NULL`. SQL inspected before apply; `migrate deploy` clean; `migrate status` = up to date (20 migrations). No DROP/DELETE/TRUNCATE. `prisma generate` hit the known transient Windows DLL `EPERM` (reported honestly) but the **client types regenerated** (`AiSpendAlert` present) and the engine is identical — build/tests/queries pass.

## 8. Tests / build results
- **AI unit suite: 130/130 (21 suites)** incl. new `ai-cost-rate-catalog.spec` (7) + `spend-alert.service.spec` (10): unknown→null, fixture rate computed, missing split→null, inactive/effective-window, dedup, token & cost thresholds, orchestrator alert on live over-threshold, alert-write-failure-non-fatal, default-skip, no-secret-in-metadata.
- Deterministic eval gate: green (within the suite). Default chat smoke: skip (4/4). **`pnpm build`: green.**
- Direct-Gemini grep: provider-only. `.env` untracked; no key/secret in diff.

## 9. Erasure compatibility (schema changed → re-verified)
`AiSpendAlert.userId` is `onDelete: SetNull`. Disposable-DB erasure verify re-run **36/36**: FK model now **37 User FKs (30 Cascade / 7 SetNull / 0 Restrict)**; **`AiSpendAlert` survives the user's deletion de-linked (`userId=null`)** — does NOT block erasure; bystander intact; `garnish_db` untouched. The FK-coverage tripwire was updated to the new known-safe counts.

## 10. Secret / PII safety
Alert `metadata` is `{ kind: 'ai_spend_alert' }` only — no userId duplication, no prompt text, no secret (unit-asserted). The rate catalog stores source attribution (name/ref), never secrets. AICallLog metadata/error sanitizers from A10A/A10B remain in force. No API key appears in any cost/alert row.

## 11. R3 status recommendation
**R3 remains Mitigating (not Closed).** The cost-governance stack is now: A10A durable per-call ledger → A10B persisted daily budget enforcement → A10C rate-catalog scaffold + spend-alert foundation. **Not closed because:** no verified provider/model rates exist (so no real USD cost is computed and the cost-spend alert is inactive), and the daily enforcement still has the A10B TOCTOU race. Closing R3 requires verified rates + computable daily estimated spend + persisted spend-threshold alerting/blocking + the race caveat addressed/accepted, all test-proven.

## 12. R4 status
**R4 remains OPEN** (unsafe AI answer) — unchanged by this task.

## 13. Remaining gaps
- No verified rates → estimatedCost null, cost-spend alert inactive.
- No email/push notification delivery (records persist only).
- Alert evaluation re-queries the daily sum per live call (acceptable for dev/beta).
- TOCTOU race on budget/alert (from A10B) not yet hardened.

## 14. Confirmations (what was NOT done)
- ✅ No live-Gemini default enablement · no live-chat default · no billing · no subscription · no user charging · no faked costs · no unverified prices as production truth.
- ✅ No streaming · no model-driven tools · no agents/LangGraph · no vision · no medical/diet advice · no guards weakened.
- ✅ No UI · no recipe import · no destructive retention · no erasure/export/retention behavior change (erasure re-verified) · no `.env`/secret committed · R3 not closed.
- ✅ Migration additive-only (no DROP/DELETE/TRUNCATE).

## 15. Not claimed
Billing complete · monetization complete · exact cost accounting (no verified rates) · live Gemini product-enabled · AI Core complete · R3 closed — **none** claimed.

**Stopping after this report. Not merged — awaiting Founder/Reviewer approval.**
