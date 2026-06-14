/**
 * Event Producer Inventory (E43-A2).
 *
 * A CODE-GROUNDED inventory of the server-side event/event-like producers discovered by a targeted
 * static scan of apps/server/src (not imagination). Each record names a real producer (file:line +
 * method) and assigns its canonical migration target. This is the input to the staged producer
 * migration described in `docs/analytics/E43_A2_EVENT_PRODUCER_MIGRATION_MAP.md`.
 *
 * Coverage is deliberately reported as `targeted_static_scan` — NOT "all producers found" — because a
 * fully exhaustive guarantee would require runtime tracing. Producer families with NO current server
 * producer (cook, admin-audit, workflow, notification-suppression) are recorded as gaps in the map.
 */

import { EventFamily } from './event-taxonomy.contract';

export type ProducerShape = 'canonical_v2' | 'legacy' | 'partial' | 'unknown';
export type MigrationPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type ProducerRisk = 'low' | 'medium' | 'high';
export type ProducerMigrationStatus = 'not_started' | 'shadow_guarded' | 'canonical_emitting' | 'blocked';

export interface ProducerRecord {
  id: string;
  sourceFile: string;
  producerName: string;
  currentEventType?: string;
  /** canonical_v2 = emits CanonicalEventEnvelope; legacy = raw UserEvent; partial = table-specific row. */
  currentShape: ProducerShape;
  targetEventFamily: EventFamily;
  targetCanonicalEventType: string;
  migrationPriority: MigrationPriority;
  risk: ProducerRisk;
  migrationStatus: ProducerMigrationStatus;
  notes: string[];
}

export const PRODUCER_INVENTORY_COVERAGE = 'targeted_static_scan' as const;

/**
 * Producers grounded in the E43-A2 static scan. file:line references are approximate to the scanned
 * revision and are anchors for migration, not load-bearing imports.
 */
