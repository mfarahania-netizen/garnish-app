# P0-A full-suite differential report

Status: **FINAL — FAIL_BRANCH_REGRESSIONS + BLOCKED_BY_BASELINE**
Base: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
Clean worktree: `C:\dev\garnish-p0a-baseline-1631dc5` (detached HEAD)
Evidence date: 2026-07-12 to 2026-07-13 (Asia/Tehran)

## Reality check

[قطعی] The base commit is not green under the required full-suite and lint gates. This prevents an honest final `PASS`, even if every P0-A-introduced regression is fixed. The branch comparison is still mandatory because baseline redness does not excuse branch-only failures.

## Reproducible environment and safety controls

| Item | Exact value |
|---|---|
| Node | `v26.1.0` |
| pnpm | `9.1.0` (matches root `packageManager`) |
| Memory | `NODE_OPTIONS=--max-old-space-size=8192` |
| CI mode | `CI=true` |
| DB guard | `postgresql://p0a_test:***@127.0.0.1:1/garnish_p0a_fullsuite_guard?connect_timeout=1` |
| Optional analytics flag | unset |
| Optional personalization flag | unset |
| Live-AI escape hatch | unset |
| Real `.env` in clean worktree | none; only committed `.env.example` files exist |
| Project processes started/stopped | none |

[قطعی] A static scan of unit test files found no `new PrismaClient`, `$connect`, or `$disconnect` call. The explicit DB URL points to loopback port `1`, so any unexpected connection fails immediately and cannot reach a shared, non-test, or production database.

[قطعی] `apps/server/test/test-env-setup.ts` removes live AI provider flags and keys unless a deliberate live-test escape hatch is enabled; the escape hatch was unset.

## Clean-checkout prerequisite

| Command | Exit | Duration | Result |
|---|---:|---:|---|
| `pnpm install --frozen-lockfile` | 0 | 76.6s | PASS; lockfile unchanged |
| `pnpm --dir apps/server exec prisma generate --schema=prisma/schema.prisma` | 0 | 6.3s | PASS; Prisma Client 5.22.0 generated |

[قطعی] An initial server-test attempt before explicit Prisma generation was invalid infrastructure evidence: 113 suites failed TypeScript compilation because generated model delegates were absent. It exited `1` after 168.9s and is retained as evidence that a fresh checkout requires the documented `prisma generate` prerequisite. It is not counted as a product test result and was not a flaky retry.

## Clean-base canonical results

| Gate | Command | Exit | Duration | Exact result |
|---|---|---:|---:|---|
| Full server tests | `pnpm --dir apps/server test -- --runInBand --json --outputFile=...` | 1 | 245.7s (Jest 242.652s) | 276/278 suites; 2357/2360 tests; 2 failed files, 3 failed tests |
| Full web tests | `pnpm --dir apps/web test -- --reporter=json --outputFile=...` | 1 | 130.6s | 53/55 files; 126/130 suites; 283/287 tests; 2 failed files, 4 failed tests |
| Server lint | `pnpm --dir apps/server lint` | 1 | 72.0s | 1 error; 18,806 warnings across JSON diagnostic output |
| Web lint | `pnpm --dir apps/web lint` | 1 | 29.3s | 4 errors; 35 warnings |
| Server build | `pnpm --dir apps/server build` | 0 | 43.5s | PASS, including Prisma prebuild generation |
| Web build | `pnpm --dir apps/web build` | 0 | 30.6s | PASS; 8,096 modules; PWA `generateSW`; 11 precache entries |

External machine-readable evidence:

- `C:\dev\garnish-p0a-baseline-server-valid-results.json`
- `C:\dev\garnish-p0a-baseline-web-results.json`
- `C:\dev\garnish-p0a-baseline-server-eslint.json`

## Failure differential matrix

Current-branch cells remain pending until the coordinator declares implementation freeze.

