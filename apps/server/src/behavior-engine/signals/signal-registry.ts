/**
 * Signal Registry v1 (E43-A3).
 *
 * A typed, auditable registry of behavioral signals. ADDITIVE to (does not replace) the legacy
 * `SignalRegistryService` (`signal.registry.ts`). Every entry declares its allowed sources, privacy
 * class, consent purpose, retention, confidence policy, forbidden inferences, and a safe
 * explainability template. The registry is guarded so it can NEVER contain a forbidden
 * medical/diagnostic/protected-attribute signal.
 */

import { EventFamily, getEventTypeMigrationStatus } from '../../analytics/event-taxonomy.contract';
import {
  SignalRegistryEntry,
  SignalFamily,
  SIGNAL_FAMILIES,
  ConfidencePolicy,
  SignalStatus,
} from './signal-types';

/** Default confidence policy (overridable per signal). */
const DEFAULT_CONFIDENCE: ConfidencePolicy = {
  minEvidenceCount: 3,
  recencyHalfLifeDays: 90,
  consistencyWeight: 0.4,
  frequencyWeight: 0.3,
  explicitFeedbackWeight: 0.3,
};

/**
 * Inferences NO signal may ever make. Used both as per-entry documentation and as a hard guard that
 * scans every registry entry's user-facing text (signalKey/description/explainabilityTemplate).
 */
export const FORBIDDEN_INFERENCE_TERMS: readonly string[] = [
  'diagnosis',
  'diagnose',
  'treatment',
  'pregnan', // pregnancy/pregnant
  'eating disorder',
  'anorexia',
  'bulimia',
  'religion',
  'religious',
  'ethnicity',
  'race',
  'political',
  'sexuality',
  'sexual orientation',
  'mental health',
  'depression',
  'anxiety disorder',
  'criminal',
  'medical condition',
  'medical', // defense-in-depth: block standalone "medical" (advice/history/etc.) in any user-facing text
  'condition', // defense-in-depth: a health-app explanation referencing "a condition" is almost always medical
  'disease',
  'disorder',
];

const FORBIDDEN_BASELINE: string[] = [
  'medical diagnosis',
  'treatment need',
  'strict/therapeutic diet plan',
  'pregnancy status',
  'eating disorder',
  'mental health condition',
  'religion / ethnicity / politics / sexuality',
  'precise location',
  'financial status',
  'criminal/legal status',
];

type EntryInput = {
  signalKey: string;
  description: string;
  allowedEventFamilies: EventFamily[];
  allowedEventTypes: string[];
  explainabilityTemplate: string;
  direction?: SignalRegistryEntry['direction'];
  valueType?: SignalRegistryEntry['valueType'];
  privacyClass?: SignalRegistryEntry['privacyClass'];
  consentPurpose?: SignalRegistryEntry['consentPurpose'];
  retentionPolicy?: SignalRegistryEntry['retentionPolicy'];
  confidencePolicy?: ConfidencePolicy;
  forbiddenInferences?: string[];
  status?: SignalStatus;
};

function mk(p: EntryInput): SignalRegistryEntry {
  return {
    signalKey: p.signalKey,
    family: p.signalKey.split('.')[0] as SignalFamily,
    description: p.description,
    allowedEventFamilies: p.allowedEventFamilies,
    allowedEventTypes: p.allowedEventTypes,
    direction: p.direction ?? 'neutral',
    valueType: p.valueType ?? 'score',
    confidencePolicy: p.confidencePolicy ?? DEFAULT_CONFIDENCE,
    privacyClass: p.privacyClass ?? 'P1-pseudonymous',
    consentPurpose: p.consentPurpose ?? 'personalization',
    retentionPolicy: p.retentionPolicy ?? 'standard-365d',
    forbiddenInferences: p.forbiddenInferences ?? FORBIDDEN_BASELINE,
    explainabilityTemplate: p.explainabilityTemplate,
    status: p.status ?? 'active_v1',
  };
}

