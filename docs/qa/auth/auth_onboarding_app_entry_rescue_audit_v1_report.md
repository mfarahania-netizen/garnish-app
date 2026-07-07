# Auth, Onboarding & App Entry Rescue Audit Gate v1

Date: 2026-07-06  
Verdict: PASS  
Scope: audit only; no production deploy, no migration, no database mutation, no recipe/data change, no guest user creation.

## 1. Verdict

PASS for the audit gate.

Hard-pass criteria are met:

- Active auth/onboarding routes identified.
- Duplicate login/register/onboarding surfaces identified.
- Guest mode source identified.
- Onboarding repeat source identified.
- Drawer/auth duplication source identified.
- Proposed launch state machine written.
- Next implementation files listed.
- No production/db/migration/data mutation performed.
- Report created.

Important limitation: browser reproduction was run only in a DB-safe no-API mode (`VITE_API_URL=http://127.0.0.1:3999`). Full connected flows such as real guest mint, register, login, logout, and re-login were not executed because the current implementation creates real DB rows via `/auth/guest` and a test signup would mutate the local/dev DB. This is the correct constraint for this audit.

## 2. Current Branch / Head

| Item | Value |
| --- | --- |
| Worktree | `C:\dev\garnish-app` |
| Branch | `release/prisma-client-generation-build-v1` |
| HEAD | `195fd856` |
| Status at audit start | clean |
| Is this `master`? | No |
| Is this homepage redesign branch? | No |
| Homepage redesign actually running here? | No direct evidence in this worktree; this audit was performed on the current checked-out release/build branch. |

Recent commits observed:

- `195fd856 docs: finalize prisma client generation gate report`
- `65f2d14e merge: prisma client generation build fix`
- `6b8e014f chore: generate prisma client before server build`
- `90e225c5 docs: finalize dependency build approval gate report`
- `c831a9b5 merge: dependency build approval policy`

## 3. Runtime / Worktree Used

- Source files inspected directly from `C:\dev\garnish-app`.
- Browser evidence captured with web dev server only, API intentionally pointed at an unused port to prevent DB writes.
- Dev server command shape used for evidence: `VITE_API_URL=http://127.0.0.1:3999 pnpm --dir apps/web dev -- --host 127.0.0.1 --port 5176`.
- Server was stopped after screenshots.

## 4. Auth / Onboarding / Register / Login Routes

| Route | Component | Guard | Status | Notes |
| --- | --- | --- | --- | --- |
| `/onboarding` | `apps/web/src/app/onboarding/page.jsx` | Public | Active | First-run flow, also contains account/login/signup step through `useOnboarding`. |
| `/login` | `apps/web/src/app/login/page.jsx` | Public | Active | Standalone login/signup page using shared `AuthForm`. |
| `/admin` | `apps/web/src/app/admin/page.jsx` | Public route, internal auth gate | Active | Uses `AuthForm` with `allowSignup={false}` for admin login when not admin. |
| `/` | `HomePage` inside `RequireAuth` + `AppShell` | Protected | Active | Accessible to registered users; accessible to onboarded guests because guest gets token. |
| `/discover` | `DiscoveryPage` inside `RequireAuth` + `AppShell` | Protected | Active | Same gate as home. |
| `/recipes` | `RecipesPage` inside `RequireAuth` + `AppShell` | Protected | Active | Same gate as home. |
| `/profile` | `ProfilePage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/food-dna` | `FoodDnaPage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/plan` | `PlanPage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/shopping-list` | `ShoppingListPage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/favorites` | `FavoritesPage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/assistant` | `AssistantPage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/settings` | `SettingsPage` inside `RequireAuth` + `AppShell` | Protected | Active | Settings logout navigates to `/onboarding`, creating inconsistent exit behavior. |
| `/notifications` | `NotificationsPage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/support` | `SupportPage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/achievements` | `AchievementsPage` inside `RequireAuth` + `AppShell` | Protected | Active | Guest can enter after local onboarded flag. |
| `/recipe/:id` | `RecipeDetailPage` | Public | Active | Public recipe detail. |
| `/cook/:id` | `CookPage` inside `AppShell` but not `RequireAuth` | Public shell | Active | Public cook mode with app shell, so auth/nav behavior differs from other app pages. |
| `/terms`, `/privacy` | Legal pages | Public | Active | Linked from consent surfaces. |
| `/register` | None found | N/A | Not active | Signup is only a mode inside `/login` and onboarding account step. |