| Suite/test | Base | P0-A | Branch regression | Root cause | Owning file | Required scope |
|---|---|---|---|---|---|---|
| `user.serializer` — safe allow-list | FAIL | pending | pending | Base serializer emits `avatarUrl` and `onboardingComplete=false`, while assertion omits them | `apps/server/src/common/serializers/user.serializer.spec.ts` / `.ts` | Intersects P0-A onboarding serializer; branch must make contract and assertion agree without weakening safety |
| `user.serializer` — absent-field behavior | FAIL | pending | pending | Base serializer synthesizes `onboardingComplete=false` even when source field is absent | same | Intersects P0-A; scoped behavior correction is allowed |
| `UserExportService` stable envelope | FAIL | pending | pending | Export subject inherits synthesized `onboardingComplete=false` | `apps/server/src/users/export/user-export.service.spec.ts` plus serializer | Intersects serializer behavior; verify frozen branch |
| Food DNA cold start | FAIL | pending | no if unchanged | `getByText(/تازه شروع شده/)` matches both ring caption and explanatory paragraph; stale ambiguous query | `apps/web/src/app/food-dna/food-dna.smoke.test.jsx` | Pre-existing unrelated quality debt; do not patch in P0-A |
| Food DNA remaining question count | FAIL | pending | no if unchanged | UI interpolates ASCII `3`; assertion requires Persian digit `۳` | `apps/web/src/app/food-dna/page.jsx` / smoke test | Pre-existing unrelated locale-contract debt; do not patch in P0-A |
| Onboarding account step | FAIL | pending | pending | Base step-6 cases render an empty shell | `apps/web/src/app/onboarding/onboarding.smoke.test.jsx` / `page.jsx` | Intersects P0-A onboarding; verify branch-owned correction |
| Onboarding account error state | FAIL | pending | pending | Same base step-6 render path; expected alert absent | same | Intersects P0-A onboarding; verify branch-owned correction |
| Recipes list — loading/error/empty/success (4 tests) | PASS (4/4) | previously FAIL 0/4; frozen pending | **YES before fix** | Coordinator's deterministic isolation found AuthProvider mount-time `clearPrivateSessionState({ queryClient })` canceled the already-started child query permanently | `apps/web/src/context/AuthContext.jsx` | Scoped P0-A session fix: remove only mount-time QueryClient clear; preserve bootstrap Cache Storage purge and logout/account-switch/cross-tab clears |
| Server lint `tfidf.ts:30:16` | FAIL | pending | no if unchanged | `no-misleading-character-class` on joined character sequence | `apps/server/src/recipes/search/tfidf.ts` | Pre-existing frozen recipe domain; do not patch in P0-A |
| Web lint `RealtimeTab.jsx:30:17` | FAIL | pending | no if unchanged | impure `Date.now()` during render | `apps/web/src/app/admin/tabs/RealtimeTab.jsx` | Pre-existing; not required for admin backend consent boundary |
| Web lint `dna-fa.js:122:48` | FAIL | pending | no if unchanged | unnecessary regex escape | `apps/web/src/app/food-dna/dna-fa.js` | Pre-existing unrelated Food DNA debt |
| Web lint `useMealPlan.js:37:32` | FAIL | pending | no if unchanged | ref mutated during render | `apps/web/src/app/plan/useMealPlan.js` | Pre-existing unrelated web plan debt |
| Web lint `PlatePlaceholder.jsx:31:8` | FAIL | pending | no if unchanged | component created during render | `apps/web/src/components/ges/PlatePlaceholder.jsx` | Pre-existing unrelated visual component debt |

## Recipes diagnosis

[قطعی] Clean base passes all four `apps/web/src/app/recipes/recipes.smoke.test.jsx` tests. Therefore the earlier four P0-A loading failures are not pre-existing.

[قطعی] Coordinator-provided deterministic evidence identifies the race: a child recipe query starts, then AuthProvider's mount effect calls `clearPrivateSessionState({ queryClient })`; cancellation prevents query settlement and the screen remains in loading state. Removing only the mount-time QueryClient clear fixes the race while retaining pre-mount Cache Storage cleanup and all logout/account-switch/cross-tab cleanup paths. Focused post-fix evidence reported by the coordinator is 3 files / 27 tests PASS. This report will independently close the row only after a frozen full-web run.

## Food DNA diagnosis

[قطعی] Both Food DNA failures reproduce at the clean base with no P0-A code. Neither uses a database or live consent state: `useFoodDna` is explicitly mocked per test.

[قطعی] The first failure is an ambiguous DOM query caused by two intentional copies containing the same phrase. The second is an ASCII-versus-Persian digit contract mismatch. Retrying cannot fix either failure.

## Test side effect

