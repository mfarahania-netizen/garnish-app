# Recommendation consent-epoch containment

## Verdict

`[قطعی] PASS (focused lane)` — recommendation history, cached vectors, experiment assignments, and derived writes are bounded to the latest joint analytics + personalization grant epoch.

## Implemented boundaries

- `[قطعی]` Candidate UserEvent reads require `timestamp >= max(analyticsGrant, personalizationGrant)`; a withdrawal/re-grant during source reads discards the personalized slate and serves the generic safety-filtered fallback.
- `[قطعی]` Ranking rejects cached feature vectors older than the joint epoch, filters popularity events by epoch, uses only epoch-valid experiment assignments, and suppresses contribution writes if the epoch changes.
- `[قطعی]` Learned weight and recipe-prior interfaces currently expose no timestamp/provenance, so ranking treats them as default/neutral instead of consuming unverifiable history.
- `[قطعی]` Evaluation and reward queries bound Attribution `occurredAt`, Exposure `viewedAt`, FeatureContribution `createdAt`, UserEvent `timestamp`, and Outcome `recordedAt` to the epoch.
- `[قطعی]` UserOutcome, FeatureContribution, ServedItem, and ExperimentAssignment writes re-check exact epoch equality immediately before mutation/retry; experiment assignment also performs post-write cleanup if the epoch changes during mutation.
- `[قطعی]` Existing experiment assignments without a valid `createdAt`, or older than the epoch, return default weights.

## Verification

```text
Focused Jest group 1: 5 suites passed, 47 tests passed
Focused Jest group 2: 2 suites passed, 15 tests passed
Total: 7 suites, 62 tests passed
```

`[قطعی]` `pnpm.cmd --dir apps/server build`: PASS, including Prisma generation and Nest build.

`[قطعی]` Focused ESLint with `--quiet`: PASS. Targeted `git diff --check`: PASS.

## Scope and residual risk

- `[قطعی]` No recipe/content, metrics, exposure/controller, outbox, production, migration, staging, commit, or push operation was performed.
- `[قطعی]` Public aggregate trending remains provenance-filtered and time-windowed but is not personalized history; per-user recommendation consumption is epoch-bounded.
- `[احتمالاً]` WeightSource and RecipePriorSource should later add explicit evidence timestamps to their interfaces; until then the safe behavior is neutral/default, which intentionally disables those optional learned inputs.
