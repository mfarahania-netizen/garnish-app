# P0-A v2 transaction boundary report

Status: **IMPLEMENTED — OWNED FOCUSED AND POSTGRESQL A-J PASS**
Owner: Transaction Boundary Engineer
Date: 2026-07-13
Branch: 'fix/p0-a-safety-consent-session-isolation-v1'

## Direct conclusion

[قطعی] ADV-P0A-001 is closed for the consent mutations and active writers owned by this agent. Consent
authorization and optional writes now share one per-user PostgreSQL lock and one Prisma interactive
transaction. The owned safety invariant no longer depends on a post-write consent check or compensating delete.

[قطعی] This report is not a release-wide PASS. Scenario K and coordinator-owned active writers are evaluated in
their own lanes. Full-repository compile/build was temporarily blocked by concurrent coordinator-owned test
fixture edits after the owned lane had passed; exact external errors are listed below.

## Canonical boundary

Implementation:

- 'apps/server/src/consent/optional-processing-transaction-boundary.service.ts'
- Prisma interactive transaction
- canonical 'User' row 'FOR UPDATE'
- one user per boundary and stable lock order
- PostgreSQL 'READ COMMITTED'
- 'lock_timeout=2000ms'
- 'statement_timeout=4500ms'
- Prisma 'maxWait=2000ms'
- Prisma transaction 'timeout=5000ms'
- maximum three attempts
- retry only for known serialization/deadlock/lock conflicts
- structured 'OptionalProcessingBoundaryOperationalError'
- runtime checks before DB allocation and again inside the lock
- current server-owned privacy policy and latest decision resolved under the lock
- exact optional 'expectedEpoch' equality inside the lock
- callback writes only through 'OptionalProcessingTransactionClient'

Settled denials are explicit: 'invalid_request', 'runtime_disabled', 'user_not_found',
'consent_not_granted', and 'consent_epoch_changed'.

Consent mutation uses 'withUserConsentMutationBoundary', the same User lock as optional writers.

## Critical PostgreSQL finding and correction

[قطعی] The first real PostgreSQL run disproved the initial 'Serializable' isolation choice:

- A-J result: 8/10.
- Case B failed: a writer waiting behind withdrawal retained the pre-wait consent snapshot and wrote.
- Case H failed: a writer waiting behind grant retained the earlier withdrawn snapshot and denied.

Cause: the lock holder appended 'UserConsent' but did not update 'User'. A Serializable waiter could keep a
snapshot created before waiting on 'User FOR UPDATE' without a serialization conflict on the User row.

Correction: 'READ COMMITTED + User FOR UPDATE'. The lock provides ordering and the consent statement after the
lock sees the previous holder's committed decision. The corrected and final PostgreSQL runs passed 10/10.

This is documented in:

- 'docs/architecture/p0-a/optional_processing_transaction_boundary_v2.md'

## Integrated owned mutations and writers

| Surface | Boundary behavior | Compensation status |
|---|---|---|
| ConsentService grant/decline/withdraw | same User lock; monotonic decision timestamp | not applicable |
| onboarding consent decisions | whole command under mutation boundary | not applicable |
| Settings grant/withdraw | ConsentLog and UserConsent in same locked transaction | not applicable |
| Analytics collection | creates analytics provenance, then promotes same uncommitted row when joint grant exists | removed as invariant |
| Event enrichment | expected epoch + joint grant + provenance/timestamp predicate in one transaction | none |
| EventOutbox enqueue | joint grant; event re-read; epoch bound; idempotent upsert | none |
| RecommendationExposure one/batch | joint grant and inserts in one locked transaction | deleted |
| RecommendationServedItem slate | joint grant + caller expected epoch + createMany | none |
| ExperimentAssignment | joint grant + expected epoch + read/create | deleted |
| SignalCalculator standalone methods | personalization grant and signal writes under lock | none |

SignalCalculator locked reuse API delivered to the coordinator to avoid nested boundaries in EventRouter:

- 'updateSignalInLockedTransaction(tx, userId, signalName, signalDomain, signalType, rawValue, eventCount)'
- 'applyNegativeFeedbackInLockedTransaction(tx, userId, recipeId, factor)'
- 'applyPositiveFeedbackInLockedTransaction(tx, userId, recipeId, factor)'
- 'applyIngredientPreferenceInLockedTransaction(tx, userId, ingredientId, delta)'

