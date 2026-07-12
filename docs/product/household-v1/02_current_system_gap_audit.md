# Garnish Household OS v1 — Current System Gap Audit

## Audit conclusion

**Confidence: certain for source-code capabilities; uncertain for deployed infrastructure because no production access was used.** Current Garnish is a single-user food-planning application with reusable recipe, plan, pantry, and shopping primitives. It is not a household collaboration system. The highest-risk mistake would be to add realtime UI on top of the present user-owned schema: it would create shared-state behavior without a verified tenant, membership, concurrency, or cache-isolation boundary.

## End-to-end trace method

Each relevant capability was traced across UI/page, hook/state, API client, Nest controller/service, Prisma model, response/cache behavior, and tests. Evidence is from `origin/master` at `1631dc5d`; no production system or database was accessed.

## Required 20-system trace ledger

`—` means the layer is absent, not that it was skipped. Shared HTTP calls use `apps/web/src/lib/apiClient.js` unless noted.

| # / system | UI | Hook/context/state | API / endpoint | Controller → service | Prisma / infrastructure | Response → cache/state | Tests found | Classification |
|---|---|---|---|---|---|---|---|---|
| 1. User/Auth | login/onboarding/admin auth surfaces | `AuthContext.jsx` | `/auth/login`, `/auth/otp/*`, `/auth/google`, `/users/me` | `AuthController` → `AuthService`; `UsersController` → `UsersService` | `User`, OTP/reset rows, `UserSession`; JWT `sessionEpoch` | JWT/user response → `localStorage` + React state; other caches not purged | auth service, context, route/smoke tests | `BLOCKED_BY_P0A` |
| 2. Profile | profile/onboarding/settings pages | profile local state; `useOnboarding`; `useSettings` | `GET /users/me`, `GET/PUT /users/preferences`, allergy/consent routes | `UsersController` → `UsersService`; `ConsentService` | `UserPreference`, allergy joins, `UserConsent`, `ConsentLog` | mixed server/local mirrors; failure can look like empty state | user/consent/onboarding/settings tests | `UNSAFE` |
| 3. Pantry | shopping-list pantry section | `useShopping.js` | `GET/POST /shopping-list/pantry`, item-to-pantry, delete pantry | `ShoppingListController` → `ShoppingListService` | `PantryItem`, optional `Ingredient` soft link | JSON rows → query/refetch/local optimistic UI | shopping service/smoke tests | `REUSABLE_AFTER_FIX` |
| 4. Shopping List | shopping-list page | `useShopping.js` | list/items/from-plan/check/delete/bulk routes | `ShoppingListController` → `ShoppingListService`/aggregator | `ShoppingList`, `ShoppingItem` | JSON list/summary → TanStack/local optimistic state then refetch | service, aggregator, smoke tests | `REUSABLE_AFTER_FIX` |
| 5. Meal Plans | plan page | `useMealPlan.js` | `/meal-plans`, slots, proposal, swap, servings, cooked, copy | `MealPlansController` → `MealPlansService`/planner | `MealPlan`, `MealSlot`, recipe relations | JSON plan/proposal → TanStack key `['plan', offset]`; optimistic mutation/refetch | service/planner/course/smoke tests | `UNSAFE` |
| 6. Notifications | notification center + settings toggles | `useNotifications.js`; local settings state | `GET /notifications`, generate, read/delete, INE preview | `NotificationsController` → `NotificationsService`/`IneService`; scheduler | `Notification`; cron; in-memory INE ledger | inbox JSON → local query; preferences remain local-only | INE/unit/smoke tests | `UNSAFE` |
| 7. PWA | installable web shell | generated registration/Workbox | Workbox intercepts `/api/**`; no dedicated server endpoint | — | generated service worker and Cache Storage | single `api-cache`, NetworkFirst, 24h max age; no auth partition/purge | build artifact only; no A/B service-worker E2E | `UNSAFE` |
| 8. Query cache | all TanStack-backed pages | `QueryClient`; domain hooks; `queryKeys.js` | ordinary HTTP APIs | ordinary controllers/services | no cache tenant metadata | keys are not uniformly account/household scoped; logout does not clear client | component/hook tests only | `UNSAFE` |
| 9. Recommendation | discover/home/assistant/plan proposal | page hooks and recommendation attribution | recommendation/planner/assistant endpoints | recommendation/planner/AI controllers → services | events, profiles, exposure/attribution, internal outbox | proposal/ranking JSON → page/query/local attribution state | extensive unit/eval suites | `PARTIAL` |
| 10. Cook flow | `/cook/:id` | `useCook.js` | recipe reads; meal-slot cooked acknowledgement where linked | recipes/meal-plan controllers → services | `Recipe`, `RecipeStep`, `MealSlot.cookedAt` | recipe/step data → local cook state; completion API when applicable | hook/smoke/integration tests | `READY_TO_REUSE` |
| 11. Recipe detail | `/recipe/:id` and GRIS renderer | `useRecipeDetail.js` + presenter helpers | `GET /recipes/:id`, `/full`, personalize | `RecipesController` → `RecipesService` | recipe, ingredient, nutrition, step models/JSON | recipe JSON → TanStack/presenter state | substantial presenter/action/smoke tests | `READY_TO_REUSE` |
| 12. Analytics/consent | app-wide hooks + settings/privacy copy | `useAnalytics.js`; `analytics-init.js` | `POST /analytics/event`; user consent routes | `AnalyticsController` → `AnalyticsService`/outbox; `ConsentService` | user events, consent, `EventOutbox` | event acknowledgement; local consent mirrors and server ledger do not yet form merged P0 contract | analytics/consent/eval tests | `BLOCKED_BY_P0A` |
| 13. Media upload/storage | profile avatar picker | profile component local file state | `POST /upload/avatar` | `UploadController` → Multer disk storage | filesystem path + `User.avatar`; no private object entity | public/static avatar URL → profile state; restrictive static headers | magic-byte upload unit tests | `PARTIAL` |
| 14. Realtime/event infrastructure | no household client | — | no client delivery endpoint | no gateway/stream service; internal behavior `EventOutboxService` only | PostgreSQL outbox + optional Redis used for other concerns | no subscription/order/resume/ack client state | internal outbox unit tests only | `MISSING` |
| 15. WebSocket/SSE/polling support | — | no `WebSocket`/`EventSource` client | no WebSocket/SSE route; ordinary query refetch only | no Nest gateway or SSE controller | — | no collaboration delivery; incidental HTTP refetch is not a protocol | none | `MISSING` |
| 16. Push notification support | no permission/subscription UX | — | no device-subscription endpoint | no push provider/service | no device subscription/delivery row | in-app rows only; no OS delivery receipt | none | `MISSING` |
| 17. Permission/role guards | route hiding/admin surfaces | `RequireAuth`; admin UI checks | JWT-protected current endpoints | Passport JWT, owner/user checks, admin role guards | `User.adminRole`; resource `userId`; no membership/capability rows | 401/403/owner-filtered JSON; UI hiding is secondary | guard/service/controller tests | `PARTIAL` |
| 18. DB constraints | — | — | mutations through current services | Prisma read-before-write/delete-create patterns | user/week plan unique; no slot identity or semantic item uniques/version/idempotency | database cannot guarantee current semantic identities under races | mostly mocked service tests; no parallel PostgreSQL proof | `UNSAFE` |
| 19. Offline behavior | PWA shell/offline response cache | no durable command queue/recovery store | cached GET behavior only | no offline replay endpoint/service | Cache Storage only; no command/idempotency/replay tables | possible stale private responses; no pending/ack/conflict model | no critical offline/reconnect E2E | `UNSAFE` |
| 20. External sharing | — | — | no share/review endpoint | no share/advisor controller/service | no share token/scope/comment/proposal models | no expiring/revocable scoped view state | none | `MISSING` |

