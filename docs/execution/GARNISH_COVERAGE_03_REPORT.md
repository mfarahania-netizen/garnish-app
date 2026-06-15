# GARNISH-COVERAGE-03 — Live Backend↔Frontend↔Design Coverage Matrix + CI Truth-up + Prisma Hygiene

> Execution report. Branch `exec/garnish-coverage-03`. Date 2026-06-15.
> **Scope: tooling + CI + docs only.** No product features, no behavior change,
> no `runtime-shadow/**` business-logic change, no DB schema change/migration,
> no new runtime dependency. Built on the verified GREENBUILD-02 baseline.

## Mission

Make it impossible to silently drop a backend capability from the frontend/design —
today or two years from now — via a **living, generated-from-code, CI-blocking** coverage
system. Secondarily: guard Prisma against drifted `npx` invocation, and make CI reflect the
now-green test reality.

The audit that motivated this: the Recipe model has **37 fields** and the backend exposes
**91 endpoints / 19 controllers**; `recipe.videoUrl`, `recipe.author`, `recipe.categories`
are **stored but rendered nowhere** — dropped because no map existed. This system is that map,
and it is enforced.

---

## The three layers

**Layer 1 — Generator** (`tools/coverage/coverage-scan.mjs`, dev-only Node, no new dependency).
Parses **live code** deterministically and writes `docs/coverage/coverage.generated.json`
(overwritten each run, stable ordering, no network/timestamps). It uses the `typescript`
compiler already installed for `apps/server` (resolved from its `node_modules`) for robust AST
parsing of NestJS controllers + React routes, and plain regex for the Prisma schema, API call
sites, events, and the Recipe render heuristic.

- **Models/fields** — every `model` in `schema.prisma`, scalar/enum fields (type, optional) kept
  separate from `relations`.
- **Endpoints** — `@Controller` + `@Get/@Post/@Put/@Patch/@Delete` → full path, verb, controller,
  guard annotations (`@UseGuards`/`@Roles`/`@Public`), `internal/`-prefix flag.
- **Routes** — `App.jsx` `<Route>` → path, page component, `ProtectedRoute`/`AdminRoute` flag.
- **Frontend API calls** — `apiClient.get/post/put/patch/delete('/…')` across `apps/web/src`
  (tolerates fluent/multiline `apiClient\n.get(...)`); normalizes `${…}`/`:param` → `*`.