'RecommendationCountersService.logSlate' now accepts 'expectedEpoch?: Date'. The coordinator owns threading this
epoch from the recommendation request/ranker path; the caller file was not edited by this agent.

## Deterministic unit/focused evidence

Final owned focused command:

~~~text
CI=true
NODE_OPTIONS=--max-old-space-size=8192
pnpm.cmd --dir apps/server test -- --runInBand
  src/consent/optional-processing-transaction-boundary.service.spec.ts
  src/consent/consent.service.spec.ts
  src/users/users-consent.spec.ts
  src/users/users-onboarding.spec.ts
  src/analytics/analytics.consent-gate.spec.ts
  src/analytics/event-enrichment.service.spec.ts
  src/behavior-engine/routing/event-outbox.service.spec.ts
  src/recommendation/exposure/exposure-tracking.service.spec.ts
  src/recommendation/pipeline/recommendation-counters.service.spec.ts
  src/experimentation/experiment-engine.service.spec.ts
  src/behavior-engine/signals/signal-calculator.service.spec.ts
~~~

Result:

- 11/11 suites PASS
- 120/120 tests PASS
- Jest time: 19.43s
- shell measured time: 24.795s
- snapshots: 0

The lane covers runtime-OFF zero DB allocation, lock and policy resolution, expected-epoch rejection, bounded
retry, structured exhaustion, same-lock consent mutation, rollback, create-then-promote analytics provenance,
no compensation path, outbox idempotency, stale assignment/slate rejection, and locked SignalCalculator reuse.

## Real PostgreSQL interleavings

Database: local disposable 'garnish_p0a_v2_tx_test' only.
Engine: local Docker PostgreSQL 16.
Schema: 52 existing migrations applied with 'prisma migrate deploy'.
Migration created: none.
Seed/import: none.

Final command environment:

~~~text
DATABASE_URL=postgresql://garnish:[REDACTED]@127.0.0.1:5432/garnish_p0a_v2_tx_test
RUN_P0A_V2_TX_INTEGRATION=true
CI=true
NODE_OPTIONS=--max-old-space-size=4096
pnpm.cmd --dir apps/server test -- --runInBand
  src/consent/optional-processing-transaction-boundary.integration.spec.ts
~~~

Final result:

- 1/1 suite PASS
- 10/10 tests PASS
- Jest time: 8.332s
- shell measured time: 11.825s

| Case | Result | Evidence |
|---|---|---|
| A writer lock first | PASS | withdrawal callback did not enter until writer committed; row precedes withdrawal |
| B withdrawal lock first | PASS | writer callback never entered; zero optional row |
| C withdrawal after request validation/before lock | PASS | decision made under lock; zero row |
| D exception before commit | PASS | insert rolled back; zero row |
| E simulated process callback failure | PASS | transaction rolled back; zero row |
| F cleanup/delete failure | PASS | withdrawal prevented insert; cleanup was irrelevant |
| G simultaneous idempotent writers | PASS | serialized; one row |
| H grant and write | PASS | writer waited; allowed only after committed current grant |
| I policy rollover/stale grant | PASS | zero row |
| J runtime OFF before lock | PASS | instrumented Prisma client emitted zero query; zero row |
| K scheduler OFF before discovery | OWNED BY COORDINATOR | not claimed by this report |

The suite refuses to run against a database URL whose pathname is not exactly
'garnish_p0a_v2_tx_test'.

## Residue and disposal

After the final integration run, direct Prisma counts were:

~~~json
{"users":0,"events":0,"consents":0}
~~~

The disposable database was then dropped. PostgreSQL catalog count for
'garnish_p0a_v2_tx_test' after drop: '0'.

The database was recreated after an earlier shell-only residue query had invalid quoting, and recreated once
more after the last production refactor so the recorded integration lane is strictly post-change. The invalid
shell query was not reported as evidence. The last run, direct Prisma count and final drop above are the
authoritative evidence.

## Compile/build evidence

Concurrent coordinator-owned test fixtures temporarily blocked an intermediate global compile. Their owners
fixed those files; this agent did not edit them. After the last Agent B production change:

- 'pnpm.cmd --dir apps/server exec tsc --noEmit --incremental false': PASS, exit 0, 21.1s.
- 'NODE_OPTIONS=--max-old-space-size=8192 pnpm.cmd --dir apps/server build': PASS, exit 0, 26.933s.

