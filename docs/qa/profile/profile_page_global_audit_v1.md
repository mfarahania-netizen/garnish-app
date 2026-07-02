# Garnish Profile Page Global Audit v1

Date: 2026-07-02  
Scope: profile page, Food DNA connection, settings/preferences/consent connection, gamification summary, auth/logout, profile backend contracts, related stale profile code.  
Mode: report only. No product code, database rows, or imports were changed.

## Reality Check

[قطعی] صفحه پروفایل فعلی برای لانچ MVP قابل استفاده است، اما برای «سطح جهانی» هنوز آماده نیست. مشکل اصلی ظاهر نیست؛ مشکل اصلی این است که پروفایل هنوز مرکز کنترل قابل اعتماد کاربر نیست. چند اکشن مرده دارد، چند قرارداد فرانت/بک ناقص است، Food DNA دو مسیر UI دارد، consent/settings منبع حقیقت یکپارچه ندارد، و چند فایل قدیمی پروفایل هنوز در کد مانده‌اند.

[احتمالاً] اگر همین وضعیت بدون اصلاح لانچ شود، کاربر حرفه‌ای حس می‌کند پروفایل فقط یک صفحه نمایشی است، نه جایی برای کنترل هویت غذایی، امنیت آلرژی، داده‌های رفتاری، رضایت‌ها و پیشرفت واقعی.

## Verdict

Overall verdict: **FAIL for world-class profile**, **CONDITIONAL PASS for narrow MVP if dead buttons are removed or fixed before launch**.

Launch blockers:

1. [P0] Edit profile button is non-functional.
2. [P0] `/users/me` does not return `createdAt`, while profile expects member-since from it.
3. [P0] Food DNA projection reads observed behavioral signal rows without an explicit personalization-consent gate in that method.
4. [P1] Consent state in settings is locally mirrored and cannot be server-read, so profile/Food DNA trust state can diverge by device/session.
5. [P1] Profile has duplicate Food DNA UI paths and stale profile architecture.

## What Is Good

[قطعی] These parts are solid foundations:

- `apps/web/src/app/profile/useProfile.js` degrades secondary data honestly: `/gamification/me` or `/users/preferences` failure does not blank the whole page.
- `/users/me`, `/profile`, `/profile/dna`, `/gamification/me`, `/users/preferences` are owner-scoped behind JWT guards.
- `apps/server/src/common/serializers/user.serializer.ts` uses a safe allowlist serializer.
- Allergy writes have canonical-token allowlisting in `UsersService.addAllergies`.
- GDPR export and erasure endpoints exist.
- Gamification is private, server-derived, and does not expose a leaderboard.
- Avatar upload endpoint has MIME allowlist, magic-byte verification, size limit, and destination setup.
- Profile smoke tests cover loading/error/ready and gamification degraded states.

These strengths should be preserved. The issue is not that the profile is bad from scratch; it is that it is not yet coherent enough to be the user's command center.

## P0 Findings

### P0-1: Profile Edit Button Is Dead

Confidence: [قطعی]

Evidence:

- `apps/web/src/app/profile/page.jsx:86` shows the edit button but only calls a toast: "edit profile coming soon".
- Backend already has `PATCH /users/me` in `apps/server/src/users/users.controller.ts:21`.
- Old hook `apps/web/src/hooks/useProfileQuery.js:45` has an unused `updateNameMutation`, but current `ProfilePage` does not use it.

Why it matters:

A visible edit button that does not edit is a trust-breaking UI bug. On a profile page, edit identity/avatar is not an optional luxury; it is expected behavior.

Fix:

- Add a real edit bottom sheet or modal from the pencil button.
- Allow editing at minimum: display name.
- Optional but expected: avatar upload through `POST /upload/avatar`, then `PATCH /users/me` with returned `avatarUrl`.
- Invalidate query keys after success: `['home','me']`, any centralized profile/me key, drawer header profile.
- If avatar upload is not ready for launch, hide avatar edit and ship name edit only.

Acceptance criteria:

- Clicking pencil opens editable UI.
- Saving name calls `PATCH /users/me`.
- UI updates without full reload.
- Failed save preserves previous state and shows a real error.
- Test covers button click, save success, and save failure.

