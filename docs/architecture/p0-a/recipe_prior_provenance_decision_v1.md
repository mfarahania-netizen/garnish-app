# Recipe-prior provenance decision v1

Status: **Accepted for P0-A Gate v2**

Decision: **Option B — fail-neutral and disabled at the ranking consumer**

Owner: Recipe-Prior Contract Reviewer

Date: 2026-07-13

## Decision

`RankingService` must not call or consume the current `RecipePriorSource`.
Every candidate receives the neutral recipe-prior value `0.5`, regardless of
source registration, `L1_RECIPE_PRIOR_ENABLED`, or a non-zero Step 5 weight.

This decision remains in force until recipe-prior output carries real,
verifiable provenance and the ranker validates it against current consent.

## Why Option A is not valid in this gate

The current source returns only `Map<string, number> | null`. The value has no:

- evidence observation timestamp;
- evidence source identity;
- analytics and personalization purpose provenance;
- consent policy version;
- analytics and personalization grant epochs;
- proof that the aggregate excludes withdrawn, stale-policy, or pre-regrant
  observations.

`RecipePrior.updatedAt` is not a substitute. It is an aggregate row write time,
not the observation time or consent epoch of the contributing evidence. Using
request time, row update time, or a synthetic timestamp would fabricate the
missing relationship.

Adding sufficient provenance requires a storage and producer contract, likely
including schema/versioning and population rebuild rules. Gate v2 forbids a
migration, backfill, or broad product redesign, so Option A cannot be completed
honestly inside this scope.

## Current runtime contract

The P0-A ranking consumer has these invariants:

1. A registered legacy `RecipePriorSource` is not called.
2. `scores.recipePrior` is `0.5` for every candidate.
3. The default linear recipe-prior weight remains `0`.
4. Setting `L1_RECIPE_PRIOR_ENABLED` or `L1_PRIOR_STEP5_WEIGHT` cannot bypass
   the provenance gate.
5. A missing or throwing source cannot affect the ranking request.

The pure `recipePriorSlateTerm` helper remains tested only as dormant future
score math. Direct unit invocation of that helper is not authorization to read
or consume optional data.

## Future activation contract

Activation requires a separately reviewed implementation. Before any source is
called or value is used, all of the following must be true and testable:

1. Both optional runtime switches are ON before optional database I/O.
2. The target user has current-policy analytics and personalization grants.
3. The returned value has a real evidence envelope containing at minimum:
   `observedAt`, `source`, consent purpose(s), `policyVersion`, and the grant
   epoch(s) under which its evidence was observed.
4. The envelope is compatible with the current analytics and personalization
   grant epochs. Evidence before withdrawal/regrant or under a stale policy is
   rejected.
5. Population and cohort aggregates prove that their contributing observations
   were selected from a current-consent population; target-user consent alone
   does not legitimize stale training evidence.
6. Person-scoped priors cannot survive withdrawal/regrant as usable evidence
   unless they were rebuilt entirely from the new epoch.
7. Any validation error, missing field, mixed epoch, unknown source, runtime
   change, or source failure returns neutral `0.5` and performs no optional
   write.
8. Optional producer writes and any materialization/enqueue path use the shared
   per-user transactional consent boundary where a user-scoped write exists.

Future activation tests must include: valid current evidence; missing each
required envelope field; stale policy; pre-regrant observation; withdrawal
between validation and use; analytics-only or personalization-only consent;
runtime OFF before I/O; mixed-epoch aggregate; throwing source; and a neutral
fallback that is output-identical to no source.

The existing executable negative activation test is deliberate: even with
current joint consent and activation flags, a legacy value-only source remains
uncalled and neutral. A future positive test may replace that expectation only
in the same reviewed change that introduces the real evidence contract.

## Scope boundary and residual risk

This ADR closes only the `RankingService` consumption decision. It does not
claim that direct calls to `RecipePriorService.valuesForSlate` or
`RecipePriorLearnerService.refresh` are consent-safe. The optional-processing
inventory identifies those paths as unresolved gaps; they must remain disabled
or be closed by the transaction-boundary/gap-classification owners.

No production code, database schema, migration, backfill, recipe data, or
ingredient data is changed by this decision.
