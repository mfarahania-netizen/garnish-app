# P0-A v2 optional-processing transaction boundary

Status: implemented and validated on disposable PostgreSQL
Decision owner: Transaction Boundary Engineer
Scope: P0-A consent mutation and user-linked analytics/personalization writes

## Invariant

For one user, a consent decision and an optional write are ordered by the same database lock. Authorization is
read only after that lock and the optional mutation is committed in the same Prisma interactive transaction.
No caller-side consent boolean, pre-transaction read, post-write check, or compensating delete is an
authorization/safety mechanism.

The canonical APIs are:

~~~ts
withUserOptionalProcessingBoundary(
  prisma,
  { userId, purposes, operation, expectedEpoch? },
  async (tx, context) => {
    // all optional reads/writes use tx
    // context.grantEpoch is current under the lock
  },
)

withUserConsentMutationBoundary(
  prisma,
  { userId, operation },
  async (tx) => {
    // append the consent decision using tx
  },
)
~~~

'OptionalProcessingTransactionClient' is exported for compound writers and router/processor chains. A caller
that already owns the boundary must use an explicit '*InLockedTransaction(tx, ...)' method; opening a nested
boundary for the same user can self-deadlock and is forbidden.

## Transaction and lock semantics

1. Runtime switches are checked before transaction allocation, after lock acquisition, after the ledger read,
   and immediately before the callback.
2. The transaction applies PostgreSQL 'lock_timeout = 2000ms' and 'statement_timeout = 4500ms'.
3. The one canonical lock is:

   ~~~sql
   SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE
   ~~~

4. Lock order is stable: canonical User row, current consent ledger, then operation-specific optional tables.
   A boundary handles exactly one user. Multi-user operations must process users separately in stable user-id
   order and never retain one user lock while acquiring another.
5. Isolation level is deliberately 'READ COMMITTED', not 'SERIALIZABLE'.
6. After the lock, the boundary reads the latest decision for every required purpose and requires:
   'status=granted', current server-owned privacy-policy version, valid decision timestamp, and runtime ON.
7. The effective grant epoch is the maximum latest-grant timestamp across required purposes.
8. If 'expectedEpoch' is supplied, exact equality is required under the lock. This prevents a derived result
   computed before withdrawal/re-grant from being written in the new epoch.
9. Callback writes use only the Prisma transaction client. Network/provider calls while holding the lock are
   forbidden.
10. The transaction uses 'maxWait=2000ms', 'timeout=5000ms', and at most three attempts. Retry is limited to
    Prisma/PostgreSQL concurrency failures ('P2034', '40001', '40P01', '55P03' or equivalent messages).

### Why READ COMMITTED is required here

The first real PostgreSQL interleaving run exposed a non-obvious failure in the initial 'SERIALIZABLE' design.
A writer transaction could establish a snapshot before waiting on the User lock. The consent transaction held
the User lock but appended only 'UserConsent'; it did not update 'User'. After waiting, PostgreSQL therefore
allowed the writer to retain its pre-wait consent snapshot: case B incorrectly wrote after withdrawal, and case
H failed to observe a grant.

'READ COMMITTED + User FOR UPDATE' gives the needed semantics: every statement after the lock sees state
committed by the previous lock holder. The User lock provides per-user serialization; the newer statement
snapshot supplies visibility. The corrected A-J run passed 10/10 on PostgreSQL 16.

## Result and error contract

Settled privacy decisions are data, not exceptions:

- success: '{ status: executed, value, grantEpoch }'
- denial: 'invalid_request', 'runtime_disabled', 'user_not_found', 'consent_not_granted', or
  'consent_epoch_changed'

Infrastructure/locking/ledger failures throw 'OptionalProcessingBoundaryOperationalError' with stable code
'OPTIONAL_PROCESSING_BOUNDARY_FAILED', operation and attempt count. Domain HTTP exceptions are preserved.
Services that must remain fail-neutral catch this structured error, log its class without user data, and return
their documented neutral result.

## Consent ordering outcomes

- Writer lock first: the optional row commits before withdrawal. It is a pre-withdrawal row and is valid.
- Withdrawal lock first: the writer waits, then reads the committed withdrawal and performs zero callback write.
- Grant lock first: a waiting writer can proceed only after the current-policy grant commits.
- Callback/process exception: the interactive transaction rolls back; there is zero committed optional row.
- Cleanup failure: irrelevant to correctness because no cleanup is required to close the race.

Consent rows use a timestamp strictly later than the prior same-purpose decision while the User lock is held,
preventing equal-timestamp ambiguity for newly written ledger entries.

## Integrated owned writers

| Writer/mutation | Required purpose | Transactional mutation |
|---|---|---|
| ConsentService grant/decline/withdraw | mutation boundary | UserConsent.create |
| onboarding consent decisions | mutation boundary | consent, mirror and completion command |
| Settings consent | mutation boundary | ConsentLog.upsert + UserConsent.create |
| AnalyticsService.trackEvent | analytics; optional joint promotion | analytics create then personalization update in one uncommitted transaction |
| event enrichment | analytics + personalization + expected epoch | provenance-bounded UserEvent.updateMany |
| outbox enqueue | analytics + personalization | event re-read + idempotent EventOutbox.upsert |
| recommendation exposure | analytics + personalization | one/batch RecommendationExposure inserts |
| served-slate counters | analytics + personalization + expected epoch | RecommendationServedItem.createMany |
| experiment assignment | analytics + personalization + expected epoch | assignment read/create |
| signal calculator standalone entrypoints | personalization | signal read/update/upsert |

SignalCalculator also exposes transaction-reuse methods for the EventRouter's joint boundary:

- 'updateSignalInLockedTransaction'
- 'applyNegativeFeedbackInLockedTransaction'
- 'applyPositiveFeedbackInLockedTransaction'
- 'applyIngredientPreferenceInLockedTransaction'

## Validation contract

The dedicated integration suite runs only when
'RUN_P0A_V2_TX_INTEGRATION=true' and refuses any database whose URL pathname is not exactly
'garnish_p0a_v2_tx_test'. It uses two independent Prisma clients and explicit deferred barriers for A-J.
Scenario K belongs to the separately-owned SignalDetector runtime-OFF lane.

No migration, seed, import, production database, provider call, staging, commit, or push is part of this
architecture change.