export const EVENT_PRODUCER_INVENTORY: readonly ProducerRecord[] = [
  {
    id: 'prod-analytics-trackevent',
    sourceFile: 'apps/server/src/analytics/analytics.service.ts:trackEvent',
    producerName: 'AnalyticsService.trackEvent',
    currentEventType: '(variable: data.type — multi-family central ingest)',
    currentShape: 'legacy',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: '(per-event: classifyEventFamily(data.type))',
    migrationPriority: 'P0',
    risk: 'low',
    migrationStatus: 'shadow_guarded',
    notes: [
      'Central server-side ingest for frontend-emitted events (POST /analytics/event); writes raw UserEvent.',
      'E43-A2 wires the runtime guard here in OBSERVATIONAL shadow mode (no write/return change, no drop).',
      'Multiplexes many families; per-event family is resolved by classifyEventFamily(data.type).',
    ],
  },
  {
    id: 'prod-behavior-cron-run',
    sourceFile: 'apps/server/src/behavior-engine/behavior-engine-scheduler.service.ts:handleCron',
    producerName: 'BehaviorEngineScheduler.handleCron',
    currentEventType: 'cron_behavior_engine_run',
    currentShape: 'legacy',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: 'cron_behavior_engine_run',
    migrationPriority: 'P2',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Hourly cron writes a UserEvent marking engine runs (actorType=system, source=cron).'],
  },
  {
    id: 'prod-ai-call-log',
    sourceFile: 'apps/server/src/ai/logging/ai-call-log.service.ts:record',
    producerName: 'AiCallLogService.record',
    currentEventType: 'ai_call (AICallLog row)',
    currentShape: 'partial',
    targetEventFamily: 'ai',
    targetCanonicalEventType: 'ai_call_logged',
    migrationPriority: 'P1',
    risk: 'medium',
    migrationStatus: 'not_started',
    notes: [
      'Per-orchestrator-call accounting row; metadata already PII-guarded + errorMessage sanitized.',
      'Already has an optional eventId link slot for a future canonical source event.',
    ],
  },
  {
    id: 'prod-ai-spend-alert',
    sourceFile: 'apps/server/src/ai/cost/spend-alert.service.ts:writeIfNew',
    producerName: 'SpendAlertService.writeIfNew',
    currentEventType: 'ai_spend_alert (AiSpendAlert row)',
    currentShape: 'partial',
    targetEventFamily: 'ai',
    targetCanonicalEventType: 'ai_spend_alert',
    migrationPriority: 'P2',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Daily per-user token-threshold alert; metadata is {kind} only (PII-free).'],
  },
  {
    id: 'prod-ai-chat-message',
    sourceFile: 'apps/server/src/ai/chat/chat-message.service.ts:create',
    producerName: 'ChatMessageService.create',
    currentEventType: 'ai_message_persisted (ChatMessage row)',
    currentShape: 'partial',
    targetEventFamily: 'ai',
    targetCanonicalEventType: 'ai_message_persisted',
    migrationPriority: 'P1',
    risk: 'high',
    migrationStatus: 'not_started',
    notes: [
      'Stores RAW user/assistant message content — must NEVER be copied into envelope metadata.',
      'A canonical event would carry only a reference (conversationId/messageId), not the text.',
    ],
  },
  {
    id: 'prod-reco-exposure',
    sourceFile: 'apps/server/src/recommendation/exposure/exposure-tracking.service.ts:trackExposure(s)',
    producerName: 'ExposureTrackingService.trackExposure / trackExposures',
    currentEventType: 'recommendation_exposure (RecommendationExposure row)',
    currentShape: 'legacy',
    targetEventFamily: 'recommendation',
    targetCanonicalEventType: 'recommendation_exposure',
    migrationPriority: 'P1',
    risk: 'medium',
    migrationStatus: 'not_started',
    notes: ['Uses raw $executeRaw INSERT (single + batched) — migrate with care to keep idempotency.'],
  },
  {
    id: 'prod-reco-attribution',
    sourceFile: 'apps/server/src/behavior-engine/processors/recommendation.signal-processor.ts:process',
    producerName: 'RecommendationSignalProcessor.process',
    currentEventType: 'recommendation_attribution (RecommendationAttributionEvent row)',
    currentShape: 'partial',
    targetEventFamily: 'recommendation',
    targetCanonicalEventType: 'recommendation_attribution',
    migrationPriority: 'P1',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Writes one attribution row per reco event (impression/click/save/cook/dismiss/ignore).'],
  },
  {
    id: 'prod-behavior-signal-recipe',
    sourceFile: 'apps/server/src/behavior-engine/processors/recipe.signal-processor.ts:process',
    producerName: 'RecipeSignalProcessor.process',
    currentEventType: 'signal_observation:likes_recipe|views_recipe (SignalObservation row)',
    currentShape: 'partial',
    targetEventFamily: 'recipe',
    targetCanonicalEventType: 'recipe_signal_observed',
    migrationPriority: 'P2',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Derived signal from recipe_view / favorite_add.'],
  },
  {
    id: 'prod-behavior-signal-reco',
    sourceFile: 'apps/server/src/behavior-engine/processors/recommendation.signal-processor.ts:process',
    producerName: 'RecommendationSignalProcessor.process (SignalObservation)',
    currentEventType: 'signal_observation:event_<type> (SignalObservation row)',
    currentShape: 'partial',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: 'behavior_signal_observed',
    migrationPriority: 'P2',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Same processor also writes a SignalObservation alongside the attribution row.'],
  },
  {
    id: 'prod-behavior-signal-mealplan',
    sourceFile: 'apps/server/src/behavior-engine/processors/meal-plan.signal-processor.ts:process',
    producerName: 'MealPlanSignalProcessor.process',
    currentEventType: 'signal_observation:plans_meal (SignalObservation row)',
    currentShape: 'partial',
    targetEventFamily: 'planner',
    targetCanonicalEventType: 'planner_signal_observed',
    migrationPriority: 'P2',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Derived from mealplan_add (event arrives via analytics.trackEvent → event-router).'],
  },
  {
    id: 'prod-behavior-signal-shopping',
    sourceFile: 'apps/server/src/behavior-engine/processors/shopping.signal-processor.ts:process',
    producerName: 'ShoppingSignalProcessor.process',
    currentEventType: 'signal_observation:shops_efficiently (SignalObservation row)',
    currentShape: 'partial',
    targetEventFamily: 'grocery',
    targetCanonicalEventType: 'grocery_signal_observed',
    migrationPriority: 'P2',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Derived from shopping_item_add (event arrives via analytics.trackEvent → event-router).'],
  },
  {
    id: 'prod-outcome-reco-quality',
    sourceFile: 'apps/server/src/recommendation/evaluation/recommendation-evaluator.service.ts:buildRecommendationQuality',
    producerName: 'RecommendationEvaluatorService.buildRecommendationQuality',
    currentEventType: 'user_outcome:recommendation_quality (UserOutcome row)',
    currentShape: 'partial',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: 'outcome_recorded',
    migrationPriority: 'P3',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Daily cron metric; aggregate, no raw user text.'],
  },
  {
    id: 'prod-outcome-reco-reward',
    sourceFile: 'apps/server/src/recommendation/evaluation/recommendation-reward.service.ts:buildRewardProfile',
    producerName: 'RecommendationRewardService.buildRewardProfile',
    currentEventType: 'user_outcome:recommendation_reward (UserOutcome row)',
    currentShape: 'partial',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: 'outcome_recorded',
    migrationPriority: 'P3',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Daily cron metric.'],
  },
  {
    id: 'prod-outcome-adherence',
    sourceFile: 'apps/server/src/outcomes/adherence-outcome.service.ts:calculateWeeklyAdherenceOutcomes',
    producerName: 'AdherenceOutcomeService.calculateWeeklyAdherenceOutcomes',
    currentEventType: 'user_outcome:goal_adherence (UserOutcome row)',
    currentShape: 'partial',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: 'outcome_recorded',
    migrationPriority: 'P3',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Weekly cron metric.'],
  },
  {
    id: 'prod-outcome-behavior',
    sourceFile: 'apps/server/src/outcomes/behavior-outcome.service.ts:calculateWeeklyBehaviorOutcomes',
    producerName: 'BehaviorOutcomeService.calculateWeeklyBehaviorOutcomes',
    currentEventType: 'user_outcome:shopping_efficiency (UserOutcome row)',
    currentShape: 'partial',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: 'outcome_recorded',
    migrationPriority: 'P3',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Weekly cron metric.'],
  },
  {
    id: 'prod-outcome-health',
    sourceFile: 'apps/server/src/outcomes/health-outcome.service.ts:calculateWeeklyHealthOutcomes',
    producerName: 'HealthOutcomeService.calculateWeeklyHealthOutcomes',
    currentEventType: 'user_outcome:meal_consistency (UserOutcome row)',
    currentShape: 'partial',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: 'outcome_recorded',
    migrationPriority: 'P3',
    risk: 'medium',
    migrationStatus: 'not_started',
    notes: ['Health-adjacent metric → a canonical event here should be privacyClass P2-sensitive.'],
  },
  {
    id: 'prod-notif-create',
    sourceFile: 'apps/server/src/notifications/notifications.service.ts:createAndSendNotification',
    producerName: 'NotificationsService.createAndSendNotification',
    currentEventType: 'notification (Notification row; variable type)',
    currentShape: 'partial',
    targetEventFamily: 'notification',
    targetCanonicalEventType: 'notif_sent',
    migrationPriority: 'P1',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Creates the Notification row but does NOT emit a send/suppress decision event (Layer-10 gap).'],
  },
  {
    id: 'prod-notif-scheduler',
    sourceFile: 'apps/server/src/notifications/notification-scheduler.service.ts:(crons)',
    producerName: 'NotificationSchedulerService crons',
    currentEventType: 'notification (shopping_reminder/plan_empty/meal_reminder/churn_risk)',
    currentShape: 'partial',
    targetEventFamily: 'notification',
    targetCanonicalEventType: 'notif_sent',
    migrationPriority: 'P2',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Cron-scheduled notifications; suppression decisions are not currently logged.'],
  },
  {
    id: 'prod-erasure-event',
    sourceFile: 'apps/server/src/users/erasure/erasure-audit.service.ts:record',
    producerName: 'ErasureAuditService.record',
    currentEventType: 'erasure_event (ErasureEvent row)',
    currentShape: 'partial',
    targetEventFamily: 'consent',
    targetCanonicalEventType: 'erasure_event',
    migrationPriority: 'P2',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['PII-free audit-long ledger (subjectHash). Compliance/privacy family; do not de-tombstone.'],
  },
  {
    id: 'prod-experiment-assignment',
    sourceFile: 'apps/server/src/experimentation/experiment-engine.service.ts:getWeights',
    producerName: 'ExperimentEngine.getWeights',
    currentEventType: 'experiment_assignment (ExperimentAssignment row)',
    currentShape: 'partial',
    targetEventFamily: 'behavior',
    targetCanonicalEventType: 'experiment_assigned',
    migrationPriority: 'P3',
    risk: 'low',
    migrationStatus: 'not_started',
    notes: ['Lazy per-user variant assignment; small structured row (experimentArm fits context).'],
  },
];

