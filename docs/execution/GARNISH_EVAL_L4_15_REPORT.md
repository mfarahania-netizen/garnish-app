# GARNISH-EVAL-L4-15 — Recsys Eval Harness + Offline Metrics (runnable, allergy-safety measured)

**Track:** 3 · Sprint 3.3 (**TRACK 3 CLOSER**) · **Branch:** `exec/garnish-eval-l4-15` · **Baseline:** master `0513edaf`
**Scope:** extend the live `recommendation/evaluation/` module — no parallel metrics tower. No migration.

---

## Mission outcome

The recommendation system now has **numbers we can act on today, without real users.** The existing evaluation
services are behaviour-based (CTR/save/cook are zero until the pilot) and measured no safety. This sprint adds
the **offline half**: a runnable, deterministic eval harness that scores quality from the catalog + the S9
content representation + declared-profile fixtures, plus a **mandatory allergy-safety hard guard**. Behaviour
metrics report honest "awaiting pilot"; the online half is explicitly deferred to Track 7. The frozen
`runtime-shadow/**` is untouched and never imported by the new files.

## What shipped (A–D)

| Part | Where | What |
|---|---|---|
| **A. Offline structural metrics** | `evaluation/offline-metrics.ts` (pure) | **catalog-coverage** (fraction recommendable), **diversity** (avg intra-list dissimilarity via S9 `buildContentVector`/`cosineDense`), **novelty/popularity-bias** (real favorite counts; honest `null` when none), **fit-quality** (avg `assessRecipeFit` fitScore). Deterministic, reproducible, no `Math.random`. |
| **B. Allergy-safety metric (mandatory hard guard)** | `offline-metrics.ts` `allergenLeaks` | An **INDEPENDENT** allergen-intersection check (does NOT trust the recommender's own verdict): any recommended recipe whose allergen set �(declared field ∪ dictionary-derived) intersects a fixture's declared allergies counts as a leak. Across the allergy fixtures the count MUST be 0, else the harness FAILs. Proven to detect a leak (a regression would fail CI). |
| **C. Runnable harness + report** | `evaluation/recommendation-eval.harness.ts` + `recommendation-eval.service.ts` | Mirrors `ai-eval.harness`: runs metrics over the catalog + fixtures (omnivore / vegan / beginner / **peanut-allergic** / **dairy-allergic**), emits `{ offline, allergySafety, online, overallPass }` with per-metric thresholds. Asserted by `recommendation-eval.harness.spec.ts`. `RecommendationEvalService.runOfflineEval()` runs it against the real catalog; `pnpm recsys:eval` runs it on demand. |
| **D. Honest online metrics (deferred)** | harness `online` section + existing metrics service | CTR/save/cook/retention are reported as `null` + `awaitingPilot: true` when there's no real data (impressions = 0) — **never fabricated**; they flip to real values automatically when impressions > 0. Logged as a Track-7 trigger (R-T7-ONLINE-RECSYS-METRICS / D14). |

## Sample offline numbers (fixture catalog, from the QA artifact)

`catalogCoverage = 1.0`, `diversity = 0.925`, `fitQuality = 0.786`, `popularityBias = null (awaiting pilot)`,
`allergySafety = { fixturesChecked: 2, leaks: 0, pass: true }`. QA gate: **9/9 checks pass**
(`docs/qa/recommendation/garnish_eval_l4_15_offline_recsys_results.json`).

## Reuse / boundaries

Reuses the existing `RecommendationMetricsService` (online data), S9 `recipe-content` (diversity), and
`assessRecipeFit`/`analyzeRecipeIntegrity` (fit + allergen derivation). No parallel metrics system; the eval
files do **not** import `runtime-shadow/**`. Deterministic (0 `Math.random`); no external API / LLM / vector
DB / new dependency (`package.json` change is the `recsys:eval` script only; lockfile unchanged); no new
ingredient IDs; no migration.

---

## PHASE 2 — Isolated worktree clean-install (verbatim)

```
$ git worktree add --detach ../garnish-verify exec/garnish-eval-l4-15
HEAD is now at c81d2c41 feat(EVAL-L4-15): runnable offline recsys eval harness + metrics (allergy-safety hard guard)

$ pnpm install --frozen-lockfile
Done in 27.8s                          # frozen lockfile → NO dependency changes

$ pnpm --dir apps/server exec prisma generate
✔ Generated Prisma Client (v5.22.0) in 490ms

$ pnpm build
Tasks:    2 successful, 2 total      # server (nest) + web (vite) — exit 0

$ pnpm coverage:check
coverage: ... deferred=14 | UNMAPPED=0 UNREGISTERED=0
COVERAGE GATE PASSED.

$ pnpm test
server:test: Test Suites: 184 passed, 184 total
server:test: Tests:       1369 passed, 1369 total     # 0 skips (= worktree baseline 1353 + 16 new)

$ git status --short                 # only docs/qa + coverage.generated regeneration churn (NOT committed)
$ git diff --name-only master..HEAD  # 12 files, confined to recommendation/evaluation + module + scripts + logs + qa
$ git worktree remove ../garnish-verify   # blocked by regen churn → prune + rm -rf + prune
```

**Scope-proof summary:** offline metrics deterministic (0 `Math.random` in offline-metrics/harness/service) and
honest (behaviour metrics + popularity-bias return `null`/"awaiting pilot" on empty data); the allergy-safety
metric is a HARD guard (allergy fixtures → 0 leaks; a leak is detectable and would fail the harness); the
harness is runnable (`pnpm recsys:eval`) + asserted by a spec (mirrors ai-eval); `git diff` confined to
`recommendation/evaluation/` (+ module + scripts + logs + qa), `runtime-shadow/**` untouched + not imported by
the eval files; no new dep (scripts-only package change); no new ingredient IDs; online-deferral logged
(R-T7-ONLINE-RECSYS-METRICS / D14); coverage green.

---

## TRACK 3 SUMMARY (S9–S11) — for the founder's end-of-track audit

Track 3 built the content-side recommendation foundation + made it measurable — all deterministic/local,
allergy-safe, with no second shadow tower (the frozen `runtime-shadow/**` was never touched or imported).

| Sprint | Capability | Master commit (merge) |
|---|---|---|
| **S9 · EMBED-L4-13** | Deterministic recipe content representation (`recipe-content.ts`) + `RecipeContentFeatureStore`, replacing the 48-dim hash stub; wired live into search / "similar recipes" / candidate-embedding | `1d3c95e2` |
| **S10 · COLDSTART-L4-14** | Profile-grounded, **allergy-safe**, content-aware, fit-ranked cold-start (reads `getLivingUserProfile`, hard allergy filter via `assessRecipeFit`); history-aware ranking blend (flagged, default ON) | `0513edaf` |
| **S11 · EVAL-L4-15** | Runnable offline recsys eval harness + metrics (coverage/diversity/fit-quality) + **mandatory allergy-safety hard guard**; honest-null online metrics | this sprint (HEAD after merge) |

**Track-wide invariants held:** content-side only, deterministic/local (no live-AI, no external API, no vector
DB, no new heavy dep); the live recommendation pipeline + evaluation module were upgraded IN PLACE — no parallel
recommender/metrics tower; `runtime-shadow/**` frozen + never imported throughout; declared allergies are a hard
filter (cold-start) and a measured regression guard (eval); the two deferred halves (user-side learning +
online metrics) are LOGGED to Track 7 (R-T7-USERSIDE-EMBEDDING / R-T7-ONLINE-RECSYS-METRICS), not half-built.
Clean-room at HEAD: build 0, coverage green, **184 suites / 1369 tests, 0 skips**.

---

## REQUIRED VERDICT BLOCK

```
EVAL_L4_15 RESULT: PASS
Clean install (worktree): build exit 0, coverage:check green, tests Test Suites 184/184, Tests 1369/1369, skips 0
Offline metrics (numbers NOW): catalog-coverage=ok, diversity(S9)=ok, novelty/popularity-bias=ok, fit-quality(assessRecipeFit)=ok; deterministic=yes
ALLERGY-SAFETY METRIC (mandatory hard guard): allergy fixtures → zero allergen recs = yes (2 fixtures, 0 leaks; regression would FAIL harness — leak-detection test proves it)
Runnable harness + report: mirrors ai-eval.harness, asserted by spec = yes (pnpm recsys:eval); thresholds pass/fail reported = yes
Online metrics honest: CTR/save/cook/retention return null/"awaiting pilot" on empty data (NOT faked) = yes
Deferred (LOGGED): online metrics → Track 7 pilot = RISK_REGISTER R-T7-ONLINE-RECSYS-METRICS + DECISION_LOG D14
No parallel/shadow: extends existing evaluation/; runtime-shadow untouched + not imported = yes
Boundaries: live-AI=NONE, external-API=NONE, vectorDB=NONE, new-heavy-dep=NONE, newIngredientIDs=0, migration=none
Coverage gate: green (endpoints/scripts registered: recsys:eval script added; 0 new endpoints)
TRACK 3 summary: included=yes; master commit=c81d2c41 (HEAD after report merge)
Merge/push: exec/garnish-eval-l4-15 → master ff/pushed (commit c81d2c41 + report)
Verdict: EVAL_L4_15_PASS
```
