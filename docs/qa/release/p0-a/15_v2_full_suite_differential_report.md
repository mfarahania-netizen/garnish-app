# P0-A v2 full-suite differential report

## Final status

- Full-suite differential: **BRANCH CLEAN RELATIVE TO BASELINE**
- Branch-owned test failures added: **0**
- Branch-owned lint errors added: **0**
- Baseline failures removed on the branch: **5** (`3` server tests and `2` web Onboarding tests)
- Overall P0-A v2 gate: **BLOCKED_BY_BROWSER_ENV**
- Commit/push decision: **NO COMMIT AND NO PUSH** while the browser gate remains blocked

The full server and web suites were executed twice on an exact clean-base worktree and twice on the final branch. Failure membership and counts were identical within each pair of repeated runs. The remaining branch web failures are an exact subset of the deterministic clean-base failures; the branch introduces no new full-suite failure.

## Controlled environment

| Control | Value |
| --- | --- |
| Node.js | `26.1.0` |
| pnpm | `9.1.0` |
| CI | `true` |
| Node heap | `NODE_OPTIONS=--max-old-space-size=8192` |
| Database guard | `postgresql://postgres:postgres@127.0.0.1:1/garnish_p0a_guarded` |
| Optional runtime flags | Unset |
| Provider credentials/keys | Unset |
| Prisma | Client generated before every full-suite execution |

The guarded database URL prevents an accidental connection to a developer or production database. No provider-backed execution was permitted by the test environment.

## Server full-suite differential

| Revision | Run | Suites | Tests | Jest duration | Wall time | Result |
| --- | ---: | --- | --- | ---: | ---: | --- |
| Clean base | 1 | `276 passed`, `2 failed`, `1 skipped`; `278 executed` | `2357 passed / 2360 total`, `3 failed` | `144.076s` | `150.188s` | Baseline deterministic failures |
| Clean base | 2 | `276 passed`, `2 failed`, `1 skipped`; `278 executed` | `2357 passed / 2360 total`, `3 failed` | `140.523s` | `146.186s` | Same counts and failure membership |
| Final branch | 1 | `300 passed / 301 total`, `0 failed`, `1 skipped` | `2593 passed / 2603 total`, `0 failed`, `10 skipped` | `156.217s` | `162.428s` | PASS |
| Final branch | 2 | `300 passed / 301 total`, `0 failed`, `1 skipped` | `2593 passed / 2603 total`, `0 failed`, `10 skipped` | `173.279s` | `176.438s` | PASS; deterministic repeat |

### Deterministic clean-base server failures

| Area | Failure count | Failure |
| --- | ---: | --- |
| User serializer | 2 | Serialized output unexpectedly included `avatarUrl` and/or `onboardingComplete` |
| User export | 1 | Exported output unexpectedly included `onboardingComplete` |

Both clean-base runs reproduced the same two failing suites and three failing tests. Both final-branch runs passed the complete server suite. Therefore the branch fixes all three server baseline failures and adds no server failure.

## Web full-suite differential

| Revision | Run | Files | Tests | Vitest duration | Wall time | Result |
| --- | ---: | --- | --- | ---: | ---: | --- |
| Clean base | 1 | `53 passed / 55 total`, `2 failed` | `283 passed / 287 total`, `4 failed`, `0 skipped` | `156.16s` | `159.166s` | Baseline deterministic failures |
| Clean base | 2 | `53 passed / 55 total`, `2 failed` | `283 passed / 287 total`, `4 failed`, `0 skipped` | `143.65s` | `146.789s` | Same counts and failure membership |
| Final branch | 1 | `62 passed / 63 total`, `1 failed` | `363 passed / 365 total`, `2 failed`, `0 skipped` | `200.68s` | `203.033s` | Only baseline FoodDNA failures remain |
| Final branch | 2 | `62 passed / 63 total`, `1 failed` | `363 passed / 365 total`, `2 failed`, `0 skipped` | `173.52s` | `176.028s` | Same counts and failure membership |

### Failure membership

The clean base failed four web tests on both runs:

1. FoodDNA cold-start assertion: `/تازه شروع شده/` matched multiple rendered elements.
2. FoodDNA onboarding assertion: `/۳ سؤال دیگه/` was not found.
3. Two Onboarding tests, with identical membership in both clean-base runs.

The final branch failed only the same two FoodDNA tests on both runs. The two baseline Onboarding failures pass on the branch. The branch also contains additional web coverage, including the final E2E-only QueryClient instrumentation, and those additions introduce no new full-suite failure.

## Build differential

| Revision | Target | Result | Timing |
| --- | --- | --- | ---: |
| Clean base | Server build | PASS | `58.802s` wall |
| Clean base | Web build | PASS | `35.902s` wall |
| Final branch | Server build plus E2E-instrumented web build | PASS | `101.7s` combined wall; Vite `11.09s` |

The E2E-only instrumentation is accepted by the production build path. There is no branch build regression.

## Lint differential

| Revision | Target | Errors | Warnings | Differential conclusion |
| --- | --- | ---: | ---: | --- |
| Clean base | Server | `1` | `18,806` | Baseline lint error |
| Final branch | Server | `1` | `21,456` | Exact same error; `0` new errors |
| Clean base | Web | `4` | `35` | Baseline lint errors |
| Final branch | Web | `4` | `33` | Exact same four errors; `0` new errors |

The branch does not add a lint error. Server warning volume increases by `2,650`; this is non-gating for the P0-A differential but remains technical-debt evidence and must not be represented as a clean lint result. Web warnings decrease by `2`.

## Differential classification

| Gate | Base evidence | Branch evidence | Classification |
| --- | --- | --- | --- |
| Server tests | Deterministic `2` suites / `3` tests failing twice | Zero failures twice | Branch fixes all base server failures |
| Web tests | Deterministic `4` tests failing twice | Only the same `2` FoodDNA tests fail twice | Baseline-only residual; branch fixes `2` Onboarding tests |
| Builds | Server and web PASS | Server and E2E-instrumented web PASS | No regression |
| Lint errors | `1` server + `4` web errors | Exact same error membership | Baseline-only; zero new lint errors |
| Overall release gate | Not determined by suites alone | Browser environment gate incomplete/blocked | **BLOCKED_BY_BROWSER_ENV** |

## Final conclusion

The repeated differential is stable: the branch adds zero test failures and zero lint errors, fixes three clean-base server failures and two clean-base web failures, and passes both builds. It is not correct to label the repository globally green because two deterministic FoodDNA tests and the baseline lint errors remain. It is also not correct to commit or push under the v2 closure contract because the independent browser gate remains **BLOCKED_BY_BROWSER_ENV**.
