# Dependency Build Approval Policy Gate v1 Report

## 1. Verdict
PASS

## 2. Base Branch / Hash
- Base branch: `origin/master`
- Branch: `chore/dependency-build-approval-policy-v1`
- Base hash: `a1d7e216`
- `origin/main`: not present

## 3. Runtime
- pnpm: `11.7.0`
- node: `v26.1.0`

## 4. ignored-builds Output Before Approval
`pnpm ignored-builds` in the clean homepage worktree reported exactly:

```text
Automatically ignored builds during installation:
  @nestjs/core
  @prisma/engines
  unrs-resolver
  core-js
  prisma
```

No additional package appeared.

## 5. Approved Packages
- `@nestjs/core`
- `@prisma/engines`
- `core-js`
- `prisma`
- `unrs-resolver`

Already approved before this gate:

- `@prisma/client`

## 6. Final allowBuilds Entries

```yaml
allowBuilds:
  '@nestjs/core': true
  '@prisma/client': true
  '@prisma/engines': true
  core-js: true
  prisma: true
  unrs-resolver: true
```

## 7. Files Changed
- `pnpm-workspace.yaml`
- `docs/qa/release/dependency_build_approval_policy_gate_v1_report.md`

No lockfile or package manifest churn.

## 8. Backup File Untouched Status
- `docs/qa/recipes/global_143_pre_apply_backup_v0_1.json` was not touched, staged, modified, deleted or committed.

## 9. Rebuild Result
Command:

```bash
pnpm rebuild @nestjs/core @prisma/engines core-js prisma unrs-resolver @prisma/client
```

Result: PASS

## 10. Web Build Result
Command:

```bash
pnpm --dir apps/web build
```

Result: PASS

Summary:

```text
vite v8.0.14 building client environment for production...
✓ built in 6.51s
PWA generateSW completed
```

## 11. Server Build Result
Command:

```bash
pnpm --dir apps/server build
```

Result: PASS

Summary:

```text
$ nest build
```

## 12. Test Result
Full test suite was not run.

Targeted web tests:

```bash
pnpm --dir apps/web exec vitest run src/app/recipe/[id]/ingredientDisplayPresenter.test.js src/app/recipe/[id]/recipeDetailPresenter.test.js src/app/recipe/[id]/recipeActionCopy.test.js src/components/ges/ingredientAmountDisplay.test.js src/app/food-dna/dna-fa.test.js
```

Result:

```text
Test Files 5 passed (5)
Tests 31 passed (31)
```

Targeted server test:

```bash
pnpm --dir apps/server exec jest src/recipes/search/tfidf.spec.ts --runInBand
```

Result:

```text
Test Suites: 1 passed, 1 total
Tests: 11 passed, 11 total
```

## 13. Approval Commit Hash
- `1b2487ee`

## 14. Integration Branch
- `release/dependency-build-approval-policy-v1`
- Merge commit before final report update: `c831a9b5`

## 15. Master Push Result
PASS

Push result:

```text
a1d7e216..c831a9b5  HEAD -> master
```

No force push was used.

## 16. Remaining Risks
- Full test suite was not run in this gate.
- Some pnpm bin creation warnings appeared during install/build preparation, but the required builds completed successfully.
- This gate changes dependency build approval policy only; it does not validate the homepage redesign itself.

## 17. Homepage Sprint Allowed Next
YES.

[قطعی] Dependency build approval policy is now on `origin/master`; Homepage Launch Redesign Sprint v1 can be retried from a fresh `origin/master` worktree.

## 18. Hard PASS Criteria

| Criterion | Result |
|---|---|
| ignored-builds contained only expected packages | PASS |
| only expected packages were approved | PASS |
| pnpm-workspace diff minimal | PASS |
| backup file untouched | PASS |
| no recipe/ingredient/migration/server/UI change | PASS |
| dependency rebuild PASS | PASS |
| web build PASS | PASS |
| server build PASS | PASS |
| merge with origin/master clean | PASS |
| no force push | PASS |
| master push PASS | PASS |
| report created | PASS |