### P0-2: Member-Since Is Broken by Backend Contract

Confidence: [قطعی]

Evidence:

- `apps/web/src/app/profile/useProfile.js:10` documents `/users/me -> name + member-since (createdAt)`.
- `apps/web/src/app/profile/useProfile.js:70` reads `me.data?.createdAt`.
- `apps/server/src/users/users.service.ts:65-80` selects user fields but does not select `createdAt`.
- `User` model has `createdAt` in `apps/server/prisma/schema.prisma:25`.

Impact:

The profile header cannot show "member since" in real API responses. The current test hides this because `apps/web/src/app/profile/useProfile.test.jsx:15` mocks `createdAt`.

Fix:

- Add `createdAt: true` to `UsersService.findById`.
- Add a server/API contract test that `GET /users/me` includes `createdAt`.
- Add a hook test using a mock response without `createdAt` to assert the UI degrades intentionally, not accidentally.

Acceptance criteria:

- `/users/me` returns `createdAt`.
- Profile header shows Persian member-since date for registered and guest users where applicable.

### P0-3: Food DNA Observed Graph Lacks Explicit Consent Gate in `/profile/dna`

Confidence: [قطعی] for missing local gate; [احتمالاً] for privacy impact depending on upstream signal ingestion guarantees.

Evidence:

- `apps/server/src/behavior-engine/profile/read/profile-read.service.ts:113-145` gates observed graph hydration in `getLivingUserProfile`: it loads observations only if `consent.granted.includes('personalization')`.
- `apps/server/src/behavior-engine/profile/read/profile-read.service.ts:164-181` in `getFoodDnaProjection` loads observations unconditionally after reading consent.
- `apps/server/src/recommendation/runtime-shadow/recommendation-shadow-a8-adapters.ts:60-77` `loadObservations` reads `signalObservation.findMany({ where: { userId } })` and does not receive consent state.

Why it matters:

Food DNA is a profile-facing explanation of inferred behavior. If a user has not granted personalization, this method should not hydrate observed behavioral signals. Even if ingestion is supposed to be consent-aware, the read path should fail closed at the product boundary.

Fix:

- In `getFoodDnaProjection`, wrap observation loading with `if (consent.granted.includes('personalization'))`.
- If no personalization consent, return declared/cold-start projection only.
- Add a unit/integration test: with only core consent and existing `SignalObservation` rows, `/profile/dna` must not include observed maturity/traits.

Acceptance criteria:

- No observed behavioral projection without personalization consent.
- Settings toggle off immediately changes Food DNA to declared/cold-start state after cache invalidation.

## P1 Findings

### P1-1: Cooking History Row Is Dead

Confidence: [قطعی]

Evidence:

- `apps/web/src/app/profile/page.jsx:159` renders "Cooking history" but only shows a "coming soon" toast.

Fix options:

| Option | Speed | Risk | Product value | Recommendation |
|---|---:|---:|---:|---|
| Remove row for launch | Fast | Low | Neutral | Best if no history page exists |
| Build real history page | Medium | Medium | High | Best if cook events are reliable |
| Replace with achievements | Fast | Low | Medium | Acceptable temporary cleanup |

Acceptance criteria:

- No "coming soon" action remains in profile.

### P1-2: Duplicate Food DNA UI Creates Product and Code Confusion

Confidence: [قطعی]

Evidence:

- `apps/web/src/App.jsx:189-191` defines both `/profile` and dedicated `/food-dna`.
- `apps/web/src/app/profile/page.jsx:172-252` still contains an internal `DnaView`.
- `apps/web/src/app/profile/page.jsx:291-293` switches local state to internal DNA view.
- `apps/web/src/app/food-dna/page.jsx` exists as the dedicated Food DNA activation screen.

Impact:

Two surfaces can drift in copy, data shape, consent behavior, and UX. The drawer already has a separate "Food DNA" route, so profile should not maintain a second detailed DNA page.

Fix:

- Make profile DNA card navigate to `/food-dna`.
- Remove internal `DnaView` from profile, or refactor both routes to use one shared component.

Acceptance criteria:

- One canonical Food DNA renderer.
- Profile card is summary only.
- `/food-dna` owns all detailed DNA, question engine, taste correction, and trust guidance.

