# ADR: realtime, ordering, concurrency, and offline replay

Status: **PROPOSED** for Stage A approval
Decision owner: Domain/Realtime/Security review
Implementation status: none

## Context and current evidence

- **[Confirmed]** Garnish is a NestJS HTTP API using PostgreSQL; `main.ts` boots one ordinary HTTP app (`apps/server/src/main.ts:22-56`).
- **[Confirmed]** Redis 7 is in the local topology, `ioredis` is installed, and Redis is already configured as the global cache store (`docker-compose.yml:17-24`, `apps/server/package.json:83-88`, `apps/server/src/app.module.ts:35-44`).
- **[Confirmed]** No WebSocket gateway, SSE controller, `EventSource`, or socket dependency exists in the current repo (repository search on Stage A base `1631dc5d`).
- **[Confirmed]** The existing event outbox is explicitly at-least-once, not exactly-once (`apps/server/src/behavior-engine/routing/event-outbox.service.ts:15-20`). It is tied to `UserEvent`, so household delivery needs a household-scoped log/outbox rather than overloading it.
- **[Confirmed]** Current shared-target models have no optimistic versions, and current `MealSlot` lacks a uniqueness constraint (`apps/server/prisma/schema.prisma:374-414`).
- **[Risk]** Native browser `EventSource` cannot attach the current bearer `Authorization` header. Putting a long-lived JWT in an SSE query string would leak it into logs/history. The selected client therefore uses authenticated `fetch()` streaming with SSE framing, not a tokenized URL.

## Decision

Use:

1. normal authenticated HTTP commands for every mutation;
2. PostgreSQL as source of truth, with integer entity versions and database constraints;
3. a per-household monotonic event sequence in a durable `HouseholdActivityEvent` table that also acts as the transactional outbox;
4. authenticated server-sent-event framing over `fetch()` for server-to-browser invalidation/events;
5. Redis Pub/Sub only as a low-latency cross-process fan-out accelerator;
6. database catch-up by household sequence after reconnect, Redis reconnect, or detected gap;
7. an IndexedDB command queue for a bounded allowlist of low-risk offline mutations;
8. at-least-once delivery and replay with idempotent consumers—never an exactly-once claim.

This is the smallest robust fit because commands are already HTTP, updates flow mainly server-to-client, PostgreSQL and Redis already exist, and durable replay is required. WebSocket would introduce a second mutation protocol and a wider authorization surface without a demonstrated bidirectional-stream need.

## Options compared

| Option | Latency/UX | Durability and reconnect | Operational cost | Security/authorization surface | Fit now | Decision |
|---|---|---|---|---|---|---|
| Browser interval polling of resource endpoints | delayed or chatty | snapshot refetch is robust but no ordered delta/ack | simple code; DB/API load grows with clients | ordinary HTTP guards; easiest to reason about | acceptable fallback, poor active-shopping efficiency | Do not use as primary; retain slow resync fallback |
| SSE (`fetch` stream) + HTTP commands | low-latency one-way fan-out | event IDs and explicit catch-up; browser/client reconnect logic required | one long HTTP connection per tab; proxy buffering/timeouts must be configured | same-origin allowlist, bearer header, tenant checked on connect and replay | update direction matches the product | **Selected transport** |
| WebSocket | low-latency bidirectional | application must build ack, replay, reauth, and gap handling | gateway/adaptor, proxy upgrade, heartbeats, more tests | message-level auth, origin validation, connection exhaustion, session expiry | no proven need to send commands over the socket | Defer until presence/duplex needs are proven |
| Client database-backed event polling (`GET events?after=`) | moderate; tunable | durable sequence makes it reliable | repeated DB scans per client; can storm | ordinary HTTP guard | useful catch-up and degraded mode | Use only for catch-up/resync, not a constant foreground loop |
| Server outbox polling | not user-facing by itself | durable, retryable, supports crash recovery | a small worker and queue indexes | internal worker only | necessary to avoid commit/publish gap | **Selected durability mechanism** |
| Redis Pub/Sub alone | very low | at-most-once; disconnected subscriber loses messages | Redis already exists; two dedicated connections per process | channel naming and publisher integrity matter | good fan-out, insufficient source of truth | **Selected only as accelerator** |
| Redis Streams | low | persisted consumer semantics | another durable queue and trimming/consumer-group operations | internal | duplicates PostgreSQL event log for v1 | Defer; reconsider at measured outbox bottleneck |
| PostgreSQL LISTEN/NOTIFY | low | notification payload is not a durable log | extra long DB connections and reconnect code | internal | possible, but Redis already exists and is used | Reject for v1 |
| CRDT | potentially excellent offline merge | convergence does not encode business authorization or semantic transitions | substantial model/client/test burden | sensitive replica state and revocation become harder | structured state has explicit conflicts | **Reject** |

