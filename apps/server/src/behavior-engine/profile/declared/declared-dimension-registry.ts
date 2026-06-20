/**
 * Declared Dimension Registry (GARNISH-PROFILE-L4-05).
 *
 * The single, extensible catalog of declared profile dimensions. STAGE-2 EXTENSIBILITY: add a new
 * `def(...)` entry here (+ a matching question in the question bank) — no engine rewrite. Guarded so it
 * can never contain a forbidden medical/protected-attribute term in user-facing text, and so sensitive
 * dimensions are always P2 + consent-gated.
 */
import { FORBIDDEN_INFERENCE_TERMS } from '../../signals/signal-registry';
import {
  DeclaredDimensionDef,
  DeclaredGroup,
  DeclaredConsentPurpose,
  DeclaredPrivacyClass,
  DeclaredValueType,
  DeclaredPersistence,
} from './declared-profile.types';

type DefInput = {
  key: string;
  group: DeclaredGroup;
  label: string;
  valueType: DeclaredValueType;
  options?: string[];
  sensitive?: boolean;
  privacyClass?: DeclaredPrivacyClass;
  consentPurpose?: DeclaredConsentPurpose;
  storeAsBand?: boolean;
  recencyHalfLifeDays?: number;
  priority?: number;
  persistence?: DeclaredPersistence;
  safeExplanationTemplate: string;
};

function def(p: DefInput): DeclaredDimensionDef {
  const sensitive = p.sensitive ?? false;
  return {
    key: p.key,
    group: p.group,
    label: p.label,
    valueType: p.valueType,
    options: p.options,
    sensitive,
    // a sensitive dimension is ALWAYS at least P2 (cannot be downgraded by a typo)
    privacyClass: sensitive ? 'P2-sensitive' : (p.privacyClass ?? 'P1-pseudonymous'),
    consentPurpose: p.consentPurpose ?? 'personalization',
    storeAsBand: p.storeAsBand ?? false,
    recencyHalfLifeDays: p.recencyHalfLifeDays ?? 365,
    priority: p.priority ?? 5,
    persistence: p.persistence ?? 'user_fact',
    safeExplanationTemplate: p.safeExplanationTemplate,
  };
}

