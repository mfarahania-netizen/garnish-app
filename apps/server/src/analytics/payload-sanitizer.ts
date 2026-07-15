/**
 * Analytics ingest privacy core (advisor audit). Free-text user input (search queries, chat messages, notes)
 * can carry incidental PII — names, phones, conditions. trackEvent stores the event payload, so before it is
 * persisted we STRIP known free-text / PII keys and CAP any remaining string, at every nesting level. This is
 * the GDPR-relevant control for the Europe/Holland launch; it is ADD-only safe (structured signal fields like
 * recipeId/position/propensity survive untouched) and never throws.
 *
 * Design note: we redact, we do NOT drop the event — "capture every second / no lost signals" is a founder
 * value (the durable outbox exists for it). Unknown event TYPES are likewise logged, not rejected.
 */
import { EventType } from './event-taxonomy';

const PII_KEYS = new Set([
  'query', 'q', 'text', 'message', 'content', 'body', 'note', 'notes', 'comment', 'prompt', 'input',
  'search', 'searchterm', 'fulltext', 'raw', 'name', 'fullname', 'phone', 'tel', 'mobile', 'email',
  'address', 'reply', 'answer', 'feedback', 'description',
]);
const MAX_STR = 120; // a structured value is short; anything longer is likely free text → truncate
const MAX_DEPTH = 4;
const PII_VALUE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:^|\D)0?9\d{9}(?:\D|$)|Bearer\s+[A-Za-z0-9._-]{8,}|eyJ[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{4,}|(?:postgres|mysql|mongodb(?:\+srv)?):\/\//i;

// Public routing metadata is stored in dedicated columns, so payload redaction cannot protect it.
// Accept pathname-only navigation values and opaque application-generated session identifiers.
export const SAFE_PAGE_PATH_PATTERN = /^\/(?!.*(?:@|\d{10,}))(?:[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*)?$/;
export const SAFE_SESSION_ID_PATTERN = /^(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|sx-[A-Za-z0-9-]{3,100})$/;

export function isSafePagePath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && SAFE_PAGE_PATH_PATTERN.test(value);
}

export function isSafeSessionId(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 128 && SAFE_SESSION_ID_PATTERN.test(value);
}

function sanitize(value: unknown, depth: number): unknown {
  if (typeof value === 'string') {
    if (PII_VALUE.test(value)) return '[redacted]';
    return value.length > MAX_STR ? value.slice(0, MAX_STR) : value;
  }
  if (Array.isArray(value)) return depth >= MAX_DEPTH ? [] : value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === 'object') {
    if (depth >= MAX_DEPTH) return {};
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase())) continue; // drop free-text / PII keys entirely
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return value; // number | boolean | null | undefined — safe as-is
}

/** Redact a stored analytics payload: drop free-text/PII keys, cap strings. Null-safe; never throws. */
export function sanitizePayload(payload: unknown): Record<string, unknown> | null {
  try {
    if (!payload || typeof payload !== 'object') return null;
    return sanitize(payload, 0) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Canonical analytics event types. The authenticated HTTP DTO rejects unknown client types;
 * internal legacy producers remain observable in AnalyticsService until separately migrated. */
export const KNOWN_EVENT_TYPES = new Set<string>([
  // single source: every canonical EventType enum value is known (no taxonomy drift — fixes the dual-list gap).
  ...Object.values(EventType),
  // BE-derived / processor-only types that are NOT in the legacy EventType enum (kept explicitly):
  'ai_feedback', 'ai_error', 'ai_message_send', 'ai_suggestion_generated', 'ai_voice_search',
  'admin_view', 'admin_ticket_reply', 'admin_ticket_status', 'admin_recipe_approve', 'admin_recipe_reject',
  'briefing_accept', 'briefing_view', 'churn_reengagement', 'churn_risk', 'cook_complete',
  'cron_behavior_engine_run', 'favorite_add', 'favorite_remove', 'feedback_negative', 'feedback_positive',
  'for_you', 'mealplan_add', 'mealplan_clear', 'mealplan_generate', 'mealplan_remove', 'not_interested',
  'onboarding_answered', 'page_view', 'preference_update', 'quick_exit', 'recipe_cooked', 'recipe_skip',
  'recipe_view', 'recommendation_attribution', 'recommendation_click', 'recommendation_cook',
  'recommendation_dismiss', 'recommendation_ignore', 'recommendation_impression', 'recommendation_save',
  'search_query', 'search_unmet', 'shopping_item_add', 'shopping_item_remove', 'consent_granted',
  'consent_withdrawn', 'recipe_impression', 'recipe_share',
]);

/** Browser producers observed in apps/web. System/admin/cron/funnel types are deliberately excluded. */
export const CLIENT_EVENT_TYPES = new Set<string>([
  'session_start',
  'page_view',
  'page_dwell',
  'page_clicks',
  'profile_view',
  'profile_edit',
  'profile_navigate',
  'recipe_view',
  'recipe_share',
  'start_cooking_click',
  'cook_complete',
  'favorite_add',
  'favorite_remove',
  'mealplan_add',
  'mealplan_remove',
  'recommendation_click',
  'recommendation_save',
  'recommendation_cook',
  'recommendation_dismiss',
  'search_query',
  'search_unmet',
  'shopping_add_manual',
  'shopping_add_from_plan',
  'portion_scaled',
  'ingredient_swapped',
  'ingredient_removed',
  'ai_message_send',
  'ai_feedback',
]);

export function isKnownEventType(type: string): boolean {
  return KNOWN_EVENT_TYPES.has(type);
}
