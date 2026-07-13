# Garnish Household v1 security and privacy review

Review verdict: **DESIGN_COMPLETE / IMPLEMENTATION_BLOCKED_BY_PREREQUISITE**
Implementation authorization: **BLOCKED by prerequisite and unimplemented controls**
Base reviewed: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`

## Executive reality check

**[Certain]** The proposed household design can be implemented safely, but the current repository cannot truthfully pass household security. There is no household tenant/capability layer yet, private API responses are cached by the PWA in a shared cache, notification preferences are client-only, and long-lived event authorization does not exist.

**[Risk]** The two most immediate blockers are cross-account browser cache isolation and tenant-scoped authorization. A third high residual risk is the localStorage bearer JWT: any successful XSS can exfiltrate access to every household the account can reach.

This review approves the architecture direction only if the gates below are implemented and tested. It does not approve Stage B, production migration, push, external share, child-directed use, or medical/nutrition claims.

## Current-repo findings

| ID | Finding and evidence | Severity | Verdict / required action |
|---|---|---:|---|
| SR-01 | PWA runtime caching uses one `api-cache`, `NetworkFirst`, max age one day for `/api/` (`apps/web/vite.config.js:34-39`) | CRITICAL | Block household work/launch until private routes are `no-store` and Account A→B purge is proven offline |
| SR-02 | JWT is stored/read in localStorage (`apps/web/src/context/AuthContext.jsx:14`; `apps/web/src/lib/apiClient.js:11-18`) | HIGH | Approve a session hardening plan; preferred HttpOnly Secure SameSite session/refresh token with short access lifetime; at minimum strict CSP, revocation, no share token storage, and XSS gates |
| SR-03 | Logout clears client keys only (`apps/web/src/context/AuthContext.jsx:154-159`); JWT strategy does support a user-wide epoch (`apps/server/src/auth/jwt.strategy.ts:21-35`) | HIGH | Add server session/logout semantics and close long-lived streams; test copied token after logout |
| SR-04 | Current domain is user-owned with no household membership/capability tables (`apps/server/prisma/schema.prisma:361-426`, `:754-767`) | CRITICAL | Implement additive household model and generated permission/IDOR tests before any shared read/write |
| SR-05 | Current `MealSlot` lacks slot uniqueness and `ShoppingItem` lacks version/race-safe semantic uniqueness (`apps/server/prisma/schema.prisma:374-414`) | HIGH | Preflight duplicates, add DB constraints/CAS, and race-test; transactions alone are insufficient |
| SR-06 | Notification settings are localStorage-only (`apps/web/src/app/settings/useSettings.js:12-22`, `:103-109`) | HIGH | Server preference model/API must be the sender’s source of truth before H3 |
| SR-07 | Existing notification dedupe partly uses an in-process map; quiet hours are hardcoded and INE ledger is in memory (`apps/server/src/notifications/notification-scheduler.service.ts:20`, `:94-101`; `apps/server/src/notifications/ine/ine.service.ts:5-8`, `:74`) | HIGH | Durable dedupe/delivery/preference enforcement; no replica-local suppression authority |
| SR-08 | No SSE/WebSocket stack exists; current CORS headers allow only `Content-Type, Authorization` (`apps/server/src/main.ts:47-56`) | HIGH | Implement authenticated fetch-stream SSE; add narrowly required `Idempotency-Key`/`Last-Event-ID` headers; no token in URL |
| SR-09 | Current avatar upload validates type/signature/size but is served from static `/uploads` (`apps/server/src/users/upload.controller.ts:13-70`; `apps/server/src/main.ts:28-38`) | HIGH for household photos | Do not reuse public-static delivery; quarantine/scan/private authorized download with short signed URLs |
| SR-10 | Deployment replica, proxy buffering, CDN, object storage, and regional data topology are not documented in the reviewed repo | HIGH/UNKNOWN | Deployment evidence and threat re-review required before realtime/share/push production claims |
| SR-11 | Retention/lawful basis/managed-child age/guardian policy is undecided | HIGH/UNKNOWN | Human privacy/legal decision gate; technical defaults are provisional, not legal advice |

## Approved security architecture

### Tenant enforcement

Use explicit routes such as `/households/:householdId/...`. A controller never trusts body actor/household IDs. A household repository exposes scoped methods only, for example:

```text
getItemForCapability({ householdId, itemId, principalUserId, capability })
updateItemCAS({ householdId, itemId, expectedVersion, ... })
```

The database query joins or filters active membership and household. A global `findUnique({id})` followed by a later tenant check is prohibited for household resources because omissions become IDORs. Cross-tenant/inactive paths return a generic `404`; permission failures within an already-visible resource may return `403` only when that does not enumerate data.

The capability resolver follows `docs/architecture/household-v1/02_permission_matrix.csv`. Role is never checked directly in controllers. Owner, membership status/expiry, manager relationship, guest assignment, resource state, share mode/version/scope, and privacy grant all narrow access.

Authorization and mutation share one transaction. Locks use the fixed order household → caller membership → resource; removal uses the same household → target membership order and an expected membership version. The mutation holds a membership lock that conflicts with removal until commit. Therefore a mutation is ordered before `MEMBER_REMOVED` or observes inactive membership—never after a completed removal.

### Authentication and sessions

- Current JWT expiry/epoch checks are useful but do not solve browser theft or per-session logout.
- Preferred direction: HttpOnly `Secure`, `SameSite=Lax/Strict` session or refresh cookie; short-lived access token held in memory; rotation/reuse detection; CSRF/Origin/Fetch-Metadata protection for cookie-auth mutations.
- If bearer localStorage temporarily remains, household Hard PASS requires a documented exception with strict CSP, no unsafe HTML/eval, dependency review, short token lifetime, server logout/revocation, and red-team XSS tests. It remains worse than HttpOnly storage.
- Member removal does not invalidate an account across other households; it invalidates membership/cache/streams and rejects all later requests/replay for that tenant.
- Admin role/JWT claims cannot substitute for household membership unless a separately audited support-access workflow exists. No such workflow is approved in v1.

### Invite token protocol

Format: `inv_<publicInviteId>.<base64url(32 cryptographically random bytes)>`.

Issuance:

1. require `MEMBER_INVITE`, rate/quota checks, allowed intended role, and active household;
2. generate secret with the platform cryptographic RNG, never UUID/Math.random;
3. store `HMAC-SHA-256(INVITE_TOKEN_PEPPER_vN, secret)`, public ID, small non-secret prefix, and digest key version; never store plaintext;
4. require expiry (proposed maximum seven days **[Assumption: product/security approval]**), single-use, revocation, and rotation on resend;
5. require a bound target: `targetUserId` or `HMAC-SHA-256(INVITE_TARGET_PEPPER_vN, canonical email/phone)` plus independent key version; a DB CHECK and API validation reject no-target invites. Plain hashes are forbidden because addresses are enumerable. Acceptance compares the authenticated account against current/previous target-pepper versions in constant time. Raw delivery address is transient or encrypted only when the delivery provider requires it and never logged/emitted/notified;
6. return the complete bearer once; keep it in a URL fragment so it is not sent in HTTP request/referrer; at first boot copy it to memory and immediately call `history.replaceState` to remove the fragment before render/network/analytics, then POST for preview/accept;
7. set `Referrer-Policy: no-referrer`, exclude route from analytics/service-worker caches, and redact secret patterns from logs/errors.

Acceptance requires an authenticated non-guest account. The transaction matches public ID and digest in constant time, validates target/status/expiry, conditionally consumes once, and activates the unique membership row. Simultaneous accepts produce one success. Errors are generic and timing-normalized enough to resist practical enumeration.

Pepper rotation supports current + one previous key version for already-issued live tokens; new issues use current. A compromise response revokes all tokens under the affected version.

### External plan share protocol

Format: `share_<publicShareId>.<base64url(32 cryptographically random bytes)>`, with an independently versioned share pepper and the same digest/no-plaintext principles.

Controls:

- required mode (`VIEW|REVIEW`), selected immutable plan versions, scopes, expiry, creator, status;
- external scopes start at minimum data; allergy/preferences/notes/nutrition detail are default-off and individually revocable;
- complete secret in URL fragment; bootstrap copies it to memory and immediately scrubs it with `history.replaceState` before render/network/analytics; authorization header to API; never query/path/localStorage;
- every response checks current share status/expiry/scopes from PostgreSQL; Redis/CDN cache cannot grant access;
- `Cache-Control: no-store, private`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow, noarchive`, restrictive CSP and `frame-ancestors 'none'`;
- no third-party analytics/session replay on share routes;
- comments/proposals are contextual, rate/size limited, escaped as data, and reference only selected version/slot;
- share bearer cannot access canonical member endpoints. Accepting a proposal is a separate member-authenticated `PLAN_CONFIRM` command with expected current version and audit.