### P1-3: Profile-Specific Analytics Are Missing

Confidence: [قطعی]

Evidence:

- `apps/web/src/lib/eventTaxonomy.js` defines `PROFILE_EDIT`, `PROFILE_VIEW`, `PROFILE_NAVIGATE`.
- `apps/web/src/app/profile/page.jsx` does not use `useAnalytics`.
- `RouteTracker` in `apps/web/src/App.jsx:92-119` emits generic page views/click summaries only.

Impact:

Admin analytics can see page-level traffic but cannot answer profile-specific product questions:

- Did users try to edit profile?
- Did they open Food DNA from profile?
- Did they use settings/privacy controls?
- Which profile sections are ignored?

Fix:

- Track `profile_view` on mount.
- Track `profile_edit_open`, `profile_edit_save`, `profile_navigate` with destination.
- Do not send PII values; send only event names and destination/section.

Acceptance criteria:

- Profile events appear in analytics without name/email/allergy payloads.

### P1-4: Settings Consent Is Not Server-Hydrated

Confidence: [قطعی]

Evidence:

- `apps/web/src/app/settings/useSettings.js:15-18` states there is no frontend endpoint to read server consent.
- `apps/web/src/app/settings/useSettings.js:36-40` initializes personalization from localStorage.
- `apps/server/src/users/users.service.ts:234-247` writes consent server-side.
- `apps/server/src/behavior-engine/profile/read/profile-read.service.ts:49-70` reads server consent for profile/backend decisions.

Impact:

The settings UI can show a consent state that is different from the server. On a new device, after localStorage loss, or after server-side withdrawal, the user may see a false state.

Fix:

- Add `GET /users/consent` returning latest consent state per purpose.
- Hydrate settings toggles from server.
- LocalStorage can remain as an optimistic/cache layer only.
- On toggle success, invalidate `['home','profile']`, `['profile','dna']`, recommendation/profile keys.

Acceptance criteria:

- Same user sees same consent state across devices.
- Revoking personalization updates Profile/Food DNA/recommendations after invalidation.

### P1-5: Profile Data Query Keys Are Fragmented

Confidence: [قطعی]

Evidence:

- Current profile uses `['home','me']`, `['home','profile']`, `['home','gamification']`, `['discover','preferences']` in `apps/web/src/app/profile/useProfile.js:38-41`.
- Food DNA uses `['profile','dna']` and `['profile','taste']`.
- Settings uses `['home','me']` and `['discover','preferences']`.
- Old hook uses `['userProfile']`, `['favorites']`, `['mealPlan']`, `['myRecipes']`.

Impact:

After editing preferences, consent, profile, or taste, related screens can stay stale because invalidation is scattered.

Fix:

- Create a central `queryKeys` module:
  - `queryKeys.me`
  - `queryKeys.profile.living`
  - `queryKeys.profile.dna`
  - `queryKeys.profile.taste`
  - `queryKeys.preferences`
  - `queryKeys.gamification.me`
- Replace duplicated literals.
- Mutation success should invalidate all affected keys.

Acceptance criteria:

- Updating preference/consent/taste changes profile, home DNA card, Food DNA, and settings without reload.

### P1-6: Profile Backend DTOs Are Too Weak for Production

Confidence: [قطعی]

Evidence:

- `apps/server/src/users/dto/update-profile.dto.ts:4-15` validates only string/email, no length, trimming, URL/path policy, avatar constraints.
- `apps/server/src/users/dto/update-preferences.dto.ts:3-26` accepts arrays as JSON strings.
- `apps/server/src/users/users.controller.ts:21-25` passes profile update directly to service.

Risks:

- Extremely long name/avatar strings.
- Arbitrary avatar URL/path if `PATCH /users/me` accepts avatar directly.
- Fragile JSON string parsing for preference arrays.
- Inconsistent client/server contract.

Fix:

- Add `MaxLength` for name/email/avatar.
- Trim and normalize name/email in service.
- Restrict avatar to app-owned upload path or validated HTTPS URL.
- Move preferences API toward native arrays:
  - `allergies?: string[]`
  - `cuisine?: string[]`
  - `healthGoals?: string[]`
