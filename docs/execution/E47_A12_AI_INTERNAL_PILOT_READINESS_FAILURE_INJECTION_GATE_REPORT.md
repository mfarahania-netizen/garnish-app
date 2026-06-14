# E47-A12 — AI Internal Pilot-Readiness Failure-Injection Gate

**Task:** E47-A12-AI-INTERNAL-PILOT-READINESS-FAILURE-INJECTION-GATE · **Date:** 2026-06-14 · **Owner:** AA / EL
**Branch:** `exec/e47-a12-pilot-readiness` (not merged — awaiting acceptance) · **Master baseline:** `3bf25870`
**Type:** dev/internal pilot-readiness gate (deterministic, CI-safe). **Not product rollout, not live-AI enablement.**

---

## Final verdict
**E47_A12_AI_INTERNAL_PILOT_READINESS_GATE_PASS**

A deterministic, CI-safe failure-injection gate (34 checks across 7 families) proves the AI runtime boundary holds under realistic failure/boundary conditions — no live AI by default, no secret leak, no capability over-claim, no safety bypass, no DB/destructive side-effects. The pre-existing hardcoded dev JWT/phone was **scrubbed** (per reviewer note) so this readiness gate passes with a clean secret scan. **R3 and R4 remain Mitigating (not Closed).**

## Branch / commit
- Start master: `3bf25870` · Final master: unchanged (not merged) · gate branch `exec/e47-a12-pilot-readiness`.

## Files changed
- **New:** `apps/server/src/ai/eval/pilot-readiness/ai-pilot-readiness-gate.ts`, `...-gate.spec.ts`, `docs/qa/ai/e47_a12_ai_internal_pilot_readiness_results.json`, this report.
- **Modified:** `apps/server/package.json` + root `package.json` (+`ai:eval:pilot-readiness`); `scripts/dev/test-exposure-final.js` (**JWT/phone scrub** → env-var token); `docs/README.md`, `docs/execution/RISK_REGISTER.md`, `docs/execution/WEEKLY_EXECUTION_REVIEW.md`.
- **No runtime AI code changed** (gate is eval-only; the only non-runtime edits are the dev-script scrub + package scripts).

## What was added
A `runPilotReadinessGate()` aggregator (deterministic, offline; mock Prisma + fixture providers only) + a spec that drives it, writes the redacted artifact, and asserts `failedChecks === 0` (non-zero CI exit on failure).

## What was not changed
No orchestrator/guard/provider/cost/logging runtime behavior; no schema/migration; no UI; no recipes/ingredients; no live-default; no streaming/tools/agents/vision/medical.

## Gate scenarios covered (34 checks, 7 families)
- **flags (7):** no-flags→stub; `AI_PROVIDER` only / `AI_LIVE_ENABLED` only / placeholder key → not live; full live config → `isLiveModelConfigured` true (gate still fixtures); `AI_CHAT_LIVE_ENABLED=false` disables chat-live; default chat-live off.
- **orchestrator_only (2):** Gemini SDK only in the provider (not controller/service/chat/orchestrator); chat routes through `ChatOrchestrationService`.
- **guard_order (9):** missing snapshot fail-fast; injection / inbound-safety / per-request-cost block **before** provider (0 calls); **cost-before-safety precedence** pinned; persisted daily budget blocks before provider (live-configured); **budget DB error → fail-closed**; outbound nutrition guard blocks unsafe nutrition **after** provider; AICallLog persistence failure never breaks the call.
- **a11b_integration (6):** scripts registered (root+server); A11B artifact present; totalCases ≥ 54; failed === 0; live calls === 0; no secret/raw leak.
- **failure_injection (7):** provider error w/ fake key → sanitized (no leak), status error; evaluator detects unsafe medical / fake-vision / hallucinated-capability outputs; **spend-alert throws → best-effort swallowed (alert attempt asserted)**; **call-log throws → best-effort ok**; **persisted-budget throws → fail-closed**.
- **secret_hygiene (1):** no hardcoded secret/PII (key/JWT/Bearer/private-key/email/phone) in `scripts/dev/`.
- **docs_honesty (2):** R3 Mitigating-not-Closed; R4 Mitigating-not-Closed.