export const SIGNAL_REGISTRY: readonly SignalRegistryEntry[] = [
  /* ── taste ── */
  mk({ signalKey: 'taste.ingredient_affinity', description: 'Affinity for specific ingredients based on saves/cooks.', allowedEventFamilies: ['recipe', 'recommendation'], allowedEventTypes: ['recipe_saved', 'favorite_add', 'recommendation_save', 'cook_complete'], direction: 'positive', valueType: 'category', explainabilityTemplate: 'Based on repeated saves and cooks of recipes sharing these ingredients.' }),
  mk({ signalKey: 'taste.ingredient_avoidance', description: 'Tendency to skip/dismiss recipes with certain ingredients.', allowedEventFamilies: ['recipe', 'recommendation'], allowedEventTypes: ['recipe_dismissed', 'recommendation_dismiss', 'recommendation_dismissed', 'not_interested'], direction: 'negative', valueType: 'category', explainabilityTemplate: 'Based on repeated dismissals of recipes sharing these ingredients.' }),
  mk({ signalKey: 'taste.cuisine_affinity', description: 'Preference for particular cuisines.', allowedEventFamilies: ['recipe', 'recommendation'], allowedEventTypes: ['recipe_view', 'recipe_viewed', 'favorite_add', 'recommendation_save', 'cook_complete'], direction: 'positive', valueType: 'distribution', explainabilityTemplate: 'Based on which cuisines you view, save, and cook most often.' }),
  mk({ signalKey: 'taste.cuisine_exploration', description: 'Willingness to try unfamiliar cuisines.', allowedEventFamilies: ['recipe', 'recommendation'], allowedEventTypes: ['recipe_view', 'recipe_viewed', 'recommendation_click'], direction: 'mixed', valueType: 'score', explainabilityTemplate: 'Based on how often you engage with cuisines you rarely cook.' }),
  mk({ signalKey: 'taste.flavor_pattern', description: 'Recurring flavor-profile engagement (e.g. spicy, savory).', allowedEventFamilies: ['recipe'], allowedEventTypes: ['recipe_view', 'recipe_viewed', 'favorite_add', 'cook_complete'], direction: 'mixed', valueType: 'distribution', explainabilityTemplate: 'Based on recurring flavor profiles in the recipes you engage with.' }),
  mk({ signalKey: 'taste.repetition_preference', description: 'Preference for repeating known recipes vs variety.', allowedEventFamilies: ['recipe', 'recommendation'], allowedEventTypes: ['recipe_view', 'recipe_viewed', 'cook_complete', 'recommendation_cook'], direction: 'mixed', valueType: 'score', explainabilityTemplate: 'Based on how often you return to recipes you have cooked before.' }),

  /* ── effort / skill ── */
  mk({ signalKey: 'effort.quick_meal_preference', description: 'Preference for quick/low-time recipes.', allowedEventFamilies: ['recipe', 'planner'], allowedEventTypes: ['recipe_view', 'recipe_viewed', 'cook_complete'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on how often you engage with quick recipes.' }),
  mk({ signalKey: 'effort.low_prep_tolerance', description: 'Tolerance for higher-prep recipes (low = avoids prep).', allowedEventFamilies: ['recipe'], allowedEventTypes: ['recipe_view', 'recipe_viewed', 'recipe_skip'], direction: 'mixed', valueType: 'score', explainabilityTemplate: 'Based on whether you continue with or skip higher-prep recipes.' }),
  mk({ signalKey: 'effort.complex_recipe_readiness', description: 'Readiness to take on more complex recipes.', allowedEventFamilies: ['recipe', 'cook'], allowedEventTypes: ['cook_complete', 'recipe_view', 'recipe_viewed'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on your completion of more involved recipes over time.' }),
  mk({ signalKey: 'skill.cook_completion_growth', description: 'Growth in completing cooks over time.', allowedEventFamilies: ['cook'], allowedEventTypes: ['cook_complete'], direction: 'positive', valueType: 'score', status: 'planned', explainabilityTemplate: 'Based on the trend of recipes you finish cooking over time.' }),
  mk({ signalKey: 'skill.recipe_step_dropoff', description: 'Tendency to drop off mid-recipe.', allowedEventFamilies: ['recipe', 'cook'], allowedEventTypes: ['recipe_skip', 'quick_exit'], direction: 'negative', valueType: 'score', explainabilityTemplate: 'Based on how often you leave recipes before finishing.' }),
  mk({ signalKey: 'skill.technique_confidence', description: 'Confidence with cooking techniques (inferred from completions).', allowedEventFamilies: ['cook'], allowedEventTypes: ['cook_complete'], direction: 'positive', valueType: 'score', status: 'planned', explainabilityTemplate: 'Based on completing recipes that use particular techniques.' }),

  /* ── routine ── */
  mk({ signalKey: 'routine.meal_time_pattern', description: 'Typical times of day you engage with meals.', allowedEventFamilies: ['recipe', 'planner', 'behavior'], allowedEventTypes: ['recipe_view', 'recipe_viewed', 'cook_complete'], direction: 'neutral', valueType: 'distribution', consentPurpose: 'analytics', explainabilityTemplate: 'Based on the times of day you usually browse or cook.' }),
  mk({ signalKey: 'routine.weekly_planning_pattern', description: 'Weekly meal-planning rhythm.', allowedEventFamilies: ['planner'], allowedEventTypes: ['mealplan_add', 'mealplan_generate', 'planner_autofill_accepted'], direction: 'positive', valueType: 'distribution', consentPurpose: 'analytics', explainabilityTemplate: 'Based on which days you tend to plan meals.' }),
  mk({ signalKey: 'routine.shopping_day_pattern', description: 'Recurring grocery/shopping days.', allowedEventFamilies: ['grocery'], allowedEventTypes: ['shopping_item_add', 'shopping_add_from_plan', 'grocery_item_merged'], direction: 'neutral', valueType: 'distribution', consentPurpose: 'analytics', explainabilityTemplate: 'Based on which days you usually build your shopping list.' }),
  mk({ signalKey: 'routine.late_night_decision', description: 'Late-evening meal decision tendency (engagement timing only).', allowedEventFamilies: ['behavior', 'recipe'], allowedEventTypes: ['recipe_view', 'recipe_viewed'], direction: 'neutral', valueType: 'distribution', consentPurpose: 'analytics', explainabilityTemplate: 'Based on how often you browse meals late in the evening.' }),
  mk({ signalKey: 'routine.weekend_cooking_pattern', description: 'Weekend vs weekday cooking rhythm.', allowedEventFamilies: ['cook', 'planner'], allowedEventTypes: ['cook_complete', 'mealplan_add'], direction: 'neutral', valueType: 'distribution', consentPurpose: 'analytics', explainabilityTemplate: 'Based on whether you cook more on weekends than weekdays.' }),

  /* ── recommendation behavior ── */
  mk({ signalKey: 'reco.save_affinity', description: 'Likelihood to save recommended recipes.', allowedEventFamilies: ['recommendation', 'recipe'], allowedEventTypes: ['recommendation_save', 'favorite_add', 'recipe_saved'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on how often you save the recipes we suggest.' }),
  mk({ signalKey: 'reco.dismiss_avoidance', description: 'Tendency to dismiss recommendations.', allowedEventFamilies: ['recommendation'], allowedEventTypes: ['recommendation_dismiss', 'recommendation_dismissed', 'recommendation_ignore', 'not_interested'], direction: 'negative', valueType: 'score', explainabilityTemplate: 'Based on how often you dismiss suggested recipes.' }),
  mk({ signalKey: 'reco.click_curiosity', description: 'Curiosity / click-through on recommendations.', allowedEventFamilies: ['recommendation', 'recipe'], allowedEventTypes: ['recommendation_click', 'recipe_view', 'recipe_viewed'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on how often you open the recipes we suggest.' }),
  mk({ signalKey: 'reco.cook_conversion', description: 'Conversion from recommendation to cooking.', allowedEventFamilies: ['recommendation', 'cook'], allowedEventTypes: ['recommendation_cook', 'cook_complete'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on how often suggested recipes lead to you cooking.' }),
  mk({ signalKey: 'reco.exposure_fatigue', description: 'Fatigue from repeated exposure to the same items.', allowedEventFamilies: ['recommendation'], allowedEventTypes: ['recommendation_impression'], direction: 'negative', valueType: 'score', consentPurpose: 'analytics', explainabilityTemplate: 'Based on repeatedly seeing the same suggestions without acting on them.' }),
  mk({ signalKey: 'reco.repeat_success', description: 'Repeated successful recommendations of a type.', allowedEventFamilies: ['recommendation', 'cook'], allowedEventTypes: ['recommendation_cook', 'cook_complete'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on suggestion types that you repeatedly cook.' }),

  /* ── notification ── */
  mk({ signalKey: 'notif.open_affinity', description: 'Tendency to open notifications.', allowedEventFamilies: ['notification'], allowedEventTypes: ['notif_open', 'notification_read'], direction: 'positive', valueType: 'score', consentPurpose: 'core', explainabilityTemplate: 'Based on how often you open the notifications you receive.' }),
  mk({ signalKey: 'notif.dismiss_fatigue', description: 'Fatigue from dismissing notifications.', allowedEventFamilies: ['notification'], allowedEventTypes: ['notif_dismiss', 'notification_delete'], direction: 'negative', valueType: 'score', consentPurpose: 'core', explainabilityTemplate: 'Based on how often you dismiss notifications without opening them.' }),
  mk({ signalKey: 'notif.quiet_hours_inferred', description: 'Inferred quiet hours (engagement-based, non-location).', allowedEventFamilies: ['notification', 'behavior'], allowedEventTypes: ['notif_open', 'notif_dismiss', 'notification_read'], direction: 'neutral', valueType: 'distribution', consentPurpose: 'core', explainabilityTemplate: 'Based on the hours when you rarely engage with notifications.' }),
  mk({ signalKey: 'notif.suppression_candidate', description: 'Whether a notification is a good suppression candidate.', allowedEventFamilies: ['notification'], allowedEventTypes: ['notif_suppressed', 'notif_dismiss'], direction: 'negative', valueType: 'boolean', consentPurpose: 'core', retentionPolicy: 'audit-long', status: 'planned', explainabilityTemplate: 'Based on low engagement with this notification type, it may be suppressed.' }),
  mk({ signalKey: 'notif.timing_fit', description: 'Fit between notification timing and engagement.', allowedEventFamilies: ['notification'], allowedEventTypes: ['notif_open', 'notif_dismiss'], direction: 'mixed', valueType: 'score', consentPurpose: 'core', status: 'planned', explainabilityTemplate: 'Based on whether notifications arrive when you tend to engage.' }),

  /* ── planner / grocery ── */
  mk({ signalKey: 'planner.autofill_acceptance', description: 'Acceptance of planner autofill suggestions.', allowedEventFamilies: ['planner'], allowedEventTypes: ['planner_autofill_accepted', 'mealplan_add'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on how often you keep autofilled plan suggestions.' }),
  mk({ signalKey: 'planner.plan_completion_intent', description: 'Intent to complete planned meals.', allowedEventFamilies: ['planner', 'cook'], allowedEventTypes: ['mealplan_add', 'mealplan_generate', 'cook_complete'], direction: 'positive', valueType: 'score', consentPurpose: 'analytics', explainabilityTemplate: 'Based on how often planned meals lead to cooking.' }),
  mk({ signalKey: 'planner.plan_abandonment', description: 'Tendency to abandon plans.', allowedEventFamilies: ['planner'], allowedEventTypes: ['mealplan_clear', 'mealplan_remove'], direction: 'negative', valueType: 'score', consentPurpose: 'analytics', explainabilityTemplate: 'Based on how often plans are cleared without being used.' }),
  mk({ signalKey: 'grocery.merge_preference', description: 'Preference for merging duplicate grocery items.', allowedEventFamilies: ['grocery'], allowedEventTypes: ['grocery_item_merged', 'shopping_item_add'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on how often you merge duplicate items on your list.' }),
  mk({ signalKey: 'grocery.list_completion', description: 'Completion of shopping lists.', allowedEventFamilies: ['grocery'], allowedEventTypes: ['shopping_item_toggle', 'shopping_toggle'], direction: 'positive', valueType: 'score', consentPurpose: 'analytics', explainabilityTemplate: 'Based on how often you check off items on your list.' }),
  mk({ signalKey: 'grocery.friction_signal', description: 'Friction while managing grocery lists.', allowedEventFamilies: ['grocery'], allowedEventTypes: ['shopping_item_remove', 'shopping_remove'], direction: 'negative', valueType: 'score', consentPurpose: 'analytics', explainabilityTemplate: 'Based on how often list items are removed rather than used.' }),

  /* ── ai interaction ── */
  mk({ signalKey: 'ai.help_seeking_pattern', description: 'How often the user seeks AI help.', allowedEventFamilies: ['ai'], allowedEventTypes: ['ai_message_send', 'ai_chat_started'], direction: 'neutral', valueType: 'count', explainabilityTemplate: 'Based on how often you start chats with the assistant.' }),
  mk({ signalKey: 'ai.explanation_depth_preference', description: 'Preference for deeper vs shorter AI explanations.', allowedEventFamilies: ['ai'], allowedEventTypes: ['ai_message_send', 'ai_answer_feedback'], direction: 'mixed', valueType: 'score', explainabilityTemplate: 'Based on the kinds of answers you engage with most.' }),
  mk({ signalKey: 'ai.feedback_positive', description: 'Positive feedback on AI answers.', allowedEventFamilies: ['ai'], allowedEventTypes: ['ai_answer_feedback', 'ai_response_like'], direction: 'positive', valueType: 'score', explainabilityTemplate: 'Based on the assistant answers you marked helpful.' }),
  mk({ signalKey: 'ai.feedback_negative', description: 'Negative feedback on AI answers.', allowedEventFamilies: ['ai'], allowedEventTypes: ['ai_answer_feedback', 'ai_response_dislike'], direction: 'negative', valueType: 'score', explainabilityTemplate: 'Based on the assistant answers you marked unhelpful.' }),
  mk({ signalKey: 'ai.safety_boundary_trigger', description: 'How often a request hit a safety boundary (system-side; never a label about the user).', allowedEventFamilies: ['ai'], allowedEventTypes: ['ai_guard_block'], direction: 'negative', valueType: 'count', privacyClass: 'P2-sensitive', consentPurpose: 'core', retentionPolicy: 'audit-long', status: 'planned', forbiddenInferences: [...FORBIDDEN_BASELINE, 'no inference about the user from blocked content; records the system boundary event only'], explainabilityTemplate: 'Based on requests that the safety system declined to answer.' }),

  /* ── onboarding / cold-start ── */
  mk({ signalKey: 'onboarding.taste_seed', description: 'Cold-start taste seed from onboarding answers.', allowedEventFamilies: ['behavior'], allowedEventTypes: ['onboarding_answered', 'preference_update'], direction: 'neutral', valueType: 'category', consentPurpose: 'core', explainabilityTemplate: 'Based on the taste preferences you shared during onboarding.' }),
  mk({ signalKey: 'onboarding.effort_seed', description: 'Cold-start effort seed from onboarding answers.', allowedEventFamilies: ['behavior'], allowedEventTypes: ['onboarding_answered', 'preference_update'], direction: 'neutral', valueType: 'category', consentPurpose: 'core', explainabilityTemplate: 'Based on the time/effort preferences you shared during onboarding.' }),
  mk({ signalKey: 'onboarding.skill_seed', description: 'Cold-start skill seed from onboarding answers.', allowedEventFamilies: ['behavior'], allowedEventTypes: ['onboarding_answered', 'skill_changed'], direction: 'neutral', valueType: 'category', consentPurpose: 'core', explainabilityTemplate: 'Based on the cooking-skill level you shared during onboarding.' }),
  mk({ signalKey: 'onboarding.notification_preference_seed', description: 'Cold-start notification preference seed.', allowedEventFamilies: ['behavior', 'notification'], allowedEventTypes: ['onboarding_answered'], direction: 'neutral', valueType: 'category', consentPurpose: 'core', status: 'planned', explainabilityTemplate: 'Based on the notification preferences you chose during onboarding.' }),
  mk({ signalKey: 'onboarding.exploration_seed', description: 'Cold-start exploration appetite seed.', allowedEventFamilies: ['behavior'], allowedEventTypes: ['onboarding_answered'], direction: 'neutral', valueType: 'score', consentPurpose: 'core', status: 'planned', explainabilityTemplate: 'Based on how adventurous you said you are during onboarding.' }),

  /* ── PROFILE-L4-05: additional OBSERVED signals (status 'planned' — backend contracts now;
        emission wiring from real UI is a later phase. Novel event types ⇒ taxonomy status 'planned'). ── */
  mk({ signalKey: 'taste.recipe_dwell', description: 'How long you spend reading a recipe (engagement depth).', allowedEventFamilies: ['recipe'], allowedEventTypes: ['recipe_dwell_ms'], direction: 'positive', valueType: 'score', status: 'planned', confidencePolicy: { minEvidenceCount: 4, recencyHalfLifeDays: 60, consistencyWeight: 0.4, frequencyWeight: 0.4, explicitFeedbackWeight: 0.2 }, explainabilityTemplate: 'Based on how long you spend reading recipes of this kind.' }),
  mk({ signalKey: 'taste.section_focus', description: 'Which recipe section you view most (ingredients, steps, tips).', allowedEventFamilies: ['recipe'], allowedEventTypes: ['recipe_section_view'], direction: 'neutral', valueType: 'distribution', status: 'planned', explainabilityTemplate: 'Based on which recipe sections you open most often.' }),
  mk({ signalKey: 'taste.repeat_cook', description: 'Cooking the same recipe again — a strong preference signal.', allowedEventFamilies: ['cook', 'recipe'], allowedEventTypes: ['recipe_repeat_cook'], direction: 'positive', valueType: 'count', status: 'planned', confidencePolicy: { minEvidenceCount: 2, recencyHalfLifeDays: 120, consistencyWeight: 0.5, frequencyWeight: 0.2, explicitFeedbackWeight: 0.3 }, explainabilityTemplate: 'Based on recipes you cook more than once.' }),
  mk({ signalKey: 'taste.explicit_like', description: 'Explicit like on a recipe.', allowedEventFamilies: ['recipe'], allowedEventTypes: ['recipe_liked'], direction: 'positive', valueType: 'score', status: 'planned', explainabilityTemplate: 'Based on the recipes you explicitly like.' }),
  mk({ signalKey: 'taste.unmet_search_demand', description: 'Searches that returned no results — wanted but missing.', allowedEventFamilies: ['recipe', 'behavior'], allowedEventTypes: ['search_empty_no_result'], direction: 'neutral', valueType: 'category', consentPurpose: 'analytics', status: 'planned', explainabilityTemplate: 'Based on searches that did not return a match, so we can fill the gap.' }),
  mk({ signalKey: 'reco.save_without_cook', description: 'Saving a recipe without cooking it (weaker intent than a cook).', allowedEventFamilies: ['recipe', 'recommendation'], allowedEventTypes: ['recipe_saved_no_cook'], direction: 'mixed', valueType: 'score', status: 'planned', explainabilityTemplate: 'Based on recipes you save but have not cooked yet.' }),
  mk({ signalKey: 'routine.scroll_velocity', description: 'How quickly you scroll while browsing (engagement pace).', allowedEventFamilies: ['behavior', 'recipe'], allowedEventTypes: ['recipe_scroll_velocity'], direction: 'neutral', valueType: 'score', consentPurpose: 'analytics', status: 'planned', explainabilityTemplate: 'Based on how quickly you scroll while browsing recipes.' }),
  mk({ signalKey: 'routine.open_time_of_day', description: 'Time of day you open recipes.', allowedEventFamilies: ['recipe', 'behavior'], allowedEventTypes: ['recipe_open_time'], direction: 'neutral', valueType: 'distribution', consentPurpose: 'analytics', status: 'planned', explainabilityTemplate: 'Based on the times of day you usually open recipes.' }),
  mk({ signalKey: 'skill.cookmode_abandonment', description: 'Leaving cook mode before finishing.', allowedEventFamilies: ['cook'], allowedEventTypes: ['cookmode_abandon'], direction: 'negative', valueType: 'score', status: 'planned', explainabilityTemplate: 'Based on how often you leave cook mode before finishing.' }),
  mk({ signalKey: 'grocery.list_edit_pattern', description: 'How you edit your shopping list (adds, removes, reorders).', allowedEventFamilies: ['grocery'], allowedEventTypes: ['shopping_list_edited'], direction: 'neutral', valueType: 'distribution', consentPurpose: 'analytics', status: 'planned', explainabilityTemplate: 'Based on how you adjust your shopping list over time.' }),
  mk({ signalKey: 'ai.question_satisfaction', description: 'Satisfaction with an assistant answer you asked for.', allowedEventFamilies: ['ai'], allowedEventTypes: ['ai_question_satisfaction'], direction: 'mixed', valueType: 'score', status: 'planned', explainabilityTemplate: 'Based on whether the assistant answers met what you asked.' }),
];

/* ───────────────────────────── Lookups ───────────────────────────── */

const BY_KEY: ReadonlyMap<string, SignalRegistryEntry> = new Map(SIGNAL_REGISTRY.map((s) => [s.signalKey, s]));

export const getSignal = (signalKey: string): SignalRegistryEntry | undefined => BY_KEY.get(signalKey);
export const getSignalsByFamily = (family: SignalFamily): SignalRegistryEntry[] =>
  SIGNAL_REGISTRY.filter((s) => s.family === family);
export const getActiveSignals = (): SignalRegistryEntry[] => SIGNAL_REGISTRY.filter((s) => s.status === 'active_v1');
export const SIGNAL_KEYS: readonly string[] = SIGNAL_REGISTRY.map((s) => s.signalKey);

/* ───────────────────────── Forbidden-signal guard ───────────────────────── */

export interface ForbiddenScanResult {
  ok: boolean;
  violations: { signalKey: string; field: string; term: string }[];
}

/**
 * Scan every registry entry's USER-FACING text (signalKey, description, explainabilityTemplate) for
 * forbidden medical/diagnostic/protected-attribute terms. `forbiddenInferences` is the allow-listed
 * place where such terms may appear (as things the signal must NOT do), so it is NOT scanned.
 */
export function scanForForbiddenSignals(registry: readonly SignalRegistryEntry[] = SIGNAL_REGISTRY): ForbiddenScanResult {
  const violations: { signalKey: string; field: string; term: string }[] = [];
  for (const e of registry) {
    for (const [field, text] of [
      ['signalKey', e.signalKey],
      ['description', e.description],
      ['explainabilityTemplate', e.explainabilityTemplate],
    ] as const) {
      const lower = text.toLowerCase();
      for (const term of FORBIDDEN_INFERENCE_TERMS) {
        if (lower.includes(term)) violations.push({ signalKey: e.signalKey, field, term });
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

/* ───────────────────────── Consistency / honesty check ───────────────────────── */

const VALID_DIRECTION = new Set(['positive', 'negative', 'neutral', 'mixed']);
const VALID_VALUE = new Set(['score', 'count', 'category', 'boolean', 'distribution']);
const VALID_PRIVACY = new Set(['P1-pseudonymous', 'P2-sensitive']);
const VALID_CONSENT = new Set(['personalization', 'analytics', 'core']);
const VALID_RETENTION = new Set(['standard-365d', 'audit-long', 'ephemeral-30d']);
const VALID_STATUS = new Set(['active_v1', 'planned', 'blocked']);

/** Status implied by sources: active_v1 if any allowed event type is legacy_active today, else planned. */
export function expectedStatusFromSources(entry: SignalRegistryEntry): 'active_v1' | 'planned' {
  const hasLegacySource = entry.allowedEventTypes.some((t) => getEventTypeMigrationStatus(t) === 'legacy_active');
  return hasLegacySource ? 'active_v1' : 'planned';
}

export interface RegistryConsistency {
  ok: boolean;
  total: number;
  active: number;
  planned: number;
  uniqueKeys: boolean;
  familiesCovered: string[];
  noForbidden: boolean;
  statusGroundedInTaxonomy: boolean;
  b2bAbsent: boolean;
  issues: string[];
}

export function checkRegistryConsistency(): RegistryConsistency {
  const issues: string[] = [];
  const keys = new Set<string>();
  let statusGrounded = true;
  let b2bAbsent = true;

  for (const e of SIGNAL_REGISTRY) {
    if (keys.has(e.signalKey)) issues.push(`duplicate signalKey: ${e.signalKey}`);
    keys.add(e.signalKey);
    if (!SIGNAL_FAMILIES.includes(e.family)) issues.push(`bad family on ${e.signalKey}: ${e.family}`);
    if (e.family !== e.signalKey.split('.')[0]) issues.push(`family/key mismatch on ${e.signalKey}`);
    if (!VALID_DIRECTION.has(e.direction)) issues.push(`bad direction on ${e.signalKey}`);
    if (!VALID_VALUE.has(e.valueType)) issues.push(`bad valueType on ${e.signalKey}`);
    if (!VALID_PRIVACY.has(e.privacyClass)) issues.push(`bad privacyClass on ${e.signalKey}`);
    if (!VALID_CONSENT.has(e.consentPurpose)) issues.push(`bad consentPurpose on ${e.signalKey}`);
    if (!VALID_RETENTION.has(e.retentionPolicy)) issues.push(`bad retentionPolicy on ${e.signalKey}`);
    if (!VALID_STATUS.has(e.status)) issues.push(`bad status on ${e.signalKey}`);
    if (e.allowedEventTypes.length === 0) issues.push(`no allowedEventTypes on ${e.signalKey}`);
    if (e.confidencePolicy.minEvidenceCount < 1) issues.push(`bad minEvidenceCount on ${e.signalKey}`);
    if (e.forbiddenInferences.length === 0) issues.push(`empty forbiddenInferences on ${e.signalKey}`);
    if (!e.explainabilityTemplate.trim()) issues.push(`empty explainabilityTemplate on ${e.signalKey}`);
    // consentPurpose must never be b2b_aggregate in v1
    if ((e.consentPurpose as string) === 'b2b_aggregate') { b2bAbsent = false; issues.push(`b2b_aggregate consent on ${e.signalKey}`); }
    // active/planned status must be grounded in the taxonomy (blocked is a manual override)
    if (e.status !== 'blocked' && e.status !== expectedStatusFromSources(e)) {
      statusGrounded = false;
      issues.push(`status "${e.status}" on ${e.signalKey} not grounded (expected ${expectedStatusFromSources(e)})`);
    }
  }

  const forbidden = scanForForbiddenSignals();
  if (!forbidden.ok) issues.push(...forbidden.violations.map((v) => `forbidden term "${v.term}" in ${v.signalKey}.${v.field}`));

  const familiesCovered = [...new Set(SIGNAL_REGISTRY.map((s) => s.family))];

  return {
    ok: issues.length === 0,
    total: SIGNAL_REGISTRY.length,
    active: SIGNAL_REGISTRY.filter((s) => s.status === 'active_v1').length,
    planned: SIGNAL_REGISTRY.filter((s) => s.status === 'planned').length,
    uniqueKeys: keys.size === SIGNAL_REGISTRY.length,
    familiesCovered,
    noForbidden: forbidden.ok,
    statusGroundedInTaxonomy: statusGrounded,
    b2bAbsent,
    issues,
  };
}
