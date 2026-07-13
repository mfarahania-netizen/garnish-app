# P0-A prerequisite quality blocker

Verdict: **FAIL_BRANCH_REGRESSIONS + BLOCKED_BY_BASELINE (final frozen comparison)**
Base: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
Clean evidence worktree: `C:\dev\garnish-p0a-baseline-1631dc5`

## Reality check

[قطعی] The original Hard PASS cannot be achieved from this base without fixing unrelated pre-existing quality failures. Folding those repairs into P0-A would violate scope-reduction rules and the explicit recipe/ingredient and unrelated-UX exclusions.

## Confirmed pre-existing blockers outside P0-A

| Priority | Gate | Evidence at clean base | Why excluded from P0-A | Proper prerequisite action |
|---|---|---|---|---|
| P1 | Full web tests | Food DNA: 2 deterministic failures | Food DNA page/tests are unrelated to GAR-LAUNCH-004..009 and were not required boundaries | Separate quality PR: decide accessible query contract and Persian-number formatting; update implementation/assertions without weakening them |
| P1 | Server lint | `apps/server/src/recipes/search/tfidf.ts:30:16`, `no-misleading-character-class` | Recipe domain is explicitly frozen for P0-A | Separate recipe-search lint fix reviewed by recipe owner |
| P1 | Web lint | 4 errors in `RealtimeTab.jsx`, `dna-fa.js`, `useMealPlan.js`, `PlatePlaceholder.jsx` | Unrelated render-purity/locale/component debt; no P0-A enforcement dependency | Separate web quality PR, one scoped fix per domain |
| P1 | Test hermeticity | Full server test mutates tracked QA artifact (`declaredDimensions: 22 → 23`) | Generated behavior QA output is explicitly excluded from P0-A commits | Make the generating test write to temp/out-of-repo output or assert in memory; restore tracked fixture |

## Intersecting baseline failures not classified as external blockers

[قطعی] The following also fail at base, but their files/contracts overlap P0-A-owned work and therefore must be evaluated on the frozen branch rather than dismissed:

- two `user.serializer` assertions;
- one `UserExportService` assertion caused by serializer output;
- two onboarding step-6 smoke tests.

[قطعی] All five are green on the frozen branch in both full runs. They count as legitimate branch-owned stabilization, not proof that the base was green.

## Deterministic frozen-branch blockers that must close inside P0-A

| Priority | Frozen blocker | Exact evidence | Minimum honest repair |
|---|---|---|---|
| P0 | Capstone outbox attribution | 1/1 failed twice; outbox harness lacks analytics runtime + canonical epoch | Bring harness to the dual-purpose epoch contract; preserve fail-closed outbox behavior |
| P0 | Ranker epoch fixture drift | 7 tests across ingredient, effort/skill, L0 loop and rejection-effect suites fail twice | Inject current dual-purpose grant epoch and explicit test opt-in; do not bypass production gate |
| P0 | Recipe-prior contract disabled | 4 tests fail twice; production never consumes source because evidence has no timestamp/provenance | Add a provenance/epoch contract or formally defer/remove the feature through owner decision |
| P0 | Analytics producer fixture drift | 4 tests fail twice with missing `userEvent.update` | Add a stateful promotion mock; retain provenance update |
| P0 | OTP onboarding response fixture/contract | 1 test fails twice (`undefined` vs `false`) | Align mock persisted shape or explicitly preserve client response contract |
| P0 | Observability query assertion drift | 1 test fails twice; production adds event timestamp epoch bound | Assert the stronger query exactly; do not remove the safety predicate |

[قطعی] These are branch-only failures. They cannot be reclassified as baseline debt and cannot be waived by passing builds or focused tests.

## Baseline gate summary

| Gate | Result |
|---|---|
| Full server | FAIL — 276/278 suites, 2357/2360 tests |
| Full web | FAIL — 53/55 files, 283/287 tests |
| Server lint | FAIL — 1 error, 18,806 warnings |
| Web lint | FAIL — 4 errors, 35 warnings |
| Server build | PASS |
| Web build | PASS |
| Tests leave tracked tree unchanged | FAIL — one tracked QA JSON changed |

## Frozen branch gate summary

| Gate | Frozen result | Differential |
|---|---|---|
| Full server run 1 | FAIL — 290/299 suites; 2553/2571 tests | 9 branch-only suites / 18 tests |
| Full server run 2 | FAIL — identical 9 suites / 18 tests | Deterministic, not flaky |
| Full web run 1 | FAIL — 142/144 suites; 361/363 tests | Only 2 pre-existing Food DNA tests remain |
| Full web run 2 | FAIL — identical 2 tests | Deterministic, not flaky |
| Server lint | FAIL — 1 error, 20,470 warnings | Same base error; warning debt +1,664 |
| Web lint | FAIL — 4 errors, 33 warnings | Same base errors; 2 fewer warnings |
| Server build | PASS — 37.554s | No build regression |
| Web build | PASS — 19.712s | No build regression |
| Tests leave tracked tree unchanged | FAIL | Same QA JSON mutation in both server runs; restored after each |

[قطعی] Recipes passes all four cases and both onboarding account tests pass inside both full web runs. They are not blockers anymore.

## Release implication

[قطعی] The current verdict is not merely `BLOCKED_BY_BASELINE`: 18 deterministic branch-only server failures remain, so the branch fails its own regression gate. Passing builds do not override failing full tests.

[قطعی] After branch-only failures close, the remaining unrelated baseline debt still requires separate prerequisite work before Hard PASS: two Food DNA assertions/contracts, five lint errors, and hermetic QA-artifact generation.

## Next action

1. Keep implementation freeze except for explicitly assigned repairs to the nine branch-only server suites.
2. Fix shared epoch-aware test fixtures once, then rerun every affected ranker/capstone suite without weakening gates.
3. Resolve recipe-prior provenance as a product/architecture decision; a mock-only patch is insufficient.
4. Re-run the identical full server and web commands twice and require zero branch-only failures.
5. Keep Food DNA, recipe-search lint and unrelated web lint repairs in separate prerequisite quality work.
6. Make behavior QA generation hermetic before claiming tests leave the tracked tree unchanged.
