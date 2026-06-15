/**
 * Retention policy map (E39-1E) — the single source of truth for which data classes may be pruned.
 *
 * Conservative by construction: only `standard_365d` and `ephemeral_30d` are EVER prune candidates,
 * and even those are dry-run-only in E39-1E. Everything else (audit_long / user_owned_active /
 * review_required) is excluded. A model not listed here is treated as `review_required` (excluded).
 *
 * Aligns with ADR-0001 §8: standard-365d (pruned by cron), audit-long (append-only, excluded),
 * ephemeral-30d (debug).
 */

export type RetentionClass =
  | 'audit_long' // compliance/audit proof — append-only, NEVER pruned by the standard job
  | 'standard_365d' // analytics/events/behaviour time-series — prune candidates after 365 days
  | 'ephemeral_30d' // debug/temp — prune candidates after 30 days
  | 'user_owned_active' // user's own content — handled by erasure/export, NOT by retention
  | 'review_required'; // ambiguous / derived state / reference content — excluded until a policy decision

export interface RetentionRule {
  /** Prisma delegate name (camelCase). */
  model: string;
  class: RetentionClass;
  /** Timestamp column used for the age cutoff (only for prunable classes). */
  timeField?: string;
  /** Age threshold in days (only for prunable classes). */
  cutoffDays?: number;
  note?: string;
}

export const STANDARD_CUTOFF_DAYS = 365;
export const EPHEMERAL_CUTOFF_DAYS = 30;

