# P0-A Atomic Consent Boundary & Branch Regression Closure Gate v2

Date: 2026-07-13 (Asia/Tehran)
Final verdict: **BLOCKED_BY_BROWSER_ENV**

## Executive conclusion

The branch-owned code and differential quality gates are clean relative to the known base: the shared per-user database boundary is implemented, real PostgreSQL A-J pass, SignalDetector returns before discovery while runtime is off, all 18 frozen branch failures are closed, the active inventory has zero ungated P0 writer, full-server runs pass twice, the branch adds zero web failure and zero lint error, and both builds pass.

Release preservation is still blocked. The production preview and disposable database started, but browser control failed before the first synthetic login. Direct A-to-B, multi-tab, offline/back-forward, legacy-worker, refresh-during-withdrawal, delayed-response, masked QueryClient, viewport and browser-linked DB-residue evidence was not obtained. The independent reviewer therefore returned `BLOCKED`, not `APPROVE`. Under the explicit commit policy, no stage, commit or push is permitted.

## Identity, base and preservation

- Branch: `fix/p0-a-safety-consent-session-isolation-v1`
- HEAD/base: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- Current `origin/master`: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- Local `master`: `d3ffde74b8415843b863799465f8390a408bd48b` (unrelated, untouched)
- Base divergence: none
- External snapshot: `C:\Users\mfara\.codex\snapshots\garnish-p0-a\20260713-015745-pre-v2`
- Bundle SHA256: `F38A125869FFCB022BF3136D4144697E641CB7287AA86646AE86594A85A6F9C4`
- Patch SHA256: `8FA29C73F99A2958B2627185AE16ADC89E23F6E35B3B8FF21CB36E6564748586`
- Initial tracked diff: 153 files, 8,111 insertions, 1,973 deletions
- Initial P0-A untracked set: 73 files
- Final tracked diff: 157 files, 9,694 insertions, 2,650 deletions
- Final P0-A untracked set: 94 files, excluding the 35 old untouched `docs/qa/launch/**` files

## Transaction boundary result

The canonical helper uses one Prisma interactive transaction and the canonical `User` row `FOR UPDATE` under PostgreSQL `READ COMMITTED`. Runtime, current policy, latest consent decision and exact expected epoch are checked after the lock. Optional writes receive only the locked transaction client. Timeouts are bounded, retries are limited to three known lock/serialization conflicts, and exhaustion surfaces a structured operational error. No network/provider call is made under the lock and compensating delete is not the safety invariant.

Real PostgreSQL evidence passed A-J 10/10. Withdrawal-first prevents the later writer callback and produces zero optional row; writer-first permits only the pre-withdrawal row. Exceptions/process-callback failures roll back. Cleanup failure is irrelevant to authorization. Stale policy, uncommitted grant and runtime-off all deny. The independent reviewer reran the critical B and H directions on a fresh disposable PostgreSQL database; both passed and residue was zero before the database was dropped.

## Runtime, regression and inventory results

- SignalDetector: runtime flags are checked before logs, user discovery, consent reads, optional tables, snapshots, feature store or downstream processors; 1/1 suite and 6/6 tests PASS.
- Frozen 18 branch failures: closed without assertion weakening. Agent-C final lane 8/8 suites and 60/60 tests PASS; RecipePrior lane 2/2 suites and 19/19 tests PASS.
- OTP contract: persisted registered users expose a stable `onboardingComplete` boolean.
- Observability contract: requires user, grant epoch, personalization purpose and event timestamp provenance.
- RecipePrior: Option B. It remains fail-neutral without a real evidence envelope; `updatedAt` is not accepted as observation provenance.
- GAP inventory: all 81 rows classified; 36 active gated, 14 read-only filtered, 21 deferred with kill switch, 5 runtime disabled, 5 legacy disabled, zero active ungated and zero unknown.

## Focused validation

- Final comprehensive server lane: 46/46 suites, 360/360 tests PASS; Jest 34.856s, shell 37.6s.
- Final web consent/session/impression/cache lane: 13/13 files, 102/102 tests PASS; Vitest 25.24s, shell 27.6s.
- Final QueryClient-inspection/session subset: 5/5 files, 35/35 tests PASS.
- Independent adversarial lane: server 11/11 suites and 89/89 tests PASS; web 4/4 files and 33/33 tests PASS.

