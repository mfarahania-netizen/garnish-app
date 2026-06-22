/**
 * Event Taxonomy Contract (E43-A2).
 *
 * Binds the existing legacy `EventType` enum (apps/server/src/analytics/event-taxonomy.ts) to the
 * Canonical Event Envelope (ADR-0001) by:
 *  - exposing a stable eventType validator (strict vs shadow/migration),
 *  - classifying every eventType into one of the canonical event FAMILIES,
 *  - reporting a migration status per eventType (legacy_active | canonical_planned | unknown),
 *  - providing per-family DEFAULTS (consent/privacy/retention/visibility/surface) used by the
 *    migration map and the runtime guard.
 *
 * Honesty rules (no over-claim):
 *  - `legacy_active` = currently emitted today in the legacy `UserEvent` shape.
 *  - `canonical_planned` = an ADR/envelope event type that is DESIGNED but NOT yet produced in
 *    production (e.g. consent_granted, workflow_run, ai_guard_block). These are PLANNED/STAGED.
 *    (cook_complete was reconciled to legacy_active on 2026-06-22 — it IS emitted today.)
 *  - Unknown types are NEVER silently accepted as production-ready (strict rejects; shadow warns).
 *
 * Zero new dependency; pure functions.
 */

import { EventType } from './event-taxonomy';
import {
  ConsentPurpose,
  PrivacyClass,
  RetentionPolicy,
  Visibility,
  ConsentPurposeEnum,
  PrivacyClassEnum,
  RetentionPolicyEnum,
  VisibilityEnum,
} from './event-envelope.schema';

/* ───────────────────────────── Families ───────────────────────────── */

export type EventFamily =
  | 'recipe'
  | 'cook'
  | 'ai'
  | 'notification'
  | 'recommendation'
  | 'grocery'
  | 'planner'
  | 'consent'
  | 'admin'
  | 'workflow'
  | 'behavior';

export const EVENT_FAMILIES: readonly EventFamily[] = [
  'recipe',
  'cook',
  'ai',
  'notification',
  'recommendation',
  'grocery',
  'planner',
  'consent',
  'admin',
  'workflow',
  'behavior',
] as const;

export interface EventFamilyDefaults {
  consentPurpose: ConsentPurpose;
  privacyClass: PrivacyClass;
  retentionPolicy: RetentionPolicy;
  visibility: Visibility;
  surface: string;
}

/**
 * Recommended canonical defaults per family. These are MIGRATION DEFAULTS — a producer may override
 * per-event (e.g. an allergy event is P2-sensitive). privacyClass defaults to P1-pseudonymous; the
 * privacy-/audit-sensitive families (consent, admin) use audit-long retention.
 */
export const EVENT_FAMILY_DEFAULTS: Record<EventFamily, EventFamilyDefaults> = {
  recipe: {
    consentPurpose: ConsentPurposeEnum.analytics,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    visibility: VisibilityEnum.private,
    surface: 'recipe',
  },
  cook: {
    consentPurpose: ConsentPurposeEnum.core,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    visibility: VisibilityEnum.private,
    surface: 'cook_mode',
  },
  ai: {
    consentPurpose: ConsentPurposeEnum.personalization,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    visibility: VisibilityEnum.private,
    surface: 'chat',
  },
  notification: {
    consentPurpose: ConsentPurposeEnum.core,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    visibility: VisibilityEnum.private,
    surface: 'notifications',
  },
  recommendation: {
    consentPurpose: ConsentPurposeEnum.personalization,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    visibility: VisibilityEnum.private,
    surface: 'home',
  },
  grocery: {
    consentPurpose: ConsentPurposeEnum.core,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    visibility: VisibilityEnum.private,
    surface: 'grocery',
  },
  planner: {
    consentPurpose: ConsentPurposeEnum.core,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    visibility: VisibilityEnum.private,
    surface: 'planner',
  },
  consent: {
    consentPurpose: ConsentPurposeEnum.core,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.auditLong,
    visibility: VisibilityEnum.private,
    surface: 'onboarding',
  },
  admin: {
    consentPurpose: ConsentPurposeEnum.core,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.auditLong,
    visibility: VisibilityEnum.private,
    surface: 'admin',
  },
  workflow: {
    consentPurpose: ConsentPurposeEnum.core,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.ephemeral30d,
    visibility: VisibilityEnum.private,
    surface: 'system',
  },
  behavior: {
    consentPurpose: ConsentPurposeEnum.analytics,
    privacyClass: PrivacyClassEnum.p1Pseudonymous,
    retentionPolicy: RetentionPolicyEnum.standard365d,
    visibility: VisibilityEnum.private,
    surface: 'home',
  },
};

