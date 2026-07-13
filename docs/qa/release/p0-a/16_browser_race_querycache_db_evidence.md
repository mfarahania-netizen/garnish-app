# P0-A v3.3 canonical runtime addendum

Date: 2026-07-13 (Asia/Tehran)
Verdict: **BLOCKED_BY_BROWSER_ENV**
This addendum supersedes every downstream-current-status statement below; the v2 and earlier v3 text is retained as history only.

## Current measured result

- Scenarios: **7 PASS / 0 FAIL / 1 BLOCKED / 5 NOT RUN**.
- Original Scenario 1 marker: public recipe title; `PUBLIC_SHARED_CONTENT` + `INVALID_TEST_MARKER`; historical FAIL was a false positive.
- Corrected Scenario 1: **PASS** across six private surfaces.
- Scenarios 2–7: **PASS**.
- Scenario 8: **BLOCKED** after synthetic legacy caches were created and current worker activation caused client navigation; Chrome control did not recover after two reconnect attempts.
- Scenarios 9–13: **NOT RUN** under the mandatory stop condition.

## QueryClient/cache evidence

- Account A and B produced different masked account scopes during completed checkpoints.
- After Account A logout, private QueryClient entry count was 0 in both tabs.
- One remaining account-unscoped public recipe-catalogue query was allowed; it is not private residue.
- Offline reload served no private A or B DOM and online recovery returned Account B state.
- QueryClient verdict: **PARTIAL**, because standalone Scenario 13 and post-Scenario-8 checkpoints did not run.
- PWA/Cache Storage verdict: **BLOCKED**, because post-activation legacy-cache deletion/public-only allowlist was not observable.

## Database evidence

Before guarded cleanup, all 15 required tables were counted. `User=2`, `UserConsent=4`, `ConsentLog=4`; the other 12 required tables were zero. Cross-account favorite/plan/shopping joins and scanned secret metadata occurrences were zero. This is a measured non-empty snapshot, but the release audit is **INCOMPLETE** because no pre-withdrawal event, concurrent withdrawal epoch, dropped-event proof or re-consent no-replay proof exists.

Exact cleanup passed: API/preview processes stopped, DB `garnish_p0a_v3_browser_20260713_145934` dropped, catalog count 0.

No product/test source was changed in v3.3. No commit, push, merge or `master` action occurred.

---

# P0-A v2 browser race, QueryClient, cache and DB evidence

Date: 2026-07-13 (Asia/Tehran)
Status: **BLOCKED_BY_BROWSER_ENV**

## Direct conclusion

The production-preview stack and disposable database were created successfully, but the required browser matrix was not completed. The in-app browser read the login page once and then lost usable CDP control. Playwright interaction, a fresh DOM read, DOM-control inspection, and navigation in a fresh tab all timed out. Chrome was installed and running, but the ChatGPT Chrome Extension was absent from every detected Chrome profile, so the documented Chrome fallback was unavailable.

No browser scenario, QueryClient enumeration, viewport measurement, withdrawal race, or account-isolation result is represented as PASS. The earlier v1 browser report remains reference-only.

## Production-preview environment reached

- Web: Vite production build and preview on `http://127.0.0.1:4173`.
- PWA: `vite-plugin-pwa` generated `dist/sw.js` and `dist/workbox-398fc23b.js`; 12 public precache entries.
- E2E build: `VITE_E2E_QUERY_INSPECTION=true` and `VITE_API_URL=http://127.0.0.1:3000`.
- API: compiled Nest server on `127.0.0.1:3000`.
- Database: local PostgreSQL 16 database `garnish_p0a_v2_browser_20260713_0317` only.
- Schema: all 52 existing migrations applied with `prisma migrate deploy`.
- No migration was created. No recipe/ingredient seed or import was run.
- Optional analytics and personalization were explicitly enabled only for this isolated QA server; derived outcomes and smart suggestions remained disabled.
- AI provider was the local stub; live AI, Google auth, and external SMS delivery were disabled.

The application startup created its six normal workflow definitions. This was application boot behavior, not a seed/import command, and no user or optional-processing row was created.

## E2E-only QueryClient inspection contract