[قطعی] The valid baseline full server run modified the tracked file `docs/qa/behavior/profile_l4_05_declared_qa_results.json`, changing `declaredDimensions` from `22` to `23`.

- Generated hash: `B22CD6E3982478396F097FE585939F0A1345452754F3B50DC1E69217B100320C`
- Restored base hash: `15ABCD13519B29B8B41976D9FE914AE52AE3AA564FB0124B133AA5845E95C3C9`

[قطعی] The change was recorded and restored only in the agent-owned clean worktree. The worktree is clean again. This mutation independently violates the final rule that tests must not change tracked files.

## Frozen P0-A comparison

The frozen branch used the same safety envelope as clean base for every command:

```text
CI=true
NODE_OPTIONS=--max-old-space-size=8192
DATABASE_URL=postgresql://p0a_test:***@127.0.0.1:1/garnish_p0a_fullsuite_guard?connect_timeout=1
OPTIONAL_ANALYTICS_INGEST_ENABLED unset
OPTIONAL_PERSONALIZATION_PROCESSING_ENABLED unset
AI_ALLOW_LIVE_IN_TESTS unset
```

[قطعی] No project server was started by this QA lane. Each full-test command ran in a fresh pnpm/Node process; server Jest used `--runInBand`. The loopback port-1 guard prevented any unexpected database connection from reaching a real database.

### Prerequisite, build and lint

| Gate | Exit | Duration | Frozen result | Differential vs base |
|---|---:|---:|---|---|
| `pnpm install --frozen-lockfile` | 0 | 222.313s | PASS; recreated 1,159-package `node_modules`; lockfile/status unchanged | PASS, slower because links were absent |
| explicit Prisma generate | 0 | 4.373s | PASS; Prisma Client 5.22.0 | PASS |
| server build | 0 | 37.554s | PASS, including Prisma prebuild | PASS; base 43.5s |
| web build | 0 | 19.712s | PASS; 8,098 modules; PWA 12 precache entries | PASS; base 8,096 modules / 11 entries |
| server lint | 1 | 88.879s | 1 error; 20,470 warnings | Same sole blocking error; +1,664 warnings |
| web lint | 1 | 48.912s | 4 errors; 33 warnings | Same four blocking errors; 2 fewer warnings |

[قطعی] The server lint error remains `apps/server/src/recipes/search/tfidf.ts:30:16` (`no-misleading-character-class`). The web lint errors remain exactly the four clean-base files/rules: `RealtimeTab.jsx` render impurity, `dna-fa.js` unnecessary escape, `useMealPlan.js` ref access during render, and `PlatePlaceholder.jsx` component creation during render. There is no new blocking lint error, although server warning debt increased.

### Consecutive full-test results

| Run | Exit | Wall | Internal | Suites | Tests | Failed files |
|---|---:|---:|---:|---|---|---:|
| Server 1 | 1 | 363.516s | 359.519s | 290/299 passed; 9 failed | 2553/2571 passed; 18 failed | 9 |
| Server 2 | 1 | 432.205s | 424.279s | 290/299 passed; 9 failed | 2553/2571 passed; 18 failed | 9 |
| Web 1 | 1 | 203.881s | 200.635s | 142/144 passed; 2 failed | 361/363 passed; 2 failed | 1/63 |
| Web 2 | 1 | 197.843s | 194.926s | 142/144 passed; 2 failed | 361/363 passed; 2 failed | 1/63 |

[قطعی] Failure membership was identical between consecutive runs for both projects. No retry was used inside either run, so these are deterministic frozen-branch results.

Machine-readable evidence is outside the repository:

- `C:\dev\garnish-p0a-freeze-server-run1.json`
- `C:\dev\garnish-p0a-freeze-server-run2.json`
- `C:\dev\garnish-p0a-freeze-web-run1.json`
- `C:\dev\garnish-p0a-freeze-web-run2.json`

### Closure of known base failures