## Full differential validation

Controlled environment used Node 26.1.0, pnpm 9.1.0, `CI=true`, 8192 MB Node heap, a guarded unreachable loopback database for unit/full suites, unset optional/provider variables and fresh Prisma generation before every run.

| Worktree / target | Run 1 | Run 2 | Classification |
|---|---|---|---|
| Base server | 276 passed suites; 2 failed suites; 2,357/2,360 tests passed | identical membership/counts | 3 deterministic baseline failures |
| Branch server | 300 passed, 1 skipped suite; 2,593 passed, 10 skipped tests; zero failures | identical membership/counts | PASS twice; zero branch failure |
| Base web | 53/55 files; 283/287 tests; 4 failures | identical membership/counts | 2 FoodDNA + 2 Onboarding baseline failures |
| Branch web final | 62/63 files; 363/365 tests; 2 failures | identical membership/counts | only the same 2 baseline FoodDNA failures |

The branch fixes all three base server failures and both base Onboarding failures. It adds zero test failure.

Builds passed on base and branch. The final branch server build and the production/PWA web build with the explicit E2E inspection flag passed. Lint remains globally red but the branch error membership is identical to base: one server error in `tfidf.ts` and four web errors in `RealtimeTab.jsx`, `dna-fa.js`, `useMealPlan.js` and `PlatePlaceholder.jsx`. New branch lint errors: zero.

## Browser, QueryClient and DB result

The production preview, generated service worker, compiled API and a dedicated database with all 52 existing migrations started successfully. No new migration, recipe seed/import, production DB or live provider was used.

The E2E-only QueryClient inspector is implemented and tested. It is enabled only by exact `VITE_E2E_QUERY_INSPECTION=true` and returns only masked query/account hashes, a safe namespace, status and a data-presence boolean. Raw cache data, tokens and identifiers are not exposed.

Runtime browser evidence is blocked. The in-app browser read the login DOM once, then Playwright, DOM control and a fresh-tab navigation all timed out. Chrome was installed/running and its native host was valid, but the ChatGPT Chrome Extension was absent from all detected profiles. No login, consent mutation or optional event occurred.

Direct SQL before cleanup found zero rows in 15 optional/consent/audit tables and the QA database was dropped with catalog count zero. This result is intentionally classified as vacuous: it proves clean startup/disposal, not withdrawal or cross-account correctness.

## Independent adversarial result

Reviewer verdict: **BLOCKED**. No blocking product-code defect was found in the reviewed attack surface, and critical PostgreSQL B/H passed independently. Seven browser-linked attacks remain blocked: A-to-B, multi-tab, offline/back-forward, legacy-worker upgrade, delayed account-switch response, direct QueryClient residue and browser-linked DB residue. The coordinator cannot override this verdict.

## Git and release status

- Staged files: zero
- Commit hashes: none
- Push status: not attempted
- Master checkout/mutation/push: none
- Production deployment: none
- Merge authorization: none

## Mandatory reports

Repository-relative root: `docs/qa/release/p0-a/`

- `P0A_PROGRESS.md`
- `10_v2_scope_and_snapshot_report.md`
- `10_v2_file_ownership.csv`
- `11_transaction_boundary_report.md`
- `12_signal_detector_boundary_report.md`
- `13_branch_regression_closure_report.md`
- `14_gap_classification.csv`
- `14_gap_classification_report.md`
- `15_v2_full_suite_differential_report.md`
- `16_browser_race_querycache_db_evidence.md`
- `17_adversarial_rereview.md`
- `p0_a_atomic_consent_branch_closure_v2_report.md`
- `test_results_v2.json`
- `changed_files_v2.csv`
- `open_risks_v2.json`

Absolute report root: `C:\Users\mfara\.codex\worktrees\6a1d\garnish-app\docs\qa\release\p0-a`

Architecture decisions:

- `docs/architecture/p0-a/optional_processing_transaction_boundary_v2.md`
- `docs/architecture/p0-a/recipe_prior_provenance_decision_v1.md`

## Exact next action

Do not stage, commit or push. Restore a controllable browser session, recreate a fresh disposable QA database and production preview, run all Phase 8 scenarios plus masked QueryClient and exact viewport evidence, update report 16, and request a new independent review of the unchanged tree. Only a green browser/DB gate and an independent `APPROVE` may unlock the atomic commit sequence.
