# Garnish Household v1 threat model

Status: Stage A design; controls are requirements, not evidence of implementation.
Method: asset/trust-boundary review plus STRIDE-style abuse cases. Severity is product-specific (`CRITICAL|HIGH|MEDIUM|LOW`), not a formal CVSS score.

## Reality check

- **[Confirmed]** Household resources, memberships, invite/share tokens, realtime subscriptions, and household capabilities do not exist on base `1631dc5d`; therefore none of their controls can currently be marked PASS.
- **[Confirmed]** Current API JWTs are bearer tokens read from localStorage (`apps/web/src/context/AuthContext.jsx:14`, `apps/web/src/lib/apiClient.js:11-18`). JWT validation checks expiry, ban, and a user-wide session epoch (`apps/server/src/auth/jwt.strategy.ts:13-35`).
- **[Confirmed]** Client logout removes local keys but does not call a server logout/revocation endpoint (`apps/web/src/context/AuthContext.jsx:154-159`).
- **[Confirmed]** PWA runtime caching currently applies `NetworkFirst` to `/api/` responses in one cache named `api-cache` for up to one day (`apps/web/vite.config.js:34-39`). This is a direct cross-account/private-cache risk.
- **[Confirmed]** Current avatar upload has MIME allowlisting, a 5 MB cap, magic-byte checks, generated filenames, `nosniff`, and CSP (`apps/server/src/users/upload.controller.ts:13-70`, `apps/server/src/main.ts:28-38`). It still serves files from a static path; household decision attachments must not inherit public-static access and need malware/quarantine controls.
- **[Confirmed]** Redis Pub/Sub is not durable; the household event log must remain authoritative. Redis documents Pub/Sub as at-most-once ([official Redis documentation](https://redis.io/docs/latest/develop/pubsub/)).
- **[Gate-critical]** No household implementation may start/ship while private API cache isolation and Account A→logout→Account B purge are unproven.

## Assets

1. Household membership, roles, capability decisions, and owner lifecycle.
2. Shopping list/session/decision state and alternative photos.
3. Meal plans, attendance, servings, notes, proposals, and history.
4. User-owned allergies, health-adjacent preferences, nutrition history, and private notes.
5. Managed-profile/child identity and constraints.
6. Invite/share bearer secrets, authentication JWTs, push subscriptions, storage URLs.
7. Household activity/security audit and notification content.
8. Correct ordering, idempotency results, immutable plan versions, and deletion/retention state.

## Trust boundaries and flows

1. **Browser/PWA ↔ Nest HTTP API:** untrusted client input, bearer auth, CORS/origin, rate limits, response caching.
2. **Long-lived event stream ↔ API process:** persistent resource use, membership revocation, reconnect/replay, origin and payload projection.
3. **API/worker ↔ PostgreSQL:** tenant-scoped queries, transactions, constraints, outbox, retention/deletion.
4. **API processes ↔ Redis:** cache/fan-out only; messages and cache keys are untrusted accelerators, never authorization truth.
5. **API ↔ object storage/scanner:** quarantine, content validation, authorized download, deletion.
6. **API/worker ↔ push provider/browser service worker:** external metadata exposure, device binding, retry, lock-screen content.
7. **Unauthenticated share browser ↔ share endpoints:** bearer-secret access with narrow immutable plan/scope projection.

Threat agents: outsider guessing/enumerating IDs/tokens; invited but malicious member; removed member with stale device; compromised browser/XSS; stolen invite/share link; abusive external reviewer; malicious upload; accidental member/privacy mistake; buggy/retried client; compromised/misconfigured worker/cache/provider; operator with excess log/database access.

## Threat register

| ID | Threat / abuse path | Severity | Required preventive controls | Detection and required test | Residual risk after controls |
|---|---|---:|---|---|---|
| TM-01 | IDOR reads/writes a resource in another household by global UUID | CRITICAL | Every repository query includes `householdId` plus active membership/share scope; capability checked on each mutation; non-enumerating 404; no fetch-then-check | Account C direct API matrix for every resource/action; log denied tenant mismatch without target data | application query regression; generated repository guard/test coverage required |
| TM-02 | Forged `householdId`, `membershipId`, actor, requester, or profile in request body | CRITICAL | Derive principal/membership from auth; derive household from route + scoped DB row; DTO whitelist; actor fields server-set | Mass-assignment tests with forged IDs and extra fields | future DTO bypass |
| TM-03 | Role/capability escalation or arbitrary capability override | CRITICAL | Version-controlled baseline matrix; owner computed from household; no client-supplied capabilities; resource predicates; owner-only role changes with CAS/audit | Permission matrix generated tests; modify-role race; owner-to-owner forgery | matrix bugs; independent adversarial review |
| TM-04 | Removed/left/expired member retains HTTP, stream, offline, attachment, or notification access; mutation/removal TOCTOU | CRITICAL | Membership checked on every request/replay/reconnect; mutation locks household→membership→resource inside its transaction; removal uses same order/conflicting membership lock/version; removal invalidates cache, closes streams, cancels deliveries/signed URLs | Real DB race in both orderings proves mutation commits before removal event or sees inactive membership; then two-tab/session/offline immediate 404/purge | sub-second stream close delay; no post-removal commit permitted |
| TM-05 | Owner leaves, is deleted, or two transfers race, orphaning/duplicating owner | CRITICAL | Non-null owner FK `RESTRICT`; household row transaction lock; fresh auth; active non-guest target; deletion flow requires transfer/delete | simultaneous transfer/leave/delete tests; invariant query exactly one owner | operator/manual DB mutation; restrict DB privileges |
| TM-06 | One-time invite is accepted twice/replayed or API mints a transferable no-target invite | HIGH | 256-bit secret digest; DB/API require target user or versioned HMAC address binding; authenticated target match; conditional atomic consume; membership unique | no-target mint negative test; target-HMAC rotation/mismatch; parallel acceptance/replay | thief also needs control of bound account; account compromise remains |
| TM-07 | Invite link stolen from logs, referrer, screenshot, clipboard, email forwarding, browser/history storage | HIGH | mandatory target binding; fragment copied to memory then immediately `history.replaceState` before render/network/analytics; no-referrer/CSP; redaction; short expiry/revoke; resend rotates | prove fragment scrub timing; scan logs/history/storage; stolen link with non-target account denied | target account compromise or intentional same-target device sharing |
| TM-08 | Expired/revoked/declined invite accepted via clock/race | HIGH | server UTC time; atomic status/expiry predicate; revoke and accept serialize; no client clock authority | boundary and concurrent revoke/accept tests | clock infrastructure error; monitor skew |
| TM-09 | Invite target/user enumeration or unsolicited invite flood | MEDIUM | generic preview/accept errors; rate limit creator/target/IP; normalized target digest; quotas; no full member disclosure | enumeration timing/content test; flood limits and alerts | targeted annoyance; block/report tooling may be needed |
| TM-10 | External share token guessed/brute-forced | CRITICAL | 256-bit random secret; public ID plus HMAC-SHA-256 digest; constant-time compare; rate limit; generic 404; required expiry | entropy/property test, DB plaintext scan, brute-force/rate test | endpoint DoS, not practical token guess |
| TM-11 | Share secret leaks via URL/query/access log/referrer/history/analytics/cache/screenshot | CRITICAL | URL fragment; copy to memory and immediately scrub with `history.replaceState` before render/network/analytics; never query/path/storage; no-referrer; analytics off; no service-worker cache; redact; revoke | browser history/network/log/cache/analytics inspection and scrub-order test; copied link revoke | intended bearer sharing remains possible; scope/expiry minimize impact |
| TM-12 | Revoked/expired share or reduced scope remains readable from CDN/PWA/Redis/browser cache | CRITICAL | `no-store, private`; no CDN/service-worker caching; live DB status/scope check every request; cache invalidation is accelerator only | read before/after revoke/scope reduction on two clients and cache failure | already viewed/screenshot data cannot be recalled |
| TM-13 | Advisor/reviewer directly edits canonical plan or submits proposal against stale/other version | CRITICAL | share endpoint exposes comment/typed proposal only; immutable selected base; separate member `PLAN_CONFIRM`; current-base CAS; patch allowlist | direct canonical endpoints with share token; stale/cross-share proposal; accept race | authorized adult may accept poor advice; product accountability remains |
| TM-14 | Sensitive allergy/health/private/nutrition data disclosed to members/advisor | CRITICAL | keep raw data user-owned; separate default-off scope grants; safety-use scope returns outcome not raw value; response projection allowlist | privacy matrix tests for every principal; serialized-response forbidden-field scan | inference from meal choices may remain; minimize explanations |
| TM-15 | Owner assumes ownership grants raw access to another adult’s private fields | HIGH | owner role grants no private-profile read; subject/managed-profile-manager check; audited break-glass not in v1 | owner direct API tests; UI must not render controls | social/offline disclosure outside product |
| TM-16 | Managed/child profile gets login/social capability or is exposed to advisor/guest | CRITICAL | no credentials/membership for managed profile; one manager; raw scopes default-off; no public profile; age/legal policy gate | attempt invite/login/token/profile enumeration; share projection tests | guardian may enter excessive data; copy/data-minimization UX needed |
| TM-17 | Notification lock-screen reveals item, allergy, household, child, or advisor details | HIGH | generic copy default; sensitive variables forbidden; context detail opt-in cannot include sensitive scopes; template allowlist | snapshot/golden content scan across event catalog and locales | OS may show app identity/time; disclose in settings |
| TM-18 | Notification flood/spam loop from repeated events, retries, scheduler restart, or malicious member | HIGH | unique recipient/source/type; grouping/caps/cooldown; durable delivery attempts; actor exclusion; per-actor event rate limit | duplicate event/worker/restart/flood tests; spam metrics/alerts | necessary decision traffic can still be noisy; tune from evidence |
| TM-19 | Notification/deep-link action bypasses permission or executes twice/after expiry | CRITICAL | notification is not authority; normal capability/state/CAS endpoint; idempotency key; internal allowlisted links | double tap, replay, removed member, stale decision, forged URL/IDOR | authorized concurrent decisions yield visible conflict |
| TM-20 | Account B receives Account A data via PWA API cache, React Query, IndexedDB, local/session storage, or live connection | CRITICAL | remove private API runtime cache or partition safely; `no-store`; logout purge barrier; account+household cache keys; stop streams before render | Account A→logout→B with offline/network failure; Cache Storage/IndexedDB/query inspection | browser crash during purge; fail closed to login and purge on next boot |
| TM-21 | XSS steals localStorage JWT and gains all household memberships | CRITICAL | preferred migration to HttpOnly Secure SameSite session/refresh; strict CSP/no unsafe HTML; dependency hygiene; short access token/session revocation; never store share token | XSS sinks/security headers/dependency scan; stolen-token revocation test | current localStorage bearer remains a high residual risk until auth design changes |
| TM-22 | Logout token remains usable server-side or a long-lived stream outlives session | HIGH | server logout/session revocation; stream periodically validates expiry/epoch/session; close on logout mapping; short-lived access | copy token then logout/reuse; stream logout/expiry test | user-wide epoch revocation may log out all devices; session model choice needed |
| TM-23 | Offline device shows or replays stale household state after removal/account switch | CRITICAL | account/household-partitioned IndexedDB; no tokens; replay reauth; purge on removal/logout; max age; high-risk commands online-only | removed offline shopper reconnect; switch accounts while offline; stale plan replay | device owner may inspect data already cached before revocation; minimize/cache encrypt only if threat model supports keys |
| TM-24 | Cross-household SSE/WebSocket subscription or event payload leak | CRITICAL | route-scoped active membership; bearer header not URL; exact origin; per-event household filter; filtered payload; periodic reauth; no wildcard Redis subscription delivery | connect/catch-up with another household; forged `after`; removal during stream | process bug could misroute; use typed channel and assertion before emit |
| TM-25 | Replayed command or reused idempotency key changes state again or binds another payload | HIGH | principal+operation+key unique; request hash; same key/different hash 409; offline max 7d; full result >=30d; non-executable tombstone through day 90; older queue auto-replay rejected | lost ack/network retry; same key other body/user; 7/30/90-day boundary; old command after removal | after tombstone deletion UUID collision is negligible; client must refetch/new explicit action, never resurrect old queue |
| TM-26 | Duplicate/lost update, source collapse, unsafe plan-diff removal, contradictory item state, meal-slot race, or per-attendee guest double count corrupts coordination | HIGH | semantic item plus unique contributions; plan-source-only diff; entity CAS; canonical item outcomes; immutable versions; one bounded slot-level guestCount with dedicated capability/version and none on attendance | concurrent multi-source add/removal; item decision/slot/confirm; guest count race/bounds and managed attendance cannot alter it on real PostgreSQL | explicit user conflict remains and needs UX |
| TM-27 | Redis loss/duplicate or one poison consumer blocks another, creating missing UI/notification | HIGH | event log authoritative; transaction writes independent realtime/notification work; per-consumer idempotency/checkpoint/dead letter; Redis accelerator; DB catch-up | crash before/after publish; Redis outage; poison notification while realtime passes; checkpoint gap recovery | temporary latency; dead notification requires operator remediation |
| TM-28 | Outbox poison event retries forever or leaks payload in logs/dead letter | MEDIUM | bounded typed event; attempts/backoff/dead letter; error code only; payload redaction; alert oldest age | malformed event/retry/dead-letter/log scan | manual remediation access needs controls |
| TM-29 | Attachment malware, parser exploit, MIME/type spoof, polyglot, oversized image | HIGH | image-only allowlist; decode/re-encode; magic and MIME; byte/pixel limits; random name; quarantine/malware scan; never execute; authorized uploader | spoof/polyglot/decompression/oversize/malware fixtures | image decoder zero-day; isolate processing and patch |
| TM-30 | Attachment is publicly enumerable or signed URL remains usable after removal/revoke | CRITICAL | private object store/outside webroot; authorization handler; short-lived signed URL; no raw storage key in events; delete/revoke; `nosniff`/safe disposition | outsider/removed/share access, URL expiry, object ACL scan | recipient can save viewed image |
| TM-31 | Audit/activity logs store bearer tokens, raw PII/health, notification bodies, IP, or free text too long | HIGH | allowlisted structured payload; secret/PII scanner; coarse/pseudonymous metadata; restricted security log; bounded retention | seeded secret/PII log scan; role access and export/erasure tests | safe labels can still identify household members |
| TM-32 | Household deletion leaves DB rows, object blobs, Redis/query/PWA caches, push deliveries, or shares | CRITICAL | deletion manifest/job; immediate revoke/disconnect; idempotent cascading cleanup; object tombstone; cache purge; completion evidence | interrupted/retried deletion and inventory reconciliation | backups retain data per policy; disclose and expire |
| TM-33 | Account erasure deletes shared household content or leaves personal identity in shared history | HIGH | distinguish household-owned content from user-owned private data; transfer owner; end/pseudonymize membership; revoke grants; no raw snapshot in events | owner/member erasure with contributed items/comments and managed profile | legal ownership/retention decision needs human approval |
| TM-34 | Realtime/polling/notification/upload endpoints exhaust connections, DB, Redis, storage, or provider quota | HIGH | authenticated connection caps; per-user/IP rates; payload/replay/queue limits; backpressure; upload quotas; no polling storm; circuit breakers | load tests, slow-client test, reconnect storm, quota exhaustion | household launch scale/topology unknown; capacity test before rollout |
| TM-35 | Redis cache key collision or stale membership cache authorizes wrong household | CRITICAL | cache keys include env/account/household/resource/version; cache stores denial/acceleration only; DB is authorization source; removal invalidation; short TTL | crafted collision, stale cache after role/removal, Redis flush/outage | extra DB load on fail closed |
| TM-36 | Malicious/compromised internal publisher injects cross-tenant Redis event | HIGH | publisher service identity/network ACL; typed minimal envelopes; SSE process reloads event from DB and asserts household/sequence; never trust Redis payload content | publish forged channel/envelope; subscriber must drop | compromised app DB credentials remain severe |
| TM-37 | Share page is indexed, embedded, framed, or captured by third-party analytics | HIGH | `noindex,nofollow,noarchive`; `frame-ancestors 'none'`; no third-party analytics/assets where possible; Referrer-Policy no-referrer | crawler headers/HTML, iframe test, network inventory | search engines may retain accidentally exposed prior content |
| TM-38 | CSRF/cross-origin confused deputy if auth later moves to cookies, or share action submitted cross-site | HIGH | SameSite cookie; CSRF token for mutations; exact Origin/Fetch-Metadata; share review mutations require bearer header and origin; no GET mutation | cross-origin form/fetch/websocket/SSE tests | legacy clients/proxies may complicate headers |
| TM-39 | Typed proposal/JSON patch or notification variable permits mass assignment, XSS, or prototype pollution | HIGH | DTO whitelist/forbid unknown; allowlisted operations/paths; size/depth caps; plain data serialization; output escaping | malicious keys (`__proto__`), HTML/script, oversized nested patch | future renderer unsafe sink |
| TM-40 | Push subscription is bound to wrong account/device or provider error leaks household metadata | HIGH | explicit opt-in; account/device binding; rotate/revoke on logout/account change; generic payload; provider data minimization; 410 removal | A/B device switch, stolen endpoint, provider payload/log review | push provider processes endpoint/timing metadata; legal review |

OWASP’s upload guidance supports allowlisted extensions/types, signature/content validation, generated filenames, limits, authorized upload, storage outside webroot, and scanning ([OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)). These are minimums, not proof that an implementation is safe.

## Security invariants to encode as tests

1. UI hiding never changes API authorization.
2. An authenticated user with no active membership gets no household resource or event.
3. Owner status does not reveal another adult’s private data.
4. Managed profile cannot authenticate or be invited.
5. Invite is one-time; invite/share secrets are absent from database/log/export/analytics.
6. Share response fields are the intersection of selected immutable versions and current live scopes.
7. Advisor/share principal cannot call canonical plan mutation.
8. Notification action and offline replay re-run current authorization.
9. Redis/cache/event payload cannot grant access.
10. Removal/revocation beats stale browser state.
11. No committed mutation is lost; duplicates are harmless and ordered by household sequence.
12. Deletion completion is reconciled across database, object storage, browser caches, push, and share access.

## Residual/high-risk human decisions

- **[Unknown]** Deployed replica/proxy/CDN/object-store/push-provider topology is not documented in this repo. Long-lived connection, buffering, storage ACL, and regional-data claims require deployment evidence.
- **[Risk]** Current bearer-in-localStorage architecture makes XSS a household-wide account compromise. A security Hard PASS needs an approved session/token hardening decision, not only input sanitization.
- **[Risk]** Retention/lawful-basis/child-age/guardian rules are product/legal decisions. Proposed technical defaults in the privacy matrix are not legal advice.
- **[Risk]** A recipient can screenshot/export data they were legitimately shown. Expiry/revocation prevents future access, not recall.

## Security release gates

Block household rollout if any remains:

- private PWA/API/query/IndexedDB cache isolation unproven;
- permission/IDOR matrix incomplete;
- invite/share plaintext or URL leakage;
- removed member retains any route/stream/replay/storage access;
- advisor canonical write path exists;
- sensitive scope defaults on or owner bypass exists;
- attachment is public/static or unscanned;
- notification preferences not server-enforced or lock copy leaks context;
- semantic/slot/owner concurrency constraints absent;
- deletion/erasure manifest cannot reconcile;
- threat tests use only mocks for critical cross-account/concurrency/reconnect cases.
