# Garnish Household v1 domain model

Status: proposed for Stage A review; no product code or schema migration has been applied.

## 1. Reality check and confidence

- **[Confirmed]** The current Prisma schema is user-owned, not household-owned: `MealPlan.userId`, the unique `ShoppingList.userId`, `PantryItem.userId`, and `Notification.userId` are the tenancy keys (`apps/server/prisma/schema.prisma:361-426`, `:754-767`).
- **[Confirmed]** `MealSlot` has no database uniqueness constraint for `(mealPlanId, dayOfWeek, mealType)` (`apps/server/prisma/schema.prisma:374-385`). `ShoppingItem` has no version or race-safe semantic key (`:398-414`).
- **[Confirmed]** PostgreSQL is authoritative and Redis already exists as cache infrastructure (`apps/server/prisma/schema.prisma:6-9`, `apps/server/src/app.module.ts:35-44`, `docker-compose.yml:4-25`).
- **[Decision]** Household v1 uses new additive household-owned tables. It does not reinterpret or silently move existing personal rows. This costs some temporary model duplication but is the lowest-risk expand-compatible path.
- **[Assumption]** A user may belong to more than one household at the data/API layer. The UI should expose a selector only after product evidence justifies it; every household route must still carry an explicit `householdId`.
- **[Decision]** A role is an input to a capability resolver, never the authorization check itself. Resource state, relationship, expiry, and explicit privacy grants narrow the baseline capability.
- **[Decision]** `ADVISOR` and `MANAGED_PROFILE` are not authenticated household roles in v1. An advisor is an expiring share principal. A managed profile cannot log in and is controlled by one authenticated manager.

## 2. Boundary and invariants

The tenant boundary is `Household.id`. Every household resource either stores `householdId` directly or has an unambiguous foreign-key path to it. Repository/service queries must include the tenant condition in the database query; fetching by global `id` and checking later is forbidden.

Hard invariants:

1. A household has exactly one owner user. `Household.ownerUserId` is non-null and `ON DELETE RESTRICT`.
2. The owner has an `ACTIVE` membership in the same household. Creation, transfer, leave, removal, archive, and account deletion run in one transaction and take a per-household transaction lock.
3. `(householdId, userId)` has one durable membership row. Re-invitation reactivates that row; history is not duplicated.
4. A removed, left, expired guest, or suspended member has zero household capabilities. Authorization is rechecked on every HTTP mutation, offline replay, share action, and realtime reconnect.
5. A managed profile has no credentials, sessions, invite acceptance, or direct permissions.
6. Sensitive personal fields are not columns on the shared member profile. Existing user allergies/health goals remain user-owned. Household processing or disclosure requires a separate, revocable `HouseholdDataGrant`.
7. One active semantic shopping item per list is enforced by a unique database key, not by a read-before-write check.
8. Every mutable collaborative aggregate has an integer `version`. Mutations use compare-and-swap and return `409 CONFLICT` with the authoritative version when stale.
9. Meal plan versions are immutable. Confirming a proposal creates a new version; it never edits an old version in place.
10. External reviewers can create comments/proposals only. Only an active household member with `PLAN_CONFIRM` can create the next canonical version.
11. Invite and share secrets are random bearer secrets, returned once, and only a keyed digest is stored. Invites are single-use; both token classes expire and are revocable.
12. Domain mutation, idempotency result, monotonic household sequence, and activity/outbox event are committed atomically.

## 3. Principals and capability resolution

### 3.1 Principals

| Principal | Persistence | Authentication | Scope |
|---|---|---|---|
| `OWNER` | `Household.ownerUserId` + active membership | normal user session | one household |
| `ADULT` | active membership | normal user session | one household |
| `MEMBER` | active membership | normal user session | one household |
| `MANAGED_PROFILE` | member profile, no membership | none | actions only through manager |
| `GUEST_SHOPPER` | active membership with mandatory `expiresAt` | normal user session | assigned list/session only |
| `PLAN_VIEWER` | `PlanShare` bearer principal | share secret | selected versions and scopes |
| `PLAN_REVIEWER` | `PlanShare` bearer principal | share secret | selected versions, comments, proposals |

