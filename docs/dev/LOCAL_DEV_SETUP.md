# Local Dev Setup

One page. Follow it exactly to reproduce the verified green baseline.

## Prerequisites

- **Node ≥ 18** (CI uses 20).
- **pnpm 9.1.0** (pinned via `packageManager`). Install: `corepack enable && corepack prepare pnpm@9.1.0 --activate`.
- A local **PostgreSQL** with a `DATABASE_URL` in `apps/server/.env` (only needed to *run* the server / DB scripts — not for build or unit tests).

## The canonical sequence

```bash
git clone <repo> garnish-app
cd garnish-app

pnpm install --frozen-lockfile                       # exact lockfile, no drift
pnpm --dir apps/server exec prisma generate          # generate the Prisma client (pinned 5.22.0)
# equivalently: pnpm --dir apps/server run db:generate

pnpm build            # turbo build (server + web) — must exit 0
pnpm coverage:check   # backend↔frontend coverage gate — must exit 0
pnpm test             # jest — must be 142 suites / 1152 tests, 0 failures
```

A clean checkout that follows the above should reproduce: **build exit 0**, **coverage gate pass**, **1152/1152 tests**.

## ⚠️ Prisma: never use `npx prisma`

The repo is **pinned to Prisma `5.22.0`** (`prisma` + `@prisma/client`, exact, in `apps/server/package.json`).

- ✅ **Always** run Prisma via the locally-pinned binary:
  - `pnpm --dir apps/server exec prisma <cmd>` (e.g. `… exec prisma generate`)
  - or the script: `pnpm --dir apps/server run db:generate`
- ❌ **Never** run `npx prisma …`. `npx` resolves a **drifted global Prisma (v7.x)** which is breaking: v7 **rejects the `url` field in `datasource db`**, so `npx prisma generate` fails against this schema. The version pin is correct; the risk is the *invocation*.

CI already uses the correct local invocation (`pnpm --dir apps/server exec prisma generate`). This guard is for local dev habits.

## ⚠️ Clean-install verification — use an ISOLATED git worktree (never the primary checkout)

A clean-install check does `rm -rf node_modules && pnpm install`. If you run that in your primary
checkout **while `pnpm dev` is watching**, the watcher momentarily loses `@types/jest`/deps and prints a
transient `TS2688: Cannot find type definition file for 'jest'` (harmless, but noisy). Do it in a
throwaway worktree instead, so your primary `node_modules` (and dev server) are never touched:

```bash
git worktree add ../garnish-verify <branch>     # isolated checkout of the branch
cd ../garnish-verify
pnpm install --frozen-lockfile
pnpm --dir apps/server exec prisma generate
pnpm build            # prod build — compiles WITHOUT @types/jest (tsconfig.build.json types:["node"])
pnpm coverage:check
pnpm test             # tests DO see jest (base tsconfig types:["jest"] + ts-jest)
cd -
git worktree remove ../garnish-verify
```

> Build hygiene (SEARCH-L4-08): `tsconfig.build.json` sets `compilerOptions.types: ["node"]` so the prod
> build never pulls test (`jest`) globals; the base `tsconfig.json` keeps `["jest"]` for spec compilation
> via ts-jest / `nest start --watch`. Verified: the build file-graph contains 0 `@types/jest` entries.

> Note: `prebuild: prisma generate` is intentionally **not** wired — it would double-run with CI's
> dedicated `Generate Prisma client` step. Use `db:generate` (above) as the canonical local command.

## ⚠️ Do not keep the project inside OneDrive / Dropbox / iCloud

Cloud-sync folders lock files mid-write. The Prisma query-engine binary (`query_engine-*.dll/.node`) is
then **EPERM**-locked during `prisma generate` / install, producing intermittent `EPERM: operation not
permitted` failures that look like corruption. Keep the working copy on a **plain local path**
(e.g. `C:\dev\garnish-app`), not a synced folder.

## Coverage system (GARNISH-COVERAGE-03)

The living backend↔frontend↔design coverage matrix is generated from live code and is **blocking in CI**.

```bash
pnpm coverage:scan      # regenerate docs/coverage/coverage.generated.json (artifact)
pnpm coverage:check     # gate: exit 1 on UNREGISTERED / UNMAPPED (warns on orphans)
pnpm coverage:check -- --report   # full non-failing report (incl. deferred + must-render debt)
pnpm coverage:matrix    # regenerate docs/coverage/COVERAGE_MATRIX.md
```

- Hand-edit **only** `tools/coverage/coverage.registry.json` (the intent layer).
- `coverage.generated.json` and `COVERAGE_MATRIX.md` are **generated** — never hand-edit them.
- When you add a Recipe field or a non-internal endpoint, `coverage:check` fails until you register a
  deliberate decision (`frontend:<ref>` / `internal` / `admin` / `deferred:<epic>` / `must-render`).
  See `docs/execution/GARNISH_COVERAGE_03_REPORT.md`.