/** Families that have NO dedicated current server producer (events arrive via trackEvent or not at all). */
export const PRODUCER_FAMILY_GAPS: { family: EventFamily; reason: string }[] = [
  { family: 'cook', reason: 'No server cook producer; cooking events arrive via analytics.trackEvent; cook_complete is canonical_planned.' },
  { family: 'admin', reason: 'No admin-action audit producer; admin reads are not logged as events (admin_diagnostic_view is canonical_planned).' },
  { family: 'workflow', reason: 'No WAT/workflow producer exists; workflow_run is canonical_planned.' },
  { family: 'notification', reason: 'Notification SEND/SUPPRESS decisions are not logged as events (Layer-10 suppressed-log gap).' },
];

/* ───────────────────────────── Helpers ───────────────────────────── */

export const getProducerInventory = (): readonly ProducerRecord[] => EVENT_PRODUCER_INVENTORY;

export const getProducersByFamily = (family: EventFamily): ProducerRecord[] =>
  EVENT_PRODUCER_INVENTORY.filter((p) => p.targetEventFamily === family);

/** The single low-risk first integration candidate (shadow-wired in this task). */
export const getLowRiskFirstIntegrationCandidate = (): ProducerRecord | undefined =>
  EVENT_PRODUCER_INVENTORY.find((p) => p.migrationStatus === 'shadow_guarded' && p.risk === 'low');