## 5. Duplicate Page Inventory

| File | Route | Status | Problem | Recommendation |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/login/page.jsx` | `/login` | Active | Canonical-looking standalone auth page, but it contains a `continue as guest` footer that sends users back to onboarding. | Keep as the single canonical login/signup route; remove user-facing guest footer for launch. |
| `apps/web/src/components/auth/AuthForm.jsx` | Used by `/login` and `/admin` | Active shared component | Password rule is 6 chars, while onboarding signup requires 8. Same account creation path has inconsistent validation. | Keep component, align validation with chosen policy. Recommendation: 8 chars in frontend and backend. |
| `apps/web/src/app/onboarding/page.jsx` | `/onboarding` | Active | Onboarding includes a separate account step, so user sees two auth experiences: onboarding auth and standalone login. | Keep onboarding questions; move auth to canonical `/login` or make final step a clean handoff, not a second auth form. |
| `apps/web/src/app/onboarding/useOnboarding.js` | Hook behind `/onboarding` | Active | Treats any token as `authed`; because AuthProvider silently mints guest tokens, a guest can be treated like an authenticated first-run user. | Split `registered authenticated` from `guest token`. Do not use `!!token` as completion/auth truth. |
| `apps/web/src/app/admin/page.jsx` | `/admin` | Active | Uses `AuthForm` for admin-only login. This is not a public duplicate but shares UI/validation code. | Keep, but ensure public `/login` changes do not break admin login. |
| `/register` route | None | Not present | User may expect it, but code uses `/login?mode=signup`. | Either add redirect `/register -> /login?mode=signup` or keep absent deliberately; document it. |

There are not many old file-level login/register pages in this branch. The real duplication is product-state duplication: standalone auth page, onboarding account step, admin auth gate, and guest entry all compete for the same mental model.

## 6. Guest Mode Source And Recommendation

Guest mode source:

- Frontend silent mint: `apps/web/src/context/AuthContext.jsx`
  - No token -> `POST /auth/guest`.
  - Stores `garnish.deviceKey`.
  - Stores `token`.
  - Sets `user`.
- Backend endpoint: `apps/server/src/auth/auth.controller.ts`
  - `POST /auth/guest`.
- Backend creation path: `apps/server/src/auth/auth.service.ts` -> `usersService.findOrCreateGuest`.
- DB row creation: `apps/server/src/users/users.service.ts`
  - `prisma.user.create({ data: { isGuest: true, deviceKey } })`.
- Schema support: `apps/server/prisma/schema.prisma`
  - `User.isGuest`
  - `User.deviceKey`.
- User-facing UI entries:
  - `/login` footer: "ادامه به‌عنوان مهمان" -> `/onboarding`.
  - Drawer footer for `user.isGuest`: "ورود / ثبت‌نام".

Answers:

| Question | Finding |
| --- | --- |
| Is guest user created in DB? | Yes. A real `User` row is created when `/auth/guest` is called without a resumable device key. |
| Is guest allowed into app? | Yes, after localStorage `garnish.onboarded === "true"`. |
| Is guest production-ready? | No. It is currently implemented as a production path, but its UX and data side effects are launch-risky. |
| Where is UI entry? | `/login` footer and indirectly `/onboarding`; silent entry also happens without user action. |
| What breaks because of guest? | Logout remints guest, onboarding repeats, DB fills with guest rows, drawer shows full app plus login/register, expired/banned sessions can degrade into guest flow. |

Recommendation: choose A.

Remove guest from user-facing launch UI and disable silent guest mint in production. Keep backend `/auth/guest` only behind a dev/test/demo flag if the team still needs it for smoke tests or AI evals.

Why: an app with food safety/allergy behavior should not silently create pseudo-users and then mix their state with registered-user onboarding. The current guest spine solves allergy filtering technically, but creates a bigger product/auth correctness problem.

## 7. Current State Machine

| State | First route shown | Storage key used | Backend endpoint called | Onboarding? | Login/register? | App accessible? | Drawer/bottom nav? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Anonymous new visitor, API up | Usually `/onboarding` after guest mint if gated route requested | `token`, `garnish.deviceKey`, later `garnish.onboarded` | `POST /auth/guest` | Yes if guest not onboarded | `/login` reachable; onboarding has auth step | Yes after local onboarded flag | Yes after app access |
| Anonymous returning visitor with deviceKey | Same guest resumed | `garnish.deviceKey`, `token` | `POST /auth/guest` with deviceKey | Depends on `garnish.onboarded` | Same | Yes if onboarded flag exists | Yes |
| Guest user | App or onboarding depending on local flag | `token`, `garnish.onboarded` | `/users/me`, `/profile`, etc. | Repeats if local flag missing | Drawer shows login/register footer | Yes after local flag | Full menu visible |
| Registered but not onboarded | App shell | `token` | `/users/me` | Not forced | Login/register not needed | Yes | Yes |
| Registered and onboarded | App shell | `token`, maybe stale local flag | `/users/me` | No | No | Yes | Yes |
| Logged out registered user | `logout()` clears token/deviceKey/onboarded, then AuthProvider can mint guest again | removes `token`, `garnish.deviceKey`, `garnish.onboarded` | next boot: `POST /auth/guest` | Yes | `/login` may appear, but guest path can re-enter | Eventually yes as guest | Guest drawer after onboarded |
| Expired token | Token removed after `/users/me` failure, then guest mint path can run | removes `token` | `/users/me`, then `/auth/guest` | Yes | Not a clear expired-session login | Eventually yes as guest | Guest drawer if completed |
| Invalid token | Same as expired | removes `token` | `/users/me`, then `/auth/guest` | Yes | Not a clear invalid-session login | Eventually yes as guest | Guest drawer if completed |
| Banned/deleted user | `jwt.strategy` rejects; client removes token; guest mint can follow | removes `token` | `/users/me`, then `/auth/guest` | Yes | Ban/deletion can be masked by guest fallback | Risk: yes as guest | Guest drawer risk |

Core flaw: the app lacks a clean anonymous state. No token should mean "not signed in"; current code turns it into "make a DB guest and continue".

## 8. Proposed Launch State Machine

Recommended launch flow:

1. No token -> public entry only: `/onboarding` or `/login`; no automatic `/auth/guest`.
2. User chooses signup/login -> `POST /auth/register` or `POST /auth/login`.
3. Backend returns user with explicit onboarding status, e.g. `onboardingCompletedAt` or `profileCompletedAt`.
4. Registered user with no completion -> route to `/onboarding`.
5. Registered user completes onboarding -> persist preferences/allergies/consent, then mark backend completion in the same success path.
6. Registered completed user -> app shell.
7. Logout -> clear token, clear auth-only cache, navigate `/login`; do not mint guest.
8. Expired/invalid token -> clear token, navigate `/login?reason=session-expired`; do not mint guest.
9. Banned/deleted user -> show account state/support message; never fall back to guest.
10. Guest/demo mode, if kept -> explicit "Demo mode" behind env flag, not silent and not mixed with production personalization.

Source of truth: backend, not localStorage.

LocalStorage may cache UI hints, but must not decide whether onboarding is complete. A user changing device, clearing storage, logging out, or using private mode must not lose server-known completion state.

## 9. Drawer / Menu Duplication Root Cause

There is no direct duplicate map loop in `NavDrawer`: `DRAWER_PRIMARY` and `DRAWER_SECONDARY` are each rendered once.

The duplication the user perceives comes from state and product surfaces:

- Guest gets a real token.
- `RequireAuth` lets onboarded guests into the full app.
- `NavDrawer` shows the full app menu to guest.
- The same drawer also shows a big "ورود / ثبت‌نام" footer for guest.
- `/login` also has a guest continuation footer.
- `/onboarding` also links to `/login`.

So the user sees app navigation and auth prompts at the same time. That is not a rendering-loop bug; it is a broken auth model.

## 10. Onboarding Repeat Root Cause

Root causes:

1. Completion is local-only: `localStorage.garnish.onboarded`.
2. `RequireAuth` checks onboarding only for guest users.
3. Registered users can bypass onboarding because there is no backend completion check.
4. `logout()` removes `garnish.onboarded`, so the next boot restarts first-run behavior.
5. AuthProvider silently mints a fresh guest after token removal, which sends users back into onboarding instead of a clean login screen.
6. Private mode, storage clearing, new device, or expired token all lose/skip the local completion truth.

The backend currently exposes `/users/me`, preferences, allergies, consent, and profile data, but no durable onboarding completion field.

## 11. Login / Register Old Page Root Cause

Finding: no separate legacy `/register` route was found.

The "old page" feeling is caused by multiple active auth surfaces:

- Standalone `/login` page using `AuthForm`.
- Signup mode inside the same `/login` page.
- Account step inside onboarding.
- Admin login also using `AuthForm`.
- Guest continuation button sending users back into onboarding.

The UI can look old/inconsistent because password rules and copy differ:

- `AuthForm` signup min password: 6.
- Onboarding signup min password: 8.
- `/login` offers guest continuation.
- Onboarding welcome links to `/login`.

Recommendation: one public account surface for launch: `/login` with login/signup tabs or modes. Onboarding should collect profile data and hand off to `/login` only if account is required.

## 12. Screenshots / Evidence Paths

Browser evidence captured without backend mutation:

- `C:\dev\garnish-app\docs\qa\auth\screenshots\auth-entry-audit-v1\01-onboarding-entry-no-api.png`
- `C:\dev\garnish-app\docs\qa\auth\screenshots\auth-entry-audit-v1\02-login-entry-no-api.png`
- `C:\dev\garnish-app\docs\qa\auth\screenshots\auth-entry-audit-v1\03-root-anonymous-no-api.png`

Connected-flow screenshots intentionally not captured:

- app after real login
- drawer logged in
- drawer logged out after real logout
- onboarding after real register

Reason: current implementation would create guest DB rows on anonymous load and user rows on signup. This audit explicitly forbids DB mutation and guest creation.

## 13. Exact Implementation Plan For Next Sprint

Priority 1 - launch blockers:

1. Stop silent guest minting in production.
   - In `AuthContext`, no token should mean `user=null`, `token=''`, `isLoading=false`.
   - `/auth/guest` should not be called automatically.

2. Add durable onboarding completion source.
   - Add backend field such as `User.onboardingCompletedAt` or `UserProfile.profileCompletedAt`.
   - Include it in `/users/me` response.
   - Add a guarded endpoint to mark completion after successful onboarding persistence.

3. Update `RequireAuth`.
   - If no token -> `/login` or `/onboarding` depending on product decision.
   - If registered but incomplete -> `/onboarding`.
   - If registered and complete -> app.
   - Remove localStorage-only guest condition.

4. Normalize auth UI.
   - Keep `/login` as canonical login/signup.
   - Remove user-facing "continue as guest".
   - Make onboarding account step either removed or a handoff button to `/login?mode=signup&from=/onboarding`.

5. Fix logout.
   - Logout should clear token/session and route to `/login`.
   - It should not clear server onboarding truth.
   - It must not cause guest remint.

Priority 2 - quality and regression:

6. Align password validation across onboarding, `AuthForm`, and backend DTO.
7. Add tests for auth state machine:
   - no token does not call `/auth/guest`
   - registered incomplete redirects to onboarding
   - registered complete enters app
   - logout routes to login without guest mint
   - expired token routes to login with reason
8. Update drawer tests:
   - no guest full menu in production
   - no duplicate auth CTA
   - logged-in drawer shows logout only

Priority 3 - optional later:

9. Keep explicit demo/guest mode behind `VITE_ENABLE_GUEST_MODE` and backend `ENABLE_GUEST_AUTH`.
10. Add `/register` redirect only if marketing/deep links need it.

## 14. Files That Should Be Changed Next

Frontend:

- `apps/web/src/context/AuthContext.jsx`
- `apps/web/src/shell/RequireAuth.jsx`
- `apps/web/src/app/onboarding/useOnboarding.js`
- `apps/web/src/app/onboarding/page.jsx`
- `apps/web/src/app/login/page.jsx`
- `apps/web/src/components/auth/AuthForm.jsx`
- `apps/web/src/shell/NavDrawer.jsx`
- `apps/web/src/app/settings/useSettings.js`
- `apps/web/src/app/profile/page.jsx`
- `apps/web/src/app/profile/useProfile.js`
- Auth/onboarding/drawer tests under `apps/web/src/**`

Backend:

- `apps/server/prisma/schema.prisma`
- new Prisma migration for onboarding completion
- `apps/server/src/users/users.service.ts`
- `apps/server/src/users/users.controller.ts`
- `apps/server/src/common/serializers/user.serializer.ts`
- `apps/server/src/auth/auth.controller.ts`
- `apps/server/src/auth/auth.service.ts`
- auth/users tests under `apps/server/src/**`

## 15. Files That Should Be Deleted / Redirected Later

Do not delete in the audit. Later:

- Remove guest footer from `apps/web/src/app/login/page.jsx`.
- Remove or convert onboarding account step in `apps/web/src/app/onboarding/page.jsx`.
- If a `/register` route is introduced, make it a redirect to `/login?mode=signup`, not a second page.
- Do not delete `AuthForm`; keep as shared implementation for `/login` and `/admin`.
- Do not delete backend guest code immediately if eval/dev scripts still depend on it; gate it behind env and remove public/silent access.

## 16. Risks

| Risk | Severity | Why it matters | Mitigation |
| --- | --- | --- | --- |
| Silent guest user creation | P0 | Creates DB rows, masks logged-out/expired/banned states, confuses UX. | Disable automatic guest mint in production. |
| LocalStorage onboarding truth | P0 | New device/storage clear/logout causes repeat or bypass. | Backend completion field. |
| Registered users bypass onboarding | P0 | App may run without allergy/personalization setup. | `RequireAuth` must check backend completion for registered users. |
| Guest sees full app shell | P1 | User thinks they are logged in but still sees login/register CTA. | Remove user-facing guest or mark explicit demo mode. |
| Logout remints guest | P1 | User cannot get a clean logged-out state. | No guest mint after token removal. |
| Inconsistent password rules | P2 | Signup fails inconsistently and feels broken. | One validation policy. |
| Admin uses shared auth component | P2 | Changes to public auth can break admin gate. | Keep admin-specific tests. |
| Current browser connected test blocked | P2 | Full UI proof requires mutation unless fixed. | After implementation, use one existing smoke account and no guest mint. |

## 17. Hard Blockers Before Homepage Merge / Launch

For pure visual homepage merge, this auth audit is separate. For launch readiness, these are blockers:

1. Silent production guest mint must be removed or hard-gated.
2. Onboarding completion must be backend-backed.
3. Registered incomplete users must not bypass onboarding.
4. Logout must not create a new guest session.
5. User-facing guest CTA must be removed unless product explicitly chooses demo mode.
6. One canonical login/signup path must be established.
7. Password validation must be consistent.
8. Regression tests must cover no-token, incomplete, complete, expired, logout, and admin auth states.

## Final Recommendation

Do not patch this by moving buttons around. The right fix is a small auth architecture correction:

- remove silent guest from production,
- make backend onboarding completion the source of truth,
- keep `/login` as the canonical account screen,
- make onboarding only collect profile/safety data,
- route expired/logout states to login, not guest/onboarding.

This is a P0/P1 launch rescue, not a cosmetic redesign.
