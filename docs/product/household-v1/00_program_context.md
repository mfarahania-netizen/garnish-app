# Garnish Household OS v1 — Program Context and Phase 0 Reality Gate

## Reality check

**Confidence: certain.** Stage B cannot start from the current base. The required P0-A work is not merged or committed: `origin/master` remains at the audited hash, while the separate P0-A worktree contains a large uncommitted diff. The current program branch is cleanly based on `origin/master`, so Stage A is valid but product-code implementation is not.

## Repository identity

| Item | Verified value |
|---|---|
| Fetch | `git fetch --all --prune` completed 2026-07-13 |
| Current `origin/master` | `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab` |
| Program branch | `program/household-os-v1` |
| Program worktree | `C:\Users\mfara\.codex\worktrees\5464\garnish-app` |
| Program base | current `origin/master` |
| Initial worktree state | clean, detached at current `origin/master` |
| Program branch creation | `git switch -c program/household-os-v1 origin/master` |
| Master changed by program | no |
| Production touched | no |

The current Codex worktree was already a new isolated worktree at the latest fetched `origin/master`; creating the named program branch in that isolated worktree preserves the requested clean-base guarantee without touching older checkouts.

## P0-A merge and worktree status

**Verdict: FAIL.** The local branch `fix/p0-a-safety-consent-session-isolation-v1` points to the same base commit `1631dc5d`; its separate worktree contains extensive modified and untracked frontend, backend, test, and report files. There is no committed P0-A delta in `origin/master` and no remote P0-A branch shown by the fetched remote refs.

The program has not copied or modified that dirty worktree. Its contents were inspected read-only only to confirm status and locate the prior audit records.

## Prerequisite gate

| # | Prerequisite | Current verdict | Evidence / required proof |
|---:|---|---|---|
| 1 | P0-A merged or equivalent protections proven | FAIL | `origin/master` is still the audited `1631dc5d`; P0-A changes are uncommitted in another worktree. |
| 2 | Account A → logout → Account B isolation | FAIL / UNPROVEN | Current logout clears auth keys but does not clear React Query, other user-scoped local storage, or Cache Storage; no two-account browser proof exists on this base. |
| 3 | Consent/default-off | FAIL | Current audited base contains coupled/default-granted personalization and non-authoritative client toggles; P0-A fixes are not merged. |
| 4 | Private PWA/API cache isolation | FAIL | `apps/web/vite.config.js` applies Workbox `NetworkFirst` to `/api/**` using one `api-cache`; current logout does not purge it. |
| 5 | Current origin/master builds | PASS | `pnpm.cmd build` passed server Prisma/Nest and web Vite/PWA builds in 75.777s. This is a compile/build result, not a performance PASS. |
| 6 | Relevant tests pass or blockers documented | PARTIAL / BLOCKER DOCUMENTED | Relevant server suites passed 15/15 (89 tests) and relevant web files passed 5/5 (27 tests), but full `pnpm.cmd test` failed on four existing Food DNA/onboarding smoke assertions; critical two-account and DB race suites do not exist on this base. |
| 7 | Household data isolated by membership | FAIL | No household, membership, invite, capability, or household-scoped resource model exists. |
| 8 | Local/dev DB clearly separated from production | PARTIAL / UNPROVEN | `.env.example` and Docker Compose target localhost, but the worktree has no `.env`, no disposable-DB harness was verified, and the Compose volume is persistent. No DB command was run. |
| 9 | No dirty P0-A worktree used as base | PASS | Program branch was created from the clean, isolated Codex worktree at fetched `origin/master`. |

Because prerequisites 1, 2, 3, 4, and 7 fail independently, no later successful build can authorize Stage B in this program run.

## Current topology

- Monorepo: pnpm + Turbo.
- Backend: NestJS 11, Prisma 5.22, PostgreSQL, scheduled jobs, optional Redis-backed cache/rate limiting.
- Frontend: React 19, Vite 8, TanStack Query 5, Mantine, PWA via `vite-plugin-pwa`/Workbox.
- Authentication: JWT in `localStorage`; server validates `sessionEpoch` for administrative invalidation.
- Tenancy: user-owned rows (`userId`); no household tenant boundary.
- Realtime delivery: none. There is a database-backed analytics/behavior `EventOutbox`, but no WebSocket, SSE, or client event stream.
- Notifications: persisted in-app `Notification` rows plus cron/INE decision logic; no push provider. Real send is controlled by a default-off environment flag, but user notification toggles are local-only and are not scheduler source of truth.
- Offline: Workbox response caching exists; there is no durable mutation queue, ordering protocol, reconciliation UI, or account-partitioned private cache.

## Current data model summary

- `MealPlan` is unique by `(userId, weekStart)`.
- `MealSlot` has no unique `(mealPlanId, dayOfWeek, mealType)` constraint and uses delete-then-create application logic.
- `ShoppingList` is one-to-one with a user; `ShoppingItem` has no version/idempotency/semantic uniqueness fields.
- `PantryItem` is user-owned and has no semantic uniqueness constraint.
- `Notification` stores basic title/body/type/read/data only; there are no preference, delivery, dedupe, action, or receipt models.
- No `Household`, membership, invite, share, advisor, shopping-session, decision-request, plan-version, or idempotency model exists.

## Recheck of named launch findings

The prior audit artifacts are not committed on `origin/master`; they currently exist inside the separate dirty P0-A worktree. Therefore their text is supporting context, not the sole proof. Direct inspection of the unchanged audited source confirms:

- `GAR-LAUNCH-004..006`: still applicable on this base; critical onboarding/settings allergy persistence behavior is not replaced by merged P0-A code.
- `GAR-LAUNCH-007..008`: still applicable on this base; purpose-scoped analytics/personalization consent fixes are unmerged.
- `GAR-LAUNCH-009`: still applicable; authenticated `/api/**` remains `NetworkFirst` cached and logout does not purge private caches.
- `GAR-LAUNCH-020`: still applicable; notification preferences remain local-only and server scheduling does not consume them.
- `GAR-LAUNCH-063`: still applicable; `MealSlot` lacks the composite DB uniqueness constraint.
- `GAR-LAUNCH-064`: still applicable; shopping/pantry semantic dedupe is read-before-create without a race-safe database identity.

## Phase 0 verdict

`PREREQUISITE_FAIL_CONTINUE_STAGE_A_ONLY`

Stage A must finish. Stage B must remain untouched. The expected program verdict is `DESIGN_COMPLETE_IMPLEMENTATION_BLOCKED_BY_PREREQUISITE` unless the base itself changes through an authorized, separately proven P0-A merge; this program will not bypass the gate by importing a dirty worktree.