Redis documents Pub/Sub as at-most-once, so it cannot be the recovery source ([Redis Pub/Sub delivery semantics](https://redis.io/docs/latest/develop/pubsub/)). SSE supports event IDs and reconnect framing, but remains one-way ([MDN server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)).

## Event and command contract

### Command envelope

Every collaborative mutation carries:

```json
{
  "clientMutationId": "uuid-v4",
  "expectedVersion": 17,
  "deviceId": "random-non-secret-id",
  "payload": {}
}
```

Header: `Idempotency-Key: <clientMutationId>`. The server binds the key to authenticated principal, operation, and request hash. The JWT/share secret is never persisted in the offline command.

Successful response:

```json
{
  "result": {},
  "entityVersion": 18,
  "householdSequence": "4021",
  "idempotencyStatus": "COMPLETED"
}
```

Conflicts use `409` with a bounded projection:

```json
{
  "code": "VERSION_CONFLICT",
  "expectedVersion": 17,
  "currentVersion": 19,
  "current": {},
  "safeChangedFields": ["quantity", "status"]
}
```

The server never reports whether an inaccessible cross-household ID exists; that path remains `404`.

### Event envelope

```json
{
  "eventId": "uuid",
  "householdId": "uuid",
  "sequence": "4021",
  "type": "SHOPPING_ITEM_CHANGED",
  "aggregateType": "SHOPPING_ITEM",
  "aggregateId": "uuid",
  "aggregateVersion": 18,
  "actorProfile": { "id": "uuid", "displayName": "safe display label" },
  "occurredAt": "2026-07-13T10:00:00.000Z",
  "data": { "changedFields": ["quantity"] }
}
```

The event is an invalidation/safe activity delta, not a complete record. Restricted fields require an authorized resource refetch. Events contain no token, raw allergy/health data, receipt text, attachment URL, or private note.

## Transactional ordering and outbox

Inside the mutation transaction:

1. claim/create idempotency record;
2. lock in the fixed order household → active caller membership → aggregate; hold the membership row lock until commit so member removal must serialize, and validate membership status/version/expiry inside the transaction;
3. perform capability/resource checks and compare-and-swap entity `version`;
4. `UPDATE Household SET nextEventSequence = nextEventSequence + 1 ... RETURNING nextEventSequence`;
5. insert `HouseholdActivityEvent` plus independent idempotent consumer-work rows for both `REALTIME_FANOUT` and `NOTIFICATION_PROJECTOR` for every event; a no-policy notification event completes as a no-op;
6. persist redacted idempotent response;
7. commit.

The sequence row serializes mutations only inside one household. Household collaboration is small enough that this is preferable to ambiguous timestamp ordering. Measure lock time; reconsider only if one household’s p95 transaction contention is proven material.

Each consumer claims its own work rows in bounded batches with `FOR UPDATE SKIP LOCKED`. Realtime publishes only `{householdId,sequence,eventId}` to Redis and marks only `REALTIME_FANOUT` work done; notification projection owns a separate work row/checkpoint and cannot block it. Before H3, that consumer drains every row as `DONE/DISABLED_BEFORE_CUTOVER`; H3 records an audited cutover sequence/policy version and only greater sequences may create intents, so H1/H2 never become a historical flood. No-policy work completes `DONE/NO_POLICY`. Crash after publish and before mark can duplicate; crash before publish leaves realtime work pending. A poison notification can dead-letter and alert while realtime remains fail-open and the notification work stays durably retryable/remediable. Consumers dedupe by their own semantic keys, and per-household/consumer checkpoints audit sequence holes without treating a checkpoint as authorization.

## Realtime endpoint and reconnect

Endpoint: `GET /households/:householdId/events/stream?after=<sequence>` using `fetch()` with:

- `Authorization: Bearer ...`;
- `Accept: text/event-stream`;
- optional `Last-Event-ID` header or `after` sequence (sequence is non-secret);
- `Cache-Control: no-store, private` response;
- proxy buffering disabled and a 15–25 second comment heartbeat;
- no service-worker/runtime caching for the stream route.

Connection procedure:

1. authenticate and load active membership scoped to route household;
2. validate `after` against retained sequence range;
3. replay authorized events `sequence > after` in ascending order, bounded to 500;
4. if the gap is too old/large, send `RESYNC_REQUIRED` and require snapshot refetch;
5. subscribe this process to Redis fan-out and emit only events for the authorized household;
6. periodically revalidate session epoch/membership and immediately close on removal/archive/logout invalidation;
7. on Redis reconnect, compare every active stream’s last sequence with PostgreSQL and fill gaps.

The client applies only the next sequence, ignores duplicates, buffers a small out-of-order window, and refetches on a gap rather than guessing. It acknowledges only by remembering the last applied sequence in account-and-household-partitioned IndexedDB. The server does not track a write per delivered UI event.

### Backpressure and limits

- one stream per tab; maximum three per user/device and a bounded per-IP fallback cap;
- heartbeat does not contain private data;
- event payload and replay page size are capped;
- slow clients are disconnected with a retry hint rather than accumulating unbounded memory;
- connection, reconnect, replay count, gap, lag, and disconnect-reason metrics are recorded without payloads;
- cross-origin requests use an exact allowlist; wildcard CORS is forbidden.

If a future WebSocket transport is introduced, OWASP recommends origin validation, session expiry handling, message-level authorization, input limits, and connection-exhaustion controls ([OWASP WebSocket Security](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html)). These controls also inform the long-lived SSE endpoint.

## Concurrency policy by operation

| Operation | Database rule | Conflict policy |
|---|---|---|
| Add semantic shopping item/contribution | unique `(listId,activeSemanticKey)` plus `(listId,sourceKey)` contribution | converge on existing aggregate, preserve each requester/meal source; never silently sum incompatible quantities |
| Edit quantity/unit/note | `WHERE id,householdId,version` | stale edit returns `409`; user chooses retry/replace after seeing safe diff |
| `BOUGHT` vs `UNAVAILABLE` | canonical `NEEDED→CLAIMED→IN_CART→BOUGHT` and `UNAVAILABLE→DECISION_PENDING→SUBSTITUTION_APPROVED` or `SKIP_APPROVED→SKIPPED`; expected version | first committed transition wins; second gets `409`; an open decision is represented once, not by contradictory statuses |
| Assign/claim | expected version + active assignee membership | stale claimant sees current assignee and may retry only after release |
| Start session | unique active session key | return existing active session, never create two |
| Resolve decision | expected version + `OPEN` + not expired | first valid decision wins; retry receives completed idempotent result or `409` |
| Draft meal edit | board expected version + slot unique key | stale edit becomes an explicit proposal or user resolves conflict |
| Confirm plan | current immutable version must equal base | create next version; stale confirmation rejected |
| Apply shopping diff | unique diff hash/source keys + idempotency key | change only plan-owned contributions; preserve manual/other-meal sources; changed list versions require re-preview |
| Ordinary mutation vs member removal | same household→membership lock order and membership version predicate | mutation either commits before `MEMBER_REMOVED` or sees inactive membership; none can commit after removal |
| Owner transfer/member removal | lock household/membership in fixed order | serialize; owner cannot leave/remove without valid transfer |

Do not implement last-write-wins for shared quantity, item status, plan confirmation, role, privacy grant, or external scope. Last-write-wins is acceptable only for a user’s own reaction/read marker when the API makes that contract explicit.

## Offline queue

### Storage and partitioning

Use IndexedDB, not localStorage. Database/store names include a non-secret stable account ID and `householdId`. Records contain command envelope, created time, dependency key, retry count, and state. They contain no JWT, invite/share secret, raw allergy/health data, or cached external share response.

On logout, account switch, membership removal, consent revocation affecting queued content, or household archive:

1. stop stream and replay;
2. cancel in-flight requests;
3. clear React Query and in-memory optimistic state;
4. purge that account/household IndexedDB partition;
5. delete private PWA API caches;
6. render the next account only after purge resolves.

### Offline allowlist

| Command | Offline | Rule |
|---|---|---|
| add shopping item | yes | idempotency + semantic unique key; duplicate requires online reconciliation |
| edit item text/quantity | yes | expected version; never overwrite automatically after conflict |
| mark claimed/in-cart/bought/unavailable | yes during a previously active session | expected version; status conflict stops that aggregate queue |
| add/edit pantry item | yes | semantic unique key + expected version |
| set own reaction/attendance | yes | scoped to own profile; expected board/version |
| upload alternative photo | no in v1 | avoid storing sensitive blobs and expiring decisions offline |
| start/end session | no | presence/session coordination needs authoritative online state |
| resolve substitution decision | no | it may expire and should not appear successful while offline |
| confirm plan/apply shopping diff | no | high-impact, versioned, preview-dependent |
| invite/remove/role/owner/privacy/share | no | security-sensitive and revocation-sensitive |

### Replay algorithm

1. Verify current authenticated account and active household membership online.
2. Fetch current server sequence and minimal versions.
3. Replay FIFO per aggregate; independent aggregates may run with bounded concurrency.
4. Reuse the original idempotency key for every retry of that queued command; never mint a new key after an acknowledgement timeout.
5. On success, reconcile optimistic entity with response and remove command.
6. On `409`, mark that aggregate `CONFLICT`; later commands for it pause, but unrelated aggregates continue.
7. On `401/403/404` after membership change, stop and purge without exposing server state.
8. Exponential backoff with jitter; cap attempts and queue age. Proposed caps are 1,000 commands and seven days **[Assumption: validate with measurement and privacy review]**. The server retains the full idempotent result for at least 30 days and a non-executable tombstone through day 90. A client/server rejects automatic replay older than seven days; during tombstone retention it returns `IDEMPOTENCY_RESULT_EXPIRED`, and after tombstone deletion the UI must refetch and require a new explicit user action/key rather than resurrecting the old command.

The UI must distinguish `LOCAL_ONLY`, `SYNCING`, `SYNCED`, `CONFLICT`, and `REJECTED`; it must not show a permanent success state before server acknowledgement.

## Why no CRDT

CRDT is not justified because:

- the product coordinates decisions rather than collaboratively editing free-form documents;
- membership removal and share revocation require immediate server authority;
- statuses have non-commutative business transitions;
- meal confirmation and shopping diff require a single canonical base version;
- database uniqueness is required for semantic items and meal slots;
- exposing replicated sensitive household state increases privacy and erasure complexity.

Reconsider only if production evidence shows frequent multi-device offline editing of the same commutative field, explicit conflict UX fails materially, and a field-level CRDT can be isolated without weakening authorization or deletion. A wholesale CRDT document remains out of scope.

## Failure and degraded modes

- **Redis down:** mutations continue; realtime consumer work remains pending while independent notification projection continues; streams perform periodic DB catch-up; latency degrades without data loss.
- **Realtime publisher down:** mutations and notification projection continue; clients may snapshot-poll/refetch; alert on oldest realtime work age; replay after recovery.
- **Notification projector poison/down:** realtime continues; notification work retries/dead-letters independently and alerts without being marked delivered.
- **SSE disconnected:** client shows reconnecting, preserves last sequence, then catch-up/refetches.
- **PostgreSQL down:** mutations fail closed; optimistic state rolls back or remains clearly unsynced. Redis never becomes authoritative.
- **Server restart:** HTTP retries use same idempotency key; SSE reconnect uses last applied sequence.
- **Retention gap:** send `RESYNC_REQUIRED`; never fabricate missing order.
- **Member removed mid-session:** membership invalidation closes stream; subsequent HTTP/offline replay denied and local household partition purged.

## Observability and acceptance gates

Measure before declaring a latency SLA:

- mutation commit p50/p95;
- commit-to-SSE p50/p95 and worst gap age;
- outbox pending/dead/oldest age and attempts;
- Redis disconnects and DB catch-up count;
- active connections by process/household/user, memory per connection, reconnect rate;
- replay page size, `RESYNC_REQUIRED` rate, duplicate suppression;
- offline queue size/age, conflict rate by command, semantic duplicate rate;
- database query plans for event replay and pending outbox claims.

Hard acceptance:

1. two browsers converge after concurrent item/plan changes;
2. no lost committed event across process crash between commit and publish;
3. duplicate delivery and duplicate HTTP retry create one semantic outcome;
4. removed/non-member user cannot connect, catch up, or replay;
5. bought/unavailable and plan-confirm races surface deterministic conflict;
6. Redis outage degrades latency but not correctness;
7. no polling storm, unbounded queue, or false synced state;
8. PWA/API caches are account/household isolated before offline mode is enabled.
9. a real two-connection race proves member removal and mutation serialize in both orderings, with no mutation committed after removal.
10. a poison notification projection does not delay realtime fan-out and remains independently visible/retryable.

## Rollback

Feature flags separately disable stream connection, Redis fan-out, offline queue, and optimistic writes. Rollback returns clients to authenticated snapshot refetch after successful HTTP mutations. Durable activity events and version columns remain; do not drop them during application rollback. Pending offline commands remain paused and exportable for debugging, then are purged by explicit user action or expiry—never replayed through an older client that cannot understand them.