- Keep temporary backward compatibility for stringified arrays during migration.

Acceptance criteria:

- Invalid long fields rejected with 400.
- Avatar cannot point to arbitrary unsafe schemes.
- Preferences accept arrays as normal JSON.

### P1-7: Gamification GET Has Write Side Effects

Confidence: [قطعی]

Evidence:

- `apps/server/src/gamification/gamification.service.ts:145-147` `getSummary` calls `recomputeForUser`.
- `recomputeForUser` writes/upserts streak, achievements, progress, gamification events in `apps/server/src/gamification/gamification.service.ts:109-136`.
- Profile calls `/gamification/me` in `apps/web/src/app/profile/useProfile.js:40`.

Impact:

A read-heavy profile page can trigger write workloads. This makes performance, caching, observability, and failure behavior harder. It also means opening profile can unlock/persist achievements, which is surprising product semantics.

Fix:

- Separate recompute from read:
  - event-triggered recompute on cook/favorite/plan changes,
  - scheduled backfill,
  - `GET /gamification/me` reads cached summary.
- If immediate recompute is needed for MVP, bound it and document it as intentional.

Acceptance criteria:

- Profile read does not write in steady state, or write behavior is bounded and monitored.

### P1-8: Stale Profile Architecture Should Be Removed

Confidence: [قطعی]

Evidence:

- `apps/web/src/hooks/useProfileQuery.js` is only found by definition/import references.
- `apps/web/src/features/profile/services/profileStore.js` stores old local profile stats in `localStorage`.
- `apps/web/src/features/profile/services/badgeEngine.js` computes old local badges.
- Current ProfilePage uses `apps/web/src/app/profile/useProfile.js`, not these files.

Impact:

Dead local profile code is dangerous because a future developer may accidentally wire stale localStorage state back into a server-authoritative profile.

Fix:

- Delete unused `useProfileQuery.js`, `profileStore.js`, `badgeEngine.js` after confirming no dynamic imports.
- If deletion is delayed, add explicit deprecation comments and tests proving current profile does not use local profile storage.

Acceptance criteria:

- One profile data layer remains.
- No localStorage-backed profile identity or badge state remains.

## P2 Findings

### P2-1: Profile Is Not Yet a True User Control Center

Confidence: [احتمالاً]

Current visible structure:

- Identity header.
- Food DNA summary.
- Progress cards.
- "What we know about you" for diet/allergens only.
- Quick links.
- Logout.

Missing for global-level profile:

- Profile completeness score with actionable steps.
- Safety status: declared allergies, dietary restrictions, pork avoidance, hard dislikes.
- Privacy/data controls: consent, export, delete, personalization status.
- Taste controls: liked/disliked ingredients and corrections.
- Cooking constraints: skill, time, budget, household size.
- Recommendation explanation: why suggestions are changing.
- Account state: guest vs registered, phone/email status, data sync status.

Recommended IA:

1. Identity and account state.
2. Food profile status:
   - taste maturity,
   - profile completeness,
   - personalization on/off.
3. Safety and restrictions:
   - allergies,
   - diet,
   - hard dislikes,
   - contains-pork avoidance if relevant.
4. Progress:
   - cooked count,
   - streak,
   - achievements.
5. Data and privacy:
   - consent,
   - export,
   - delete account.
6. Quick links:
   - favorites,
   - history only if real,
   - settings,
   - support.

### P2-2: "What We Know About You" Is Too Thin

Confidence: [قطعی]

Evidence:

- `apps/web/src/app/profile/useProfile.js:99-104` exposes only diet label and allergens.
- UI renders only those in `apps/web/src/app/profile/page.jsx:134-153`.

Impact:

For an app based on personalization, the user cannot inspect or correct most of what the system knows.

Fix:

Show at least:

- Dietary pattern.
- Allergies/restrictions.
- Hard dislikes.
- Favorite taste/cuisine tendencies.
- Cooking skill.
- Workday cooking time.
- Budget band.
- Household/servings if available.
- Confidence per fact and source: "you told us" vs "learned from cooking".

Acceptance criteria:

- User can see and edit/correct every personalization-critical fact.

### P2-3: Logout Destination Is Inconsistent