### 3.2 Resolver

The five internal role presets are exactly `OWNER`, `ADULT`, `MEMBER`, `MANAGED_PROFILE`, and `GUEST_SHOPPER`. `OWNER` is computed from `Household.ownerUserId`; `MANAGED_PROFILE` has no authenticated membership and always resolves through its manager. Only `ADULT|MEMBER|GUEST_SHOPPER` are stored in `HouseholdMembership.role`. `PLAN_VIEWER|PLAN_REVIEWER` are external share-principal presets, not household roles; “advisor” is a reviewer label/use case, never a membership role.

`authorize(principal, capability, resource)` must evaluate, in order:

1. session/share authentication and revocation;
2. tenant equality from the database query;
3. active membership or live share status and expiry;
4. computed owner role or stored membership role;
5. baseline role-to-capability mapping in version-controlled code;
6. resource predicates such as assigned guest session, profile manager, share mode, selected version, and selected scope;
7. aggregate state (not archived, decision still open, proposal based on current version);
8. privacy grant and data minimization projection.

There is no per-household arbitrary capability editor in v1. It would multiply permission states before there is evidence users need it. New exceptions should be modeled as explicit relationships, not JSON allowlists.

## 4. Smallest coherent persistence model

Names below are logical names; final Prisma names may use the `Household` prefix to avoid collision with legacy models.

### 4.1 Foundation

#### `Household`

`id`, `name`, `timezone`, `status` (`ACTIVE|ARCHIVED|DELETING`), `ownerUserId`, `nextEventSequence bigint`, `version`, `createdAt`, `updatedAt`, `archivedAt`.

Indexes/constraints: index `ownerUserId`; check `version >= 1`; `ownerUserId` restricts user deletion until transfer or household deletion.

Lifecycle mapping is explicit: PRD `DELETION_PENDING` is persisted as `DELETING`. `DELETED` is not a live-row enum; after the cooling-off/retention job finishes, household-owned rows are physically removed or represented only by a separately governed non-reversible security tombstone. APIs may render a `DELETED` outcome for an already-gone ID without treating it as an accessible household.

#### `HouseholdMembership`

`id`, `householdId`, nullable `userId`, `role` (`ADULT|MEMBER|GUEST_SHOPPER`), `status` (`ACTIVE|LEFT|REMOVED|SUSPENDED`), `invitedByUserId`, `expiresAt`, `joinedAt`, `endedAt`, `version`, optional pseudonymous former-actor label.

Constraints: unique `(householdId,userId)` for non-null users; index `(userId,status)` and `(householdId,status)`; `ACTIVE` requires non-null user; guest role requires `expiresAt`; owner is computed from `Household.ownerUserId` and is not duplicated in `role`. Account erasure first ends access and then may null the user FK while preserving pseudonymous household attribution.

#### `HouseholdInvite`

`id`, `householdId`, `createdByMembershipId`, `intendedRole`, `tokenDigest`, `tokenPrefix`, `digestKeyVersion`, optional `targetUserId`, optional `targetAddressDigest`, optional `targetDigestKeyVersion`, `status` (`PENDING|ACCEPTED|DECLINED|REVOKED|EXPIRED`), `expiresAt`, `consumedAt`, `consumedByUserId`, `revokedAt`, `createdAt`.

Constraints: unique `tokenDigest`; index `(householdId,status,expiresAt)`; database check requires `targetUserId IS NOT NULL OR targetAddressDigest IS NOT NULL`—transferable/unbound invites are forbidden in MVP. Address binding uses `HMAC-SHA-256(INVITE_TARGET_PEPPER_vN, canonicalAddress)`, not a plain enumerable email/phone hash, and stores its independent key version. Acceptance compares the authenticated account’s canonical identifiers against current/previous target-pepper versions in constant time before conditionally consuming one live row. Raw delivery address is transient or encrypted only if a provider needs it and never enters logs/events/notifications. `tokenPrefix` is non-secret support metadata only.