export const DECLARED_DIMENSIONS: readonly DeclaredDimensionDef[] = [
  // ── context / demographics (sensitive → P2, stored as bands/categories) ──
  def({ key: 'context.age_range', group: 'context', label: 'Age range', valueType: 'band', sensitive: true, storeAsBand: true, recencyHalfLifeDays: 1825, priority: 6, options: ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus', 'prefer_not'], safeExplanationTemplate: 'You told us your age range; used to tailor portion and effort suggestions.' }),
  def({ key: 'context.gender', group: 'context', label: 'Gender', valueType: 'single_select', sensitive: true, recencyHalfLifeDays: 3650, priority: 4, options: ['woman', 'man', 'nonbinary', 'self_describe', 'prefer_not'], safeExplanationTemplate: 'You shared your gender; optional and used only with your consent.' }),
  def({ key: 'context.work_pattern', group: 'context', label: 'Job / work pattern', valueType: 'single_select', sensitive: true, recencyHalfLifeDays: 365, priority: 6, options: ['office_9_5', 'shift_work', 'remote', 'student', 'home_maker', 'retired', 'unemployed', 'other', 'prefer_not'], safeExplanationTemplate: 'Your work pattern helps suggest realistic cooking times on busy days.' }),
  def({ key: 'context.income_band', group: 'context', label: 'Household income band', valueType: 'band', sensitive: true, storeAsBand: true, recencyHalfLifeDays: 365, priority: 3, options: ['low', 'lower_middle', 'middle', 'upper_middle', 'high', 'prefer_not'], safeExplanationTemplate: 'An income band (never an exact figure) helps suggest budget-appropriate recipes.' }),
  def({ key: 'context.household_composition', group: 'context', label: 'Who you cook for', valueType: 'multi_select', sensitive: true, recencyHalfLifeDays: 365, priority: 7, options: ['just_me', 'partner', 'children', 'extended_family', 'roommates', 'guests_often'], safeExplanationTemplate: 'Who you cook for helps size recipes and plans.' }),
  def({ key: 'context.cooks_for_count', group: 'context', label: 'How many people you usually cook for', valueType: 'band', storeAsBand: true, priority: 7, options: ['1', '2', '3_4', '5_plus'], safeExplanationTemplate: 'The number of people you cook for sizes portions and shopping lists.' }),
  def({ key: 'context.time_at_home', group: 'context', label: 'Time at home per day', valueType: 'band', consentPurpose: 'analytics', priority: 4, options: ['low', 'medium', 'high'], safeExplanationTemplate: 'Roughly how much time you are home helps pace meal suggestions.' }),
  def({ key: 'context.exercise_frequency', group: 'context', label: 'Exercise frequency', valueType: 'single_select', sensitive: true, priority: 4, options: ['rarely', 'weekly_1_2', 'weekly_3_5', 'daily', 'prefer_not'], safeExplanationTemplate: 'Activity frequency you shared; used for energy-fit suggestions only.' }),

  // ── dietary profile (mature) ──
  def({ key: 'dietary.pattern', group: 'dietary', label: 'Dietary pattern', valueType: 'single_select', consentPurpose: 'core', priority: 10, persistence: 'user_preference', options: ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian', 'mediterranean', 'keto', 'low_carb', 'paleo', 'halal', 'kosher', 'custom'], safeExplanationTemplate: 'Your dietary pattern filters and ranks the recipes you see.' }),
  def({ key: 'dietary.allergies_intolerances', group: 'dietary', label: 'Allergies & intolerances (with severity)', valueType: 'multi_select', sensitive: true, consentPurpose: 'core', priority: 10, persistence: 'user_allergy', safeExplanationTemplate: 'Allergies and intolerances you declared (with severity) are used to keep unsafe ingredients out of suggestions.' }),
  def({ key: 'dietary.hard_dislikes', group: 'dietary', label: 'Hard dislikes', valueType: 'multi_select', priority: 8, safeExplanationTemplate: 'Ingredients you never want suggested.' }),
  def({ key: 'dietary.cultural_constraints', group: 'dietary', label: 'Cultural / observance-based dietary needs', valueType: 'multi_select', sensitive: true, priority: 6, options: ['halal', 'kosher', 'no_pork', 'no_alcohol', 'no_beef', 'fasting_periods', 'none', 'other'], safeExplanationTemplate: 'Observance-based dietary needs you declared; pork-avoidance (halal/kosher/no_pork) is enforced across recommendations, the recipe lists, search, and meal plans — no-alcohol/no-beef enforcement is being added.' }),

  // ── goals (declared, NON-medical) ──
  def({ key: 'goals.primary', group: 'goals', label: 'Primary food goal(s)', valueType: 'multi_select', sensitive: true, priority: 9, options: ['general', 'eat_healthier', 'weight_loss', 'muscle_gain', 'more_energy', 'save_money', 'save_time', 'learn_cooking', 'none'], safeExplanationTemplate: 'Goals you chose for yourself; used for guidance only, never an assessment.' }),

  // ── history / knowledge ──
  def({ key: 'history.dieted_before', group: 'history', label: 'Tried a diet/eating plan before', valueType: 'boolean', sensitive: true, priority: 3, safeExplanationTemplate: 'Whether you have tried an eating plan before; context only, never assessed.' }),
  def({ key: 'history.researched_nutrition', group: 'history', label: 'Researched nutrition before', valueType: 'boolean', consentPurpose: 'analytics', priority: 2, safeExplanationTemplate: 'Whether you have read about nutrition before; sets explanation depth.' }),
  def({ key: 'history.knowledge_self_rating', group: 'history', label: 'Self-rated food knowledge', valueType: 'scale', priority: 4, options: ['beginner', 'some', 'confident', 'expert'], safeExplanationTemplate: 'How you rate your own food knowledge; sets explanation depth.' }),

  // ── constraints ──
  def({ key: 'constraints.weekly_budget_band', group: 'constraints', label: 'Weekly food budget band', valueType: 'band', storeAsBand: true, priority: 7, persistence: 'user_preference', options: ['tight', 'moderate', 'comfortable', 'flexible'], safeExplanationTemplate: 'A budget band (not an exact figure) ranks recipes by cost-fit.' }),
  def({ key: 'constraints.kitchen_equipment', group: 'constraints', label: 'Kitchen equipment', valueType: 'multi_select', priority: 6, options: ['stovetop', 'oven', 'microwave', 'air_fryer', 'pressure_cooker', 'blender', 'rice_cooker', 'grill', 'minimal'], safeExplanationTemplate: 'Equipment you have so suggested recipes are actually makeable.' }),
  def({ key: 'constraints.cooking_skill', group: 'constraints', label: 'Cooking skill', valueType: 'single_select', consentPurpose: 'core', priority: 9, persistence: 'user_preference', options: ['beginner', 'intermediate', 'advanced'], safeExplanationTemplate: 'Your skill level sets recipe difficulty.' }),
  def({ key: 'constraints.cooking_time_workday', group: 'constraints', label: 'Cooking time on a workday', valueType: 'band', storeAsBand: true, priority: 8, options: ['under_15', '15_30', '30_60', '60_plus'], safeExplanationTemplate: 'How long you can cook on a workday paces weekday suggestions.' }),
  def({ key: 'constraints.cooking_time_weekend', group: 'constraints', label: 'Cooking time on a weekend', valueType: 'band', storeAsBand: true, priority: 5, options: ['under_15', '15_30', '30_60', '60_plus'], safeExplanationTemplate: 'How long you can cook on a weekend paces weekend suggestions.' }),
  def({ key: 'constraints.meal_timing_rhythm', group: 'constraints', label: 'Meal timing / rhythm', valueType: 'single_select', consentPurpose: 'analytics', priority: 4, options: ['three_meals', 'two_meals', 'grazing', 'one_big_meal', 'irregular'], safeExplanationTemplate: 'Your meal rhythm helps time suggestions.' }),
] as const;

/* ───────────────────────────── Lookups ───────────────────────────── */
const BY_KEY = new Map(DECLARED_DIMENSIONS.map((d) => [d.key, d]));
export const getDeclaredDef = (key: string): DeclaredDimensionDef | undefined => BY_KEY.get(key);
export const DECLARED_KEYS: readonly string[] = DECLARED_DIMENSIONS.map((d) => d.key);
export const getDeclaredByGroup = (group: DeclaredGroup): DeclaredDimensionDef[] => DECLARED_DIMENSIONS.filter((d) => d.group === group);

/* ───────────────────────── Registry guard ───────────────────────── */
export interface DeclaredRegistryConsistency {
  ok: boolean;
  total: number;
  sensitiveCount: number;
  uniqueKeys: boolean;
  noForbidden: boolean;
  sensitiveAreP2: boolean;
  bandsForSensitiveNumerics: boolean;
  issues: string[];
}

const VALID_GROUPS = new Set<DeclaredGroup>(['context', 'dietary', 'goals', 'history', 'constraints']);
const VALID_CONSENT = new Set(['core', 'analytics', 'personalization']);

/** Validate the catalog: unique keys, valid groups/consent, sensitive ⇒ P2, no forbidden terms in text. */
export function checkDeclaredRegistryConsistency(): DeclaredRegistryConsistency {
  const issues: string[] = [];
  const keys = new Set<string>();
  let sensitiveAreP2 = true;
  for (const d of DECLARED_DIMENSIONS) {
    if (keys.has(d.key)) issues.push(`duplicate key: ${d.key}`);
    keys.add(d.key);
    if (!VALID_GROUPS.has(d.group)) issues.push(`bad group on ${d.key}`);
    if (d.group !== d.key.split('.')[0]) issues.push(`group/key mismatch on ${d.key}`);
    if (!VALID_CONSENT.has(d.consentPurpose)) issues.push(`bad consentPurpose on ${d.key}`);
    if (d.sensitive && d.privacyClass !== 'P2-sensitive') { sensitiveAreP2 = false; issues.push(`sensitive dim not P2: ${d.key}`); }
    if (!d.safeExplanationTemplate.trim()) issues.push(`empty explanation on ${d.key}`);
  }
  // forbidden-term scan over user-facing text (key/label/explanation). forbiddenInferences-style allow-list n/a here.
  const forbidden: string[] = [];
  for (const d of DECLARED_DIMENSIONS) {
    const text = `${d.key} ${d.label} ${d.safeExplanationTemplate}`.toLowerCase();
    for (const term of FORBIDDEN_INFERENCE_TERMS) if (text.includes(term)) forbidden.push(`${d.key}:${term}`);
  }
  if (forbidden.length) issues.push(...forbidden.map((f) => `forbidden term in ${f}`));

  // sensitive numeric-ish dims (age/income/budget/time/cooks_for) must be banded, not precise
  const mustBand = ['context.age_range', 'context.income_band', 'constraints.weekly_budget_band', 'constraints.cooking_time_workday', 'constraints.cooking_time_weekend', 'context.cooks_for_count'];
  const bandsOk = mustBand.every((k) => getDeclaredDef(k)?.storeAsBand === true);
  if (!bandsOk) issues.push('a numeric/sensitive dimension is not stored as a band');

  return {
    ok: issues.length === 0,
    total: DECLARED_DIMENSIONS.length,
    sensitiveCount: DECLARED_DIMENSIONS.filter((d) => d.sensitive).length,
    uniqueKeys: keys.size === DECLARED_DIMENSIONS.length,
    noForbidden: forbidden.length === 0,
    sensitiveAreP2,
    bandsForSensitiveNumerics: bandsOk,
    issues,
  };
}