Revocation/scope reduction blocks the next request immediately and invalidates app caches/streams. It cannot retract a screenshot or export already made; the UI must not imply recall.

### Realtime and offline

Use the design in `docs/architecture/household-v1/03_realtime_offline_adr.md`: HTTP commands, fetch-stream SSE with bearer header, PostgreSQL ordered activity plus independent per-consumer work/checkpoints, Redis fan-out only, sequence catch-up, CAS, idempotency, and account/household IndexedDB partitioning.

Security-specific requirements:

- exact CORS Origin allowlist and TLS; no token/query stream URL;
- active membership at connect, replay, periodic revalidation, and immediate removal invalidation;
- minimal event payloads and tenant assertion immediately before emit;
- connection/replay/payload/backpressure/rate caps;
- Redis subscriber reloads event from PostgreSQL and does not trust a published payload;
- realtime and notification consumers claim independent work; poison/dead notification projection cannot block realtime invalidation and remains durably retryable/dead-letter visible;
- offline queue stores no JWT/invite/share/sensitive personal data;
- privacy/member/owner/share/plan-confirm/upload commands remain online-only;
- purge barrier completes before another account/household UI renders.

Offline commands expire after seven days. Full idempotency results remain at least 30 days and compact to non-executable tombstones through day 90. During the tombstone window retries return `IDEMPOTENCY_RESULT_EXPIRED`; after deletion, an old client still cannot auto-replay and must refetch plus obtain a new explicit action/key.

