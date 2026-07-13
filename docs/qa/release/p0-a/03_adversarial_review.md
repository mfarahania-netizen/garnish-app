# P0-A Independent Adversarial Review

## Verdict: CHANGES_REQUIRED

[قطعی] This branch cannot receive an adversarial `APPROVE`. A withdrawal can commit between a consent check and a later optional-data write, and the current compensation is neither transactional nor crash-safe. A focused server lane is also red. Browser/PWA/two-account and database-residue scenarios were not executed by this reviewer and therefore are not treated as PASS evidence.

Review date: 2026-07-13
Branch: `fix/p0-a-safety-consent-session-isolation-v1`
Reviewed base/HEAD at start: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
Independence: [قطعی] the reviewer received no implementation explanation and made no code, migration, production, staging, commit, or push change.

## Blocking findings

### ADV-P0A-001 — withdrawal and optional writes are not serialized

Severity: P0
Confidence: [قطعی]

Evidence:

- `apps/server/src/analytics/analytics.service.ts:144-169` checks analytics consent, creates `UserEvent`, then tries to compensate after another consent check. The compensating delete at line 168 explicitly swallows deletion failure. A process stop between lines 159 and 164, or a failed delete after withdrawal, leaves the optional row in the database.
- `apps/server/src/analytics/analytics.service.ts:174-182` checks personalization and then updates the event to `consentPurpose='personalization'` without a transaction/shared lock or a post-update recheck. Withdrawal can commit after line 176 and before line 179.
- `apps/server/src/recommendation/exposure/exposure-tracking.service.ts:18-31` and `:41-61` use the same insert-then-compensate pattern for `RecommendationExposure`; the consent decision and exposure mutation are not in one serialization boundary.
- `apps/server/src/behavior-engine/signals/signal-detector.service.ts:78-93` and `:118-131` recheck an epoch immediately before derived mutations, but the check and `deleteMany`/`updateSignal`/snapshot/vector writes are separate operations. Withdrawal can commit between them.
- `apps/server/src/analytics/analytics.consent-gate.spec.ts:179-193` proves only the successful compensating-delete path. It does not cover delete failure, process interruption, or a withdrawal deferred between the final check and the subsequent update.

Concrete attack ordering:

1. Event request observes a current grant at `analytics.service.ts:146-149`.
2. `POST /users/consent` commits withdrawal through `users.service.ts:696-735`.
3. The event request executes `userEvent.create` at `analytics.service.ts:159`.
4. The process stops before the post-check, or `userEvent.delete` rejects and is ignored at line 168.
5. [قطعی] A post-withdrawal optional row remains; direct DB-residue inspection can detect it.

Required remediation:

1. Use one shared per-user database serialization primitive for both consent decisions and optional writes (for example, a transaction-held lock on the canonical user row, acquired in the same order everywhere). `grantConsent`/withdrawal and analytics/exposure/derived writers must participate in it.
2. Inside that transaction, re-read the latest current-policy decisions and runtime switches, then perform the optional insert/update/outbox enqueue. Do not rely on best-effort compensating deletion as the safety invariant.
3. Apply the same mutation-boundary rule to direct service and cron writers, not only HTTP controllers.
4. Add deterministic deferred-interleaving tests for withdrawal immediately before every optional mutation, delete/cleanup failure, and process interruption. Add a local QA database assertion that no row with a post-withdrawal write time remains.

### ADV-P0A-002 — the focused server gate is red

Severity: release blocker
Confidence: [قطعی]

Command run:

```text
pnpm.cmd test -- --runInBand <15 focused P0-A server suites>
```

Result: 14/15 suites passed; 125/126 tests passed. `apps/server/src/admin/observability.service.spec.ts:124` failed because the assertion expects `event` outside the `OR` branch and omits the event timestamp epoch, while the implementation emits the stricter relation predicate from `optional-processing-boundary.ts:190-205`.

Required remediation:

- Update the test to assert the actual strict predicate: each `OR` subject branch must contain `userId`, `observedAt >= grant epoch`, and related `event.consentPurpose='personalization'` plus `event.timestamp >= grant epoch`. Do not weaken or remove the provenance assertion. Rerun the identical focused lane after the last change.

### ADV-P0A-003 — signal cron discovers all users before a runtime-off boundary

Severity: important boundary gap
Confidence: [قطعی]

`apps/server/src/behavior-engine/signals/signal-detector.service.ts:41-47` calls `getActiveUsers()` before any explicit runtime guard, and `:136-138` reads every user id. Runtime-off is encountered only later through `currentGrantEpoch`. This does not read optional signal rows, but it violates the stricter zero-discovery/data-minimization behavior used by the other personalization schedulers and leaves unnecessary user DB I/O while processing is OFF. `signal-detector.service.spec.ts:46-57` does not assert that `user.findMany` is zero.

