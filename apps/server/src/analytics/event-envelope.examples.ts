/**
 * Canonical Event Envelope — worked examples (E43-A1).
 *
 * Every example is a fully-formed, valid `CanonicalEventEnvelope` (schemaVersion 2) per
 * `docs/adr/ADR-0001-canonical-event-envelope.md`. They are the executable counterpart of ADR §10:
 * the contract test (`event-envelope.ingest-gate.spec.ts`) validates every one of them, and the
 * ingest gate uses them as fixtures. They are PII-FREE by construction (metadata only ever holds
 * small, structured, non-personal values such as runId/experimentArm/snapshotHash/reason).
 *
 * Coverage across the set spans every enum value:
 *   actorType:       user · system · agent · admin
 *   source:          web-pwa · server · cron · ops-workflow
 *   visibility:      private · circle · public
 *   consentPurpose:  core · analytics · personalization · b2b_aggregate · community
 *   privacyClass:    P0-public · P1-pseudonymous · P2-sensitive
 *   retentionPolicy: standard-365d · audit-long · ephemeral-30d
 */

import {
  CanonicalEventEnvelope,
  ActorTypeEnum,
  EventSourceEnum,
  VisibilityEnum,
  ConsentPurposeEnum,
  PrivacyClassEnum,
  RetentionPolicyEnum,
} from './event-envelope.schema';

/** Fixed timestamps so the examples (and the artifact derived from them) are deterministic. */
const OCCURRED = '2026-06-14T09:00:00.000Z';
const RECEIVED = '2026-06-14T09:00:00.250Z';

/* ───────────────────────── 6 REQUIRED examples (ADR §10) ───────────────────────── */

/** 1. recipe_viewed — web user, analytics consent, P1, standard retention. */
export const recipe_viewed: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0001',
  eventType: 'recipe_viewed',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'recipe',
  objectId: 'recipe_42',
  source: EventSourceEnum.webPwa,
  surface: 'home',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.analytics,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
};

/** 2. cook_complete — core consent, cook_mode surface. */
export const cook_complete: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0002',
  eventType: 'cook_complete',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'recipe',
  objectId: 'recipe_42',
  source: EventSourceEnum.webPwa,
  surface: 'cook_mode',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.core,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
};

/** 3. ai_answer_feedback — personalization consent, PII-free structured metadata. */
export const ai_answer_feedback: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0003',
  eventType: 'ai_answer_feedback',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'ai_message',
  objectId: 'msg_777',
  source: EventSourceEnum.webPwa,
  surface: 'chat',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.personalization,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
  metadata: { snapshotHash: 'sha256:a1b2c3d4', rating: 1 },
};

/** 4. notif_suppressed — system actor, cron source (no surface), suppression reason. */
export const notif_suppressed: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0004',
  eventType: 'notif_suppressed',
  actorType: ActorTypeEnum.system,
  actorId: 'notification-service',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'notif',
  objectId: 'notif_9',
  source: EventSourceEnum.cron,
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.core,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
  metadata: { suppressedReason: 'fatigue_cap' },
};

/** 5. cooked_share — visibility PRIVATE, community consent. */
export const cooked_share: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0005',
  eventType: 'cooked_share',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'post',
  objectId: 'post_1',
  source: EventSourceEnum.webPwa,
  surface: 'profile',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.community,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
};

/** 6. workflow_run — agent actor, ops-workflow source, runId/stepId metadata. */
export const workflow_run: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0006',
  eventType: 'workflow_run',
  actorType: ActorTypeEnum.agent,
  actorId: 'ops:meal-suggest',
  objectType: 'workflow',
  objectId: 'wf_2026_06_14',
  source: EventSourceEnum.opsWorkflow,
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.core,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.ephemeral30d,
  metadata: { runId: 'ops:weekly-kpi-draft', stepId: 'draft-summary' },
};

/* ───────────────────────── 6 ADDITIONAL examples ───────────────────────── */

/** 7. recommendation_impression — analytics, experiment arm in metadata. */
export const recommendation_impression: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0007',
  eventType: 'recommendation_impression',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'recipe',
  objectId: 'recipe_88',
  source: EventSourceEnum.webPwa,
  surface: 'home',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.analytics,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
  metadata: { experimentArm: 'briefing-copy-a', position: 3 },
};

/** 8. recommendation_dismissed — personalization, dismissal reason. */
export const recommendation_dismissed: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0008',
  eventType: 'recommendation_dismissed',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'recipe',
  objectId: 'recipe_88',
  source: EventSourceEnum.webPwa,
  surface: 'home',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.personalization,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
  metadata: { dismissReason: 'not_interested' },
};

/** 9. grocery_item_merged — core consent, grocery surface, merge count. */
export const grocery_item_merged: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a0009',
  eventType: 'grocery_item_merged',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'grocery_item',
  objectId: 'gitem_5',
  source: EventSourceEnum.webPwa,
  surface: 'grocery',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.core,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
  metadata: { mergedCount: 2 },
};