#### `HouseholdMemberProfile`

Represents an eater, not an authorization principal: `id`, `householdId`, optional `membershipId`, `kind` (`LINKED_USER|MANAGED`), `displayName`, optional `avatarKey`, optional `managedByMembershipId`, `status`, `createdAt`, `updatedAt`.

Constraints: one linked profile per membership; managed kind requires an active manager; linked kind requires membership and forbids a manager. No allergy, health goal, private note, or nutrition history is stored here.

#### `HouseholdDataGrant`

`id`, `householdId`, `profileId`, `scope` (`DIETARY_CONSTRAINT_USE|ALLERGY_SAFETY_USE|ALLERGY_DISPLAY|PREFERENCE_DISPLAY|NUTRITION_SUMMARY_DISPLAY`), `grantedByMembershipId`, `status`, `grantedAt`, `revokedAt`, `version`.

Constraints: unique `(profileId,scope)`; default is no row/no grant. For a linked adult, only that user grants. For a managed profile, its manager grants. `ALLERGY_SAFETY_USE` permits server-side filtering but not display of raw allergy names.

#### `HouseholdActivityEvent` and independent consumer work

Event: `id`, `householdId`, `sequence bigint`, `eventType`, `aggregateType`, `aggregateId`, optional `actorMembershipId`, `actorKind`, `publicPayload jsonb`, `sensitivity` (`HOUSEHOLD|RESTRICTED|SECURITY`), `createdAt`.

Consumer work: `eventId`, `consumer` (`REALTIME_FANOUT|NOTIFICATION_PROJECTOR`), `status` (`PENDING|PROCESSING|DONE|DEAD`), `outcome` (`DELIVERED|NO_POLICY|DISABLED_BEFORE_CUTOVER|DEAD`), `policyVersion`, `attempts`, `nextAttemptAt`, `claimedAt`, `completedAt`, `lastErrorCode`; unique `(eventId,consumer)` and claim index `(consumer,status,nextAttemptAt)`. A small `HouseholdConsumerCheckpoint(householdId,consumer,lastScannedSequence,cutoverSequence,policyVersion)` supports gap/cutover audits but never substitutes for work-row idempotency.

The mutation transaction inserts the event and both independent work rows for every event. Realtime fan-out and notification projection claim/retry/dead-letter independently: a poison notification template cannot block realtime invalidation, and a Redis outage cannot discard notification work. Before H3, the running notification consumer marks each row `DONE/DISABLED_BEFORE_CUTOVER` with policy version/sequence; it does not leave backlog. H3 activation records an audited cutover sequence and only later events may produce intents. A no-policy event completes `DONE/NO_POLICY`, so checkpoint gaps never infer intentional absence and historical H1/H2 events never flood users. Each consumer is idempotent. The payload contains IDs, safe labels, status deltas, and versions only—never bearer tokens, raw allergies/health data, receipt OCR, attachment bytes, or free-form private notes. A filtered projection drives household activity history; security events are owner-only.

#### `IdempotencyRecord`

`id`, `principalId`, optional `householdId`, `operation`, `key`, `requestHash`, `state` (`PROCESSING|COMPLETED|FAILED_RETRYABLE|TOMBSTONE`), `httpStatus`, nullable `responseJson`, optional `resourceId`, `createdAt`, `responseExpiresAt`, `tombstoneExpiresAt`.

Constraints: unique `(principalId,operation,key)`. Reusing a key with another `requestHash` returns `409`; completed results are replayed. Store only bounded, redacted responses. The offline command queue expires at seven days; the full completed result remains at least 30 days, then compacts to a key/hash/resource/status tombstone until day 90 **[Assumption: validate storage and privacy]**. A retry during the tombstone window returns `409 IDEMPOTENCY_RESULT_EXPIRED` and never re-executes. After tombstone deletion, old clients still must not auto-replay: any command older than seven days is locally/server rejected and requires a fresh refetch plus a new explicit user action/key.