const VALID_SHAPES: ReadonlySet<ProducerShape> = new Set(['canonical_v2', 'legacy', 'partial', 'unknown']);
const VALID_PRIORITY: ReadonlySet<MigrationPriority> = new Set(['P0', 'P1', 'P2', 'P3']);
const VALID_RISK: ReadonlySet<ProducerRisk> = new Set(['low', 'medium', 'high']);
const VALID_STATUS: ReadonlySet<ProducerMigrationStatus> = new Set([
  'not_started',
  'shadow_guarded',
  'canonical_emitting',
  'blocked',
]);

export interface InventoryConsistency {
  ok: boolean;
  totalProducers: number;
  uniqueIds: boolean;
  allFieldsPresent: boolean;
  allEnumsValid: boolean;
  hasLowRiskCandidate: boolean;
  byFamily: Record<string, number>;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  issues: string[];
}

/** Internal-consistency check used by the spec + the artifact (no fabrication, no missing fields). */
export function checkInventoryConsistency(): InventoryConsistency {
  const issues: string[] = [];
  const ids = new Set<string>();
  let allFieldsPresent = true;
  let allEnumsValid = true;
  const byFamily: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  for (const p of EVENT_PRODUCER_INVENTORY) {
    if (ids.has(p.id)) issues.push(`duplicate producer id: ${p.id}`);
    ids.add(p.id);

    if (!p.id || !p.sourceFile || !p.producerName || !p.targetEventFamily || !p.targetCanonicalEventType || !Array.isArray(p.notes)) {
      allFieldsPresent = false;
      issues.push(`missing required field(s) on producer: ${p.id || '(no id)'}`);
    }
    if (!VALID_SHAPES.has(p.currentShape)) { allEnumsValid = false; issues.push(`bad currentShape on ${p.id}: ${p.currentShape}`); }
    if (!VALID_PRIORITY.has(p.migrationPriority)) { allEnumsValid = false; issues.push(`bad priority on ${p.id}: ${p.migrationPriority}`); }
    if (!VALID_RISK.has(p.risk)) { allEnumsValid = false; issues.push(`bad risk on ${p.id}: ${p.risk}`); }
    if (!VALID_STATUS.has(p.migrationStatus)) { allEnumsValid = false; issues.push(`bad status on ${p.id}: ${p.migrationStatus}`); }

    byFamily[p.targetEventFamily] = (byFamily[p.targetEventFamily] || 0) + 1;
    byPriority[p.migrationPriority] = (byPriority[p.migrationPriority] || 0) + 1;
    byStatus[p.migrationStatus] = (byStatus[p.migrationStatus] || 0) + 1;
  }

  const uniqueIds = ids.size === EVENT_PRODUCER_INVENTORY.length;
  const hasLowRiskCandidate = !!getLowRiskFirstIntegrationCandidate();
  if (!uniqueIds) issues.push('producer ids are not unique');
  if (!hasLowRiskCandidate) issues.push('no low-risk first integration candidate (shadow_guarded + low risk)');

  return {
    ok: uniqueIds && allFieldsPresent && allEnumsValid && hasLowRiskCandidate && issues.length === 0,
    totalProducers: EVENT_PRODUCER_INVENTORY.length,
    uniqueIds,
    allFieldsPresent,
    allEnumsValid,
    hasLowRiskCandidate,
    byFamily,
    byPriority,
    byStatus,
    issues,
  };
}