The final source adds a narrowly scoped inspection function in `apps/web/src/lib/private-session-cache.js` and installs it from `apps/web/src/App.jsx` only when:

```text
import.meta.env.VITE_E2E_QUERY_INSPECTION === 'true'
```

The global is absent/deleted for the default and every non-exact value. When explicitly enabled, it returns only:

- a safe top-level query namespace;
- a 16-hex SHA-256 prefix of the complete query key;
- a 16-hex SHA-256 prefix of the current account token as the account-scope identifier;
- query status;
- a `dataPresent` boolean.

It never returns raw tokens, account identifiers, nested query-key values, search terms, or cached data. Focused Vitest evidence passed 5/5 files and 35/35 tests, including two direct inspection tests. Full-web final runs also included and passed these new tests.

Runtime QueryClient enumeration after logout and A-to-B was **not executed** because browser control failed before the first synthetic account login. Therefore the code/test contract is green, but the browser evidence requirement remains unverified.

## Browser attempts and exact blocker

1. The in-app browser opened the production preview and returned the login DOM (`به گارنیش خوش آمدی`, phone input, local OTP button).
2. Before any form submission, the first unique-locator operation timed out.
3. A fresh Playwright DOM snapshot timed out.
4. The documented DOM-control fallback timed out while reading the frame tree.
5. A newly created tab timed out navigating to the same localhost login URL.
6. The documented Chrome fallback was retried once after two seconds and remained unavailable.
7. Chrome diagnostics found:
   - Chrome installed and running;
   - native messaging host manifest present and valid;
   - ChatGPT Chrome Extension not installed/enabled in `Default`, `Profile 1`, or `Profile 2`.

No OTP, phone value, account state, consent mutation, optional event, screenshot, or private cache value was transmitted or captured before the failure.

## Required scenario matrix

| Required scenario | v2 result | Reason |
|---|---|---|
| Account A distinct private state | UNVERIFIED | browser control failed before login |
| Account B distinct private state | UNVERIFIED | browser control failed before login |
| A to logout to B without restart | UNVERIFIED | no accounts created |
| Cross-tab logout | UNVERIFIED | no authenticated tab |
| Back/forward after logout | UNVERIFIED | no authenticated history |
| Offline/network failure | UNVERIFIED | browser network control not reached |
| Legacy worker/cache upgrade | UNVERIFIED_V2 | earlier v1 evidence is reference-only |
| Consent grant | UNVERIFIED | no account session |
| In-flight withdrawal + optional event + refresh + reconnect | UNVERIFIED | browser control blocked |
| Re-consent with no replay | UNVERIFIED | browser control blocked |
| Account switch during delayed response | UNVERIFIED | browser control blocked |
| Direct masked QueryClient enumeration | UNVERIFIED_RUNTIME | implementation/tests pass; browser call not reached |
| Viewports 360/390/430/480 | UNVERIFIED | capability could not be exercised |
| Direct DB residue audit | COMPLETE_BUT_VACUOUS | all counts zero because no browser account/event existed |

## Direct DB audit and disposal

Before disposal, direct SQL returned zero rows for each of these 15 tables:

`User`, `UserConsent`, `ConsentLog`, `UserEvent`, `RecommendationExposure`, `FeatureContributionLog`, `RecommendationServedItem`, `RecommendationAttributionEvent`, `SignalObservation`, `UserFeature`, `UserOutcome`, `UserBehaviorTimeline`, `ExperimentAssignment`, `EventOutbox`, and `UserAuditLog`.

This proves cleanup and absence of unintended startup residue. It does **not** prove post-withdrawal or cross-account correctness because no withdrawal or account existed. The transaction interleavings A-J remain the deterministic race evidence in report 11.

The API and preview listeners were stopped after verifying their exact command lines. The database name was matched exactly, dropped with forced local disconnection, and the PostgreSQL catalog count after drop was `0`.

## Gate decision and exact next action

Phase 8 cannot approve. The next action is to install/enable the ChatGPT Chrome Extension (or restore stable in-app browser control), rebuild the same E2E production preview, recreate a fresh disposable database, and execute all 13 scenarios plus masked QueryClient and exact viewport measurements. Until that happens, no commit or push is authorized.