One semantic shopping item may have many `ShoppingItemContribution` rows. Requester and immutable meal/manual/import source keys are preserved. Plan diffs mutate only their plan-owned contributions and must prove that manual and other-meal contributions survive. The state machine is exactly `NEEDED→CLAIMED→IN_CART→BOUGHT` or `UNAVAILABLE→DECISION_PENDING→SUBSTITUTION_APPROVED` / `SKIP_APPROVED→SKIPPED`; there is no conflicting second decision-required state.

### Notifications

Follow `docs/architecture/household-v1/04_notification_adr.md`. Server preference is authoritative; push defaults off. Separate `NotificationIntent` is canonical, and deterministic `IN_APP`/`PUSH` intent-delivery rows represent in-app-only, push-only, both-enabled, and both-muted preferences. The legacy `Notification` table receives only visible `IN_APP=AVAILABLE` presentations, so old readers cannot display muted/push-only intents on rollback. Before H3, notification consumer work is actively completed as versioned disabled no-op; H3 audits a cutover sequence and never sends H1/H2 history. Default lock-screen content is generic. Recipient lists come from current membership/resource relationships. Actor is excluded unless policy documents benefit. Every deep-link action reauthorizes the domain command.

Push activation is a separate human/security/privacy gate. PWA installation is not readiness.

### Attachments

Alternative photos are private household data. Minimum pipeline:

1. authenticated/capability-checked upload bound to an open decision;
2. strict business allowlist (prefer JPEG/PNG/WebP; GIF should be rejected unless motion is required), size and decoded pixel limits;
3. generated storage key/name, signature + actual decode, re-encode to remove active metadata/profiles where practical;
4. EXIF/GPS removal before availability;
5. quarantine and malware scanning; `PENDING` files are not downloadable;
6. object storage outside webroot with private ACL; authorized handler or very short signed URL;
7. safe response headers (`nosniff`, safe content disposition, restrictive CSP where relevant);
8. upload/download quotas and deletion linked to item/decision/household deletion;
9. no attachment URL/body in push or broad activity event.

OWASP recommends defense in depth including type/signature validation, generated names, size limits, authorized access, storage outside webroot, and scanning ([OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)).

### Privacy and managed profiles

- Raw user allergies, health goals, private notes, nutrition history, and personal profile remain user-owned.
- Household member display profile contains only coordination identity.
- Server-side `ALLERGY_SAFETY_USE` can filter meals without disclosing the allergy label; display is a separate scope.
- Owner does not bypass another adult’s private data.
- A managed profile has no login, invite, messaging, public page, advisor access, or independent consent. One manager controls it; owner-only emergency manager transfer is audited and does not reveal raw data.
- Do not market managed profiles as child accounts until age/guardian/legal requirements are defined and verified.
- Full field/principal defaults are in `docs/security/household-v1/privacy_scope_matrix.csv`.

### Logs, analytics, export, erasure, retention

Logs/events contain allowlisted IDs/status/version/error codes, never bearer secrets, authorization headers, raw request bodies, private notes, allergies/health data, receipt OCR, attachment URLs, or notification bodies. Add automatic token/PII canary tests and access controls for owner/security audit views.

Household activation metrics require the existing purpose-scoped consent policy where applicable. Do not add optional analytics against default-off consent. External share routes have analytics off.

