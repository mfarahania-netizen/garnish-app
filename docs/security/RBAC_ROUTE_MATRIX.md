# RBAC Route Matrix (E3-0)

> Pre-work audit for **E3** (JWT/RBAC, W2). Read-only inventory of every HTTP route, its guards, role
> requirements, and current vs. intended access. **CA boundary (E3-0):** no behavior change here except
> the deny-by-default guard hardening shipped as E3; any change to a route's *intended* access is a
> **PS/F decision** and is marked `⚠ needs PS/F` below — not changed unilaterally.
>
> Generated 2026-06-13. Guard facts: only `ThrottlerGuard` is global (`APP_GUARD`). `RolesGuard` is
> applied on exactly two controllers (`admin`, `behavior-engine`), both with class-level `@Roles('admin')`.
> `RolesGuard` only understands the `admin` role → `user.isAdmin === true`.

## Legend
- **Access**: `public` (no auth) · `auth` (any logged-in user) · `admin` (isAdmin only).
- **Risk**: severity if current access is broader than intended.

## auth (`/auth`) — ThrottlerGuard only
| Method | Path | Guards | Roles | Current | Intended | Risk | Note |
|--------|------|--------|-------|---------|----------|------|------|
| POST | /auth/register | Throttler | — | public | public | — | correct (rate-limited 5/min) |
| POST | /auth/login | Throttler | — | public | public | — | correct |

## recipes (`/recipes`)
| Method | Path | Guards | Roles | Current | Intended | Risk | Note |
|--------|------|--------|-------|---------|----------|------|------|
| GET | /recipes | — | — | public | public | — | catalog browse |
| GET | /recipes/search | — | — | public | public | — | |
| GET | /recipes/my | AuthGuard | — | auth | auth | — | own recipes |
| GET | /recipes/:id | — | — | public | public | — | |
| POST | /recipes | AuthGuard | — | auth | auth | low | any user can create; confirm moderation expectations |
| PATCH | /recipes/:id | AuthGuard | — | auth | auth(owner) | **med** | ⚠ verify ownership check exists (no `@Roles`; owner-scoping must be in service) |

## users (`/users`) + upload (`/upload`) — all AuthGuard
| Method | Path | Current | Intended | Note |
|--------|------|---------|----------|------|
| GET | /users/me | auth | auth | self (sanitized, E2) |
| PATCH | /users/me | auth | auth | self |
| GET/PUT | /users/preferences | auth | auth | self |
| POST | /users/consent | auth | auth | self |
| DELETE | /users/me | auth | auth | self (GDPR; see R16 erasure) |
| POST | /upload/avatar | auth | auth | self |

## User-scoped feature controllers — all AuthGuard (correct)
`ai` (POST /ai/chat) · `analytics` (POST /analytics/event) · `favorites` (GET, POST/:recipeId, DELETE/:recipeId) ·
`meal-plans` (GET, POST, POST /slots, DELETE /slots/:d/:m, POST /generate) · `notifications` (GET, POST /generate, PATCH /:id/read, DELETE /:id) ·
`shopping-list` (GET, POST /items, PATCH /items/:id, DELETE /items/:id) · `support` (GET /tickets, GET /tickets/:id, POST /tickets, POST /tickets/:id/replies, PATCH /tickets/:id/close).
All require auth and must be **owner-scoped in the service layer** (verify `:id` handlers check ownership — flagged generically, not per-route).

## admin (`/admin`) — AuthGuard + RolesGuard + @Roles('admin') ✅
All 20 routes (dashboard, tickets, recipes approve/reject, users, analytics/*) are admin-only. Correct.
After E3 (deny-by-default), this is unchanged (class-level `@Roles('admin')` still resolves).

## behavior-engine — AuthGuard + RolesGuard + @Roles('admin') ✅
Admin-only. Correct.

## recommendation (`/recommendations`) — AuthGuard only ⚠
| Method | Path | Current | Intended | Risk | Action |
|--------|------|---------|----------|------|--------|
| GET | /recommendations | auth | auth | — | user-facing |
| POST | /recommendations/impression | auth | auth | — | user-facing |
| GET | /recommendations/lifestyle | auth | auth(self) | low | |
| GET | /recommendations/compare | auth | ? | low | |
| GET | /recommendations/embedding/:recipeId | auth | **admin?** | med | internal embedding inspection · ⚠ needs PS/F |
| POST | /recommendations/build-snapshots | auth | **admin/ops** | **HIGH** | triggers a batch job · ⚠ needs PS/F → gate behind admin |
| POST | /recommendations/run-signal-detector | auth | **admin/ops** | **HIGH** | triggers signal detector · ⚠ needs PS/F → gate |
| POST | /recommendations/build-identity | auth | **admin/ops** | **HIGH** | triggers identity build · ⚠ needs PS/F → gate |
| GET | /recommendations/debug-features | auth | **admin** | **HIGH** | exposes internal features · ⚠ needs PS/F → gate |
| GET | /recommendations/test-penalty/:recipeId | auth | **admin/debug** | med | debug endpoint · ⚠ needs PS/F → gate or remove |

## diagnostics (`@Controller()` → root paths) — AuthGuard only ⚠⚠
These 14 routes are mounted at the **root** path (no prefix) and require only auth. Several expose
system/governance/diagnostic data that is almost certainly admin-only.
| Method | Path | Current | Intended | Risk |
|--------|------|---------|----------|------|
| GET | /feature-vector | auth | self/admin? | med |
| GET | /signals | auth | self/admin? | med |
| GET | /outcomes | auth | self/admin? | med |
| GET | /feature-importance | auth | **admin** | high · ⚠ |
| GET | /lifestyle | auth | self | low |
| GET | /recommendation-quality | auth | **admin** | high · ⚠ |
| GET | /recommendation-reward | auth | **admin** | high · ⚠ |
| GET | /attribution | auth | **admin** | high · ⚠ |
| GET | /exposure-memory | auth | self/admin? | med |
| GET | /summary | auth | **admin** | high · ⚠ |
| GET | /metrics | auth | **admin** | high · ⚠ |
| GET | /governance | auth | **admin** | **HIGH** · ⚠ governance data exposed to any user |
| GET | /report | auth | **admin** | **HIGH** · ⚠ |
| GET | /review-report | auth | **admin** | **HIGH** · ⚠ |

> Additional note: the empty `@Controller()` prefix puts these on bare root paths, which also risks path
> collisions. Consider a `/diagnostics` (or `/admin/diagnostics`) prefix — UX/EL/PS to confirm.

## E3 actions
1. **Done in E3 (this PR):** `RolesGuard` made **deny-by-default** — if it is applied but no `@Roles` is
   declared, access is denied (fail closed). Behavior-preserving for current routes (admin/behavior-engine
   always declare `@Roles('admin')`).
2. **Flagged for PS/F (follow-up, not in this PR):** gate the `⚠ needs PS/F` ops/debug/governance endpoints
   in `recommendation` and `diagnostics` behind `RolesGuard + @Roles('admin')`, and move diagnostics under
   a non-root prefix. Tracked as **R18** in RISK_REGISTER.
3. **Verify (service layer):** owner-scoping on `:id` mutations (recipes PATCH, notifications, shopping-list,
   meal-plans, support) — confirm each checks `req.user` ownership. Out of scope for E3 guard work; flagged.
