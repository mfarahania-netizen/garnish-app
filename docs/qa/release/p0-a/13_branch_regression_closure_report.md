# P0-A v2 branch regression closure report

Status: **PASS — all Agent-C branch regression suites are green**

## Scope and ownership

Agent C changed only the files assigned to `Branch Regression Engineer` in
`10_v2_file_ownership.csv`:

- `apps/server/src/test-support/p0-a-epoch-fixture.ts`
- the five named recommendation regression specs
- `apps/server/src/analytics/event-producer-inventory.spec.ts`
- `apps/server/src/auth/auth.service.spec.ts`
- `apps/server/src/admin/observability.service.spec.ts`
- this report

No production service, schema, migration, seed, recipe data, or assertion was
weakened. No stage, commit, or push was performed.

## Frozen starting evidence

The first owned-lane run used:

```text
CI=true
NODE_OPTIONS=--max-old-space-size=8192
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:1/garnish_p0a_guarded
pnpm.cmd test -- --runInBand <8 Agent-C suites>
```

Result: **0/8 suites passed; 46/60 tests passed; 14 failed; Jest 23.977s;
shell 29s**. This 14-failure Agent-C subset reconciles with the frozen 18
branch-only failures because the other four failures were in the two
recipe-prior suites owned by Agent D.

Failure attribution:

- nine recommendation assertions were neutralized by missing joint grant epoch
  and runtime fixtures;
- four analytics producer tests lacked stateful `userEvent.update` provenance
  promotion;
- the OTP fixture omitted the persisted `onboardingCompletedAt` field;
- the observability test asserted the older, weaker relation predicate.

## Contract repairs

### Canonical epoch-aware fixture

`p0-a-epoch-fixture.ts` now owns the single deterministic optional-processing
test contract:

- analytics grant: `2026-07-01T00:00:00.000Z`;
- personalization grant: `2026-07-01T00:00:01.000Z`;
- both grants use the server-owned current privacy-policy version and
  `source=settings`;
- joint epoch: the later personalization grant;
- persisted event timestamp: `2026-07-01T00:00:02.000Z`, after the joint epoch;
- both optional runtime switches are explicitly enabled and restored;
- `hasPurpose` and `currentGrantEpoch` fail closed for unknown or runtime-disabled
  purposes.

The transaction factory is production-build compatible and has no dependency on
Jest globals. Its backward-compatible signature is:

```ts
makeP0ATransactionBoundaryPrisma<
  TDelegates extends Record<string, unknown>,
>(
  delegates: TDelegates,
  userId = 'u1',
  grantRows: readonly P0ATestGrantRow[] = p0ACurrentGrantRows(userId),
)
```

The optional third argument lets a focused spec supply current-policy grant rows
whose timestamps match its local epoch without duplicating lock/transaction
mechanics. `purpose` and `status` accept TypeScript's widened strings from
generated arrays, but the fixture validates the closed runtime sets
`analytics|personalization` and `granted|withdrawn`; an invalid row throws and
cannot manufacture a grant.

All five named recommendation specs consume this fixture. The two specs using
`RankingService.rank()` also expose a real fresh `UserFeatureVector.updatedAt`
after the joint epoch; they do not bypass the production freshness check.

### Analytics producer promotion

The Prisma harness is stateful across `userEvent.create`, `update`, `delete`, and
`findUnique`. The fixture creates the event under analytics provenance and
models the production promotion to personalization. The contract now asserts
both the analytics create and the explicit personalization update. Both writes
run through the canonical interactive-transaction harness, including bounded
transaction setup, canonical User-row lock, and current-policy grant rows. The
intermediate analytics state is never committed independently.

### OTP persisted response shape

The persisted User schema contains `onboardingCompletedAt DateTime?`, and
`sanitizeUser` deterministically derives `onboardingComplete` when that field is
present. The OTP fixture now returns `onboardingCompletedAt: null` and models the
real `usersService.findById` reread. The stable API assertion remains
`onboardingComplete === false`; the serializer was not changed.

### Observability predicate

The assertion now requires, inside each subject branch:

```text
userId
observedAt >= grant epoch
event.consentPurpose = personalization
event.timestamp >= grant epoch
```

No event timestamp or provenance bound was removed.

