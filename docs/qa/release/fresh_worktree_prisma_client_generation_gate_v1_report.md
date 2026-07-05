# Fresh Worktree Prisma Client Generation Gate v1

## 1. Verdict
PASS

[قطعی] Root cause was a missing/non-deterministic Prisma Client generation step before `apps/server` build in a fresh worktree. The durable fix is a minimal server package `prebuild` script that runs Prisma Client generation from the actual server schema before `nest build`.

## 2. Base origin/master Hash
- `origin/master`: `90e225c5f56590efd39bccbe7c62cc1bcdf3c88b`
- short: `90e225c5`
- `origin/main`: not present in the prior fresh-master run

## 3. Worktree / Branch
- Diagnostic fresh worktree: `C:\dev\garnish-homepage-launch-v1-rerun`
- Fix worktree: `C:\dev\garnish-app`
- Fix branch: `chore/prisma-client-generation-build-v1`

## 4. Prisma Layout
- Schema path: `apps/server/prisma/schema.prisma`
- Generator provider: `prisma-client-js`
- Generator output: default output, no custom `output` configured
- Server import path: `import { PrismaClient } from '@prisma/client';`
- Prisma service: `apps/server/src/prisma/prisma.service.ts`

## 5. Existing Package Scripts Before Fix
- `apps/server/package.json` had:
  - `"build": "nest build"`
  - `"db:generate": "prisma generate"`
- The server build script did not run Prisma Client generation.

## 6. Generate Command Used
```bash
pnpm --dir apps/server exec prisma generate --schema=prisma/schema.prisma
```

This is non-mutating. No `migrate`, `db push`, `db pull`, seed, import, recipe data change, ingredient data change, or database mutation was run.

## 7. Baseline Results
From fresh `origin/master` worktree before implementation:

```bash
pnpm --dir apps/web build
```

Result: PASS

```bash
pnpm --dir apps/server build
```

Result: FAIL

First meaningful error:

```text
prisma/prisma.service.ts:2:10 - error TS2305:
Module '"@prisma/client"' has no exported member 'PrismaClient'.
```

Representative follow-on errors:

```text
Property '$connect' does not exist on type 'PrismaService'.
Property 'recipe' does not exist on type 'PrismaService'.
Property 'user' does not exist on type 'PrismaService'.
```

## 8. Generate / Build Proof
Manual generate created the Prisma Client from `apps/server/prisma/schema.prisma`.

After generate:

```bash
pnpm --dir apps/server build
```

Result: PASS

There were no tracked schema, migration, data, or source behavior changes after manual generation.

## 9. Windows File Lock Note
[قطعی] During generated-clean validation, an existing local dev stack was running from `C:\dev\garnish-app`, including `node --env-file=.env --enable-source-maps dist/src/main.js`. That process locked `query_engine-windows.dll.node`, causing:

```text
EPERM: operation not permitted, rename ... query_engine-windows.dll.node.tmp... -> query_engine-windows.dll.node
```

The local dev stack was stopped. Codex runtime was not stopped. After that, generated artifacts could be removed and regenerated cleanly.

## 10. Durable Fix Chosen
Option A: add server `prebuild` script.

File:

```text
apps/server/package.json
```

Change:

```json
"prebuild": "prisma generate --schema=prisma/schema.prisma"
```

Reason:
- Schema lives in `apps/server/prisma/schema.prisma`.
- `pnpm --dir apps/server build` runs from `apps/server`.
- No schema or import change is needed.
- No root script is necessary.

## 11. Generated-Clean Validation
Removed generated Prisma client artifacts only:

```text
apps/server/node_modules/.prisma/client
apps/server/node_modules/@prisma/client/.prisma
node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client
```

Then ran:

```bash
pnpm --dir apps/server build
```

Result: PASS

Evidence:

```text
✔ Generated Prisma Client (v5.22.0) ...
$ prisma generate --schema=prisma/schema.prisma
$ nest build
```

## 12. Web Build Result
```bash
pnpm --dir apps/web build
```

Result: PASS

Summary:

```text
✓ built in 4.94s
PWA generateSW completed
```

## 13. Targeted Test Result
```bash
pnpm --dir apps/server exec jest src/recipes/search/tfidf.spec.ts --runInBand
```

Result: PASS

Summary:

```text
Test Suites: 1 passed, 1 total
Tests: 11 passed, 11 total
```

## 14. Files Changed
Intended commit files:

```text
apps/server/package.json
docs/qa/release/fresh_worktree_prisma_client_generation_gate_v1_report.md
```

Explicitly not changed:

```text
apps/server/prisma/schema.prisma
apps/server/prisma/migrations/**
recipe data
ingredient data
import/seed scripts
Homepage/UI files
docs/qa/recipes/global_143_pre_apply_backup_v0_1.json
node_modules generated files
```

## 15. Git Status After Generate
Tracked changes before report:

```text
 M apps/server/package.json
```

No generated Prisma client files were tracked.

## 16. Commit / Merge / Push
To be completed after staging the two intended files only.

## 17. Homepage Sprint Eligibility
[قطعی] Homepage Launch Redesign Sprint v1 is allowed to resume only after this fix is committed, merged to `master`, pushed, and fresh baseline builds pass from `origin/master`.

## 18. Remaining Risks
- If a local dev server is running and holding Prisma query engine files, Windows can still block Prisma engine replacement. This is an operator/process hygiene issue, not a source-code issue.
- The durable fix covers `pnpm --dir apps/server build`; other custom build paths must either call that script or run Prisma generate explicitly.

## 19. Hard PASS Criteria

| Criterion | Result |
|---|---|
| root cause confirmed/resolved | PASS |
| no migration/db mutation | PASS |
| no schema/migration/data changed | PASS |
| generated files not committed | PASS |
| server build PASS from generated-clean state | PASS |
| web build PASS | PASS |
| targeted server test PASS | PASS |
| minimal package script/report files only | PASS |
| master push PASS | PENDING |
| report created | PASS |
