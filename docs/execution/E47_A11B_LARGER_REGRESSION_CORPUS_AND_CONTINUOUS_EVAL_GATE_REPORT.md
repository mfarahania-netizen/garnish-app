# E47-A11B — Larger Regression Corpus & Continuous Eval Gate (R4 mitigation)

**Task:** E47-A11B-LARGER-REGRESSION-CORPUS-AND-CONTINUOUS-EVAL-GATE · **Date:** 2026-06-14 · **Owner:** AA / EL
**Branch:** `exec/e47-a11b-regression-corpus` (not merged — awaiting acceptance) · **Master baseline:** `e7379212`
**Scope:** expand the A11A output-safety harness into a 50+ case EN+Farsi regression corpus + a CI-safe deterministic offline eval gate. **Evaluation/governance only — not product enablement, not live-Gemini default.**

---

## ✅ Final verdict: `E47_A11B_OUTPUT_SAFETY_REGRESSION_GATE_PASS`

A **54-case** EN+Farsi regression corpus (14 categories) + corpus schema/secret/PII validation + a **CI-safe offline gate** (no key/network/DB; exits non-zero on unsafe pass / over-block) are implemented, **adversarially reviewed, and hardened**. Reuses the A11A evaluator/harness. **R4 stays Mitigating** (strengthened, not Closed). **R3 stays Mitigating.**

---

## 1. Files changed
- **New** `apps/server/src/ai/eval/output-safety/corpus/`: `regression-corpus.ts` (54 cases + breakdown helpers), `corpus-validation.ts` (schema + secret/PII validation).
- **New** `apps/server/src/ai/eval/output-safety/output-safety-regression.spec.ts` (validation tests + offline gate + adversarial-fixture failure proofs).
- **New** `docs/qa/ai/e47_a11b_output_safety_regression_results.json` (redacted artifact).
- **Modified (in-scope, eval-only):** `output-eval-cases.ts` (+optional `language`/`EvalLanguage`), `output-safety-evaluator.ts` (food-safety vocab +`sushi`, a review fold-in), `apps/server/package.json` + root `package.json` (+`ai:eval:regression`).
- **Docs:** this report · RISK_REGISTER · WEEKLY · index. **No runtime guard/orchestrator/provider/schema change.**

## 2. Corpus size & breakdown
**54 cases.** Language: **EN 33 / Farsi 21**. Categories: **all 14** (safe food, recipe improvement, Persian recipe, prompt injection, medical diagnosis, strict-diet/weight-loss, allergy inference, pregnancy/child-sensitive, fake fridge-photo, bypass safety, hallucinated capability, unsafe food handling, overconfident nutrition, refusal quality). **32 mustBlock** (blocked before provider) + **22 non-block** (pure-safe baselines + output-risk). Each case: `id, category, language, input, expectedSafetyStatus, mustBlock, mustRefuse, blockAcceptable, forbiddenClaims, requiredBehavior, severity, notes`. Prompts are **synthetic** (no real PII/secrets).

## 3. Corpus validation behavior
`validateCorpus()` (deterministic, offline) enforces: unique non-empty ids; valid category/language/severity/expectedSafetyStatus; non-empty input + requiredBehavior; valid `forbiddenClaims`; duplicate-case detection (category+normalized input); and a **secret/PII scan** (Google/sk/pk/ghp keys, Bearer, JWT, private-key header, email, phone≥9-digits, connection string) across input + requiredBehavior + notes + id. **Crash-safe** on malformed (non-string) input; **no false-positive** on innocent recipe number ranges (e.g. "10 - 12 - 15 minutes").

## 4. Continuous offline gate
`output-safety-regression.spec.ts` runs the full corpus through the real Orchestrator in **stub/offline** mode (`offlineEnv()` strips the flags; mock Prisma; no network/key/DB). It **fails (non-zero jest exit)** if any case fails — i.e. an unsafe request not blocked, unsafe content delivered at `ok`, or a pure-safe baseline over-blocked. Package scripts `ai:eval:regression` (root + server) run it (`jest src/ai/eval/output-safety` — the whole offline output-safety suite, A11A+A11B). Verified the gate script exits **0** on the clean corpus.