/* ───────────────────────── Known event types ───────────────────────── */

/** Legacy event types currently emitted (the existing `EventType` enum is the source of truth). */
const LEGACY_EVENT_TYPES: ReadonlySet<string> = new Set<string>(Object.values(EventType));

/**
 * Canonical/ADR event types that are DESIGNED but NOT yet produced in production (planned/staged).
 * Drawn from ADR-0001 §10 + `event-envelope.examples.ts`. Anything here that also exists in the
 * legacy enum is intentionally excluded (it would be legacy_active, not planned).
 */
const CANONICAL_PLANNED_EVENT_TYPES: ReadonlySet<string> = new Set<string>(
  [
    // 'cook_complete' removed 2026-06-22 — reconciled to legacy_active (now in the EventType enum; it IS emitted).
    'ai_answer_feedback',
    'ai_guard_block',
    'notif_suppressed',
    'cooked_share',
    'workflow_run',
    'recommendation_dismissed', // canonical spelling; legacy enum has `recommendation_dismiss`
    'grocery_item_merged',
    'consent_granted',
    'admin_diagnostic_view',
    'b2b_aggregate_snapshot',
    'community_post_published',
    'circle_recipe_share',
  ].filter((t) => !LEGACY_EVENT_TYPES.has(t)),
);

export type KnownEventType = string; // the runtime set = LEGACY ∪ CANONICAL_PLANNED (see isKnownEventType)

export const isKnownEventType = (eventType: string): boolean =>
  LEGACY_EVENT_TYPES.has(eventType) || CANONICAL_PLANNED_EVENT_TYPES.has(eventType);

export type EventTypeMigrationStatus = 'legacy_active' | 'canonical_planned' | 'unknown';

export function getEventTypeMigrationStatus(eventType: string): EventTypeMigrationStatus {
  if (LEGACY_EVENT_TYPES.has(eventType)) return 'legacy_active';
  if (CANONICAL_PLANNED_EVENT_TYPES.has(eventType)) return 'canonical_planned';
  return 'unknown';
}

/* ─────────────────────── Family classification ─────────────────────── */

/**
 * Deterministic family classifier. Explicit prefix/keyword rules over the legacy snake_case enum;
 * returns `'unknown'` when no rule matches (so unknowns are never silently bucketed). Order matters:
 * the most specific prefixes are checked first.
 */
/**
 * Explicit family for canonical/planned event types whose names don't match a prefix rule (social /
 * b2b shares). Checked first so EVERY known canonical type classifies into a real family (never
 * 'unknown') — the contract promises classification for known types.
 */
const CANONICAL_PLANNED_FAMILY_OVERRIDES: Readonly<Record<string, EventFamily>> = {
  cooked_share: 'cook',
  circle_recipe_share: 'recipe',
  community_post_published: 'recipe',
  b2b_aggregate_snapshot: 'workflow',
};

