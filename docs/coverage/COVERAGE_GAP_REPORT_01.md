# Coverage Gap Report 01

> First payoff of the GARNISH-COVERAGE-03 system. Generated from live code via
> `node tools/coverage/coverage-check.mjs --report` (non-failing report mode) +
> `coverage.generated.json`. Date: 2026-06-15.
>
> This is the input to upcoming L4 design/feature sprints. The coverage **gate**
> (`pnpm coverage:check`) is **green** — everything below is either acknowledged
> debt (`must-render`), intentionally deferred (`deferred:<epic>`), or an
> informational orphan. None of it blocks; all of it is now *tracked*, not lost.

## Scan snapshot

| Metric | Value |
|---|---|
| Prisma models | 52 |
| Recipe fields | 37 (27 scalar + 10 relations) |
| Endpoints | 91 across 19 controllers (9 internal) |
| Frontend routes | 17 (11 protected) |
| Frontend API call sites | 67 |
| Events | backend 117 / frontend 116 |
| Gate | **PASS** — UNREGISTERED 0, UNMAPPED 0 |
| Coverage | mapped 55 · internal 15 · admin 39 · deferred 8 · must-render 2 |

---

## 1. Recipe fields NOT surfaced on the detail page

The heuristic render scan (`apps/web/src/app/recipe/[id]/**`) found **18 of 27 scalar fields
rendered**. The 10 below are not rendered on the detail page, each with its deliberate registry decision.
The **three audit-flagged "dropped features"** are called out first.

### 🔴 The real dropped-feature debt (the reason this system exists)

| Field | Registry decision | Why it's debt |
|---|---|---|
| `Recipe.author` | **must-render** | Authorship attribution is stored but rendered **nowhere**. Belongs as a recipe-detail byline. |
| `Recipe.categories` | **must-render** | Secondary category tags stored but rendered **nowhere** (note: `category` *singular* IS rendered in the hero). |
| `Recipe.videoUrl` | **deferred:E-recipe-media** | Stored but rendered **nowhere**. Deferred to a recipe media/gallery epic (decision: defer, not must-render — no video pipeline yet). |

### Other not-rendered fields (deliberately classified, not debt)

