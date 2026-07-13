# P0-A — Scope and Audit Delta

## Gate result

- [قطعی] audited hash: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`.
- [قطعی] fetched `origin/master` at sprint start: `1631dc5dbf0f0d5b9699399ed8f50ebef4b053ab`.
- [قطعی] audit delta between the audited hash and current master is zero؛ no target file changed after the audit.
- [قطعی] implementation branch: `fix/p0-a-safety-consent-session-isolation-v1`, created from `origin/master`.
- [قطعی] master was not checked out or modified.
- [قطعی] existing untracked `docs/qa/launch/full-audit-v3/**` artifacts belong to the prior audit. They are excluded from this sprint's staging and commit.

## Findings in scope

| finding | reproduction owner | implementation owner | status before reproduction |
|---|---|---|---|
| `GAR-LAUNCH-004` critical onboarding writes can fail before completion | Allergy & Onboarding Agent | Allergy & Onboarding Agent | [قطعی] audit evidence exists؛ runtime reproduction pending |
| `GAR-LAUNCH-005` launch-facing allergy severity lacks round-trip/enforcement | Allergy & Onboarding Agent | Allergy & Onboarding Agent | [قطعی] audit evidence exists؛ reproduction pending |
| `GAR-LAUNCH-006` settings read failure can overwrite allergies | Allergy & Onboarding Agent | Allergy & Onboarding Agent | [قطعی] audit evidence exists؛ reproduction pending |
| `GAR-LAUNCH-007` analytics opt-out/copy does not match first-party ingest | Consent & Analytics Agent | Consent & Analytics Agent | [قطعی] audit evidence exists؛ reproduction pending |
| `GAR-LAUNCH-008` personalization consent is bundled/implicitly granted | Consent & Analytics Agent | Consent & Analytics Agent | [قطعی] audit evidence exists؛ reproduction pending |
| `GAR-LAUNCH-009` authenticated API responses may enter shared Cache Storage | Session & PWA Isolation Agent | Session & PWA Isolation Agent | [احتمالاً] source/config exposure exists؛ final URL/runtime reproduction pending |

## Agent ownership

| role | owned scope | independent evidence |
|---|---|---|
| Coordinator | branch/scope gate, architecture decision, integration, final report, explicit staging/commit/push | `00_scope_and_audit_delta.md`, `02_architecture_decision.md`, final report |
| Allergy & Onboarding Agent | onboarding, binary allergy UI/contract, settings hydration/update safety | `agents/01_allergy_onboarding_reproduction.md` and implementation handoff |
| Consent & Analytics Agent | Terms separation, optional personalization consent, analytics purpose gate/copy | `agents/02_consent_analytics_reproduction.md` and implementation handoff |
| Session & PWA Isolation Agent | Workbox allowlist, private no-store, logout cache/query cleanup | `agents/03_session_pwa_reproduction.md` and implementation handoff |
| Adversarial Security Reviewer | independent attempts to bypass safety/consent/session isolation after implementation | `03_adversarial_review.md` |
| QA & Evidence Agent | targeted/full tests, preview browser, two-account evidence and final command ledger | independent QA section in final report |

## File ownership map

- Allergy lane: `apps/web/src/app/onboarding/**`, `apps/web/src/app/settings/**`, related web tests؛ `apps/server/src/users/**` only if the chosen architecture requires it.
- Consent lane: `apps/web/src/hooks/useAnalytics.js`, analytics initialization, privacy/settings/onboarding consent UI/tests؛ `apps/server/src/consent/**`, `apps/server/src/analytics/**`.
- Session lane: `apps/web/vite.config.js`, `apps/web/src/context/AuthContext.jsx`, API/query cache helpers and focused tests؛ server cache headers only through narrowly scoped shared/interceptor files if required.
- Coordinator-only reports: `docs/qa/release/p0-a/**`.

## Hard exclusions

- [قطعی] no production deploy/DB/migration, recipe or ingredient mutation, media/raw assets, AI provider enablement, broad auth rewrite, full-repo formatting or legal conclusion.
- [قطعی] `food pic-gbt/**`, `apps/web/public/data/media/**`, recipe/ingredient data, production env and unrelated P0-B/P0-C files are excluded.
- [قطعی] no file outside the ownership map may change without a coupling note in this report before the edit.

## Overlap risks

- [احتمالاً] onboarding currently writes user preferences, consent, taste and favorites in one client flow. A single atomic endpoint could couple users, consent and profile modules too broadly; architecture decision is deferred until reproduction traces are complete.
- [احتمالاً] server-side cache headers may require a shared interceptor or response middleware outside the initially named files. If so, the exact coupling and narrow scope will be recorded before editing.
- [قطعی] logout/query-cache changes can affect every authenticated route. Regression tests for session persistence, route guards and anonymous public recipe access are mandatory.
- [قطعی] legal copy remains Privacy/Legal-owned. This sprint may remove false claims and mark review-required text, but will not invent lawful-basis language.

## Approved narrow coupling after architecture decision

- [قطعی] `apps/server/src/app.module.ts` and a new `apps/server/src/common/interceptors/private-cache-control.interceptor.ts` are required to enforce no-store headers centrally؛ controller-by-controller headers would be incomplete.
- [قطعی] new focused DTO/constants files under `apps/server/src/users/dto/**` and `apps/server/src/consent/**` are required for the atomic command and purpose allowlist.
- [قطعی] a new `apps/web/src/lib/private-session-cache.js` helper is required so logout، 401، startup and multi-tab invalidation use one cleanup contract.
- [قطعی] focused tests adjacent to those files are in scope. No broader platform/auth rewrite is approved.

- [قطعی] `apps/server/src/auth/auth.service.ts` has three direct `UserEvent(register)` writes that bypass the new server consent gate. Removing only those optional funnel writes is required for fail-closed analytics; authentication/token behavior remains unchanged.
- [قطعی] `apps/web/src/App.jsx` collects page/click/dwell state before consent and can later emit that pre-consent behavior. Gating and clearing only the `RouteTracker` state is required; routing and provider topology remain unchanged.
- [قطعی] a shared web policy-version constants file is required so onboarding, Settings and auth hydration reject stale optional grants consistently.
- [قطعی] `apps/web/src/main.jsx` must await deletion of legacy private API Cache Storage before React children can mount and issue queries; an AuthProvider effect is too late for the first render. This is a narrow bootstrap ordering change only.
- [قطعی] `apps/server/src/behavior-engine/behavior-engine.service.ts` and routing outbox require canonical personalization checks at their mutation boundaries; otherwise scheduled/pending work can profile after deny or withdrawal.
- [قطعی] `apps/server/src/behavior-engine/signals/taste-correction.service.ts`, `apps/server/src/behavior-engine/profile/read/profile-read.service.ts` and their modules require the same canonical check; direct taste correction and stale legacy consent otherwise bypass Settings/onboarding decisions. Only consent gates and focused tests are approved in these modules.
- [قطعی] recommendation exposure/served-slate writes and personalized rank inputs require canonical analytics/personalization gates at their own boundaries; otherwise direct telemetry and old feature vectors survive withdrawal. Only those gates, DI wiring and focused tests are approved in recommendation modules.
- [قطعی] `GroundedReplyService` reads behavior profiles and remembered user facts independently of the already-gated AI snapshot. A canonical personalization check before those reads is required; the hard allergy filter remains always-on and separate.
- [قطعی] `apps/server/src/ai/context/behavioral-context-snapshot.service.ts` and `ai-core.module.ts` require the same canonical current-policy gate before reading behavioral signals; safety preferences remain available without personalization.
- [قطعی] `FeatureStoreService`, `SignalDetectorService`, `CandidateGeneratorService`, `RankingService`, exposure/counter services and recommendation evaluator/reward paths each read or write derived per-user state outside the primary analytics gate. Canonical analytics/personalization checks, DI wiring, bounded DTOs and focused tests are approved only at those boundaries.
- [قطعی] weekly `outcomes/{health,behavior,adherence}-outcome.service.ts` jobs derive per-user outcomes from meal/shopping behavior. `OutcomesModule` and those three services require per-user personalization checks before any sensitive IO.
- [قطعی] meal-plan planner, Briefing and Gamification read historical `UserEvent` rows to tailor user-facing output. Their modules/services require canonical personalization checks before event reads while allergy/declared safety behavior remains always-on.
- [قطعی] process note: the exact outcomes file note was appended immediately after the independent reviewer exposed the coupling, but the delegated lane started before this exact bullet landed. The earlier broad behavior-engine consent note existed; this ordering deviation is retained here rather than hidden.
- [قطعی] `apps/web/public/sw-private-cache-cleanup.js` is a narrow executable worker asset, not media/raw content. It is required because an already-open legacy tab may never execute the new page bundle; activation-time deletion must run in the newly installed worker itself.
- [قطعی] `RecommendationMetricsService` and `BehaviorEngineScheduler` are active cron entry points that can process optional analytics/personalization data without a request controller. Default-off runtime gates before all delegate IO are required. The unsafe direct churn-notification block is removed instead of retaining a dormant activation bypass.
- [قعی] `NotificationsService.generateSmartSuggestion`, `MealPlansService.generateSmartPlan`, and `BehavioralContextSnapshotService.build` are direct personalized read paths found by the final adversarial scan. Narrow canonical gates/redacted selects and focused tests are approved; unrelated notification/planner/AI behavior remains excluded.

- [قطعی] legacy PostHog builds could persist account identity in cross-subdomain `ph_*_posthog` cookies and `ph_conv_*` storage keys. Extending the existing launch cleanup to expire host/multi-label-domain cookies and known provider-owned storage keys is required for hard account isolation; provider capture remains disabled.

- [قطعی] default-enabled workflow jobs reach `WorkflowNodesService.contentGaps` and `OpsIntelligenceService.eventQuality`, which read legacy `UserEvent` data while optional analytics processing is OFF. Narrow pre-IO runtime gates and honest empty/disabled outputs are required; provenance and current-consent population logic remain activation blockers.

- [قطعی] activation-time Cache Storage deletion alone leaves old JavaScript and its in-memory query/account state alive in already-open tabs. The migration worker must claim and reload existing window clients after cleanup. This can reload an unsaved draft once during a worker update; the documented UX cost is accepted for the account-isolation security transition.

- [قطعی] `useImpressionObserver` is a production telemetry path outside `useAnalytics`; it must reactively cancel dwell timers/pending batches on analytics disable and re-check the active runtime state at send time. The home recommendation UI itself remains unchanged.
- [قطعی] admin analytics/intelligence/observability/diagnostics views can process legacy optional data via polling while runtime purposes are OFF. Narrow honest-disabled responses before optional DB IO are approved; operational support data must remain separately bounded, and any per-user optional view requires current consent before data access.
- [قطعی] `AdminService.recordAudit` writes unbounded operational metadata into `UserEvent`, bypassing the consent/provenance pipeline. Moving this audit write to the existing operational `UserAuditLog` boundary with an allowlisted shape is approved; no admin-auth redesign is included.

## Phase 0 verdict

[قطعی] `PASS`: base hash matches the audited master and the implementation branch is isolated. Product edits remain blocked until Phase 1 reproduction evidence is complete.

## Stabilization ownership freeze

- [قطعی] Scope & Diff Auditor owns only `05_diff_scope_matrix.csv` and `06_scope_reduction_report.md`; it must not edit product files.
- [قطعی] Admin & Analytics Closure Agent owns `apps/server/src/admin/**`, `apps/server/src/analytics/intelligence/**`, admin observability/diagnostics boundaries and their focused tests plus `07_admin_analytics_boundary_report.md`.
- [قطعی] Full-Suite Regression Analyst owns only a separate clean-base worktree and `09_full_suite_differential_report.md`/`09a_prerequisite_quality_blocker.md`; it must not edit current product files.
- [قطعی] Coordinator owns `useImpressionObserver`, analytics runtime notification plumbing, `08_optional_processing_consumer_inventory.csv`, scope reduction decisions and integration.
- [قطعی] Coordinator additionally owns the already-classified `workflow/workflow-nodes.service*` current-consent population fix and `recommendation/evaluation/recommendation-metrics.service*` provenance-unavailable containment exposed by Phase 2. Admin Agent must not edit those four files; Coordinator will integrate only after the shared optional-boundary contract stabilizes.
- [قطعی] Browser/PWA/DB QA and Adversarial Reviewer are deferred until the implementation/differential lanes finish; they receive no product-file ownership.
- [قطعی] No product file is assigned to two active agents. Any newly discovered overlap must be returned to the Coordinator before editing.
- [قطعی] Post-inventory Boundary Closure Agent owns only `notifications/notification-scheduler.service*`, `notifications/ine/ine.service*`, `behavior-engine.service*`, `feature-store.service*`, `recommendation/exposure/exposure-tracking.service*`, `ai/tools/explain-recommendation.tool*` and `governance/governance-insights.service*`. It must not edit admin/intelligence, analytics ingest, workflow or recommendation-metrics files.
- [قطعی] Direct Processor Closure Agent owns only `behavior-engine/routing/event-router.service*`, `behavior-engine/processors/{recipe,recommendation,meal-plan,shopping,personalization}.signal-processor*`, `behavior-engine/signals/signal-calculator.service*`, `behavior-engine/identity/identity-dimension.builder*` and `lifestyle/lifestyle-graph.builder*`. Its only approved change is a fail-closed personalization runtime self-gate before optional IO plus focused direct-call tests.
