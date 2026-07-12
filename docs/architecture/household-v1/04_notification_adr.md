# ADR: server-backed household notifications

Status: **PROPOSED**; push remains disabled until its readiness gate passes.
Implementation status: none.

## Reality check

- **[Confirmed]** The current `Notification` table is only an in-app row with title/body/type/read/data (`apps/server/prisma/schema.prisma:416-426`). It has no dedupe key, source event, action state, delivery attempt, quiet-hours, or channel model.
- **[Confirmed]** The current settings UI explicitly stores notification toggles only in localStorage because there is no backend preference endpoint (`apps/web/src/app/settings/useSettings.js:12-22`, `:103-109`). Those toggles therefore cannot govern a server scheduler.
- **[Confirmed]** The current notification engine is default-off/dry-run, keeps its ledger in memory, uses a hard-coded `22:00–07:00` quiet window, and has no push/email provider (`apps/server/src/notifications/ine/ine.service.ts:1-9`, `:56-79`).
- **[Confirmed]** Scheduler duplicate suppression includes an in-process `Map`, which resets on restart and does not coordinate replicas (`apps/server/src/notifications/notification-scheduler.service.ts:20`, `:94-101`).
- **[Confirmed]** A PWA plugin exists, but the repo contains no push-subscription model, Web Push provider, VAPID key flow, browser permission workflow, or delivery test harness (`apps/web/vite.config.js`, repository search on base `1631dc5d`).
- **[Decision]** H3 ships server-backed in-app inbox plus realtime invalidation first. Push is schema-ready but feature-flagged off. Email and SMS are out of scope.

## Goals and non-goals

Goals:

- create notifications from committed server domain events;
- persist user settings server-side and enforce them in routing/delivery;
- make notifications actionable, deduplicated, rate-limited, privacy-safe, and observable;
- survive retry, scheduler restart, duplicate event, and multi-instance execution;
- reauthorize every deep-linked action.

Non-goals:

- generic “something changed” noise;
- behaviorally inferred quiet hours overriding explicit settings;
- marketing/re-engagement expansion;
- raw health/allergy detail in any notification;
- push before technical/consent/privacy readiness;
- autonomous actions, purchase, or plan confirmation.

## Decision and data model

### 1. Domain events are the source

A household mutation transaction writes `HouseholdActivityEvent` plus both independent `REALTIME_FANOUT` and `NOTIFICATION_PROJECTOR` consumer-work rows for every event. The two workers claim/retry/dead-letter independently. Notification projection never runs “before” or gates realtime: a poison notification event can dead-letter and alert while realtime invalidation continues, and Redis failure cannot discard durable notification work. Projection and retries are idempotent:

`unique(recipientUserId, sourceEventId, eventType)`.

A crash may repeat projection or Redis publish, but cannot create another semantic notification intent. If an event has no notification policy, work completes `DONE/NO_POLICY`. During H1/H2 while H3 is disabled, the projector still drains every row as `DONE/DISABLED_BEFORE_CUTOVER` with policy version/sequence; it never accumulates a future-send backlog. H3 records an audited cutover sequence and only greater sequences may create intents. Per-consumer checkpoints/gap audits therefore remain contiguous; checkpoints are not authorization or dedupe state.

Do not create a second `NotificationEvent` table in v1; that would duplicate the durable household event. Scheduled personal nudges may keep their existing path until separately migrated, but they must not masquerade as household collaboration events.

### 2. Add `NotificationIntent`; keep legacy `Notification` visible-only

Do not store hidden or push-only intents in the legacy `Notification` table: the previous reader returns every row and would display muted content after application rollback. Add a separate `NotificationIntent` canonical per-recipient record:

- `id`, `recipientUserId`, optional `householdId`, `sourceEventId`, `eventType`;
- optional `actorMembershipId` (no copied actor PII), safe template key/variables;
- internal allowlisted deep link and action resource/version/expiry/state;
- `dedupeKey`, `groupKey`, priority, sensitivity, expiry, timestamps;
- unique `(recipientUserId,sourceEventId,eventType)`.