| Field | Registry decision | Reason |
|---|---|---|
| `Recipe.imageUrl` | frontend:recipe-card/RecipeCard | Surfaced on recipe cards/list; the detail hero uses a gradient (so the detail-scoped heuristic doesn't see it). |
| `Recipe.status` | admin | Recipe moderation status (admin approval workflow). |
| `Recipe.adminNote` | admin | Admin moderation note; never user-facing. |
| `Recipe.authorId` | internal | FK column backing the `author` relation (the relation is the user-facing concept). |
| `Recipe.isPublic` | internal | Server-side visibility filter; not a rendered field. |
| `Recipe.updatedAt` | internal | ORM-managed mutation timestamp. |
| `Recipe.createdAt` | deferred:E-recipe-metadata | Could surface as "added on"; deferred. |

---

## 2. Orphan endpoints (non-internal endpoint with no detected frontend caller)

**27** of 82 non-internal endpoints have no matching `apiClient` call. Annotated with the registry
decision so genuine gaps are distinguishable from admin/dynamic-call cases.

### Genuine "no frontend consumer" gaps (the to-surface candidates)

| Endpoint | Decision | Note |
|---|---|---|
| `PATCH /recipes/:id` | deferred:E-recipe-edit-ui | Edit endpoint exists; no frontend edit UI (add-recipe does create only). |
| `GET /users/me/export` | deferred:E-gdpr-self-service | GDPR data-export endpoint; no self-service export UI. |
| `DELETE /users/me` | deferred:E-gdpr-self-service | Account-erasure endpoint; no self-service delete UI. |
| `GET /support/tickets/:id` | deferred:E-support-ticket-detail | Single-ticket detail; UI uses list + replies only. |
| `POST /recommendations/impression` | deferred:E-recommendation-impression-api | Frontend emits impressions via the analytics event pipeline (`trackEvent`), not this endpoint. |
| `GET /recommendations/lifestyle` | deferred:E-recommendation-lifestyle | Placeholder; lifestyle graph not yet available. |

### Admin surface (called via the admin dashboard; some via dynamic paths the matcher can't resolve)

`PATCH /admin/recipes/:id/approve`, `PATCH /admin/recipes/:id/reject` (called via a dynamic
`${id}/${action}` path in `RecipesTab`), and the entire `RecommendationDiagnosticsController`
(`/attribution`, `/exposure-memory`, `/feature-importance`, `/feature-vector`, `/governance`,
`/lifestyle`, `/metrics`, `/outcomes`, `/recommendation-quality`, `/recommendation-reward`,
`/review-report`, `/signals`, `/summary`) plus the admin maintenance triggers
(`POST /recommendations/build-identity|build-snapshots|run-signal-detector`). All **admin** — not a
product gap. `GET /report` and `GET /recommendations/compare` (sibling diagnostics) *are* detected as
called by the admin `IntelligenceTab`.

### Internal dev probes (intentionally no frontend)

`GET /recommendations/debug-features`, `GET /recommendations/embedding/:recipeId`,
`GET /recommendations/test-penalty/:recipeId` — developer diagnostics / placeholders → **internal**.

> Heuristic note: the frontend-call matcher resolves `${...}`/`:param` segments to `*` but cannot
> resolve a **dynamically chosen path segment** (e.g. `/admin/recipes/${id}/${action}`), so admin
> approve/reject read as orphans. They are correctly classified `admin` and are not a product gap.

---

## 3. Orphan events

| Event | Side | Action |
|---|---|---|
| `resolve_miss` | backend-only (in `event-taxonomy.ts`, missing from `eventTaxonomy.js`) | Decide: add to the frontend taxonomy if the client should emit it, or document it as a backend-only (E11 ingredient-resolver) telemetry event. |

Backend taxonomy has **117** event types, frontend **116**; the single delta is `resolve_miss`.

---

## 4. Prioritized "to-surface" backlog (feeds upcoming L4 sprints)

1. **P1 · Recipe authorship + tags on the detail page** — surface `Recipe.author` (byline) and
   `Recipe.categories` (tag chips). These are the audit's literal "dropped features"
   (`must-render`). Smallest, highest-signal win.
2. **P1 · GDPR self-service UI** (`E-gdpr-self-service`) — wire `GET /users/me/export` (download my
   data) and `DELETE /users/me` (delete my account). Backend is built and privacy-gate-closed (R16);
   only the UI is missing. Compliance-relevant.
3. **P2 · Recipe edit UI** (`E-recipe-edit-ui`) — `PATCH /recipes/:id` exists; add an edit flow to
   `my-recipes` (currently create-only).
4. **P2 · Recipe media** (`E-recipe-media`) — `Recipe.videoUrl` storage exists; build the media
   pipeline + detail-page player/gallery.
5. **P3 · Support ticket detail** (`E-support-ticket-detail`) — `GET /support/tickets/:id` for a
   dedicated detail view.
6. **P3 · Event taxonomy parity** — reconcile `resolve_miss` across the two taxonomies.
7. **P3 · Recommendation impression wiring** (`E-recommendation-impression-api`) — decide whether the
   viewport-impression endpoint should be wired directly, or stays superseded by the analytics pipeline.

---

## How to regenerate

```bash
pnpm coverage:check -- --report   # this report's source data (non-failing)
pnpm coverage:matrix              # the full living matrix → docs/coverage/COVERAGE_MATRIX.md
```

Each future feature sprint should end with `pnpm coverage:check` green, moving entries here from
`must-render` / `deferred:` → `frontend:<ref>` as they get surfaced.