### 4.2 Shared pantry and shopping

#### `HouseholdPantryItem`

`id`, `householdId`, optional `ingredientId`, `name`, `normalizedKey`, quantity/unit, `version`, provenance, `updatedByMembershipId`, timestamps, optional `archivedAt`.

Constraint: unique `(householdId,normalizedKey)` for active rows. Normalization must be a versioned server function shared with list aggregation; database uniqueness resolves races.

#### `SharedShoppingList`

`id`, `householdId`, `listKey` (v1 only `default`), `name`, `status`, `version`, timestamps.

Constraint: unique `(householdId,listKey)`. Multiple arbitrary lists are deferred; the schema supports them without changing tenancy.

#### `HouseholdShoppingItem`

`id`, `householdId`, `listId`, `name`, optional `ingredientId`, `normalizedKey`, nullable `activeSemanticKey`, derived display quantity/unit, `status` (`NEEDED|CLAIMED|IN_CART|UNAVAILABLE|DECISION_PENDING|SUBSTITUTION_APPROVED|SKIP_APPROVED|BOUGHT|SKIPPED|REMOVED`), `createdByProfileId`, optional `assignedMembershipId`, alternative policy, optional note/max price/category/store, `version`, timestamps, optional `deletedAt`.

Constraint: unique `(listId,activeSemanticKey)`. `activeSemanticKey` is set for active lifecycle states and becomes null for terminal rows, so a later shopping cycle can request the item again. Insert uses a database upsert/unique-conflict path. The row is the semantic aggregate; requester/source/provenance lives in contributions below. Derived quantity is materialized only when active contributions use safely convertible units; otherwise the UI shows contribution lines instead of invented arithmetic. Status transitions and quantity edits compare `version`.

Canonical flow: `NEEDED → CLAIMED → IN_CART → BOUGHT`; an unavailable action is `NEEDED|CLAIMED|IN_CART → UNAVAILABLE`, then opening a request makes it `DECISION_PENDING`, and resolution makes it `SUBSTITUTION_APPROVED` (then the selected substitute is represented/claimed and may become `BOUGHT`) or `SKIP_APPROVED → SKIPPED`. `BOUGHT`, `SKIPPED`, and `REMOVED` are terminal for that cycle. There is no separate contradictory `DECISION_REQUIRED` status; an open `ShoppingDecisionRequest` and `DECISION_PENDING` are the single source of that state.

#### `ShoppingItemContribution`

`id`, `householdId`, `listId`, `itemId`, `kind` (`MANUAL|MEAL_SLOT|RECURRING|IMPORT`), deterministic `sourceKey`, optional `requestedByProfileId`, optional `sourcePlanVersionId`, optional `sourceSlotId`, quantity/unit, `status` (`ACTIVE|REMOVED|FULFILLED`), `version`, timestamps.

Constraints: unique `(listId,sourceKey)` and index `(itemId,status)`. A manual request uses a stable client-mutation-derived source key; a plan contribution uses the immutable plan version/slot/ingredient key. Adding the same ingredient from several people/meals converges on one semantic item while preserving every requester and reason. A plan diff removes/changes only contributions created by the affected plan source; it never deletes a manual or other-meal contribution. When no active contributions remain, the aggregate may become `REMOVED`; recomputation and event creation occur in the same transaction.

#### `ShoppingSession`

`id`, `householdId`, `listId`, `startedByMembershipId`, `status` (`ACTIVE|COMPLETED|CANCELLED`), nullable `activeKey` (`ACTIVE` while active), `version`, `startedAt`, `endedAt`.

Constraint: unique `(listId,activeKey)`. Presence is an expiring realtime hint, not location tracking and not a durable GPS trail.

#### `ShoppingDecisionRequest` and `ShoppingDecisionOption`

