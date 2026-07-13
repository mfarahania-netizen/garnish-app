# P0-A v2 active GAP classification report

Status: **PHASE 5 PASS on the current source tree — not a release PASS**

Audit basis: the current branch source after the coordinator's transaction-boundary and scheduler-guard integrations, cross-checked against `08_optional_processing_consumer_inventory.csv`. The inventory has 150 rows; 81 unique source rows contain at least one explicit `GAP` marker. This phase classifies those 81 rows only and does not replace focused, PostgreSQL, full-suite, browser or adversarial validation.

## Classification result

| Classification | Rows |
| --- | ---: |
| `ACTIVE_GATED` | 36 |
| `ACTIVE_UNGATED_P0` | 0 |
| `READ_ONLY_FILTERED` | 14 |
| `DEFERRED_WITH_KILL_SWITCH` | 21 |
| `RUNTIME_DISABLED` | 5 |
| `LEGACY_DISABLED` | 5 |
| `UNKNOWN_REQUIRES_OWNER` | 0 |
| **Total** | **81** |

Integrity checks:

- source rows: **81**
- duplicate `source` values: **0**
- blank owners: **0**
- blank evidence paths: **0**
- unknown classifications: **0**
- invalid taxonomy values: **0**

The row-level owner, rationale, runtime control, transaction disposition and evidence paths are recorded in `14_gap_classification.csv`.

## Hard-gate result

| Required condition | Result | Current-tree evidence |
| --- | --- | --- |
| zero `ACTIVE_UNGATED_P0` | **PASS — 0 rows** | exact remaining list is empty |
| zero active optional writer outside the shared transaction boundary | **PASS for classified active paths** | active event, signal, feature, profile, ranking, exposure, evaluation and notification mutations either own the shared boundary or receive its locked transaction client |
| zero active scheduler that discovers users while runtime OFF | **PASS** | SignalDetector, behavior/outbox, recommendation evaluator, outcome and notification schedulers return before their respective user/optional-table discovery paths |

This Phase 5 PASS is conditional on all default-OFF controls named in deferred rows remaining OFF. For the four newly contained writers this explicitly includes `OPTIONAL_SMART_SUGGESTIONS_ENABLED` and `OPTIONAL_DERIVED_OUTCOMES_ENABLED`, in addition to canonical consent-purpose runtime gates. It is not authorization to enable deferred consumers.

## Re-audit of the former 22 P0 rows

### 16 rows moved to `ACTIVE_GATED`

1. `EventOutboxService.processNow`: derived writes are delegated to EventRouter's locked boundary. Outbox done/suppressed/retry status transitions are control-plane completion and hygiene, not authorization for a new optional payload.
2. `BehaviorEngineScheduler.drainOutbox`: personalization OFF returns before calling drain; EventOutbox checks both canonical switches before queue I/O; routed mutations are locked.
3. `EventRouterService.route`: the only production caller of processor `process`; it opens the joint-purpose boundary, validates event timestamp/provenance against the locked grant epoch and passes the transaction client.
4–8. The five signal processors require the locked transaction client. Their observations, attribution rows and signal-calculator changes all reuse that transaction; repo-wide production call search found only EventRouter.
9. `SignalDetectorService.detectBatchSignals`: both runtime switches are checked before logs/user discovery. The stale-signal delete and health write share one expected-epoch boundary; the explorer write uses another expected-epoch boundary.
10. `TasteCorrectionService.correctTastePreference`: non-neutral upsert is locked with expected epoch. Neutral delete remains available as a user-initiated privacy/control operation after opt-out.
11. `FeatureStoreService.rebuildFeatureVector`: vector upsert plus feature delete/create replacement execute in one expected-epoch transaction.
12. `ProfileReadService.submitAnswer`: core declarations remain core; optional preference and fact upserts use a purpose-specific expected-epoch boundary.
13. `RankingService.logFeatureContributions`: `FeatureContributionLog.createMany` is inside the joint expected-epoch boundary.
14. Recommendation evaluator scheduler checks both switches before `user.findMany`.
15. Recommendation quality outcome creation is inside the joint expected-epoch boundary and its inputs are epoch-bounded.
16. Recommendation reward outcome creation is inside the joint expected-epoch boundary and its inputs are epoch-bounded.

### 2 rows moved to `LEGACY_DISABLED`

- `IdentityDimensionBuilder.buildAll`: no production caller exists; only module registration/export and tests reference it. A boundary is present, but source-epoch review is still required before activation.
- `GamificationService.recomputeForUser`: neither it nor `evaluateNotifications` has a production caller; the live controller exposes read-only `getSummary`. Its writer is locked, but pre-regrant input reuse still forbids activation.

### 4 rows moved to `DEFERRED_WITH_KILL_SWITCH`

- `NotificationsService.generateSmartSuggestion`: `OPTIONAL_SMART_SUGGESTIONS_ENABLED` is exact-true and default-OFF before consent or suggestion I/O. The final notification create is locked, but profile/plan/favorite inputs still lack a grant-epoch provenance contract. The focused spec contains a direct zero-consent/zero-suggestion-I/O contract for the dedicated switch.
- The health, behavior and adherence outcome crons check exact-true, default-OFF `OPTIONAL_DERIVED_OUTCOMES_ENABLED` before consent or `user.findMany`, then apply the canonical personalization gate. Their final `UserOutcome` creates are locked, while meal-plan/shopping source inputs remain not fully bounded to the current grant epoch. The shared outcome spec contains a direct zero-user-discovery contract for the dedicated switch.

These four are not active approvals. Their dedicated switches must remain OFF until the input provenance gap is closed. The canonical personalization runtime remains an additional fail-closed gate, not the sole containment mechanism.

## Scheduler OFF-before-discovery audit

| Scheduler | Earliest gate | Discovery after gate | Disposition |
| --- | --- | --- | --- |
| Signal detector | analytics + personalization | `user.findMany` | gated |
| Behavior profile cron | personalization | `UserEvent.findMany` | gated |
| Outbox drain cron | personalization outer gate; analytics + personalization inside EventOutbox | `EventOutbox.findMany` | gated |
| Recommendation evaluator | analytics + personalization | `user.findMany` | gated |
| Three outcome crons | `OPTIONAL_DERIVED_OUTCOMES_ENABLED`, then personalization | `user.findMany` | dedicated default-OFF containment; locked writer; deferred for input epoch |
| Three notification crons | personalization | `user.findMany` | gated; real send remains independently default OFF |

## Deferred means activation is prohibited

The 21 `DEFERRED_WITH_KILL_SWITCH` rows are contained, not approved. They include optional profile/AI/briefing/gamification/meal-plan enrichments, analytics population aggregates, smart suggestions and outcome derivations that still lack a complete current-epoch/current-population input contract. Smart suggestions are specifically contained by `OPTIONAL_SMART_SUGGESTIONS_ENABLED`; all three derived-outcome crons are specifically contained by `OPTIONAL_DERIVED_OUTCOMES_ENABLED`.

Turning on analytics, personalization, `OPTIONAL_SMART_SUGGESTIONS_ENABLED`, `OPTIONAL_DERIVED_OUTCOMES_ENABLED`, INE real send, shadow mode, or another affected feature flag without first closing the corresponding CSV row invalidates this Phase 5 classification.

## Exact remaining ACTIVE_UNGATED list

**None.**

## Validation boundary

This update is a source, inventory and focused-test-contract re-audit. It confirms that direct dedicated-switch assertions are present; it does not claim their execution result, PostgreSQL interleavings, full server/web suites, browser race evidence, adversarial approval, commit readiness or release readiness. Those gates remain recorded in their dedicated v2 reports.