The existing `Notification` remains the visible inbox presentation. Add only nullable `intentId @unique` plus new display/read fields needed by the new UI. Projection creates it only when `IN_APP=AVAILABLE`; a push-only or both-muted intent creates no legacy inbox row. Existing readers therefore see exactly the visible in-app subset on rollback. New household payloads use validated templates and never accept arbitrary external URLs.

### 3. `NotificationPreference` is server-authoritative

One row per user:

- `timezone` (IANA identifier);
- optional `quietStartMinute` / `quietEndMinute` in local time;
- `quietDays` bitset;
- `lockScreenDetail` (`GENERIC` default; `CONTEXT` explicit opt-in where allowed);
- `digestMode` (`OFF|DAILY`), digest local minute;
- `globalMuteUntil`;
- `rulesJson` validated against a versioned server schema;
- `schemaVersion`, `version`, timestamps.

Each event rule contains `{inApp, push, mode: IMMEDIATE|DIGEST|MUTED}`. Unknown rule keys fail validation; absence uses conservative defaults. Local storage may be an optimistic mirror only and is cleared/account-partitioned.

### 4. `NotificationDelivery` tracks every channel decision/work

Fields: `id`, `intentId`, `channel` (`IN_APP|PUSH`), `status` (`AVAILABLE|PENDING|DEFERRED|PROCESSING|SENT|SUPPRESSED_PREFERENCE|FAILED_RETRYABLE|FAILED_PERMANENT|CANCELLED`), `attempts`, `nextAttemptAt`, `providerMessageId`, bounded `lastErrorCode`, `claimedAt`, `sentAt`, timestamps.

Constraints: unique `(intentId,channel)`; indexed claim queue `(channel,status,nextAttemptAt)`. Projection creates a deterministic row for each supported channel: `IN_APP=AVAILABLE` also creates the linked visible `Notification`; `IN_APP=SUPPRESSED_PREFERENCE` creates no inbox row while push may proceed. If both channels are muted, the minimal intent plus suppressed decisions is retained for bounded dedupe/audit without presentation. A worker uses row claims/`SKIP LOCKED`, exponential backoff with jitter, attempt/age caps, and dead-letter alerting. Provider idempotency keys use the delivery ID where supported.

Push subscription persistence is a later additive model: endpoint/user/device binding, public key material, expiration, last success/failure, revokedAt. A stale or `410 Gone` subscription is revoked, not retried forever.

## Event catalog and action policy

| Event | Recipients | Default in-app | Default push | Action/deep link | Dedupe/group rule |
|---|---|---:|---:|---|---|
| `HOUSEHOLD_INVITED` | target user only when identity-bound | on | off | accept/decline invite | one per live invite; resend rotates/replaces |
| `INVITE_ACCEPTED` | inviter/owner, excluding acceptor | on | off | member profile | invite ID |
| `SHOPPING_SESSION_STARTED` | active members except actor | digest/silent | off | active shopping session | one per session |
| `ITEM_ADDED_DURING_SESSION` | active shoppers except actor | on | opt-in | exact item | collapse by session in short window |
| `SHOPPING_ITEM_MENTIONED` | mentioned active member | on | opt-in | exact item | source event + recipient |
| `ITEM_UNAVAILABLE` | requester/assigned decision participants except actor | on | opt-in time-sensitive | item decision | one open decision |
| `SUBSTITUTION_REQUESTED` | members permitted to decide, except actor | on | opt-in time-sensitive | exact decision | one open decision |
| `SUBSTITUTION_DECIDED` | requester/shopper except actor | on | opt-in | resolved decision | decision ID/status |
| `MEAL_PROPOSED` | active plan participants except actor | on/digest | off | proposal | proposal ID |
| `PLAN_REVIEW_REQUESTED` | active members with plan read | on | opt-in | board review | board/version |
| `PLAN_CONFIRMED` | active plan participants except actor | on | off | immutable confirmed version | board/version |
| `ADVISOR_COMMENT` | share creator/plan confirmer except matching actor | on | opt-in | contextual comment | comment ID; group by share |
| `ADVISOR_PROPOSAL` | share creator/plan confirmer | on | opt-in | exact proposal | proposal ID |
| `SHARE_REVOKED` | identifiable reviewer only if an authenticated channel exists | on where applicable | off | none/revoked state | share ID |
| `MEMBER_REMOVED` | removed user and owner audit surface | on while session valid | off | access-ended page | membership ID |