## System traces

### 1. User/Auth — `BLOCKED_BY_P0A`

- UI/state: `apps/web/src/context/AuthContext.jsx` keeps JWT and device key in `localStorage`.
- Client: `apps/web/src/lib/apiClient.js` injects the bearer token; a 401 removes only the token.
- API: `apps/server/src/auth/*`; JWT strategy checks `sessionEpoch` against the user row.
- Storage: `User`, `UserSession`, OTP/reset models.
- Cache/session behavior: logout resets PostHog and selected auth keys but does not clear React Query, application local stores, conversations, recommendation attribution, service-worker caches, or private API cache entries.
- Tests: unit/component auth tests exist; no verified A→logout→B PWA/browser isolation proof exists on this base.
- Decision: retain the auth spine only after P0-A is committed and its two-account cache/session evidence passes.

### 2. Profile and consent — `UNSAFE`

- UI: onboarding/settings manage allergies, preferences, analytics, and personalization.
- API/service: users and consent modules persist user-level data.
- Storage: `UserPreference`, allergy joins, `UserConsent`, `ConsentLog`.
- Gap: prior P0 findings remain present at the unchanged base: critical writes can diverge from onboarding completion; allergy severity is not a defensible round trip; settings failure can overwrite a safe value; optional consent is not consistently default-off/source-of-truth.
- Household implication: allergy and health-adjacent fields cannot be copied into a household profile or exposed to all members. V1 needs explicit per-field disclosure scopes and parent-managed profiles.

