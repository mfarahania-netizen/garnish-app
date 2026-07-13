# P0-A Safety, Consent & Session Isolation — Stabilization Closure Report

Date: 2026-07-13 (Asia/Tehran)

## 1. Final verdict

**CHANGES_REQUIRED**

This verdict takes precedence over `BLOCKED_BY_BASELINE`: the base is red, but the frozen P0-A branch also has 18 deterministic branch-only server-test failures, an independent adversarial `CHANGES_REQUIRED`, and a non-atomic withdrawal/write boundary that can leave optional database residue. Baseline debt cannot excuse branch-owned failures.

No commit, stage, push, merge, deployment, migration, production database access, or production provider activation was performed.

## 2. Identity

- Branch: `fix/p0-a-safety-consent-session-isolation-v1`
- Base/HEAD: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- `origin/master`: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
- Local `master` ref at final observation: `d3ffde74b8415843b863799465f8390a408bd48b` (external/shared-repository state, not created or moved by this task).
- Master action status: this task never checked out, committed to, pushed, reset, or otherwise mutated master. The current P0-A branch still has zero commits beyond its audited base.

## 3. Safety snapshot

- Snapshot root: `C:\Users\mfara\.codex\snapshots\garnish-p0-a\20260712-232628`
- Bundle: `garnish-p0-a-pre-stabilization-snapshot.zip`
- Bundle SHA256: `86fcf9ad02173d4e3d3e2e3d302b9cd898d33a9aa584dd26e818f874fec29a11`
- Binary patch SHA256: `f18170cd3c2f44daf9a90201b87dc1d93132ad83b0d649fc092552268cd91d79`
- Readability verification: archive listing and binary-patch numstat succeeded before stabilization edits.

## 4. Initial versus final diff

| Measure | Initial | Final |
|---|---:|---:|
| Tracked changed files | 117 | 153 |
| Tracked insertions | 4,753 | 8,111 |
| Tracked deletions | 1,053 | 1,973 |
| Allowed untracked P0-A files | 43 | 73 |
| Review files excluding old launch artifacts | 160 | 226 |
| Staged files | 0 | 0 |

The final surface is technically classified but materially larger and harder to review than the initial snapshot. Atomic commits were not created because Hard PASS was not reached.

## 5. Scope matrix and exclusions

Final matrix: `05_diff_scope_matrix.csv`

- 262 rows after adding this report;
- 34 `CORE_REQUIRED`;
- 65 `BOUNDARY_REQUIRED`;
- 92 `TEST_REQUIRED`;
- 35 `REPORT_REQUIRED`;
- 1 `GENERATED_REVERT`;
- 35 `LEGACY_UNTRACKED_EXCLUDE`;
- zero duplicate paths, blank required cells, invalid classifications, or uncovered final files.

Reverted/excluded:

- `docs/qa/behavior/profile_l4_05_declared_qa_results.json` was restored to base after every full server run;
- 35 old `docs/qa/launch/**` files remain untouched and excluded;
- generated Prisma/client/build output and disposable browser fixture files remain ignored;
- no real `.env`, media/raw, recipe data, ingredient data, P0-B, P0-C, or unrelated formatting was included.

The only recipe-domain source exception is a narrow analytics/provenance boundary; recipe content/catalog data was not changed.

## 6. GAR-LAUNCH finding results

| Finding | Result | Evidence and limitation |
|---|---|---|
| GAR-LAUNCH-004 | IMPLEMENTED, release gate red | Critical onboarding state is one serializable command/transaction; completion occurs only after canonical read-back. Focused server 16/16 and web 18/18 passed. |
| GAR-LAUNCH-005 | IMPLEMENTED | Unsupported allergy severity was removed; binary allergy declaration and honest safety copy are covered by focused tests and browser profile/settings evidence. |
| GAR-LAUNCH-006 | IMPLEMENTED | Settings critical hydration is fail-closed; diet and allergy writes are field-specific, so a failed read cannot send an empty replacement set. |
| GAR-LAUNCH-007 | PARTIAL / CHANGES_REQUIRED | Settled deny and sequential withdrawal cause zero analytics write; browser DB evidence is green. The consent-check-to-write race is not atomic and can leave a row after interruption/delete failure. |
| GAR-LAUNCH-008 | IMPLEMENTED with legal and atomicity blockers | Terms and optional personalization are separated; optional consent defaults off and versions/source are server-owned. Legal sufficiency remains unapproved, and optional writers share the race above. |
| GAR-LAUNCH-009 | CORE SCENARIOS PASS; browser Hard PASS withheld | Private API Workbox caching is removed, legacy `api-cache` purges, logout/cross-tab/account switch fail closed, and A data was not visible to B. Exact refresh-during-withdrawal, direct QueryClient enumeration, and exact-width screenshot evidence remain incomplete. |

## 7. Admin, analytics, and operational audit boundary