Request: `id`, `householdId`, `itemId`, `createdByMembershipId`, `type`, `status` (`OPEN|RESOLVED|EXPIRED|CANCELLED`), `question`, `version`, `expiresAt`, optional `resolvedByMembershipId`, `selectedOptionId`, timestamps.

Option: `id`, `requestId`, `label`, optional price/unit/brand, `sortOrder`. One authorized resolution wins via compare-and-swap; this is a decision workflow, not voting or chat.

#### `ShoppingAttachment`

`id`, `householdId`, `decisionOptionId`, `uploadedByMembershipId`, opaque `storageKey`, generated filename, detected MIME, byte size, SHA-256, `scanStatus`, timestamps, optional `deletedAt`.

Only image types required for alternatives are allowed. Download is always through an authorized handler or short-lived signed URL; original filenames are display metadata, not storage paths.

### 4.3 Meal board and deterministic shopping diff

#### `MealBoard`

`id`, `householdId`, `weekStart` (household-local date), `status` (`DRAFT|SUGGESTIONS|REVIEW|CONFIRMED|SHOPPING_GENERATED|COOKING|COMPLETED|ARCHIVED`), optional `currentVersionId`, `version`, timestamps.

Constraint: unique `(householdId,weekStart)`. Month views aggregate four or five weekly boards; there is no second monthly canonical model.

#### `MealPlanVersion` and `HouseholdMealSlot`

Version: `id`, `boardId`, `versionNumber`, optional `baseVersionId`, `createdByMembershipId`, `reason`, `createdAt`. It is immutable after creation.

Slot: `id`, `planVersionId`, `localDate`, `mealType`, optional `recipeId`, servings, one aggregate `guestCount`, `version`, notes, source/provenance. `guestCount` is bounded `0..20` **[Assumption: product validation]** and is never repeated per attendance row.

Constraints: unique `(boardId,versionNumber)` and `(planVersionId,localDate,mealType)`. This directly prevents duplicate slots in household plans. A confirmed change copies a small weekly snapshot, applies the typed patch, validates uniqueness, and atomically advances `MealBoard.currentVersionId/version` only when the expected prior version matches.

#### `MealProposal`, `MealReaction`, `MealAttendance`

Proposal: `id`, `householdId`, `boardId`, `baseVersionId`, `createdByProfileId`, typed `patchJson`, reason, status, `version`, timestamps. Patch schema is allowlisted; arbitrary JSON paths are rejected.

Only `OWNER|ADULT` with `PLAN_EDIT_DRAFT` may mutate a draft board directly. `MEMBER` has `PLAN_PROPOSE` and cannot directly mutate draft/canonical state; accepted proposals still require `OWNER|ADULT` confirmation.

Reaction: `proposalId`, `profileId`, reaction (`WANT|OK|NOT_THIS_WEEK`), timestamps; unique `(proposalId,profileId)`. Reactions inform a person’s decision and never auto-confirm.

Attendance: `planVersionId`, `slotId`, `profileId`, state (`EATING|ABSENT|UNKNOWN`), `managedByMembershipId`, timestamps; unique `(slotId,profileId)`. Serving totals are deterministic from `EATING` profile rows plus the slot-level guest count. Changing guest count uses the dedicated `PLAN_GUEST_COUNT_WRITE` capability, expected slot/board version, bounds, and the immutable-next-version workflow; managed-profile attendance cannot change guest count.

#### `PlanShoppingDiff`

`id`, `householdId`, `boardId`, `fromVersionId`, `toVersionId`, canonical `diffJson`, `diffHash`, `status` (`PENDING|APPLIED|PLAN_ONLY|DISMISSED`), `createdByMembershipId`, `appliedByMembershipId`, `version`, timestamps.

Constraint: unique `(fromVersionId,toVersionId,diffHash)`. Applying the diff is a separate idempotent command that adds/removes/changes `ShoppingItemContribution` rows and then deterministically recomputes affected semantic aggregates. It never deletes unrelated manual/meal contributions. No plan confirmation silently mutates the shopping list.

### 4.4 Secure external sharing