### 3. Pantry — `REUSABLE_AFTER_FIX`

- UI/API: pantry operations are embedded in the shopping-list surface and service.
- Model: `PantryItem` is user-owned with optional ingredient soft link.
- Strength: a usable ingredient dictionary link and plan subtraction exist.
- Gap: no household owner/source/provenance, quantity normalization, version, retention, or race-safe semantic uniqueness. Read-before-create dedupe can duplicate under concurrency.
- Reuse: migrate personal pantry as a private source; do not silently convert it into shared household inventory.

### 4. Shopping list — `REUSABLE_AFTER_FIX`

- UI: `apps/web/src/app/shopping-list/page.jsx` + `useShopping.js`.
- API: JWT-guarded `ShoppingListController`; service scopes item ownership through the user's list.
- Model: one `ShoppingList` per user; basic item amount/unit/category/check state/source.
- State: TanStack Query with local optimistic changes and refetch; no event stream or offline mutation queue.
- Tests: unit/service and smoke coverage exists for current single-user behavior.
- Gaps: no household, membership/capabilities, requester, assignment, session, unavailable/substitution decision, attachments, event history, idempotency, version, or race-safe semantic dedupe.
- Reuse: aggregation and ingredient resolution can be extracted behind a new household-scoped command model.

### 5. Meal plans — `UNSAFE`

- UI: `apps/web/src/app/plan/page.jsx` + `useMealPlan.js`.
- API/service: JWT-owned plan reads/writes and proposals; multiple mutations use optimistic cache/re-fetch.
- Model: user/week plan uniqueness; unversioned slots.
- Strength: manual/suggested slots, servings, cooked acknowledgement, plan-to-shopping aggregation.
- Gaps: `MealSlot` identity is not DB-unique; delete-then-create is vulnerable to parallel duplicates. No board lifecycle, member attendance, proposals/reactions, plan versions/locks, deterministic reviewable shopping diff, or rollback log.
- Reuse: recipe proposal and scaling logic only after slot uniqueness and a versioned household plan boundary.

### 6. Notifications — `UNSAFE`

- UI: in-app notification list and local settings toggles.
- API/model: persisted `Notification` rows and mark-read/delete endpoints.
- Scheduler: cron jobs pass candidates through INE; actual in-app generation is behind default-off `INE_REAL_SEND_ENABLED`.
- Strength: basic consent/quiet-hour/fatigue decision code and persisted inbox rows.
- Gaps: local notification preferences are not backend source of truth; quiet hours are fixed/inferred, delivery state is absent, dedupe is weak/in-memory, no deep-link action contract, no retry receipt, no device subscription, no push provider, and no household privacy copy policy.
- Decision: reuse templates/pipeline concepts, replace persistence and enforcement contract before enabling household notifications.

### 7. PWA and query cache — `UNSAFE`

- `apps/web/vite.config.js` caches all `/api/**` using one Workbox `NetworkFirst` cache for up to one day.
- Authenticated responses are not explicitly excluded/partitioned; logout has no Cache Storage purge.
- TanStack Query keys are mostly domain-oriented and are not systematically account/household partitioned; logout does not clear the client.
- No offline mutation queue, command idempotency, version check, replay authorization, or conflict UI exists.
- Decision: make private API network-only/no-store first; later add an explicit encrypted/minimal household offline command design if product evidence justifies it.

