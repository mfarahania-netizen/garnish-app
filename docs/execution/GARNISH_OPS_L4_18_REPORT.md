# GARNISH-OPS-L4-18 — Operational Health + Safety/Compliance + Economics (backend + dashboard panels)

**Track:** 4 · Sprint 4.3 (**TRACK 4 CLOSER**) · **Branch:** `exec/garnish-ops-l4-18` · **Baseline:** master `37fcf130`
**Scope:** extend analytics/admin (backend) + 3 GES dashboard panels (frontend). No migration.

---

## Phase 0 — the S13 web-lint verification ask

Confirmed: `pnpm --dir apps/web lint` fails **identically on master `37fcf130` (pre-change)** with
`ERR_MODULE_NOT_FOUND: Cannot find package 'globals'`. Investigated: the **root** `eslint.config.js` imports
`globals` + `@eslint/js` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`, but those live in
`apps/web/node_modules`, not the root — so the root flat-config can't resolve them and lints nothing. This is
**not** the trivial "missing `globals` devDep" case (4 deps + a root/lockfile change, or relocating the config)
→ per the prompt it is **non-trivial → logged as a risk (R-WEB-LINT-ROOT-CONFIG), not fixed** (scope discipline;
avoids lockfile churn that would risk the frozen-install gate). The vite build — the meaningful frontend
compile check — passes.

## What shipped (C, F, H) — each domain: backend metric + GES panel

| Domain | Backend (`analytics/intelligence/ops-*`) | Panel |
|---|---|---|
| **C. Operational health** | `getHealth()`: AI-call latency **p50/p95** + **error rate** + **guard-block rate** + status distribution (from `AICallLog`); event-data **well-formedness %** (structural, over a recent sample); scheduled-jobs list (queues = **n/a**, in-process `@nestjs/schedule`); retention-destructive flag. Honest-null on empty. | `OpsHealthTab` |
| **F. Safety & compliance** | `getSafetyCompliance()`: **REAL guard-fire counts** — runs the actual `AiSafetyGuard`/`NutritionClaimGuard`/`PromptInjectionGuard` over the real output-safety corpus (**68 cases, 40 blocked** — deterministic, not invented) + logged `guardHits`; **allergy hard-filter** standing PASS indicator (S11 harness, **0 leaks**); **consent posture** (counts per purpose, no PII); **INE dry-run** state (`INE_REAL_SEND_ENABLED` OFF). | `SafetyComplianceTab` |
| **H. Economics & cost** | `getEconomics()`: token-usage rollups (real); **cost-per-user honest-null** (`awaiting_rates` — production rate catalog empty, `estimateCostUsdFromCatalog`→null, never fabricated); policy limits; **revenue "not yet"**. ACCOUNTING only. | `EconomicsTab` |

## The compliance evidence (the important one)

Guard-fire counts are **real**: the QA gate proves a real injection fixture fires the prompt-injection guard
and a benign fixture fires nothing — the headline number (40/68 corpus cases blocked; ai_safety 28 /
prompt_injection 12 / nutrition_claim 4) comes from **running the actual guards**, not an invented "we blocked
N". The allergy hard-filter is a standing PASS indicator (0 leaks across the S11 fixtures). Notification
delivery is shown as dry-run (no real sends). This panel reads as evidence for an EU/AI-Act reviewer or investor.

## Honest / accounting-only / PII-safe / no-shadow

Every metric is REAL or explicit `awaiting_pilot`/`awaiting_rates`/`not_yet` — never fabricated (asserted by
tests on empty data). No `Math.random`. **Economics is accounting-only — NO billing/payment/revenue code**
(QA-gate `BILLING` regex over the source = clean). Aggregates only — a test asserts no `userId`/`email`/`phone`
PII field in safety/economics output. The ops files do **not** import `runtime-shadow/**`; the engine extends
the existing analytics module (no parallel tower). No new dependency. The S11 harness + S6 INE flag + the cost
rate-catalog are reused as pure imports.

## QA gate

`analytics/intelligence/ops-l4-18-qa-gate.spec.ts` — **10/10 checks pass**
(artifact: `docs/qa/analytics/garnish_ops_l4_18_results.json`): no_runtime_shadow_import, no_billing_code,
no_randomness, guard_counts_real, allergy_safety_pass, notification_dry_run_off, health_honest_null,
economics_cost_honest_null, revenue_not_yet, pii_safe.

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-ops-l4-18
HEAD is now at ce453cf5 feat(OPS-L4-18): operational health + safety/compliance + economics (backend + GES panels)

$ pnpm install --frozen-lockfile
Done in 32.8s                          # frozen lockfile → NO dependency changes

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 431ms

$ pnpm build            # web + server
Tasks:    2 successful, 2 total      # vite (web) + nest (server) — exit 0

$ pnpm coverage:check
coverage: ... admin=46 | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm test
server:test: Test Suites: 190 passed, 190 total
server:test: Tests:       1403 passed, 1403 total     # 0 skips (= worktree baseline 1387 + 16 new)

# web lint: PRE-EXISTING root-config break (globals/4 eslint deps unresolvable from root) — reproduces on master
$ git status --short                 # only docs/qa + coverage.generated regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # 18 files: analytics/ops-* + admin/ + web admin + coverage + logs + qa
$ git worktree remove ../garnish-verify   # blocked by regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** ops metrics deterministic (0 `Math.random` usage — only in comments/gate text) and
HONEST (empty → `awaiting_pilot`, proven by test); **guard-fire counts REAL** (run real guards over the real
corpus — 68 cases/40 blocked; injection fires, benign 0); economics ACCOUNTING-only (QA-gate billing regex over
source = clean; cost honest-null until verified rates); no `userId`/`email`/`phone` PII field in panels; panels
GES-tokenized (reuse S13 helpers); `git diff` confined to `analytics/`+`admin/`+web admin (+coverage+logs+qa),
`runtime-shadow/**` untouched + not imported; no new dep; no new ingredient IDs; Track-7 deferral logged
(R-T7-OPS-SCALE-METRICS / D16); coverage green (admin=46).

---

## TRACK 4 SUMMARY (S12–S14) — for the founder's end-of-track audit

Track 4 built the full observability layer — the numbers behind the admin dashboard — all deterministic +
HONEST (real-or-awaiting, never faked), extending the existing analytics/admin modules with no parallel tower
and `runtime-shadow/**` untouched throughout.

| Sprint | Capability | Master commit (merge) |
|---|---|---|
| **S12 · ANALYTICS-L4-16** | Analytics computation engine: funnels, trends, cohort/retention math, product-intelligence (Food DNA bands, recsys quality, INE distribution, briefing, gamification); 4 admin endpoints; honest-null | `522f0903` |
| **S13 · DASHBOARD-L4-17** | Shallow → deep GES admin dashboard on the real S12 data: overview/funnels/trends/cohort/product-intelligence tabs, honest awaiting-pilot UI, CSV export, full GES tokenization (0 banned hex) | `37fcf130` |
| **S14 · OPS-L4-18** | Operational health + safety/compliance evidence (REAL guard counts, allergy indicator, consent posture, dry-run) + economics accounting; 3 admin endpoints + 3 GES panels | this sprint (HEAD after merge) |

**Track-wide invariants held:** deterministic + HONEST (real or `awaiting_pilot`/`awaiting_rates`/`not_yet` —
never fabricated, no `Math.random`); aggregates only (no PII); economics accounting-only (no billing); guard/
safety evidence comes from REAL guard behavior; analytics/admin extended in place — no parallel analytics tower,
`runtime-shadow/**` frozen + never imported; GES-tokenized panels; user/scale-dependent metrics LOGGED to
Track 7 (R-T7-ANALYTICS-USER-METRICS, R-T7-OPS-SCALE-METRICS). Clean-room at HEAD: build 0 (web+server),
coverage green, **190 suites / 1403 tests, 0 skips**.

---

## REQUIRED VERDICT BLOCK

```
OPS_L4_18 RESULT: PASS
Clean install (worktree): build(web+server) exit 0, coverage:check green, server tests Test Suites 190/190, Tests 1403/1403, skips 0; web lint pre-existing-logged (root flat-config can't resolve eslint deps; reproduces on master; R-WEB-LINT-ROOT-CONFIG)
Health (C): latency(p50/p95 or honest-null)=ok, error/failure rate=ok, event-quality=ok, queues=n/a (in-process crons) ; panel=ok
Safety/Compliance (F): guard-fire counts REAL (real guards over fixture corpus — 68 cases/40 blocked; logged guardHits; NOT faked)=yes, allergy-safety standing indicator (0 leaks)=yes, consent posture (counts,no PII)=yes, notification dry-run OFF shown=yes ; panel=ok
Economics (H): cost-per-user/call (estimate from rate catalog, honest-null until verified rates)=ok, usage rollups=ok, revenue="not yet" honest placeholder=yes, NO billing/payment code=confirmed ; panel=ok
HONEST DATA: absent data → null/"awaiting pilot" (NOT faked) = yes; test
Determinism: no Math.random = yes
PII-safe + GES-tokenized panels (no stray non-brand hex, RTL) = yes
No parallel/shadow: existing modules extended; runtime-shadow untouched + not imported = yes
Boundaries: live-AI=NONE, external-API=NONE, new-heavy-dep=NONE, newIngredientIDs=0, medical-framing=NONE, billing=NONE, migration=none
Deferred (LOGGED): scale-dependent metrics → Track 7 = RISK_REGISTER R-T7-OPS-SCALE-METRICS + DECISION_LOG D16
Coverage gate: green (endpoints registered=3: /admin/ops/{health,safety-compliance,economics})
TRACK 4 summary: included=yes; master commit=ce453cf5 (HEAD after report merge)
Merge/push: exec/garnish-ops-l4-18 → master ff/pushed (commit ce453cf5 + report)
Verdict: OPS_L4_18_PASS
```