Confidence: [قطعی]

Evidence:

- Profile logout navigates to `/onboarding`: `apps/web/src/app/profile/page.jsx:284`.
- Drawer logout navigates to `/`: `apps/web/src/shell/NavDrawer.jsx:88-92`.
- `AuthContext.logout` clears token, device key, and onboarded flag in `apps/web/src/context/AuthContext.jsx:87-100`.

Impact:

Logout behavior can feel inconsistent. A registered user may expect login, not onboarding. A guest may need onboarding reset. These should be intentionally separated.

Fix:

- Define product rule:
  - guest reset -> onboarding,
  - registered logout -> login,
  - account deletion -> onboarding or goodbye state.
- Use one shared logout helper.

Acceptance criteria:

- Profile and drawer logout route to the same intended destination for the same account state.

### P2-4: Empty State Is Too Generic

Confidence: [احتمالاً]

Evidence:

- When no diet/allergens are known, profile says "the more you cook, the better we know you" in `apps/web/src/app/profile/page.jsx:147-151`.

Problem:

That message is friendly but not actionable enough. New users need a clear next action.

Fix:

- Replace with a compact checklist:
  - Add allergies.
  - Pick dietary style.
  - Answer 3 taste questions.
  - Save 3 recipes or cook first recipe.

Acceptance criteria:

- New user can improve profile quality in under 2 minutes.

### P2-5: Visual Hierarchy Is Attractive but Not Operational Enough

Confidence: [احتمالاً]

Observations:

- The page is visually clean and token-consistent.
- But the current order puts DNA summary before safety/profile controls.
- Progress cards look polished but are less mission-critical than allergy/diet/consent correctness.

Fix:

- Keep DNA summary but add a safety/control strip above or inside it:
  - personalization on/off,
  - allergy guard active,
  - profile completeness.
- Move dead/secondary quick links lower.
- Do not add decorative cards; use compact rows and status chips.

Acceptance criteria:

- Within 5 seconds, user understands:
  - who they are logged in as,
  - whether personalization is on,
  - whether allergy guard is active,
  - what they should fix next.

### P2-6: Accessibility Needs Interaction-Level QA

Confidence: [احتمالاً]

Evidence:

- Many buttons use visible text and icons correctly.
- Some icon-only actions rely on `aria-label`.
- `KnownRow` intentionally avoids row-level aria-label in `apps/web/src/app/profile/page.jsx:52-61`.

Risks:

- Repeated pencil buttons may be ambiguous to screen-reader users.
- DNA card may be announced as one large button without enough destination context.
- Toast-only feedback may be missed by assistive tech if Toast does not use live regions.

Fix:

- Verify with axe and keyboard navigation.
- Add specific labels where needed, e.g. "edit dietary preference", "edit allergy peanut".
- Ensure toast uses `role="status"` or `aria-live`.

Acceptance criteria:

- Full profile is usable by keyboard.
- All actionable controls have meaningful accessible names.

## P3 Findings

### P3-1: Profile Tests Are Too Mocked

Confidence: [قطعی]

Evidence:

- `apps/web/src/app/profile/profile.smoke.test.jsx:4-6` mocks `useProfile`, so it cannot catch API contract/data mapper bugs.
- `apps/web/src/app/profile/useProfile.test.jsx:15` injects `createdAt`, hiding the real `/users/me` omission.

Fix:

- Add integration-style test for real hook against realistic API fixtures copied from backend contract.
- Add backend test for `/users/me`.
- Add mutation tests when edit profile is implemented.

Acceptance criteria:

- Tests fail if `/users/me` omits `createdAt`.
- Tests fail if profile edit button becomes dead again.

### P3-2: Copy and Product Language Need One Pass After Functional Fixes

Confidence: [احتمالاً]

Notes:

- Current copy is warm and on-brand.
- But terms like "maturity", "DNA", and reconciliation need careful explanation so users do not feel judged or profiled opaquely.

Fix:

- Use plain user-benefit language:
  - "برای پیشنهادهای دقیق‌تر"
  - "از چیزهایی که خودت گفتی"
  - "از رفتار آشپزی‌ات، فقط اگر اجازه داده باشی"
- Avoid overpromising precision.