| Known row | Clean base | Frozen P0-A | Classification |
|---|---|---|---|
| `user.serializer` allow-list | FAIL | PASS | Branch-owned stabilization closed |
| `user.serializer` absent field | FAIL | PASS | Branch-owned stabilization closed |
| `UserExportService` stable envelope | FAIL | PASS | Branch-owned stabilization closed |
| Onboarding account step/error (2) | FAIL | PASS | Branch-owned stabilization closed |
| Recipes loading/error/empty/success (4) | PASS, earlier branch regression | PASS in both full runs | AuthProvider cancellation regression independently closed |
| Food DNA cold-start query | FAIL | FAIL in both runs | Pre-existing, unchanged |
| Food DNA Persian remaining count | FAIL | FAIL in both runs | Pre-existing, unchanged |
| Server lint error | FAIL | FAIL, same error | Pre-existing, unchanged |
| Web lint errors | FAIL | FAIL, same four | Pre-existing, unchanged |
| Tracked QA JSON mutation | FAIL | FAIL in both server runs | Pre-existing hermeticity blocker persists |

[قطعی] Frozen web improved from four failed tests at base to the same two Food DNA tests only. Onboarding is closed. Recipes passes all four cases inside both full runs, not merely in a focused retry.

### Deterministic branch-only server failures

| Failed suite | Tests | Root cause diagnosis | Required action |
|---|---:|---|---|
| `recommendation-requestid-capstone.spec.ts` | 1 | Outbox now requires both runtime flags and `currentGrantEpoch`; the harness enables only personalization and injects only `hasPurpose`, so enqueue returns `null` and attribution times out | Model both current grants and a valid event epoch; do not weaken outbox checks |
| `auth.service.spec.ts` OTP signup | 1 | Serializer no longer invents `onboardingComplete=false` when neither onboarding field exists; the mock user omits both and the mock service has no `findById` | Make fixture match persisted shape or explicitly preserve the API contract |
| `ranking.recipe-prior.spec.ts` | 4 | Ranker leaves `priorValues` empty and never calls the source because its contract has no evidence timestamp/provenance; legacy tests still require the seam/value/lift | Add epoch provenance to the source or revise the feature contract through owner review |
| `analytics/event-producer-inventory.spec.ts` | 4 | Analytics promotion calls `userEvent.update`; the old Prisma mock has create but no update, causing `TypeError` | Add the stateful provenance-update mock |
| `fi-phase-2-3-ingredient-soft-taste.spec.ts` | 2 | Ranker consent mock has only `hasPurpose`; missing `currentGrantEpoch` forces neutral features | Provide a valid dual-purpose epoch and explicit runtime opt-in |
| `admin/observability.service.spec.ts` | 1 | Production adds `event.timestamp >= grantEpoch` inside the provenance predicate; assertion expects the weaker old query | Update exact expected query after safety review |
| `fi-phase-2-2-effort-skill-graft.spec.ts` | 3 | Missing ranker epoch mock forces neutral ranking, so effort/skill signals disappear | Model current dual-purpose grant epoch |
| `l0-loop.integration.spec.ts` | 1 | Same missing ranker epoch mock neutralizes cook→signal→ranker | Model current dual-purpose grant epoch |
| `fi-step-1-ranker-effect.spec.ts` | 1 | Same missing ranker epoch mock suppresses learned-signal effect | Model current dual-purpose grant epoch |

[قطعی] Seven ranking-effect failures across four suites share one fail-closed mock gap. The four recipe-prior failures are different: current production intentionally does not consume the prior source, so adding an epoch mock alone will not close them.

### Tracked-file side effects

Both full server runs produced the same tracked mutation:

```text
before/restored: 15ABCD13519B29B8B41976D9FE914AE52AE3AA564FB0124B133AA5845E95C3C9
generated:       B22CD6E3982478396F097FE585939F0A1345452754F3B50DC1E69217B100320C
```

[قطعی] The artifact was restored immediately after each server run. Both web runs left it unchanged. Final `git status --porcelain` had exactly the same 192 pre-existing entries as the pre-run snapshot: zero added and zero removed status lines. Install/build outputs were ignored; no lockfile or tracked product file changed. The only intentional content changes are this report and `09a_prerequisite_quality_blocker.md`, both already present as untracked report paths before execution.

## Final verdict

**FAIL_BRANCH_REGRESSIONS + BLOCKED_BY_BASELINE**

[قطعی] The branch cannot advance as release-ready: 18 deterministic branch-only server tests fail. Even after those close, Hard PASS remains blocked by two pre-existing Food DNA tests, five pre-existing lint errors, and tracked-test mutation. Baseline redness does not authorize assertion weakening, recipe-domain edits, or a false PASS. See `09a_prerequisite_quality_blocker.md` for the minimum split backlog.
