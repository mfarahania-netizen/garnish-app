# P0-A browser runtime release unlock v3.4

## Decision

Runtime evidence is **PASS**: 13/13 scenarios, QueryClient, PWA/cache, 24/24 viewports, operational audit, and the non-vacuous DB audit all passed. The fresh independent reviewer returned `APPROVE`; the repository verdict is `BRANCH_CLEAN_BLOCKED_BY_BASELINE`, not global PASS, because inherited baseline debt remains.

## Evidence boundary

- Reused: accepted v3.3 Scenarios 1–7 only; historical v3.3 Scenario 8/browser blocker is superseded.
- New: Playwright 1.61.1 with system Google Chrome 150, compiled API, production preview, generated Service Worker, isolated persistent profiles, Scenarios 8–13, storage/QueryClient ledgers, 24 viewport screenshots, and 15-table DB audit.
- Machine ledger: `evidence/browser-v3/v34/machine_result.json` (`5AE13FD0EFC5DD53A196EF7232B8379E51A550C2D2AD14EF9EA355438EAAB267`).

## Results

- Scenarios 1–7: 7 PASS (reused); Scenarios 8–13: 6 PASS (new); total 13 PASS / 0 FAIL / 0 BLOCKED / 0 NOT RUN.
- QueryClient isolation: PASS; no Account-A private query/scope after logout or in Account B.
- Cache/PWA: PASS; legacy private cache removed and authenticated API cache entries zero.
- Viewports: 24/24 PASS at 360, 390, 430, and 480 CSS px.
- DB: PASS and non-vacuous; two accounts, consent history, pre-withdrawal evidence, committed withdrawal, zero post-withdrawal optional writes, zero replay/cross-account association, UserAuditLog present, secret metadata matches zero.
- Cleanup: exact DB `garnish_p0a_v34_browser_20260713_235611` dropped after evidence copy; catalog/prefix count zero; exact QA listener count zero.

## Source, tests, and Git

- v3.4 product/test source changes: none; 85/85 frozen hashes match.
- No build/lint/test rerun in v3.4 under the unchanged-source efficiency rule. Reused baseline: 2 unrelated FoodDNA failures and 5 unrelated lint errors.
- Reviewer: `APPROVE`.
- Commit hashes: `PENDING_AT_REPORT_FREEZE`; push: PENDING.
- Master untouched. Local master `d3ffde74b8415843b863799465f8390a408bd48b`; observed `origin/master` `fa2c6c84d51c4da7167895f1c765ce662eca2b72`.
- Exact next action: fresh independent review, then explicit allowlisted staging and validated branch push.