/** 10. consent_granted — onboarding, AUDIT-LONG retention (consent is an audit record). */
export const consent_granted: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a000a',
  eventType: 'consent_granted',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'consent',
  objectId: 'consent_analytics',
  source: EventSourceEnum.webPwa,
  surface: 'onboarding',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.core,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.auditLong,
  metadata: { grantedPurpose: 'analytics' },
};

/** 11. ai_guard_block — SYSTEM actor, server source, P2-SENSITIVE, AUDIT-LONG (safety event). */
export const ai_guard_block: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a000b',
  eventType: 'ai_guard_block',
  actorType: ActorTypeEnum.system,
  actorId: 'ai-orchestrator',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'ai_message',
  objectId: 'msg_778',
  source: EventSourceEnum.server,
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.core,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p2Sensitive,
  retentionPolicy: RetentionPolicyEnum.auditLong,
  metadata: { guard: 'prompt_injection', blockedBeforeProvider: true },
};

/** 12. admin_diagnostic_view — ADMIN actor, server source, AUDIT-LONG (admin access trail). */
export const admin_diagnostic_view: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a000c',
  eventType: 'admin_diagnostic_view',
  actorType: ActorTypeEnum.admin,
  actorId: 'admin_7',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'diagnostic_report',
  objectId: 'feature-vector',
  source: EventSourceEnum.server,
  surface: 'admin',
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.core,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.auditLong,
  metadata: { view: 'feature-vector' },
};

/* ───────── 3 BONUS examples: complete the visibility / consent / privacy enum coverage ───────── */

/** 13. b2b_aggregate_snapshot — system/cron, B2B_AGGREGATE consent, P1 (only ≤P1 enters the K≥100 line). */
export const b2b_aggregate_snapshot: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a000d',
  eventType: 'b2b_aggregate_snapshot',
  actorType: ActorTypeEnum.system,
  actorId: 'b2b-aggregator',
  objectType: 'aggregate',
  objectId: 'snapshot_2026_06_14',
  source: EventSourceEnum.cron,
  visibility: VisibilityEnum.private,
  consentPurpose: ConsentPurposeEnum.b2bAggregate,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
  metadata: { cohortSize: 100 },
};

/** 14. community_post_published — visibility PUBLIC, P0-PUBLIC, community consent. */
export const community_post_published: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a000e',
  eventType: 'community_post_published',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'post',
  objectId: 'post_2',
  source: EventSourceEnum.webPwa,
  surface: 'community',
  visibility: VisibilityEnum.public,
  consentPurpose: ConsentPurposeEnum.community,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p0Public,
  retentionPolicy: RetentionPolicyEnum.standard365d,
};

/** 15. circle_recipe_share — visibility CIRCLE, community consent. */
export const circle_recipe_share: CanonicalEventEnvelope = {
  eventId: '0190a000-0000-7000-8000-0000000a000f',
  eventType: 'circle_recipe_share',
  actorType: ActorTypeEnum.user,
  actorId: 'user_123',
  subjectType: 'user',
  subjectId: 'user_123',
  objectType: 'recipe',
  objectId: 'recipe_42',
  source: EventSourceEnum.webPwa,
  surface: 'profile',
  visibility: VisibilityEnum.circle,
  consentPurpose: ConsentPurposeEnum.community,
  schemaVersion: 2,
  occurredAt: OCCURRED,
  receivedAt: RECEIVED,
  privacyClass: PrivacyClassEnum.p1Pseudonymous,
  retentionPolicy: RetentionPolicyEnum.standard365d,
  metadata: { circleId: 'circle_5' },
};

/** All canonical examples, keyed by name (used by the contract gate + tests). */
export const CANONICAL_EVENT_EXAMPLES: Record<string, CanonicalEventEnvelope> = {
  recipe_viewed,
  cook_complete,
  ai_answer_feedback,
  notif_suppressed,
  cooked_share,
  workflow_run,
  recommendation_impression,
  recommendation_dismissed,
  grocery_item_merged,
  consent_granted,
  ai_guard_block,
  admin_diagnostic_view,
  b2b_aggregate_snapshot,
  community_post_published,
  circle_recipe_share,
};

/**
 * Legacy-shaped inputs (the current `UserEvent` row shape) used to exercise backward-tolerant
 * normalization. These are NOT canonical — they intentionally omit envelope fields so the gate can
 * prove the normalizer infers + warns. PII-free.
 */
export const LEGACY_EVENT_EXAMPLES: Record<string, Record<string, unknown>> = {
  // classic web client event: only type/userId/page/timestamp
  legacy_recipe_view: {
    type: 'recipe_view',
    userId: 'user_900',
    page: 'home',
    sessionId: 'sess_1',
    timestamp: '2026-06-14T08:00:00.000Z',
  },
  // cron-emitted legacy event with no page
  legacy_cron_run: {
    type: 'cron_behavior_engine_run',
    userId: 'system',
    timestamp: '2026-06-14T08:05:00.000Z',
  },
};