Export/erasure distinguishes:

- user-owned private data: export/delete for the subject;
- household-owned collaborative content: remains with household after a member leaves, with approved pseudonymized attribution;
- bearer secrets: never export plaintext;
- audit/security proof: redacted, access-restricted, retained only under approved policy;
- backups: documented expiry and restore deletion procedure.

The proposed retention values in the privacy matrix are operational hypotheses and require Dutch/EU privacy review before production.

## Required security headers/cache policy

Authenticated/private/share/event endpoints:

```text
Cache-Control: no-store, private
Pragma: no-cache
Vary: Authorization, Origin
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
Content-Security-Policy: route-appropriate strict policy
```

External share additionally uses `X-Robots-Tag: noindex, nofollow, noarchive` and `frame-ancestors 'none'`. Do not rely on headers alone; remove private API runtime caching from the service worker and clear old cache versions during upgrade/logout.

## Verification plan

Tests must use real local PostgreSQL and critical two-browser/network scenarios—not mocks only.

### P0 release-blocking

1. Account A→logout→Account B online/offline with Cache Storage, query cache, IndexedDB, local/session storage, SSE, and notification inspection.
2. Complete permission/IDOR matrix for Account A/B same household, Account C outsider, removed member, expired guest, managed profile, view/review share.
3. Invite/share entropy, digest-at-rest, fragment/no-referrer/no-log, mandatory invite target CHECK/API rejection, versioned target-HMAC rotation/match, raw-address absence, reuse/expiry/revoke/simultaneous race, and proof that bootstrap immediately removes the fragment with `history.replaceState` before other render/network/analytics.
4. Advisor direct canonical write denial and stale proposal acceptance conflict.
5. Raw sensitive field serialized-response scan for every principal/scope combination.
6. Owner transfer/leave/delete and membership removal during HTTP/stream/offline/upload.
7. Semantic item/contribution, multi-meal/manual provenance, safe plan-diff removal, canonical bought/unavailable/decision state, plan version/slot/diff concurrency.
8. Member-removal-versus-mutation real database race in both orderings; no mutation commit after removal.
9. Seven-day command expiry, 30-day idempotent result, 90-day tombstone, and lost-ack retry behavior.
10. Household deletion/erasure reconciliation across DB/object/cache/share/push.

### P1 before feature enablement

1. Notification preference/quiet/dedupe/flood/action/lock-copy and push-denied behavior.
2. Redis outage/realtime-publisher crash/duplicate/reconnect/sequence gap plus notification poison proving independent realtime progress and durable notification retry/dead-letter.
3. Upload spoof/polyglot/oversize/decompression/EXIF/malware/private URL tests.
4. SSE origin, token leakage, slow client, connection/reconnect storm, session expiry.
5. CSP/XSS sinks and copied-token logout/revocation.
6. Noindex/frame/referrer/third-party network inventory for external share.

## Gate-critical open risks and owner decisions

| Priority | Risk / decision | Owner | Pass evidence |
|---|---|---|---|
| P0 | Private PWA/API/account cache isolation | Frontend + Security | real A/B offline browser test and cache inventory |
| P0 | Household repository/capability layer absent | Backend + Security | matrix/IDOR suite green with real DB |
| P0 | Invite/share/session/token design not implemented | Backend + Security | protocol tests + DB/log/browser secret scan |
| P0 | Concurrency constraints absent | Data + Backend | duplicate preflight, constraints, two-connection races |
| P0 | Advisor/sensitive scope isolation absent | Backend + Privacy | canonical denial + field projection suite |
| P1 | LocalStorage JWT residual XSS blast radius | Founder + Security | approved session-hardening decision and tests; exception explicitly time-bounded if not migrated |
| P1 | Attachment storage/scanner topology unknown | Platform + Security | private object/scanner/deletion evidence |
| P1 | Push/provider/device privacy not ready | Notifications + Privacy | full readiness gate; feature flag remains off otherwise |
| P1 | Deployment/proxy/replica topology unknown | Platform | documented topology + SSE/cache/load validation |
| Human gate | Retention, lawful basis, child/guardian policy | Founder + privacy/legal counsel | written approved policy mapped to matrix/jobs/copy |

## Final security verdict

**[Certain] CHANGES_REQUIRED.** The architecture is bounded and avoids CRDT/overbroad advisor membership, but no household security control is implemented on this base. Exact next action: pass the private cache/account isolation prerequisite, then implement H1 tenant/capability/invite foundations behind a default-off flag and run the complete real-DB permission/IDOR/concurrency suite before any H2–H5 data is exposed.