- **Recipe rendered fields (heuristic)** — identifier matching under
  `apps/web/src/app/recipe/[id]/**` (the audit's method). Per-field rendered yes/no + files.
  Documented as **heuristic, not proof** — the registry is the source of intent.
- **Events** — backend `event-taxonomy.ts` enum vs frontend `eventTaxonomy.js` object →
  shared / backend-only / frontend-only (orphans).

Modes: `--json` (default; always writes the JSON) and `--md` (also emits a markdown view).

**Layer 2 — Registry** (`tools/coverage/coverage.registry.json`, the **only** hand-maintained file).
A deliberate decision + one-line `reason` per capability. Status grammar:

| Status | Meaning | Gate behaviour |
|---|---|---|
| `frontend:<route/component>` | Must surface AND is verified mapped (route/call) or rendered (Recipe detail heuristic) | Losing the mapping → **UNMAPPED block** |
| `must-render` | Belongs on the frontend but **not yet surfaced** — acknowledged debt | Non-blocking; in gap report |
| `internal` | Never user-facing (FKs, internal flags, dev probes, shadow/governance internals) | Non-blocking |
| `admin` | Admin-only surface (admin dashboard / RolesGuard) | Non-blocking |
| `deferred:<epic>` | Intentionally postponed to a named epic | Non-blocking; in gap report |

Field-level coverage is enforced for `trackedFieldEntities` (currently **Recipe**); other models are
tracked at the model level. `internal/`-prefix endpoints are auto-classified `internal`.

**Layer 3 — Enforcer** (`tools/coverage/coverage-check.mjs` + `coverage-matrix.mjs`).
`coverage:check` runs the generator, diffs live-code-vs-registry, and **exits 1** on a blocking
violation. `coverage:matrix` writes the living `docs/coverage/COVERAGE_MATRIX.md`
(`Capability | Backend | Frontend | Design (GES ref) | States(L/E/Err) | Status`).

---

## Exact gate policy (founder decision: UNREGISTERED + UNMAPPED block)

| Signal | Definition | Policy |
|---|---|---|
| **UNREGISTERED** | A tracked Recipe field or a non-internal endpoint exists in code but is absent from the registry | **BLOCK (exit 1)** |
| **UNMAPPED** | Registry says `frontend:<ref>` but the frontend neither routes to / calls it (endpoint) nor renders it (Recipe detail field) | **BLOCK (exit 1)** |
| **ORPHAN_ENDPOINT** | A non-internal endpoint the frontend never calls | warn (lists every instance, annotated with its decision) |
| **ORPHAN_EVENT** | An event defined on one taxonomy side only | warn |
| **STALE_REGISTRY** | Registry references a capability no longer in code | warn |

Both block conditions were proven during build: a deliberately-misclassified `frontend:` endpoint
with no caller → UNMAPPED exit 1 (then corrected to `deferred:`); removing a registry endpoint entry →
UNREGISTERED exit 1 (then restored). The committed registry makes `coverage:check` exit **0** — gaps
live as `deferred:` / `must-render`, not as a red build — while `videoUrl/author/categories` stay
visible in the gap report.

> A `frontend:recipe-detail/*` field is verified via the detail-page render heuristic. A `frontend:*`
> field on another surface (e.g. `recipe-card`) is treated as mapped-but-unverified, since the heuristic
> only scans the detail page — documented, not silently trusted.

---

## Scanned counts

| Metric | Value |
|---|---|
| models | **52** |
| Recipe fields | **37** (27 scalar + 10 relations) |
| endpoints | **91** across **19** controllers (**9** internal) |
| routes | **17** (16 page routes + 1 layout; 11 protected) |
| frontend API call sites | **67** |
| events | backend **117** / frontend **116** |

## Coverage tally (committed registry)

```
mapped=55  internal=15  admin=39  deferred=8  must-render=2
UNMAPPED=0  UNREGISTERED=0  orphanEndpoints=27  orphanEvents=1
```

- `mapped` = 37 endpoints + 18 Recipe detail fields verified rendered.
- `internal` = 3 endpoint + 3 field decisions + 9 internal-prefix endpoints.
- `admin` = 37 endpoints + 2 fields (`status`, `adminNote`).
- `deferred` = 6 endpoints + 2 fields (`videoUrl`, `createdAt`).
- `must-render` = `Recipe.author`, `Recipe.categories` (the live dropped-feature debt).
- `orphanEndpoints` (27) breaks down as: ~19 admin (called via the admin dashboard, some via
  dynamic `${id}/${action}` paths the matcher can't resolve), 3 internal dev probes, 5 genuine
  deferred gaps (recipe-edit, GDPR export/delete, support-detail, recommendation impression/lifestyle).
- `orphanEvents` (1) = `resolve_miss` (backend-only).

## Known dropped fields surfaced

| Field | Decision | Rationale |
|---|---|---|
| `Recipe.videoUrl` | **deferred:E-recipe-media** | Stored, rendered nowhere; no media pipeline yet → deferred to a named epic (not must-render). |
| `Recipe.author` | **must-render** | Authorship attribution stored, rendered nowhere → flagged live debt (recipe-detail byline). |
| `Recipe.categories` | **must-render** | Secondary tags stored, rendered nowhere (`category` singular IS rendered) → flagged live debt. |

Full backlog: `docs/coverage/COVERAGE_GAP_REPORT_01.md`.

---

## Prisma hygiene (Phase 1)

- Added `apps/server` script **`db:generate": "prisma generate"`**. The canonical local command is
  `pnpm --dir apps/server run db:generate` (or `… exec prisma generate`) — **never `npx prisma`**
  (npx resolves a drifted global Prisma v7 that rejects `url` in the schema).
- **`prebuild` intentionally not added** — it would double-run with CI's dedicated
  `Generate Prisma client` step.
- Version unchanged (pinned `5.22.0`). No schema change, no migration.
- New `docs/dev/LOCAL_DEV_SETUP.md`: the canonical sequence + the `npx prisma` and OneDrive/Dropbox
  EPERM warnings.

## CI changes (Phase 5) — `.github/workflows/ci.yml`

1. **Added** a `Coverage gate` step after `Build` → `run: pnpm coverage:check`, **no
   `continue-on-error`** (blocking).
2. **Flipped Test:** removed `continue-on-error: true` — R19 is closed, the suite is green
   (142/1152), so a test failure now fails CI. Stale R19 comment updated.
3. **Lint** stays `continue-on-error: true` (R20 format debt, out of scope); comment updated to
   describe R20 accurately.

No duplicate workflow; reused the existing pnpm/Node/cache setup.

---

## Files added / changed

**Added**
- `tools/coverage/coverage-scan.mjs` — generator (Layer 1)
- `tools/coverage/coverage.registry.json` — intent registry (Layer 2, hand-maintained)
- `tools/coverage/coverage-check.mjs` — diff gate (Layer 3)
- `tools/coverage/coverage-matrix.mjs` — matrix writer (Layer 3)
- `docs/coverage/coverage.generated.json` — generated artifact (do not hand-edit)
- `docs/coverage/COVERAGE_MATRIX.md` — generated matrix (do not hand-edit)
- `docs/coverage/COVERAGE_GAP_REPORT_01.md` — first gap report (Phase 6)
- `docs/dev/LOCAL_DEV_SETUP.md` — one-page setup + Prisma/OneDrive guards
- `docs/execution/GARNISH_COVERAGE_03_REPORT.md` — this report

**Changed**
- `package.json` — added `coverage:scan` / `coverage:check` / `coverage:matrix` scripts
- `apps/server/package.json` — added `db:generate` script
- `.github/workflows/ci.yml` — added blocking Coverage gate; removed Test `continue-on-error`; updated Lint/Test comments
- `docs/execution/RISK_REGISTER.md` — added the standing Coverage-Gate control; R19 closed / R20 open / R-E1 pending reaffirmed
- `docs/execution/DECISION_LOG.md` — every future feature sprint ends with `coverage:check` green

No source, spec, schema, or `runtime-shadow/**` file was modified.

---

## Clean-install verification (Phase 7, verbatim)

```
$ rm -rf node_modules apps/server/node_modules apps/web/node_modules packages/shared/node_modules
  rm_done exit=0

$ pnpm install --frozen-lockfile
  Done in 41.7s
  install exit=0

$ pnpm --dir apps/server exec prisma generate          # npx NOT used
  ✔ Generated Prisma Client (5.22.0)
  prisma exit=0

$ pnpm build
  Tasks: 2 successful, 2 total
  build exit=0

$ pnpm coverage:check
  scanned: models=52 recipeFields=37 endpoints=91(internal 9) routes=17 events=B117/F116
  coverage: mapped=55 internal=15 admin=39 deferred=8 must-render=2 | UNMAPPED=0 UNREGISTERED=0 orphanEndpoints=27 orphanEvents=1
  COVERAGE GATE PASSED. (warnings/debt non-blocking)
  coverage exit=0

$ pnpm test
  Test Suites: 142 passed, 142 total
  Tests:       1152 passed, 1152 total
  Time:        42.103 s
  test exit=0

# version confirmation (local exec, NOT npx):
$ pnpm --dir apps/server exec prisma --version
  prisma          : 5.22.0
  @prisma/client  : 5.22.0
```

---

## Commands

```bash
pnpm install --frozen-lockfile
pnpm --dir apps/server exec prisma generate     # NEVER npx prisma
pnpm build
pnpm coverage:check        # blocking gate
pnpm coverage:matrix       # regenerate the matrix doc
pnpm test
node tools/coverage/coverage-scan.mjs --json|--md
pnpm coverage:check -- --report   # non-failing full report
```

## Verdict

`COVERAGE_03_PASS` — see the verdict block in the PR / handoff. runtime-shadow logic untouched;
Prisma version unchanged; tests green; coverage gate green and blocking.