Acceptance criteria:

- User understands the app learns preferences, not identity or sensitive traits.

## Backend Contract Review

### `/users/me`

Status: partially correct.

Good:

- JWT guarded.
- Sanitized via allowlist.

Problems:

- Missing `createdAt`.
- Does not include consent or account registration state beyond `isGuest`.
- Email/avatar can exist but current profile does not use them well.

Recommended response shape:

```json
{
  "id": "user-id",
  "name": "Display name",
  "email": "user@example.com",
  "phone": "...",
  "avatar": "/uploads/avatars/...",
  "isGuest": false,
  "createdAt": "2026-07-02T00:00:00.000Z"
}
```

### `/profile`

Status: good as a living-profile read, but must remain consent-gated.

Required:

- Keep personalization observations gated.
- Keep allergies fail-closed.
- Use this as summary source for profile and drawer only.

### `/profile/dna`

Status: needs consent fix.

Required:

- No observed graph without personalization consent.
- Return trust guidance explaining whether DNA is based on declared info only or observed behavior.

### `/users/preferences`

Status: works but API shape is legacy.

Required:

- Move from JSON-string arrays to typed arrays.
- Expose all profile-critical preference dimensions, not only diet/allergies.

### `/users/consent`

Status: write-only from frontend perspective.

Required:

- Add read endpoint.
- Include consent source/timestamp if possible.

### `/gamification/me`

Status: server-authoritative but read has write side effects.

Required:

- Separate recompute from read or document and bound recompute.

## Frontend Architecture Review

Current active profile path:

- `ProfilePage` -> `useProfile`
- `useProfile` calls:
  - `/users/me`
  - `/profile`
  - `/gamification/me`
  - `/users/preferences`

Connected surfaces:

- Drawer profile header uses `/profile`.
- Home Food DNA card uses `/profile/dna` fallback to `/profile`.
- Dedicated Food DNA page uses `/profile/dna`, `/profile/next-question`, `/profile/taste`, `/profile/taste/correct`.
- Settings mutates preferences and consent.
- Onboarding writes taste/preferences/profile answers.
- Achievements uses gamification.

Required architecture change:

- One profile domain module should own:
  - query keys,
  - profile summary mapper,
  - user fact labels,
  - consent hydration,
  - invalidation after profile-affecting mutations.

Do not keep business logic scattered in route pages.

## UX Redesign Recommendation

Recommended profile screen for launch:

1. Header
   - avatar/initial
   - name
   - guest or registered status
   - member since
   - edit button that works

2. Control strip
   - allergy guard active/incomplete
   - personalization on/off
   - profile completeness percentage

3. Food Profile card
   - compact Food DNA score
   - top 3 traits
   - "view details" navigates to `/food-dna`

4. What Garnish Knows
   - dietary pattern
   - allergies
   - dislikes
   - cooking time
   - skill
   - budget
   - each with edit/correct action

5. Progress
   - cooked
   - streak
   - achievements
   - no fake zeroes when data unavailable

6. Data and Privacy
   - consent status
   - export data
   - delete account

7. Quick links
   - favorites
   - real cooking history if implemented
   - support

Things to remove or defer:

- Dead "coming soon" cooking history.
- Internal Profile `DnaView` if `/food-dna` is canonical.
- Old localStorage profile store and old badge engine.
- Any visible control that cannot complete its task.

## Priority Plan

### Priority 1: Must Fix Before Launch

1. Make profile edit real or remove the button.
2. Add `createdAt` to `/users/me`.
3. Gate `/profile/dna` observed graph behind personalization consent.
4. Add server-read consent endpoint and hydrate settings from it, or at minimum block claims of verified consent state in UI.
5. Remove all "coming soon" controls from profile.

### Priority 2: Should Fix Before Serious International Release

1. Unify Food DNA UI path.
2. Centralize profile query keys/invalidation.
3. Strengthen DTO validation for profile/preferences.
4. Convert preferences arrays from JSON strings to typed arrays.
5. Separate gamification read from recompute.
6. Add profile-specific analytics events without PII.

### Priority 3: Can Follow After Launch