/** Every model in the Prisma schema, classified exactly once. */
export const RETENTION_POLICY: readonly RetentionRule[] = [
  // ── audit_long — EXCLUDED from prune (compliance/audit proof; see E39-1B tombstones) ──
  { model: 'consentLog', class: 'audit_long', note: 'consent proof' },
  { model: 'userAuditLog', class: 'audit_long', note: 'audit evidence' },
  { model: 'erasureEvent', class: 'audit_long', note: 'erasure proof ledger' },
  { model: 'dataAccessLog', class: 'audit_long', note: 'access audit' },
  { model: 'aICallLog', class: 'audit_long', note: 'AI cost/safety audit trail' },

  // ── standard_365d — DRY-RUN prune candidates (analytics/events/behaviour time-series) ──
  { model: 'userEvent', class: 'standard_365d', timeField: 'timestamp', cutoffDays: STANDARD_CUTOFF_DAYS },
  { model: 'userSession', class: 'standard_365d', timeField: 'startTime', cutoffDays: STANDARD_CUTOFF_DAYS },
  { model: 'signalObservation', class: 'standard_365d', timeField: 'observedAt', cutoffDays: STANDARD_CUTOFF_DAYS },
  { model: 'userBehaviorTimeline', class: 'standard_365d', timeField: 'recordedAt', cutoffDays: STANDARD_CUTOFF_DAYS },
  { model: 'recommendationExposure', class: 'standard_365d', timeField: 'viewedAt', cutoffDays: STANDARD_CUTOFF_DAYS },
  { model: 'recommendationAttributionEvent', class: 'standard_365d', timeField: 'occurredAt', cutoffDays: STANDARD_CUTOFF_DAYS },
  { model: 'featureContributionLog', class: 'standard_365d', timeField: 'createdAt', cutoffDays: STANDARD_CUTOFF_DAYS },
  { model: 'userOutcome', class: 'standard_365d', timeField: 'recordedAt', cutoffDays: STANDARD_CUTOFF_DAYS },
  { model: 'recommendationMetrics', class: 'standard_365d', timeField: 'metricDate', cutoffDays: STANDARD_CUTOFF_DAYS, note: 'aggregate, no userId' },

  // ── ephemeral_30d — reserved; no current model qualifies ──

  // ── user_owned_active — EXCLUDED (handled by erasure/export, not retention) ──
  { model: 'user', class: 'user_owned_active' },
  { model: 'userPreference', class: 'user_owned_active' },
  { model: 'userAllergy', class: 'user_owned_active' },
  { model: 'userCuisine', class: 'user_owned_active' },
  { model: 'userHealthGoal', class: 'user_owned_active' },
  { model: 'favoriteRecipe', class: 'user_owned_active' },
  { model: 'mealPlan', class: 'user_owned_active' },
  { model: 'mealSlot', class: 'user_owned_active' },
  { model: 'shoppingList', class: 'user_owned_active' },
  { model: 'shoppingItem', class: 'user_owned_active' },
  { model: 'notification', class: 'user_owned_active', note: 'user-owned; pruning old notifications is a future product decision' },
  { model: 'supportTicket', class: 'user_owned_active' },
  { model: 'ticketReply', class: 'user_owned_active' },
  { model: 'chatMessage', class: 'user_owned_active' },
  { model: 'userFact', class: 'user_owned_active' },
  { model: 'preferenceHistory', class: 'user_owned_active', note: 'user-owned preference-change history (allergy/health/diet) — audit trail, NOT pruned; handled by erasure/export' },
  { model: 'userBehaviorProfile', class: 'user_owned_active', note: 'current profile state' },
  { model: 'recipe', class: 'user_owned_active', note: 'user-authored or catalog content' },
  // GAMIFY-L4-11 — user-owned gamification state; erased via Cascade, not retention-pruned
  { model: 'userStreak', class: 'user_owned_active', note: 'user-owned streak state; erased with the user' },
  { model: 'userAchievement', class: 'user_owned_active', note: 'user-owned unlocked achievements; erased with the user' },
  { model: 'userProgress', class: 'user_owned_active', note: 'user-owned mastery/progress; erased with the user' },
  { model: 'gamificationEvent', class: 'user_owned_active', note: 'user-owned award ledger; erased with the user' },

  // ── review_required — EXCLUDED (derived state / reference content; pending a policy decision) ──
  { model: 'userFeatureVector', class: 'review_required', note: 'current derived state, regenerable' },
  { model: 'userFeature', class: 'review_required', note: 'current derived state' },
  { model: 'userIdentityDimension', class: 'review_required', note: 'current derived state' },
  { model: 'userBehaviorSignal', class: 'review_required', note: 'current derived state' },
  { model: 'userEngagementSnapshot', class: 'review_required', note: 'current snapshot (1/user), not time-series' },
  { model: 'userHealthSnapshot', class: 'review_required', note: 'current snapshot (1/user)' },
  { model: 'userIdentitySnapshot', class: 'review_required', note: 'current snapshot (1/user)' },
  { model: 'userRetentionSnapshot', class: 'review_required', note: 'current snapshot (1/user)' },
  { model: 'experimentAssignment', class: 'review_required', note: 'A/B assignment tied to user' },
  { model: 'allergy', class: 'review_required', note: 'reference data' },
  { model: 'cuisine', class: 'review_required', note: 'reference data' },
  { model: 'healthGoal', class: 'review_required', note: 'reference data' },
  { model: 'ingredient', class: 'review_required', note: 'reference content' },
  { model: 'recipeIngredient', class: 'review_required', note: 'recipe content' },
  { model: 'recipeStep', class: 'review_required', note: 'recipe content' },
  { model: 'nutrition', class: 'review_required', note: 'recipe content' },
  { model: 'searchTerm', class: 'review_required', note: 'recipe content' },
  { model: 'experiment', class: 'review_required', note: 'experiment config' },
];

/** Prunable rules (the ONLY models the dry-run inspects). */
export function prunableRules(): RetentionRule[] {
  return RETENTION_POLICY.filter((r) => (r.class === 'standard_365d' || r.class === 'ephemeral_30d') && r.timeField && r.cutoffDays).map((r) => ({ ...r }));
}

/** Models excluded from prune, grouped by class. */
export function excludedByClass(): Record<string, string[]> {
  const out: Record<string, string[]> = { audit_long: [], user_owned_active: [], review_required: [] };
  for (const r of RETENTION_POLICY) if (r.class in out) out[r.class].push(r.model);
  return out;
}

/** Look up a model's class; unknown models are treated as review_required (excluded). */
export function classOf(model: string): RetentionClass {
  return RETENTION_POLICY.find((r) => r.model === model)?.class ?? 'review_required';
}
