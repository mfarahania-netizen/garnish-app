# E43-A2 — Event Producer Migration Map

> Code-grounded map from the current legacy/table-specific event producers to the Canonical Event
> Envelope (ADR-0001, schemaVersion 2). Produced by a **targeted static scan** of `apps/server/src`
> (see `event-producer-inventory.ts`). This is a migration *plan*, not a completed migration.

## 0. Over-claim prevention (read first)
- **BIP v1 is NOT complete.**
- **Analytics is NOT fully migrated.** No producer emits a `CanonicalEventEnvelope` yet.
- **The Event Envelope contract IS code-backed** (E43-A1) and now **taxonomy-bound** (E43-A2).
- **Runtime migration is staged.** This task adds only a **shadow** (observational) integration at one
  low-risk producer — **not** full blocking production validation.
- Producer-inventory coverage is `targeted_static_scan` (not an exhaustive runtime trace).

## 1. Current reality
- One central server-side ingest exists: `AnalyticsService.trackEvent` (writes raw `UserEvent`).
- Many table-specific producers exist (AICallLog, AiSpendAlert, ChatMessage, RecommendationExposure,
  RecommendationAttributionEvent, SignalObservation, UserOutcome, Notification, ErasureEvent,
  ExperimentAssignment) — all **legacy/partial**, none envelope-wrapped.
- The legacy `EventType` enum (`event-taxonomy.ts`) has **117** values; the canonical/ADR set adds **13**
  planned types (e.g. `cook_complete`, `consent_granted`, `workflow_run`) that are **not yet produced**.
- No DB envelope columns exist on `UserEvent`; **no DB migration is added in E43-A2**.

## 2. Producers found (20)

| Producer | Source File | Current Shape | Target Canonical Event | Priority | Risk | Migration Status | Next Action |
|---|---|---|---|---|---|---|---|
| AnalyticsService.trackEvent | analytics/analytics.service.ts | legacy | per-event (classifyEventFamily) | P0 | low | **shadow_guarded** | Observe shadow warnings; design per-family canonical mapping |
| BehaviorEngineScheduler.handleCron | behavior-engine/behavior-engine-scheduler.service.ts | legacy | cron_behavior_engine_run | P2 | low | not_started | Emit system/cron envelope |
| AiCallLogService.record | ai/logging/ai-call-log.service.ts | partial | ai_call_logged | P1 | medium | not_started | Link AICallLog.eventId to a canonical source event |
| SpendAlertService.writeIfNew | ai/cost/spend-alert.service.ts | partial | ai_spend_alert | P2 | low | not_started | Wrap alert as canonical system event |
| ChatMessageService.create | ai/chat/chat-message.service.ts | partial | ai_message_persisted | P1 | **high** | not_started | Reference-only event (NEVER put message text in metadata) |
| ExposureTrackingService.trackExposure(s) | recommendation/exposure/exposure-tracking.service.ts | legacy | recommendation_exposure | P1 | medium | not_started | Replace raw `$executeRaw` with canonical-tracked write |
| RecommendationSignalProcessor.process | behavior-engine/processors/recommendation.signal-processor.ts | partial | recommendation_attribution | P1 | low | not_started | Emit attribution as canonical event |
| RecipeSignalProcessor.process | behavior-engine/processors/recipe.signal-processor.ts | partial | recipe_signal_observed | P2 | low | not_started | Canonical signal-observed event |
| RecommendationSignalProcessor.process (signal) | behavior-engine/processors/recommendation.signal-processor.ts | partial | behavior_signal_observed | P2 | low | not_started | Canonical signal-observed event |
| MealPlanSignalProcessor.process | behavior-engine/processors/meal-plan.signal-processor.ts | partial | planner_signal_observed | P2 | low | not_started | Canonical signal-observed event |
| ShoppingSignalProcessor.process | behavior-engine/processors/shopping.signal-processor.ts | partial | grocery_signal_observed | P2 | low | not_started | Canonical signal-observed event |
| RecommendationEvaluatorService.buildRecommendationQuality | recommendation/evaluation/recommendation-evaluator.service.ts | partial | outcome_recorded | P3 | low | not_started | Canonical outcome event |
| RecommendationRewardService.buildRewardProfile | recommendation/evaluation/recommendation-reward.service.ts | partial | outcome_recorded | P3 | low | not_started | Canonical outcome event |
| AdherenceOutcomeService.calculateWeeklyAdherenceOutcomes | outcomes/adherence-outcome.service.ts | partial | outcome_recorded | P3 | low | not_started | Canonical outcome event |
| BehaviorOutcomeService.calculateWeeklyBehaviorOutcomes | outcomes/behavior-outcome.service.ts | partial | outcome_recorded | P3 | low | not_started | Canonical outcome event |
| HealthOutcomeService.calculateWeeklyHealthOutcomes | outcomes/health-outcome.service.ts | partial | outcome_recorded | P3 | medium | not_started | Canonical outcome event — **P2-sensitive** privacyClass |
| NotificationsService.createAndSendNotification | notifications/notifications.service.ts | partial | notif_sent | P1 | low | not_started | Emit notif_sent + (new) notif_suppressed events |
| NotificationSchedulerService crons | notifications/notification-scheduler.service.ts | partial | notif_sent | P2 | low | not_started | Emit canonical send/suppress decisions |
| ErasureAuditService.record | users/erasure/erasure-audit.service.ts | partial | erasure_event | P2 | low | not_started | Already PII-free audit-long; wrap as canonical consent-family event |
| ExperimentEngine.getWeights | experimentation/experiment-engine.service.ts | partial | experiment_assigned | P3 | low | not_started | Canonical behavior event (experimentArm in context) |