## 5. Results artifact summary
`docs/qa/ai/e47_a11b_output_safety_regression_results.json`: `runMode: offline`, `liveEnabled: false`, `totalCases: 54`, `passed: 54`, `failed: 0`, `categoryBreakdown` (14), `languageBreakdown` (en 33 / fa 21), `blockedBeforeProvider: 32`, `providerCalls: 0`, redacted `failureDetails` (ids/categories/severity/reasons — **no raw prompt, no secret**), `timestamp`, `schemaVersion: 1`.

## 6. Tests / build results
- **Output-safety suite: 46/46** (A11A 32 + A11B 14): corpus validation (well-formed, ≥50, both langs, 14 categories, duplicate/invalid/empty/secret rejection incl. all 8 patterns, recipe-range non-false-positive, crash-safety); offline gate (54/54, 0 live calls, 32 blocked-before-provider, redacted artifact); **adversarial-fixture failure proofs** (EN+Farsi, every eval-only detector family → `failed === subset`); over-block FAIL; leaked-refusal FAIL.
- **Full AI unit suite: 176/176 (23 suites)**; deterministic eval green; default chat smoke skip; **`pnpm build` green**; direct-Gemini grep provider-only; `.env` untracked, no secret.

## 7. Live subset result
**Not run** (the task makes live optional and not required for CI; A11A already ran a live subset 4/4). The gate is deterministic-offline by design.

## 8. Adversarial review (3 lenses) → folded in
All lenses `pass_with_minor` (no blockers). Folded in: (a) **major** — the offline gate didn't exercise the Farsi/output-risk detectors → expanded the adversarial fixture to EN **and Farsi** unsafe outputs across every eval-only detector family, asserting each fires; (b) **major** — added `sushi` to the food-safety vocab (real pregnancy food-safety gap); (c) validation hardening (crash-safety on non-string input, phone-regex tightened to avoid recipe-range false-positives, secret scan widened to all persisted fields); (d) rephrased regex-bait prompts to natural EN/Farsi; (e) added a pregnancy **output-risk** case (distinct from the medical-block aliases); (f) added over-block + leaked-refusal + full secret-pattern test coverage; (g) honest header (known-pattern **regression**; novel-evasion robustness explicitly out of scope).

## 9. Secret / PII safety
Corpus prompts are synthetic and pass the secret/PII validator (zero false positives). The artifact carries only ids/categories/severity/reasons/counts (no raw prompt, no output, no key). The validator scans every run/persisted field. Harness never writes the real DB.

## 10. Direct-Gemini scan
Production Gemini usage remains provider-only; the harness reaches the model only via the Orchestrator → `ModelProvider`. No direct call added.

## 11. R4 status recommendation
**R4 stays Mitigating (NOT Closed).** A11B strengthens R4: a durable, CI-runnable regression gate now guards the deterministic output detectors (EN+Farsi) against regressions, with both failure directions (unsafe-pass and over-block) proven. **Not Closed** because: the offline gate uses the **stub** (real model-output safety at scale still needs periodic live runs); the corpus is a **known-pattern regression** set, not robustness against novel evasion (delimiter/markup injection, obfuscation, indirect injection are out of scope — future fuzz/red-team work); and the corpus, while broad, is still finite. **R3 stays Mitigating** (unchanged by this task).

## 12. Remaining gaps
- Offline gate exercises detectors via fixtures + at-input guards; at-scale **live** output coverage remains periodic/manual.
- Novel-evasion robustness (obfuscation, markup/2nd-order injection) intentionally out of scope for the deterministic gate.
- `refusal_quality` corpus cases block at input (refusal = block); leaked-refusal detection is proven by a dedicated evaluator test, not by a live refusal.
- Corpus is finite; grow over time before any product rollout.

## 13. Confirmations (what was NOT done)
- ✅ No live-Gemini default · no live-chat default · no streaming · no model-driven tools · no agents/LangGraph · no vision · no medical/diet advice · no runtime guard weakened (the evaluator/`sushi` change is eval-layer detection, runtime guards unchanged).
- ✅ No UI · no recipe import · no destructive retention · no erasure/export/retention change · no billing/charging · no `.env`/secret committed.
- ✅ R4 NOT claimed Closed; AI Core NOT claimed complete.

## 14. Not claimed
AI Core complete · live Gemini product-enabled · medical/diet advice supported · vision supported · agents enabled · R4 closed — **none** claimed.

**Stopping after this report. Not merged — awaiting Founder/Reviewer approval.**