“Mention” is contextual tagging on an item/comment, not generic chat. Low-value item edits, read markers, reactions, presence heartbeats, and every optimistic keystroke are silent sync events, not notifications.

## Recipient and preference algorithm

For each source event:

1. load policy by typed event key; unknown keys suppress and alert in non-production tests;
2. derive candidates from current active membership/resource relationships, not event-supplied user IDs;
3. exclude actor unless the policy documents a useful self-confirmation;
4. remove recipients without resource read/action capability;
5. load server preference and apply global mute/event/channel rule;
6. apply dedupe/group transactionally;
7. persist the canonical recipient intent once and create/update an `IN_APP` delivery as `AVAILABLE` or `SUPPRESSED_PREFERENCE`;
8. create a deterministic `PUSH` delivery as pending/deferred or suppressed according to feature readiness, explicit rule, subscription, and privacy policy;
9. set `DEFERRED` until quiet-hours/digest boundary; do not busy-loop;
10. re-check membership, preference version, share status, and action expiry immediately before external delivery.

Preference precedence is: legal/safety suppression → authorization → explicit global mute → explicit event/channel rule → quiet hours/digest → rate/collapse policy. Behavioral prediction may suggest settings to a user in the future; it may not silently override them.

## Quiet hours, caps, and digest

- Quiet hours are explicit and server-backed. No preference means a conservative default proposed as `22:00–07:00` **[Assumption: product validation required]**; UI must disclose it rather than call it inferred behavior.
- In-app inbox creation may occur during quiet hours; sound/banner/push delivery waits.
- Decision-required push may bypass quiet hours only after a separate user opt-in and only while the action can still be completed. Otherwise it remains visible in-app.
- Enforce per-recipient/event cooldown, per-household group collapse, and a global non-essential daily cap. Caps are configuration, not “industry standards,” and must be measured.
- Digest groups references to inbox items; it does not copy sensitive item/meal names into a new long body.
- If the digest time is missed, send at most one catch-up digest. A restarted scheduler does not replay every historical window.

## Privacy-safe content

Default lock-screen/push copy is generic:

- good: “Your household needs a shopping decision.”
- in-app after authorization: “Greek yogurt was unavailable. Choose one of two alternatives.”
- forbidden by default: allergy names, health goals, nutrition history, private notes, receipt text, photo URL, guest/child details, full member phone/email, external share secret.

`lockScreenDetail=CONTEXT` is not available for raw sensitive scopes. Notification title/body are server templates with bounded variables; do not persist arbitrary user HTML. Internal deep links are allowlisted and resource authorization runs after navigation.

## Action execution

A notification action calls the normal domain endpoint with a new `Idempotency-Key`, `expectedVersion`, and resource ID. The action endpoint:

1. authenticates the current user independently of the notification;
2. reloads active membership/share and capability;
3. verifies action type, resource state, expiry, and expected version;
4. executes once or returns the prior idempotent result;
5. marks notification action state only after domain commit;
6. returns `409 ACTION_EXPIRED_OR_STALE` for an already-resolved decision.

A notification row is never an authorization grant. Executing the same push/in-app action twice must yield one domain result.

## Push readiness gate

Push stays off until all are proven:

1. VAPID/provider secrets are in an approved secret store and rotate safely;
2. opt-in UX explains value before the browser permission prompt; denial does not break in-app notifications;
3. subscription rows are account/device-bound, revocable, exported/erased, and never logged;
4. service worker handles payload as untrusted data and uses generic lock copy by default;
5. logout/account switch clears displayed notifications and unregisters or rebinds the device subscription safely;
6. preference/quiet/digest enforcement passes cross-device tests;
7. retry, duplicate, `410` subscription, revoked member/share, and lock-screen privacy tests pass;
8. private API responses are removed from PWA runtime cache and stream/push endpoints are `no-store`;
9. monitoring covers send rate, failures, duplicate suppression, opt-out/mute, and spam complaints;
10. privacy/legal review approves purposes and retention.

PWA installability alone is not push readiness.

## Failure behavior

- **Projection retry:** unique recipient/source/event and unique notification/channel prevent duplicates; notification poison/dead-letter does not block realtime consumer progress.
- **Delivery timeout:** keep same delivery ID/idempotency key; query provider status if supported before retry.
- **Preferences unavailable:** fail closed for push and non-essential alerts; core in-app decision may be created with no external delivery.
- **Membership removed:** cancel pending delivery and make deep link return an access-ended state without resource detail.
- **Share revoked/action expired:** mark action stale; do not leak previous content.
- **Redis/SSE unavailable:** inbox remains durable; client refetches after reconnect.
- **Clock/timezone invalid:** default to no external delivery until corrected; do not guess local time.

## Migration and coexistence

The existing personal scheduler and INE may continue default-off while household H3 is developed. Household routing does not use the in-memory INE ledger or localStorage preferences. Migrate as follows:

1. reuse the H1 independent event-consumer-work/checkpoint tables (whose disabled projector has been completing no-op work); H3 creates `NotificationIntent`, preference/delivery tables, and only a nullable unique `Notification.intentId` link on the legacy visible inbox;
2. leave legacy notification rows as legacy visible inbox data; do not fabricate hidden intents/dedupe or backfill push deliveries;
3. deploy preference read/write API and cross-device UI;
4. dual-read legacy visible rows; new router writes canonical intents and channel decisions, creating a legacy-compatible `Notification` row only for `IN_APP=AVAILABLE`;
5. atomically record/audit the H3 cutover sequence and policy version; enable intent projection only for later sequences, then in-app presentation behind a separate flag;
6. prove scheduler/router enforcement and then remove the household UI’s localStorage authority;
7. leave push disabled until its independent gate passes.

Rollback disables projection/delivery flags. Existing and new visible inbox rows remain readable by the previous app; muted/push-only intents live only in the new table and cannot leak through the old reader. Do not drop intent/preference/delivery tables during application rollback.

## Acceptance tests and observability

Required tests:

- preferences persist across two devices and are enforced by router and delivery worker;
- quiet hours including midnight wrap, DST, invalid timezone, digest restart/catch-up;
- duplicate event/projection/delivery retry and two workers racing;
- notification poison/dead-letter while realtime delivery remains green, plus independent checkpoint/gap recovery;
- H1/H2 disabled projector leaves zero pending backlog; H3 cutover never sends historical events and checkpoint audit stays contiguous;
- push-only, in-app-only, both-enabled, and both-muted preference representation;
- flood/collapse/cap behavior with action-required exception policy;
- actor exclusion and relationship-based recipients;
- removed member, expired action, revoked share, changed scope, member household switch;
- lock-screen generic copy and forbidden-sensitive-variable test;
- push denied/unavailable leaves durable in-app behavior;
- action double-tap/timeout/retry is idempotent;
- direct deep-link IDOR and stale expected version;
- server restart does not reset dedupe or quiet enforcement.

Report: projection lag, inbox create rate, duplicate suppression, grouped count, pending/oldest delivery, attempts/failure code, action rate/time-to-decision, mute/opt-out/spam complaint, and actor/self-send count. Metrics use IDs/counts, not message bodies.