## V3 Chrome preflight addendum

V3 explicitly requested the Chrome plugin and used its bounded preflight. Both allowed attachment attempts returned `Browser is not available: extension`. Chrome was installed/running and the native host was valid, but the ChatGPT Chrome Extension was absent from all three detected profiles. Per the retry guard, v3 stopped before creating a database or starting preview processes. No v2 browser claim was upgraded, and this report remains `BLOCKED_BY_BROWSER_ENV`.

### V3 closure disposition

- Branch: `fix/p0-a-safety-consent-session-isolation-v1`
- HEAD/base and `origin/master`: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- V3 environment / database name: `NOT_CREATED` / `NONE`
- Scenario matrix: 0 PASS / 0 FAIL / 13 BLOCKED
- A-to-B, cross-tab, back/forward, offline, legacy worker, concurrent withdrawal/refresh, re-consent, delayed response: BLOCKED, not executed
- QueryClient / Cache Storage / service-worker inspection: BLOCKED, not executed
- Viewports 360/390/430/480: 6-route × 4-width plan recorded; `request_applied=false`; no measurement or screenshot claimed
- DB residue: BLOCKED; no DB existed, 15 table inspections are `NOT_RUN`, and 8 required checks are blocked rather than vacuously passing
- Independent reviewer: `BLOCKED`
- Code integrity: `NO_CODE_TEST_CHANGE_DETECTED` with qualified-high confidence; current SHA256 freeze covers 37 production and 48 test paths, but no historical final-v2 per-file hashes exist
- Files changed by v3: the 14 mandatory report/evidence artifacts only
- Commits / push / master action: none / not attempted / none
- Remaining baseline debt: prior two FoodDNA failures, one server lint error, and four web lint errors; not rerun or changed by v3

Exact next action: install/enable the supported Chrome extension in a dedicated non-personal profile and resume the same task. Pass a fresh bounded Chrome preflight before creating any environment or `garnish_p0a_v3_browser_<timestamp>` database. Execute all 13 browser-linked gates and obtain a fresh independent `APPROVE` before any stage, commit, or branch push.

## V3 Scenario 1 post-install addendum — 2026-07-13

[قطعی] This addendum supersedes the historical pre-install environment blocker only for the post-install Scenario 1 execution. It does not rewrite or upgrade the historical evidence above.

- [قطعی] Scenario: `SCENARIO_01 — Account A authenticated state`
- [قطعی] Result: **FAIL**
- [قطعی] Environment: database `garnish_p0a_v3_browser_20260713_145934`; API HTTP 200; preview HTTP 200; no database recreation or migration
- [قطعی] Login: Account A login through the real local OTP UI **PASS**; raw phone, OTP, token, cookie and user ID omitted
- [قطعی] Route progress: `/` checked; profile, settings, favorites, meal plan and shopping list not opened because the stop-on-defect rule fired; checked routes=1/6
- [قطعی] Account A markers on `/`: display marker and Account A favorite marker present
- [قطعی] Account B marker absence on `/`: **FAIL** — `QA-FIXTURE-B Minimal Omnivore`, the title assigned to Account B's unique favorite fixture, was visible
- [قطعی] Guard/render checks on `/`: no login redirect; no onboarding redirect; busy count=0; visible error count=0; client width=375; scroll width=375; horizontal overflow=false
- [قطعی] Evidence: `S01-A-HOME-TOP` redacted screenshot plus `S01-A-HOME-DOM` masked route check; sensitive-data flag=false
- [قطعی] Scope qualification: the title is a public disposable Recipe record. Its visibility fails the explicit marker-absence contract, but this observation alone does not establish a cross-account private-row association.
- [قطعی] Matrix after stop: 0 PASS / 1 FAIL / 0 BLOCKED / 12 PENDING. Scenario 2–13 remain unexecuted and unchanged.
- [قطعی] Preservation: no logout, second tab, offline mode, fixture change, product/test source change, stage, commit, push, merge or master action

Exact next action: review and resolve the Scenario 1 marker-contract failure on `/`, then rerun Scenario 1 from the beginning. Do not begin Scenario 2 while Scenario 1 remains `FAIL`.
