# P0-A v3.4 final runtime completion report

## Final verdict

`BRANCH_CLEAN_BLOCKED_BY_BASELINE`. Runtime is PASS and the fresh independent reviewer returned `APPROVE`; global PASS is unavailable because inherited baseline debt remains.

## Final runtime evidence

- Reused: accepted v3.3 Scenarios 1–7; not rerun because product/test hashes remained unchanged.
- New: Playwright 1.61.1 with system Google Chrome 150, compiled local API, production preview, generated Service Worker, isolated persistent profiles, and masked QueryClient inspection.
- DB: `garnish_p0a_v34_browser_20260713_235611`; clean zero-row baseline, 52/52 migrations, two deterministic QA fixtures, then exact drop/catalog zero after evidence freeze.
- Scenario count: 13 PASS / 0 FAIL / 0 BLOCKED / 0 NOT RUN.
- Scenario 8: PASS. Scenarios 9, 10, 11, 12, and 13: PASS.
- QueryClient: PASS. Cache Storage/PWA: PASS. Viewports: 24/24 PASS. DB audit: PASS and non-vacuous. Operational audit: PASS.
- Redacted machine ledger SHA256: `5AE13FD0EFC5DD53A196EF7232B8379E51A550C2D2AD14EF9EA355438EAAB267`.
- Residue ledger SHA256: `775CE3F97A068E10AF961EBD60C89200F0D8F24523E5E6F5FF5B31379D182A76`.

## Source and differential

- Product/test source changes during v3.4: none.
- Frozen source/test integrity: 85/85 matches; aggregate `22F6BA3F213D0B94C5CD80ADF6681D0233AD5648F683C9B03762BC868B488C3D`.
- Build/lint/tests during v3.4: not rerun under the unchanged-source efficiency rule.
- Reused baseline debt: 2 unrelated FoodDNA test failures and 5 unrelated lint errors; no new branch-owned failure.

## Review and Git freeze

- Independent reviewer: `APPROVE`.
- Source/report commit hashes: `PENDING_AT_REPORT_FREEZE`.
- Branch push: PENDING.
- Master: untouched. Local master `d3ffde74b8415843b863799465f8390a408bd48b`; observed `origin/master` drifted from the frozen base to `fa2c6c84d51c4da7167895f1c765ce662eca2b72` during the task.
- Exact next action: obtain the fresh independent review; if APPROVE, explicitly stage only allowlisted P0-A source/test/architecture/report/evidence paths, commit, and push the validated branch without force.