### Recipe-prior decision (Agent D evidence)

Agent D selected Option B: recipe-prior remains fail-neutral/disabled unless a
real evidence envelope contains `observedAt`, source, purpose set, policy
version, and compatible joint epoch. `updatedAt` is explicitly rejected as
consent provenance. Agent D reported **2/2 suites and 19/19 tests passed; Jest
49.47s; shell 64.3s**. Agent C did not edit the recipe-prior files.

## Verified focused results

| Command scope | Result | Jest time | Shell time |
|---|---:|---:|---:|
| `l0-loop.integration.spec.ts` + `fi-step-1-ranker-effect.spec.ts` | 2/2 suites, 3/3 tests PASS | 50.77s | 59.9s |
| `fi-phase-2-3-ingredient-soft-taste.spec.ts` + `fi-phase-2-2-effort-skill-graft.spec.ts` | 2/2 suites, 17/17 tests PASS | 41.41s | 56.3s |
| `admin/observability.service.spec.ts` | 1/1 suite, 8/8 tests PASS | 15.669s | 20s |
| Agent D recipe-prior lane | 2/2 suites, 19/19 tests PASS | 49.47s | 64.3s |
| **Final combined Agent-C lane after structural grant-row repair** | **8/8 suites, 60/60 tests PASS** | **17.871s** | **20.8s** |

An intermediate all-owned rerun overlapped in-progress Agent B production
edits. It therefore had transient TypeScript failures in Agent B-owned files
(`analytics.service.ts`, `users.service.ts`) and is not counted as a final
Agent-C test result. Agent C did not modify those production files.

Two later combined attempts also caught real in-progress contract drift before
the final green run:

- SignalCalculator's new production transaction boundary required the two
  write-side harnesses to use the canonical transaction fixture; after repair,
  those two suites passed 11/11 tests;
- a Coordinator-owned `ProfileReadService` type error allowed `core` to reach an
  optional-only boundary. Agent C reported rather than editing it. Coordinator
  fixed it by explicitly separating core from optional purposes, without a cast.

Neither failed attempt is represented as PASS evidence.

## Final command and result

```text
CI=true
NODE_OPTIONS=--max-old-space-size=8192
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:1/garnish_p0a_guarded
pnpm.cmd test -- --runInBand \
  src/recommendation/recommendation-requestid-capstone.spec.ts \
  src/recommendation/pipeline/fi-phase-2-3-ingredient-soft-taste.spec.ts \
  src/recommendation/pipeline/fi-phase-2-2-effort-skill-graft.spec.ts \
  src/recommendation/pipeline/l0-loop.integration.spec.ts \
  src/recommendation/pipeline/fi-step-1-ranker-effect.spec.ts \
  src/analytics/event-producer-inventory.spec.ts \
  src/auth/auth.service.spec.ts \
  src/admin/observability.service.spec.ts
```

Final result: **8/8 suites, 60/60 tests, zero snapshots, zero failures; Jest
17.871s; shell 20.8s**.

Final server build after the fixture stopped depending on Jest globals:
**PASS; shell 34.7s**, including Prisma generation and `nest build`.

Full server `tsc --noEmit --incremental false` after accepting Coordinator
grant-row builders: **PASS; shell 19.4s**.

Together with Agent D's independently owned 2/2 recipe-prior suites and 19/19
tests, all 18 frozen branch-regression failures have direct green owner evidence.

## Integrity checks

- repository `git diff --check`: PASS;
- repository `git diff --cached --check`: PASS;
- generated analytics/profile artifacts: no new tracked modification;
- staged files: zero;
- stage/commit/push: not performed.

This report closes only the Gate v2 branch-regression lane. It does not claim
the transaction, browser, full-differential, or adversarial gates on behalf of
their owners.

## Coordinator full-suite confirmation

The final branch full-server suite passed twice with deterministic membership: 300 executed suites and 2,593 executed tests passed in each run, with one suite and ten tests intentionally skipped and zero failures. The clean base failed the same two serializer/export suites and three tests in both runs. The branch therefore adds zero server failure and closes all 18 frozen branch-owned failures; it also fixes the three deterministic base serializer/export failures without weakening the asserted API contract.

The release verdict is still not PASS because report 16 records a browser-environment blocker.