1. Full profile completeness checklist.
2. Rich correction UI for every learned taste/fact.
3. Advanced cooking history page.
4. Deeper accessibility/a11y automated tests.
5. Copy refinement and trust-language polish.

## Suggested Implementation Order

1. Backend contracts:
   - `/users/me` includes `createdAt`.
   - `/profile/dna` consent gate.
   - `GET /users/consent`.
   - DTO hardening.

2. Frontend data layer:
   - central query keys.
   - settings consent hydration.
   - invalidation after mutations.

3. Profile UI:
   - working edit sheet.
   - remove dead history row.
   - route DNA card to `/food-dna`.
   - add safety/control strip.

4. Cleanup:
   - delete stale profile localStorage code.
   - remove internal `DnaView` if unused.

5. QA:
   - API contract tests.
   - profile edit tests.
   - consent gating tests.
   - keyboard/a11y smoke.

## Acceptance Checklist

Global-level profile can be considered ready when:

- [ ] No visible profile action is dead.
- [ ] `/users/me` returns all fields the frontend expects.
- [ ] Profile edit works and invalidates UI caches.
- [ ] Food DNA observed behavior is hidden when personalization is not granted.
- [ ] Settings consent state is read from server.
- [ ] Profile, Food DNA, home, drawer, onboarding, and settings share coherent query keys.
- [ ] User can inspect/correct the major things Garnish knows about them.
- [ ] Allergy/diet safety status is visible and editable.
- [ ] No stale localStorage profile identity/badge system remains.
- [ ] Read endpoints do not perform surprising heavy writes, or the write behavior is explicitly bounded.
- [ ] Profile-specific analytics exist without PII.
- [ ] Keyboard and screen-reader basics pass.
- [ ] Tests cover API contract, profile mapper, edit mutation, consent gating.

## File Evidence Index

- `apps/web/src/app/profile/page.jsx:66-169` main profile view.
- `apps/web/src/app/profile/page.jsx:86` dead edit button.
- `apps/web/src/app/profile/page.jsx:159` dead cooking history row.
- `apps/web/src/app/profile/page.jsx:172-252` duplicate internal DNA view.
- `apps/web/src/app/profile/page.jsx:271-297` local view switch for profile/DNA.
- `apps/web/src/app/profile/useProfile.js:38-41` profile data queries.
- `apps/web/src/app/profile/useProfile.js:70` reads `createdAt`.
- `apps/server/src/users/users.service.ts:65-80` `/users/me` selected fields omit `createdAt`.
- `apps/server/src/users/users.controller.ts:21-25` profile update endpoint exists.
- `apps/server/src/users/dto/update-profile.dto.ts:4-15` weak profile DTO.
- `apps/server/src/users/dto/update-preferences.dto.ts:3-26` legacy string-based preferences DTO.
- `apps/web/src/app/settings/useSettings.js:15-18` local consent mirror limitation.
- `apps/web/src/app/settings/useSettings.js:96-113` consent toggle write path.
- `apps/server/src/behavior-engine/profile/read/profile-read.service.ts:113-145` consent-gated living profile hydration.
- `apps/server/src/behavior-engine/profile/read/profile-read.service.ts:164-181` Food DNA projection loads observations without local consent gate.
- `apps/server/src/recommendation/runtime-shadow/recommendation-shadow-a8-adapters.ts:60-77` signal observation loader.
- `apps/server/src/gamification/gamification.service.ts:145-147` gamification read calls recompute.
- `apps/web/src/hooks/useProfileQuery.js` stale profile hook.
- `apps/web/src/features/profile/services/profileStore.js` stale localStorage profile store.
- `apps/web/src/features/profile/services/badgeEngine.js` stale local badge engine.
- `apps/web/src/App.jsx:189-191` profile and Food DNA routes.
- `apps/web/src/shell/NavDrawer.jsx:88-92` drawer logout route.
- `apps/web/src/context/AuthContext.jsx:87-100` logout reset behavior.

## Final Practical Result

[قطعی] The next work packet should not be "make profile prettier." The right packet is:

1. Fix data contracts and consent gate.
2. Remove or implement dead controls.
3. Unify Food DNA routing.
4. Make profile a real control center for identity, safety, personalization, privacy, and progress.

Until those are done, the page is visually decent but not globally professional.