## A11B regression integration
Gate reads the committed `e47_a11b_output_safety_regression_results.json`: present ✅, totalCases 54 ✅, failed 0 ✅, providerCalls 0 ✅, no secret/raw leak ✅ → `a11bRegressionSummary.ok = true`. Would fail the gate if the artifact were stale/missing/leaky.

## Failure-injection results
All injected failures handled per policy: sanitized error (no AIza/key leak in the persisted row); unsafe medical/vision/capability outputs flagged by the deterministic evaluator; **best-effort** services (spend-alert, AICallLog) throw → chat still returns `ok`; **fail-closed** services (persisted budget) throw → `blocked_cost`, **0 provider calls**. No crash, no live call, no unsafe `ok`.

## Diagnostic route protection
`RolesGuard` unit-tested: admin → allowed; **non-admin → denied (403)**; missing user → denied; **deny-by-default** (guard present, no `@Roles`) → denied. Controller metadata reflected: `RecommendationDiagnosticsController` is class-guarded `AuthGuard('jwt') + RolesGuard + @Roles('admin')` (≥2 guards → unauthenticated = 401 via the JWT guard). **Design debt (R18):** the controller is root-mounted (`@Controller()`); it is guarded admin-only but lives at root prefix — flagged, not changed (out of A12 scope).

## Static scans
- Direct Gemini: **provider-only** (`gemini-model.provider.ts`).
- Live flags: none persisted `=true` (docstrings/`.env.example="false"` only); default stub.
- Medical/diet/fake-vision terms: only in guards / eval / safety-enforcement / docs (refusal + eval), not product behavior; A12 touched no `apps/web`.
- Secrets: repo-wide tracked scan clean after the dev-script scrub; `.env` untracked.

## Tests / build
| Command | Result |
|---|---|
| `pnpm --dir apps/server ai:eval:pilot-readiness` | ✅ 11 tests pass (gate 34/34 checks) |
| `pnpm --dir apps/server ai:eval:regression` | ✅ 46 pass |
| `pnpm --dir apps/server test:ai-eval` | ✅ 75 pass |
| `pnpm --dir apps/server test` (full) | ⚠️ 329/333 — the **4 failures are the known R19 legacy specs** (pre-existing, CI-non-blocking, not A12) |
| `pnpm build` | ✅ green |

## Artifact redaction proof
`docs/qa/ai/e47_a12_ai_internal_pilot_readiness_results.json`: `schemaVersion`, `generatedAt`, `runMode: offline-deterministic`, `liveCalls 0`, `networkCalls 0`, `dbWrites 0`, `totalChecks 34`, `passed 34`, `failed 0`, `categoryBreakdown`, empty `redactedFailureDetails`, `a11bRegressionSummary`, `r3Status/r4Status`. No raw prompts, model outputs, keys, JWTs, Bearer tokens, emails, phones, or connection strings (verified). `liveCalls/networkCalls/dbWrites` are 0 **by construction** (the gate constructs only fixture providers + mock Prisma; never `createModelProvider`/`GeminiModelProvider`/`PrismaService`).

## Docs / risk updates
- `docs/README.md` links the A12 report; `WEEKLY_EXECUTION_REVIEW.md` has the A12 entry; `RISK_REGISTER.md` change-history records A12 + the dev-script scrub.
- **R3: Mitigating, not Closed. R4: Mitigating, not Closed.** No product-rollout / live-default / "AI Core complete" claims.

## R3 / R4 status
R3: **Mitigating, not Closed** (verified rates + cost-spend alerts + race-proof reservation remain future closure work).
R4: **Mitigating, not Closed** (at-scale live output eval + novel-evasion robustness remain future closure work).

## Remaining gaps
- Diagnostic controller root-mounting (R18) is design debt — guarded admin-only, but should move under a prefix (separate task).
- `secret_hygiene` gate check scans `scripts/dev/` (non-recursive) — adequate for scope; could broaden to `scripts/**`/`*.http` later.
- Pre-existing synthetic test phone (`09123456789`) remains in `apps/server/test/*.e2e-spec.ts` / `*.http` / docs (synthetic, out of A12 scope).
- The gate exercises the AI boundary via fixtures/mocks (deterministic); at-scale live behavior remains the A11x live-subset path.

## Side-effect confirmations
- No live default · no product rollout · no UI · no recipe import · **no DB migration** · no destructive retention/prune/delete · no secrets committed · no medical/diet/vision/agent capability.

## Stop condition
Stop here. Do not start any next task.