#### `PlanShare`, `PlanShareVersion`, `PlanShareScope`

Share: `id`, `householdId`, `createdByMembershipId`, `mode` (`VIEW|REVIEW`), `tokenDigest`, `tokenPrefix`, `digestKeyVersion`, `status`, `expiresAt`, `revokedAt`, optional reviewer display label, timestamps.

Version join: `(shareId,planVersionId)`; a monthly share references at most five immutable weekly versions.

Scope: `(shareId,scope)`, `grantedAt`, optional `revokedAt`; scopes are individually revocable. Baseline scope is `MEAL_NAMES`; ingredients, quantities, servings, nutrition summary, notes, preferences, and allergy disclosure are separate and default-off where sensitive.

Token format: `share_<public-id>.<32 random bytes base64url>`. The public ID performs a bounded lookup; the server compares `HMAC-SHA-256(server_pepper, secret)` in constant time. The fragment URL (`/shared-plan#token=...`) prevents the secret reaching access logs/referrers; on boot the SPA copies it to memory and immediately calls `history.replaceState` to scrub the fragment before rendering/network/analytics. It sends the memory-only value in an authorization header and never stores it in local/session storage.

#### `PlanComment` and `AdvisorProposal`

Comment: `id`, `shareId`, `planVersionId`, optional `slotId`, pseudonymous author label, body, status, timestamps.

Proposal: `id`, `shareId`, `baseVersionId`, typed `patchJson`, explanation, status (`OPEN|ACCEPTED|REJECTED|STALE|WITHDRAWN`), timestamps, optional `decidedByMembershipId`.

No foreign share endpoint accepts `MealBoard.currentVersionId` writes. Acceptance is a separate authenticated household command requiring `PLAN_CONFIRM`, current-base validation, a new immutable version, and an audit event.

### 4.5 Notifications

Keep the existing `Notification` row as a visible legacy/in-app inbox presentation so an old reader never displays muted/push-only intents. Add:

- `NotificationIntent`: canonical per-recipient intent with `householdId`, `sourceEventId`, `recipientUserId`, `eventType`, safe template variables, deep-link/action metadata, `dedupeKey`, sensitivity, expiry, and timestamps; unique `(recipientUserId,sourceEventId,eventType)`. It persists even if in-app is muted.
- `NotificationPreference`: one server-authoritative row per user with timezone, quiet minutes, lock-screen detail (`GENERIC` default), digest mode, schema version, and a validated JSON event/channel map.
- `NotificationDelivery`: one row per intent/channel (`IN_APP|PUSH`) with status including `AVAILABLE|PENDING|DEFERRED|SUPPRESSED_PREFERENCE|SENT|FAILED|CANCELLED`, attempts, next attempt, provider message ID, and bounded error code; unique `(intentId,channel)`. If `IN_APP=AVAILABLE`, projection creates one visible `Notification` linked by unique nullable `intentId`; if muted, it creates no inbox row. A push-only preference therefore cannot leak into legacy readers.

`HouseholdActivityEvent` is the semantic source event; a separate `NotificationEvent` table would duplicate it and is rejected for v1. See `04_notification_adr.md`.

## 5. Transaction patterns

### 5.1 Mutating a collaborative item

Within one PostgreSQL transaction:

1. create/claim `IdempotencyRecord`;
2. lock rows in the global order household → caller membership → resource; the active membership row is held with a conflicting lock against removal and its `status/version/expiry` is checked inside this same transaction;
3. capability and resource-state check;
4. `UPDATE ... WHERE id=? AND householdId=? AND version=?`, incrementing version;
5. atomically increment `Household.nextEventSequence`, create `HouseholdActivityEvent`, and create independent consumer-work rows;
6. store the redacted result in `IdempotencyRecord`;
7. commit; realtime and notification consumers proceed independently.

Zero updated rows at step 4 means stale version or inaccessible resource; re-query within the tenant boundary and return a non-enumerating `404` or a `409` conflict as appropriate.

### 5.2 Owner transfer