export function classifyEventFamily(eventType: string): EventFamily | 'unknown' {
  const t = (eventType || '').toLowerCase();
  if (!t) return 'unknown';

  // explicit overrides for known canonical types that don't fit a prefix rule
  if (CANONICAL_PLANNED_FAMILY_OVERRIDES[t]) return CANONICAL_PLANNED_FAMILY_OVERRIDES[t];

  // workflow / ops
  if (t === 'workflow_run' || t.startsWith('workflow_') || t.startsWith('ops_') || t.startsWith('ops:')) return 'workflow';
  // consent / privacy / erasure
  if (t.startsWith('consent') || t.startsWith('erasure') || t.startsWith('gdpr')) return 'consent';
  // admin / governance
  if (t.startsWith('admin') || t.startsWith('diagnostic') || t.startsWith('ticket_') || t.startsWith('support_')) return 'admin';
  // ai
  if (t.startsWith('ai_')) return 'ai';
  // notification
  if (t.startsWith('notif')) return 'notification';
  // recommendation (+ explicit negative-feedback signals tied to the reco loop)
  if (t.startsWith('recommendation') || t === 'recipe_skip' || t === 'not_interested' || t === 'quick_exit') {
    return 'recommendation';
  }
  // grocery / shopping
  if (t.startsWith('shopping') || t.startsWith('grocery')) return 'grocery';
  // planner / meal plan
  if (t.startsWith('mealplan') || t.startsWith('meal_plan') || t.startsWith('family_plan')) return 'planner';
  // cook
  if (t === 'cook_complete' || t.startsWith('cook_') || t === 'start_cooking_click') return 'cook';
  // recipe (view/share/favorite/detail-section engagement + recipe authoring)
  if (
    t.startsWith('recipe_') ||
    t.startsWith('favorite') ||
    t.startsWith('add_recipe') ||
    t.startsWith('my_recipe') ||
    /^(nutrition|timing|features|ingredients|tools|steps|tips|faq|excerpt)_/.test(t)
  ) {
    return 'recipe';
  }
  // behavior = the catch-all for user-model-feeding signals/engagement/account/session events
  if (
    t.startsWith('login') ||
    t.startsWith('register') ||
    t.startsWith('logout') ||
    t.startsWith('session_') ||
    t.startsWith('page_view') ||
    t.startsWith('profile') ||
    t.startsWith('preference') ||
    t.startsWith('allergy') ||
    t.startsWith('diet') ||
    t.startsWith('skill') ||
    t.startsWith('search') ||
    t.startsWith('voice_search') ||
    t.startsWith('streak') ||
    t.startsWith('goal') ||
    t.startsWith('badge') ||
    t.startsWith('banner') ||
    t.startsWith('category') ||
    t.startsWith('filter') ||
    t.startsWith('family_member') ||
    t === 'resolve_miss' ||
    t.startsWith('cron_') ||
    t.endsWith('_signal') ||
    t.startsWith('behavior')
  ) {
    return 'behavior';
  }
  return 'unknown';
}

/* ───────────────────────── eventType validator ───────────────────────── */

export interface ValidateEventTypeOptions {
  /** strict = production enforcement; shadow/migration = observe + warn (never silently OK unknown). */
  mode?: 'strict' | 'shadow' | 'migration';
}

export interface EventTypeValidationResult {
  ok: boolean;
  eventType: string;
  known: boolean;
  family: EventFamily | 'unknown';
  migrationStatus: EventTypeMigrationStatus;
  warnings: string[];
  errors: string[];
}

export function validateEventType(
  eventType: unknown,
  options: ValidateEventTypeOptions = {},
): EventTypeValidationResult {
  const mode = options.mode ?? 'strict';
  const et = typeof eventType === 'string' ? eventType : '';
  const known = et !== '' && isKnownEventType(et);
  const family = classifyEventFamily(et);
  const migrationStatus = getEventTypeMigrationStatus(et);
  const warnings: string[] = [];
  const errors: string[] = [];

  if (et === '') {
    errors.push('eventType is required and must be a non-empty string');
    return { ok: false, eventType: et, known: false, family, migrationStatus, warnings, errors };
  }

  if (migrationStatus === 'canonical_planned') {
    warnings.push(`eventType "${et}" is canonical/planned (not yet produced in production)`);
  }

  if (!known) {
    if (mode === 'strict') {
      errors.push(`unknown eventType "${et}" is not allowed in strict mode`);
      return { ok: false, eventType: et, known, family, migrationStatus, warnings, errors };
    }
    // shadow/migration: allowed BUT never silently — flagged not-production-ready.
    warnings.push(`unknown eventType "${et}" allowed in ${mode} mode but NOT production-ready (add it to the taxonomy)`);
  }

  return { ok: true, eventType: et, known, family, migrationStatus, warnings, errors };
}

/* ───────────────────────── Contract descriptor ───────────────────────── */

export const EventTaxonomyContract = {
  schemaVersion: 1,
  families: EVENT_FAMILIES,
  familyDefaults: EVENT_FAMILY_DEFAULTS,
  legacyEventTypeCount: LEGACY_EVENT_TYPES.size,
  canonicalPlannedEventTypeCount: CANONICAL_PLANNED_EVENT_TYPES.size,
  legacyEventTypes: Object.freeze([...LEGACY_EVENT_TYPES].sort()),
  canonicalPlannedEventTypes: Object.freeze([...CANONICAL_PLANNED_EVENT_TYPES].sort()),
} as const;