## 3. Producers not found / folders missing
- `apps/server/src/meal-planner`, `apps/server/src/planner`, `apps/server/src/shopping`, `apps/server/src/grocery` — **do not exist** as discrete server modules. `mealplan_*` / `shopping_*` events arrive from the frontend via `analytics.trackEvent` and are reacted to by the meal-plan / shopping signal processors. (`meal-plans` and `shopping-list` modules exist but are not direct event producers beyond the signal processors.)
- **Notification send/suppress decision logging** — does not exist (only `Notification` rows are written; no suppressed-log).
- **Admin-action audit producer** — does not exist (admin reads are not logged as events).
- **WAT / workflow producer** — does not exist (`workflow_run` is canonical_planned only).
- `ConsentLog`, `DataAccessLog`, `UserAuditLog`, `PreferenceHistory`, `FeatureContributionLog` — tables exist but have **no active writers** found in the scan.

## 4. High-risk producers
- **ChatMessageService.create (high):** stores raw user/assistant message text. A canonical event must
  carry only references (conversationId/messageId), never the text — the PII guard would reject it in
  metadata, and that is correct.
- **HealthOutcomeService (medium):** health-adjacent metric ⇒ canonical event should be `P2-sensitive`.
- **ExposureTrackingService (medium):** raw `$executeRaw INSERT` ⇒ migrate carefully to preserve
  idempotency/batching.
- **AiCallLogService (medium):** rich metadata; already PII-guarded — keep that on migration.

## 5. Low-risk first integration candidate
**`AnalyticsService.trackEvent` (prod-analytics-trackevent).** It is the single central ingest, so one
shadow hook observes the broadest event flow with the least blast radius. E43-A2 wires the runtime guard
here in **observational shadow mode**: it validates/normalizes each event, logs a **redacted** debug line
when an event is not yet canonical, and **never drops, alters, or persists** anything. Default mode is
`shadow` (env `EVENT_ENVELOPE_RUNTIME_GUARD_MODE=off|shadow|strict`). Even `strict` does **not** drop
events here — enforcement is deferred to staged per-producer migration.

## 6. Event families and target defaults
Eleven canonical families (`event-taxonomy.contract.ts`), each with migration defaults
(`EVENT_FAMILY_DEFAULTS`): consentPurpose · privacyClass · retentionPolicy · visibility · surface.

| Family | consentPurpose | privacyClass | retentionPolicy | visibility | surface |
|---|---|---|---|---|---|
| recipe | analytics | P1-pseudonymous | standard-365d | private | recipe |
| cook | core | P1-pseudonymous | standard-365d | private | cook_mode |
| ai | personalization | P1-pseudonymous | standard-365d | private | chat |
| notification | core | P1-pseudonymous | standard-365d | private | notifications |
| recommendation | personalization | P1-pseudonymous | standard-365d | private | home |
| grocery | core | P1-pseudonymous | standard-365d | private | grocery |
| planner | core | P1-pseudonymous | standard-365d | private | planner |
| consent | core | P1-pseudonymous | **audit-long** | private | onboarding |
| admin | core | P1-pseudonymous | **audit-long** | private | admin |
| workflow | core | P1-pseudonymous | ephemeral-30d | private | system |
| behavior | analytics | P1-pseudonymous | standard-365d | private | home |

Defaults are migration starting points; producers override per-event (e.g. allergy/health ⇒ P2-sensitive).

## 7. Remaining integration gaps
- Only **1 of 20** producers is shadow-guarded; the other 19 are `not_started`.
- **No producer emits `canonical_v2` yet.** Runtime emission + DB envelope columns are future, additive,
  Founder-gated steps (no DB migration in E43-A2).
- Notification suppressed-log (Layer 10), admin audit, and WAT `workflow_run` (Layer 14) producers do not
  exist and must be **built**, not just migrated.
- `eventType` is now taxonomy-bound, but unknown types are only **warned** in shadow (strict rejects).

## 8. Explicit over-claim prevention (restated)
This task delivers a **migration foundation**: a taxonomy-bound validator, a code-grounded producer
inventory, this map, a safe runtime guard, and **one** observational shadow integration. It does **not**
complete BIP v1, does **not** migrate all producers, does **not** add a DB migration, and does **not**
enable any product/AI/community/B2B behavior. R3 and R4 remain **Mitigating, not Closed**.