Focused admin/analytics closure passed 10/10 suites and 71/71 tests. Admin authorization no longer substitutes for subject consent. Optional surfaces either use current-policy/current-epoch population filters or return an explicit unavailable contract before optional database I/O; mixed legacy stores without provenance are not presented as zero analytics.

`AdminService.recordAudit()` writes only `UserAuditLog`, not `UserEvent`. Actions and metadata are allowlisted; unknown actions, malformed values, arbitrary payload, phone/email, and behavioral metadata are rejected or stripped. Independent review classified audit injection as PASS.

The independent combined server lane nevertheless failed 1 of 126 tests: `admin/observability.service.spec.ts:124` expects an older weaker query shape. Production code emits the stricter related-event timestamp/provenance predicate. The test must be corrected to assert the stronger predicate, not weakened.

## 8. Optional processing inventory and impression behavior

Final inventory: `08_optional_processing_consumer_inventory.csv`

- 150 producer/consumer rows;
- ExperimentEngine, RecipePriorService, and RecipePriorLearner are included;
- zero duplicate or structurally blank rows;
- 81 rows explicitly retain at least one `GAP` marker.

Focused closure evidence:

- optional-consumer closure: 55/55 tests passed;
- direct processor/runtime gates: 56/56 passed;
- server consent-epoch lane: 56/56 passed;
- derived-state epoch lane: 40/40 passed;
- recommendation epoch lane: 62/62 passed;
- impression/web consent race lane: 28/28 passed;
- admin boundary: 71/71 passed.

The impression observer cancels pending dwell/batch state, disconnects when optional analytics is disabled, rechecks before POST, does not mark denied sends as reported, and does not replay the dropped event after re-consent. Browser evidence confirmed a qualifying post-withdrawal impression returned `accepted:false`, `reason:consent_not_granted`.

Focused green lanes do not override the full-suite or adversarial failures.

## 9. Differential full-suite results

Environment for both clean base and frozen branch:

- Node `v26.1.0`;
- pnpm `9.1.0`;
- `NODE_OPTIONS=--max-old-space-size=8192`;
- `CI=true`;
- guarded `DATABASE_URL` on loopback port 1;
- no live AI/provider escape hatch.

### Clean base

| Gate | Result |
|---|---|
| Full server | FAIL — 276/278 suites, 2357/2360 tests |
| Full web | FAIL — 53/55 files, 283/287 tests |
| Server lint | FAIL — 1 error, 18,806 warnings |
| Web lint | FAIL — 4 errors, 35 warnings |
| Server build | PASS |
| Web build | PASS |
| Test hermeticity | FAIL — tracked profile QA JSON mutated |

### Frozen P0-A branch, two consecutive runs

| Gate | Run 1 | Run 2 | Classification |
|---|---|---|---|
| Full server | FAIL — 290/299 suites, 2553/2571 tests | identical | 9 suites / 18 deterministic branch-only failures |
| Full web | FAIL — 142/144 suites, 361/363 tests | identical | only 2 pre-existing Food DNA failures remain |
| Tracked QA artifact | mutated then restored | mutated then restored | pre-existing hermeticity blocker |

Branch-only server groups:

- capstone outbox epoch fixture: 1;
- OTP serializer/persisted-shape fixture: 1;
- recipe-prior provenance contract: 4;
- analytics producer promotion mock: 4;
- ingredient taste epoch fixture: 2;
- observability strict query assertion: 1;
- effort/skill epoch fixture: 3;
- L0 loop epoch fixture: 1;
- ranker-effect epoch fixture: 1.

Recipes passes all four cases in both full web runs. The earlier AuthProvider cancellation regression is closed. The two onboarding account-step tests also pass. The remaining web failures are the two clean-base Food DNA contract failures.

## 10. Builds and lint

| Gate | Frozen result | Differential |
|---|---|---|
| Server build | PASS — 37.554s | no build regression |
| Web build | PASS — 19.712s; 8,098 modules; PWA 12 entries | no build regression |
| Server lint | FAIL — 1 error, 20,470 warnings | same base blocking `tfidf.ts` error; +1,664 warnings |
| Web lint | FAIL — 4 errors, 33 warnings | same four base errors; two fewer warnings |

No lint assertion or test assertion was disabled to manufacture PASS.

## 11. Browser, PWA, and database evidence

Coordinator browser verdict: **CHANGES_REQUIRED**, with core isolation scenarios green.

Passed scenarios:

- real UI OTP login for Account A and B in the same browser profile;
- distinct diet, allergy, favorite, plan, and shopping state;
- A profile/settings/favorites/plan/shopping/recommendation visits;
- two-tab logout propagation to `/login` with no A state in tab 2;
- A→logout→B switch without browser restart and zero A markers in B profile/favorites/list;
- back/forward did not resurrect A;
- API-down private routes eventually failed closed to login;
- generated service worker ran in production preview;
- disposable legacy worker demonstrated private `api-cache`, then the current worker deleted it;
- post-upgrade Cache Storage contained only public Workbox precache entries;
- post-withdrawal impression denied;
- re-consent alone created no queued replay.