Lock the household row, require fresh authentication, verify the caller is current owner, verify the target has active non-guest membership, update `ownerUserId`, emit a security activity event, and commit. The former owner remains `ADULT` unless they explicitly leave afterward. Owner leave/account deletion is rejected until transfer or explicit household deletion completes.

### 5.3 Member removal

Lock rows in the same order as ordinary mutations (household, then target membership) using a lock that conflicts with the mutation’s membership lock; forbid owner removal; change membership with an expected membership version; cancel guest/session assignments and pending push deliveries; revoke member-created external shares if policy requires or transfer ownership explicitly; emit `MEMBER_REMOVED`; invalidate membership cache; close matching realtime connections. If a mutation locked first, it may commit before removal and is ordered before `MEMBER_REMOVED`; once removal commits, no later mutation can pass. Existing contributed household content remains household-owned, with actor attribution pseudonymized if later erased.

## 6. Lifecycle, deletion, and retention

- Archive is reversible and blocks new mutations except restore/delete. It is not deletion.
- Household deletion is an owner-confirmed asynchronous job with a cooling-off window **[Assumption: duration requires product/legal decision]**. It revokes invites/shares immediately, disconnects realtime, then deletes household-owned rows and storage objects in dependency order.
- Leaving/removal removes access, not shared household content. Private user-owned records remain with the user and grants are revoked.
- Activity, notifications, delivery logs, idempotency rows, and share access metadata require bounded retention. Proposed operational defaults appear in `docs/security/household-v1/privacy_scope_matrix.csv`; they are not legal conclusions and need Dutch/EU counsel/DPO approval before production.
- Security audit rows must be redacted and access-restricted. Do not copy full request/response bodies or tokens.

## 7. Explicitly rejected/deferred architecture

- **CRDT: rejected for v1.** The state is typed, server-authoritative, and low-cardinality. A CRDT cannot decide whether `BOUGHT` or `UNAVAILABLE` wins, who may confirm a plan, or whether a stale advisor proposal is safe. Compare-and-swap plus explicit conflict UX is smaller and auditable.
- **Generic household chat: rejected.** Notes/comments remain attached to item, decision, meal proposal, or share review.
- **Advisor membership: rejected.** It would expose a broader tenant surface than the use case requires.
- **Arbitrary capability overrides: deferred.** The v1 matrix plus resource predicates is easier to test exhaustively.
- **Multiple shopping lists in UI: deferred.** The key exists in the model, but v1 creates only `default`.
- **Always-on location/presence history: forbidden.** Shopping presence is explicit, coarse, expiring, and contains no GPS.
- **Automatic purchase/payment and autonomous plan confirmation: forbidden.**

## 8. Acceptance evidence required before implementation PASS

1. Permission matrix tests generate one allow/deny case for every row in `02_permission_matrix.csv`.
2. Direct IDOR tests prove cross-household reads/mutations return no data.
3. Concurrent tests prove unique active item, active session, owner transfer, and meal slot/version invariants.
4. Invite tests cover mandatory target CHECK/API rejection, versioned target-HMAC match/rotation, raw-address absence, expiry, revocation, single use, replay, and simultaneous accept.
5. Share tests cover entropy/digest-at-rest, fragment transport, scope projection/reduction, revocation, stale proposal, and canonical-write denial.
6. Account A logout to Account B clears query, IndexedDB, PWA API caches, and live connections before any household screen renders.
7. Migration rehearsal and rollback evidence satisfy `05_migration_plan.md`.

## 9. References

- Realtime/offline and delivery semantics: `docs/architecture/household-v1/03_realtime_offline_adr.md`.
- Notification architecture: `docs/architecture/household-v1/04_notification_adr.md`.
- Migration sequencing: `docs/architecture/household-v1/05_migration_plan.md`.
- Threats and controls: `docs/architecture/household-v1/06_threat_model.md` and `docs/security/household-v1/security_review.md`.
- Privacy defaults: `docs/security/household-v1/privacy_scope_matrix.csv`.
