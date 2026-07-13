# P0-A Admin & Analytics Boundary Report

Date: 2026-07-12
Branch: `fix/p0-a-safety-consent-session-isolation-v1`
Base: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`
Lane verdict: **PASS for focused Admin & Analytics closure; overall build remains blocked outside this lane**

## Reality check

[قطعی] An admin role is authorization, not consent. Before this closure, admin, analytics-intelligence,
observability, recommendation-diagnostics and admin user-dossier paths could read optional or legacy data
without proving the subject's latest current-policy grant. Several stores have no consent-purpose or consent-epoch
provenance at all, so filtering only by `userId` would have fabricated safety.

## Boundary decision

[قطعی] The implementation now uses two contracts:

1. Runtime OFF returns HTTP 503 before consent-ledger or optional-table IO:
   `optional_analytics_processing_disabled` or `optional_personalization_processing_disabled`.
2. Runtime ON can read a provenance-aware source only for the latest current-policy consent epoch. A withdrawal
   removes the subject; a later re-consent sets a new `effectiveFrom` boundary. Legacy/null-policy rows are excluded.

[قطعی] Mixed or legacy stores without purpose/epoch provenance return HTTP 503 before DB IO with
`optional_data_provenance_unavailable`. They do not return misleading zero metrics.

The shared implementation is:

- `currentConsentPopulation(prisma, purpose)`
- `requireCurrentConsentPopulation(prisma, purpose, surface)`
- `requireCurrentUserProcessing(prisma, userId, purpose, surface)`
- `currentEventPopulationWhere(subjects, purpose)`
- `currentObservationPopulationWhere(subjects)`

For personalization, both a current analytics grant and a current personalization grant are required. The effective
epoch is the later of those two grants.

## Closed readers

### Provenance-filtered and current-population filtered

- Admin event feed, event totals, active-user count and time-bucketed trends
- Admin content gaps, meal-planning event aggregates and recommendation funnel
- Admin AI interaction enrichment, requiring current analytics + personalization
- Admin page-flow/dwell/click aggregates and add-source aggregate
- Analytics-intelligence funnels and trends
- Observability per-user event stream and signal observations
- Observability engagement counters
- Ops event-quality sampling

All UserEvent reads above require `consentPurpose in (analytics, personalization)` for analytics or exact
`personalization` for personalization, plus a per-user timestamp not earlier than the latest active grant epoch.
SignalObservation additionally requires its source event to have personalization provenance.

### Explicitly unavailable before read

The following surfaces are deliberately disabled because their legacy sources cannot prove purpose and epoch:

- Analytics-intelligence cohorts, behavior insights and product intelligence
- Admin recipe/favorite stats, shopping aggregates and behavior-profile aggregate
- Observability profile trace, per-user AI-call dossier and recsys health
- Recommendation diagnostics: feature vectors, signals, outcomes, snapshots, evaluation, metrics, governance,
  summary and review reports

[قطعی] Recommendation metric cron/read containment and workflow current-population filtering were implemented by
the Coordinator outside this lane, reusing the boundary helper. They are not claimed as edits by this agent.

## Admin roster and dossier scope reduction

[قطعی] `AdminUsersService.list()` no longer reads UserEvent last activity or event/favorite/meal-plan counts. It
returns only core account/security fields and support-ticket count, plus an explicit `optionalDerivedData` unavailable
contract.

[قطعی] `AdminUsersService.detail()` no longer reads budget, cuisines, health goals, recent UserEvent rows or
event/favorite/meal-plan counts. It retains core account/security fields, core diet/skill declarations, a redacted
allergy count, operational session metadata and ticket/recipe/session counts.

## Operational audit separation

[قطعی] `AdminService.recordAudit()` no longer writes `UserEvent`. It writes only `UserAuditLog` with:

- actor and target identifiers in canonical columns;
- an action allowlist: `admin_view`, `admin_ticket_view`, `admin_user_create_done`;
- per-action metadata allowlists;
- strict token/enum/boolean validation;
- unknown metadata keys stripped;
- malformed allowlisted values and unknown actions rejected before IO;
- no raw payload spread, free text, phone or email.

Passive audit DB failure remains fail-open; sensitive mutations continue to use the existing fail-closed
`recordAuditStrict()` path.

`getSystemHealth()` now reads only canonical `UserAuditLog`. It no longer counts legacy admin/cron UserEvent rows.

## Operational AICallLog allowlist

[قطعی] Operational AI health/cost views may read only technical aggregate fields: status, latency, model, provider,
token counts, estimated cost, surface, tier, cache-hit and error code as applicable. `userId` and `intent` are excluded
from selects and output. Per-user cost, per-intent and top-user outputs are explicit provenance-unavailable contracts.

## Test evidence

Focused command:

```text
pnpm.cmd --dir apps/server test -- --runInBand admin/admin.service.spec.ts admin/admin.controller.spec.ts admin/admin-users.service.spec.ts admin/observability.service.spec.ts analytics/intelligence/optional-processing-boundary.spec.ts analytics/intelligence/analytics-intelligence.service.spec.ts analytics/intelligence/analytics-l4-16-qa-gate.spec.ts analytics/intelligence/ops-intelligence.service.spec.ts recommendation/diagnostics.controller.spec.ts recommendation/diagnostics-summary.spec.ts
```

Result: **PASS — 10/10 suites, 71/71 tests, 0 snapshots, 0 failures, 25.143 s Jest time**.

Coverage includes:

- runtime OFF zero consent/optional DB calls;
- current-policy latest decision;
- withdrawal exclusion;
- null/old-policy legacy exclusion;
- re-consent epoch reset;
- personalization requiring current analytics + personalization;
- direct admin service/controller unavailable contracts;
- recordAudit canonical-only write, unknown-field stripping and malformed/PII rejection;
- observability current-user and current-population filters;
- recommendation diagnostics zero dependency reads under OFF and ON/provenance-unavailable states;
- AICallLog select allowlist;
- QA gate evidence computed in memory with no tracked artifact write.

Focused ESLint command covered all 18 lane source/spec files. Result: **exit 0, 0 errors, 1685 warnings**. The warning
count is mostly existing unsafe-any and Prettier debt in legacy files; no lint assertion was disabled.

Server build command:

```text
pnpm.cmd --dir apps/server build
```

Result: **FAIL outside this lane**. Prisma Client generation passed. Nest compile stopped at
`apps/server/src/notifications/notification-scheduler.service.ts:128` with TS18047:
`profile.churnRiskScore` is possibly null. This lane did not modify that file.

`git diff --check`: **PASS** after the focused implementation. The analytics QA test did not modify
`docs/qa/analytics/garnish_analytics_l4_16_results.json` or any other tracked artifact.

## Files owned and changed by this lane

- `apps/server/src/admin/admin-users.service.ts`
- `apps/server/src/admin/admin-users.service.spec.ts`
- `apps/server/src/admin/admin.controller.ts`
- `apps/server/src/admin/admin.controller.spec.ts`
- `apps/server/src/admin/admin.service.ts`
- `apps/server/src/admin/admin.service.spec.ts`
- `apps/server/src/admin/observability.service.ts`
- `apps/server/src/admin/observability.service.spec.ts`
- `apps/server/src/analytics/intelligence/optional-processing-boundary.ts`
- `apps/server/src/analytics/intelligence/optional-processing-boundary.spec.ts`
- `apps/server/src/analytics/intelligence/analytics-intelligence.service.ts`
- `apps/server/src/analytics/intelligence/analytics-intelligence.service.spec.ts`
- `apps/server/src/analytics/intelligence/analytics-l4-16-qa-gate.spec.ts`
- `apps/server/src/analytics/intelligence/ops-intelligence.service.ts`
- `apps/server/src/analytics/intelligence/ops-intelligence.service.spec.ts`
- `apps/server/src/recommendation/diagnostics.controller.ts`
- `apps/server/src/recommendation/diagnostics.controller.spec.ts`
- `apps/server/src/recommendation/diagnostics-summary.spec.ts`
- `docs/qa/release/p0-a/07_admin_analytics_boundary_report.md`

## Residual risks and activation blockers

1. [قطعی] The intentionally disabled surfaces require schema-level purpose and consent-epoch provenance before they
   can be re-enabled. An environment flag alone is insufficient.
2. [احتمالاً] The current consent-population resolver scans the purpose ledger and collapses latest decisions in
   application memory. It is correct for this gate but should become a reviewed indexed projection/materialized
   query before high-scale activation.
3. [قطعی] Admin roster/detail response shape is reduced. Browser/admin-UI contract verification is required to
   ensure omitted optional fields render as unavailable rather than fake zero.
4. [قطعی] The overall server build cannot be called PASS until the out-of-lane nullable churn-risk compile failure
   is fixed and the build reruns successfully.
5. [قطعی] Full-suite, two-account browser/PWA/DB and independent adversarial gates remain Coordinator-owned.

## Merge recommendation

[قطعی] **Do not merge on this report alone.** The Admin & Analytics focused lane is reviewable and green, but P0-A
must remain blocked until the external build error, full suites, browser/DB evidence and adversarial approval pass.