The coordinator remains responsible for the final release-wide build after every agent freezes.

## Files changed in this lane

Production:

- 'apps/server/src/consent/optional-processing-transaction-boundary.service.ts'
- 'apps/server/src/consent/consent.service.ts'
- 'apps/server/src/users/users.service.ts'
- 'apps/server/src/analytics/analytics.service.ts'
- 'apps/server/src/analytics/event-enrichment.service.ts'
- 'apps/server/src/behavior-engine/routing/event-outbox.service.ts'
- 'apps/server/src/recommendation/exposure/exposure-tracking.service.ts'
- 'apps/server/src/recommendation/pipeline/recommendation-counters.service.ts'
- 'apps/server/src/experimentation/experiment-engine.service.ts'
- 'apps/server/src/behavior-engine/signals/signal-calculator.service.ts'

Tests:

- 'apps/server/src/consent/optional-processing-transaction-boundary.service.spec.ts'
- 'apps/server/src/consent/optional-processing-transaction-boundary.integration.spec.ts'
- 'apps/server/src/consent/consent.service.spec.ts'
- 'apps/server/src/users/users-consent.spec.ts'
- 'apps/server/src/users/users-onboarding.spec.ts'
- 'apps/server/src/analytics/analytics.consent-gate.spec.ts'
- 'apps/server/src/analytics/event-enrichment.service.spec.ts'
- 'apps/server/src/behavior-engine/routing/event-outbox.service.spec.ts'
- 'apps/server/src/recommendation/exposure/exposure-tracking.service.spec.ts'
- 'apps/server/src/recommendation/pipeline/recommendation-counters.service.spec.ts'
- 'apps/server/src/experimentation/experiment-engine.service.spec.ts'
- 'apps/server/src/behavior-engine/signals/signal-calculator.service.spec.ts'

Reports:

- 'docs/architecture/p0-a/optional_processing_transaction_boundary_v2.md'
- 'docs/qa/release/p0-a/11_transaction_boundary_report.md'

## Safety and git state

- production/shared database used: no
- migration created: no
- seed/import: no
- provider/network call while locked: no
- compensating delete as safety invariant: no
- staged/committed/pushed by this agent: no
- master checkout/mutation/push: no
- owned 'git diff --check': PASS

## Remaining handoff

1. Coordinator must finish EventRouter/processor and all other owned active-writer integrations using the shared
   boundary and locked SignalCalculator methods.
2. Coordinator must thread the request/ranker epoch into counters 'expectedEpoch'.
3. Coordinator must provide scenario K evidence and a final frozen full compile/build.
4. Independent adversarial review must re-run B/H specifically against the final code.

## Coordinator closure addendum

This addendum supersedes the handoff items above; those items described the boundary engineer's freeze point, not the final integrated branch.

- `EventRouterService` now opens one joint-consent boundary, validates the event user, purpose, timestamp, policy and expected joint epoch under the canonical user lock, and passes the same transaction client to all five signal processors.
- The processors reuse the locked SignalCalculator methods; no nested authorization check is treated as the safety invariant.
- The recommendation pipeline captures the joint epoch before derivation and threads it into `RecommendationCountersService.logSlate` as `expectedEpoch`.
- Behavior engine, snapshots, feature store, identity dimensions, taste correction, profile optional reads/writes, ranking feature contributions, evaluator/reward, outcomes, gamification, notification scheduling and smart suggestions were routed through the shared boundary or fail closed behind a dedicated default-off switch.
- Scenario K has direct runtime-OFF evidence in SignalDetector, notification scheduler, smart-suggestion and outcome-cron tests: no user discovery or downstream optional DB call occurs while the relevant switch is off.
- The final comprehensive focused server lane passed 46/46 suites and 360/360 tests (Jest 34.856s; shell 37.6s).
- Final full-server runs both passed with zero failures: 300/300 executed suites and 2,593/2,593 executed tests in each run; one suite and ten tests were intentionally skipped.
- Final TypeScript compile and server build passed after all server production changes.

The transaction boundary and active-writer integration are therefore closed at code, focused-test, real-PostgreSQL and full-server levels. Release approval remains blocked solely by the incomplete browser gate documented in report 16 and the resulting independent-review disposition.