Required remediation:

- Return before logging or user discovery when either required optional runtime is OFF, and add a runtime-OFF test asserting zero `user.findMany`, consent, optional-table, snapshot, and feature-store calls.

## Attack matrix

| Attack | Result | Evidence |
|---|---|---|
| Completion after allergy-write failure | PASS (unit/static) | One serializable transaction in `users.service.ts:391-581`; injected critical-write failures in `users-onboarding.spec.ts:189-196` never reach completion. |
| Completion after consent failure | PASS (unit/static) | Consent writes and completion share the same transaction; the same parameterized test covers both consent writes. |
| Stale completion retry | PASS (unit/static) | Completed state is immutable and mismatches return conflict at `users.service.ts:395-448`; replay test at `users-onboarding.spec.ts:309-318`. |
| Double submission | PASS (unit/static) | Serializable retry loop at `users.service.ts:583-594`; identical/conflicting concurrency tests at `users-onboarding.spec.ts:240-268`. |
| Direct optional analytics API after deny | PASS for settled deny | Authenticated identity is server-owned in `analytics.controller.ts:54-66`; deny stops before write at `analytics.service.ts:94-100`. |
| Forged consent payload | PASS (static) | Global `ValidationPipe` forbids unknown fields in `main.ts:39-44`; DTO allowlists optional purposes, and service rejects other purposes at `users.service.ts:696-699`. |
| Old policy version | PASS (unit/static) | Server-owned current versions in DTO/service; current-policy filtering in `consent.service.ts:116-122`; stale-policy tests passed. |
| Withdrawal race | **FAIL** | ADV-P0A-001. |
| Queued impression replay | PASS (unit/static, not browser) | Client clears dwell/batch and disconnects at `useImpressionObserver.js:28-48,101-151`; reactive replay tests passed at `useImpressionObserver.test.jsx:129-180`; outbox rechecks current epoch. |
| Admin analytics bypass | PASS (focused static/unit) | Runtime-off/current-population assertions precede optional reads in `optional-processing-boundary.ts:28-59,111-152` and admin services. |
| Observability bypass | CODE PASS / TEST GATE FAIL | Optional reads are gated or explicitly unavailable in `observability.service.ts`; ADV-P0A-002 keeps the release gate red. |
| Recommendation diagnostics bypass | PASS (focused static/unit) | `diagnostics.controller.ts:34-41` returns unavailable before diagnostic DB reads; direct-call tests passed. |
| Cron/direct service bypass | **PARTIAL/FAIL** | Outbox and several schedulers fail closed, but ADV-P0A-001 and ADV-P0A-003 remain. |
| `recordAudit` payload injection | PASS (focused unit/static) | `admin.service.ts:33-95,107-141` allowlists action/route/token metadata and writes only `UserAuditLog`; injection/canonical-model tests passed. |
| Account A to B cache leak | NOT VERIFIED IN BROWSER | Static cleanup and unit tests passed; no production-preview two-account run was performed by this reviewer. |
| Multi-tab stale token/state | NOT VERIFIED IN BROWSER | Token-snapshot and storage-event code/tests passed; real two-tab behavior remains unverified here. |
| Offline/back-forward replay | NOT VERIFIED IN BROWSER | Private API runtime caching is absent, but browser history/offline evidence is required. |
| Legacy service-worker cache replay | NOT VERIFIED IN BROWSER | Known `api-cache`/`asset-cache` cleanup exists in `sw-private-cache-cleanup.js`; actual old-worker upgrade was not executed here. |
| Startup/account-switch race | UNIT PASS / BROWSER NOT VERIFIED | Auth/api/cache focused tests passed; real account-switch under delayed cache/network conditions remains required. |
| Direct DB residue | **FAIL by construction / not locally executed** | ADV-P0A-001 permits residue after cleanup failure or interruption; no production or ambiguous database was accessed. |

## Test evidence

- [قطعی] Web focused lane: 8/8 files, 73/73 tests passed (`AuthContext`, `apiClient`, private-session cache, PWA config, analytics init, analytics hook, impression observer, onboarding hook).
- [قطعی] Server focused lane: 14/15 suites, 125/126 tests passed; the one failure is ADV-P0A-002.
- [قطعی] These unit results do not substitute for production-preview service-worker, two-account, multi-tab, offline/back-forward, or dedicated local QA database evidence.

## Approval condition

[قطعی] Rerun this adversarial attack only after ADV-P0A-001 and ADV-P0A-002 are fixed. Approval additionally requires production-preview browser evidence for A→logout→B, two tabs, offline/back-forward, legacy-worker upgrade/startup, and dedicated `garnish_p0a_qa` residue inspection. No production database may be used.