### 8. Recommendation and cooking — `PARTIAL`

- Recommendation/planner logic and the cook/recipe-detail surfaces are substantial and test-covered at the current single-user level.
- Recipe nutrition includes nullable provenance, servings exist, and cook completion is represented.
- Missing competitive requirements: verified post-cook feedback, unit-safe cross-domain scaling, per-step ingredient quantities, honest nutrition completeness state, bounded voice commands, explainable household pantry coverage, reviewed receipt OCR, and private-draft import workflow.
- Do not label the deterministic planner or pantry matching as AI.

### 9. Analytics/consent — `BLOCKED_BY_P0A`

- Frontend producers and server analytics/outbox exist.
- The database event outbox is for internal behavior routing, not client realtime collaboration.
- Existing consent fixes live only in the dirty P0-A worktree. Household analytics must stay off unless independently opted in and must avoid sensitive member/child data.

### 10. Media upload/storage — `PARTIAL`

- Authenticated avatar upload uses Multer local disk, allowlisted image MIME/extensions, magic-byte checks, size limit, and restrictive static response headers.
- No household attachment entity, object-storage lifecycle, virus scanning, EXIF stripping, access-controlled download, retention, or deletion contract exists.
- Alternative photos should be deferred until a private attachment pipeline is designed; reusing public/static avatar delivery would be unsafe.

### 11. Realtime/event infrastructure — `MISSING`

- No Nest WebSocket gateway, SSE controller, browser `WebSocket`, or `EventSource` exists.
- Redis is present for cache/rate-limit roles, and an analytics/behavior database outbox exists.
- Neither is a household collaboration delivery protocol. There is no subscription authorization, household sequence, resume cursor, acknowledgement, or removed-member disconnect behavior.

### 12. Roles, permissions, and sharing — `MISSING`

- Current authorization is JWT plus per-user ownership and separate admin guards.
- There is no household tenant, membership, capability matrix, invite/share token, advisor scope, external share, or child managed-profile boundary.
- UI hiding cannot substitute for this missing server authorization layer.

## Named finding status

| Finding | Current base status | Direct evidence |
|---|---|---|
| GAR-LAUNCH-004..006 | OPEN | unchanged onboarding/settings source; P0-A edits uncommitted |
| GAR-LAUNCH-007..008 | OPEN | unchanged analytics/consent source; P0-A edits uncommitted |
| GAR-LAUNCH-009 | OPEN | broad Workbox `/api/**` `NetworkFirst`; no private-cache purge |
| GAR-LAUNCH-020 | OPEN | notification prefs documented and implemented as local-only |
| GAR-LAUNCH-063 | OPEN | no `MealSlot` composite unique; delete/create path remains |
| GAR-LAUNCH-064 | OPEN | no shopping/pantry normalized unique identity or transactional merge |

## What is reusable

1. Recipe/ingredient corpus and safe recipe visibility/filtering.
2. Plan proposal as a proposal—not an automatic decision.
3. Ingredient aggregation, serving-scale inputs, and pantry subtraction as pure domain helpers after unit policy hardening.
4. JWT/user identity foundation after P0-A isolation proof.
5. PostgreSQL/Prisma/Nest/TanStack stack.
6. Database outbox implementation patterns, not its current event schema or client delivery behavior.

## What must not be reused as-is

1. User ownership as a substitute for household tenancy.
2. Broad authenticated API caching.
3. Local-only notification preferences.
4. Read-before-create semantic dedupe.
5. Delete-then-create meal-slot identity.
6. Avatar static-file delivery for private decision attachments.
7. Internal analytics outbox as a claimed realtime transport.

## Recommended implementation sequence after P0-A

1. Prove account/cache/consent isolation on merged master.
2. Add the smallest household/membership/capability foundation and IDOR matrix.
3. Add versioned household shopping commands and database identities before realtime transport.
4. Add server-backed notification preferences/delivery ledger before enabling sends.
5. Add versioned Meal Board and explicit shopping diff.
6. Add secure sharing only after membership data isolation is stable.
7. Validate expensive H6 inputs (OCR, voice, social import) before building dependencies.

## Audit verdict

`STAGE_A_REUSABLE_FOUNDATIONS_EXIST_STAGE_B_BLOCKED`
