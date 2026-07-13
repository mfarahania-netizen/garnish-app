# P0-A v3.4 storage, PWA, and QueryClient evidence

## Verdict

**PASS**; fresh independent review: `APPROVE`.

- Reused evidence: accepted Scenarios 1–7 from v3.3.
- New method: Playwright 1.61.1, system Google Chrome 150, isolated persistent profiles, generated Service Worker, and the masked E2E QueryClient inspector.
- DB: `garnish_p0a_v34_browser_20260713_235611`; 52/52 migrations; dropped after evidence freeze, catalog zero.
- Scenario 8: PASS — legacy private cache removed, precache manifest exact, authenticated API cache entries zero, approved public runtime cache only.
- Scenarios 9–11: PASS — independent consent grants, real withdrawal/event/refresh overlap, zero post-withdrawal optional writes, and zero re-consent replay.
- Scenario 12: PASS — delayed Account-A response did not enter Account-B DOM or QueryClient; fresh Account-B response contained only the B marker.
- Scenario 13: PASS — Account-A scope existed only while A was active; logout state was empty; later private rows were B-scoped; public recipe namespaces were separately classified.
- localStorage/sessionStorage/IndexedDB/cookie-name/cache checks: PASS; no prior-account private browser state after logout or B login.
- Viewports: 24/24 PASS. DB audit: PASS.
- v3.4 product/test changes: none; 85/85 frozen hashes match; build/lint/tests not rerun. Inherited baseline remains 2 FoodDNA failures and 5 lint errors.
- Reviewer: `APPROVE`; report commit `PENDING_AT_REPORT_FREEZE`; push PENDING; master untouched.
- Exact next action: fresh independent evidence review, then allowlisted branch commit/push if approved.