Direct DB counts at/after withdrawal were zero for `UserEvent`, `RecommendationExposure`, `FeatureContributionLog`, `RecommendationServedItem`, `RecommendationAttributionEvent`, `SignalObservation`, `UserFeature`, `UserOutcome`, `UserBehaviorTimeline`, and `ExperimentAssignment`.

The dedicated `garnish_p0a_qa` database was created locally, used only for QA, verified by exact name, dropped, and verified absent. No production or ambiguous database was used.

Hard browser PASS is withheld because the exact refresh-concurrent-with-withdrawal case, final direct QueryClient enumeration, and an exact 1:1 viewport-width capture were not completed. The browser backend scaled/cropped retained PNGs despite explicit 360/390/430/480 capability requests.

## 12. Independent adversarial review

Independent verdict: **CHANGES_REQUIRED**.

The reviewer received architecture, matrix, acceptance criteria, and endpoints without an implementation explanation. Findings:

1. `ADV-P0A-001` P0: consent decisions and optional writes are not serialized in one database boundary. `AnalyticsService` and exposure/derived writers use check→write→best-effort compensation; process interruption or cleanup failure can leave residue.
2. `ADV-P0A-002`: focused server gate red — 14/15 suites and 125/126 tests; observability expectation drift described above.
3. `ADV-P0A-003`: `SignalDetectorService` discovers all users before an explicit runtime-OFF guard, violating the strict zero-discovery/zero-unnecessary-I/O boundary.

Independent focused web evidence passed 8/8 files and 73/73 tests. The reviewer intentionally did not receive the coordinator's later browser evidence before first-pass judgment; the coordinator browser run closes several `NOT VERIFIED` rows but does not fix `ADV-P0A-001..003`.

## 13. Remaining legal-review items

- current Terms/Privacy version constants are technical audit identifiers, not legal approval;
- `lawfulBasis=pending_legal_review` is intentionally unresolved;
- final privacy copy, purpose matrix, retention periods, processor disclosures, PostHog configuration/cookies, DSAR completeness, and notification-purpose policy require Privacy/Legal ownership;
- disabled legacy/mixed analytics surfaces must not be re-enabled until purpose and consent-epoch provenance exists.

## 14. Remaining technical risks and priorities

### Priority 1 — release blockers

1. Implement one shared per-user database serialization primitive for withdrawal/grant and every optional write. Re-read current policy/runtime inside the same transaction; compensation must not be the safety invariant.
2. Fix all 18 branch-only server-test failures without weakening production gates.
3. Add the runtime-OFF guard before signal-detector user discovery with zero-call assertions.
4. Rerun the independent adversarial lane and require `APPROVE`.

### Priority 2 — prerequisite/baseline and evidence

1. In a separate prerequisite quality scope, fix the two Food DNA tests, one recipe-search lint error, four web lint errors, and tracked QA-artifact mutation.
2. Complete refresh-during-withdrawal, direct QueryClient enumeration, exact viewport capture, and saved cross-account DB join evidence.
3. Resolve or explicitly defer the 81 inventory `GAP` rows; recipe-prior read/learner provenance is an active example.

### Priority 3 — reviewability/performance

- split the 226-file review surface into atomic, independently reviewable commits only after tests and adversarial gates are green;
- replace in-memory current-consent population collapse with a reviewed indexed projection/materialized query before scale activation.

## 15. Rollback

- Restore from the external snapshot only in a fresh worktree from the base hash, apply the binary patch, then extract the allowed untracked archive.
- No schema rollback is required because no migration was created.
- Keep the legacy service-worker private-cache cleanup through at least one released upgrade even if other source changes are rolled back; removing it early can resurrect old private caches.
- The disposable QA database is already deleted.

## 16. Commit, push, and merge recommendation

- Commit hashes: none.
- Staged files: none.
- Push status: not pushed.
- Master action status: untouched by this task. The local `master` ref is currently `d3ffde74b8415843b863799465f8390a408bd48b`; `origin/master` and the P0-A base remain `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`.
- Merge recommendation: **DO NOT MERGE**.

## 17. Exact next action

Open a continuation on the same P0-A branch limited to: shared transactional consent/write serialization, `SignalDetectorService` runtime-OFF pre-discovery gate, and the six deterministic branch-failure groups listed in `09a_prerequisite_quality_blocker.md`. Then rerun focused tests, both full suites twice, lint/build, browser residue/race evidence, and the independent adversarial attack. Only after those are green may the remaining baseline-only debt be reported as `BLOCKED_BY_BASELINE`; only a completely green baseline and branch can produce `PASS` and authorize atomic commits/push.
