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
const PII_KEYS = new Set([
  'query', 'q', 'text', 'message', 'content', 'body', 'note', 'notes', 'comment', 'prompt', 'input',
  'search', 'searchterm', 'fulltext', 'raw', 'name', 'fullname', 'phone', 'tel', 'mobile', 'email',
  'address', 'reply', 'answer', 'feedback', 'description',
]);
const MAX_STR = 120; // a structured value is short; anything longer is likely free text → truncate
const MAX_DEPTH = 4;

function sanitize(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return value.length > MAX_STR ? value.slice(0, MAX_STR) : value;
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

/** The canonical analytics event types (grounded from FE trackEvent + BE processors). Unknown types are still
 *  stored (no lost signals) but flagged, so taxonomy drift is observable and the set can be completed. */
export const KNOWN_EVENT_TYPES = new Set<string>([
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

export function isKnownEventType(type: string): boolean {
  return KNOWN_EVENT_TYPES.has(type);
}
