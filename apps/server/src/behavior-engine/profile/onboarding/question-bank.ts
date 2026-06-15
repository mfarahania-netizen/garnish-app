/**
 * Onboarding Question Bank (GARNISH-PROFILE-L4-05) — backend contract, NO UI.
 *
 * One typed question per declared dimension, DERIVED from the declared registry (so the bank can
 * never drift from the catalog — stage-2 = add a registry dim + a prompt here). Carries the consent
 * purpose + sensitivity + priority so the selection engine can sequence safely. No screens, no visual
 * flow — this is the data + contract a future UI would render.
 */
import { DECLARED_DIMENSIONS } from '../declared/declared-dimension-registry';
import { DeclaredGroup, DeclaredConsentPurpose, DeclaredValueType } from '../declared/declared-profile.types';

export interface OnboardingQuestion {
  id: string; // === dimensionKey (stable)
  dimensionKey: string;
  group: DeclaredGroup;
  prompt: string; // safe, non-creepy, non-medical
  valueType: DeclaredValueType;
  options?: string[];
  consentPurpose: DeclaredConsentPurpose;
  sensitive: boolean;
  priority: number;
}

/** Safe prompts per dimension key. Every declared dimension MUST have one (asserted in the spec). */
const PROMPTS: Record<string, string> = {
  'context.age_range': 'Which age range are you in? (optional)',
  'context.gender': 'How do you describe your gender? (optional)',
  'context.work_pattern': 'What best describes your typical work pattern?',
  'context.income_band': 'Which household budget band fits you best? (optional, never an exact figure)',
  'context.household_composition': 'Who do you usually cook for?',
  'context.cooks_for_count': 'How many people do you usually cook for?',
  'context.time_at_home': 'Roughly how much time are you home during the day?',
  'context.exercise_frequency': 'How often do you exercise? (optional)',
  'dietary.pattern': 'Which dietary pattern best describes how you eat?',
  'dietary.allergies_intolerances': 'Do you have any allergies or intolerances we should keep out of suggestions?',
  'dietary.hard_dislikes': 'Are there ingredients you never want suggested?',
  'dietary.cultural_constraints': 'Do you follow any cultural or observance-based dietary needs?',
  'goals.primary': 'What are your main goals with food right now?',
  'history.dieted_before': 'Have you followed an eating plan before?',
  'history.researched_nutrition': 'Have you read about nutrition before?',
  'history.knowledge_self_rating': 'How would you rate your own food knowledge?',
  'constraints.weekly_budget_band': 'Which weekly food budget band fits you?',
  'constraints.kitchen_equipment': 'What cooking equipment do you have?',
  'constraints.cooking_skill': 'How would you rate your cooking skill?',
  'constraints.cooking_time_workday': 'How long can you usually cook on a workday?',
  'constraints.cooking_time_weekend': 'How long can you usually cook on a weekend?',
  'constraints.meal_timing_rhythm': 'What is your usual meal rhythm during the day?',
};

export const QUESTION_BANK: readonly OnboardingQuestion[] = DECLARED_DIMENSIONS.map((d) => ({
  id: d.key,
  dimensionKey: d.key,
  group: d.group,
  prompt: PROMPTS[d.key] ?? d.label,
  valueType: d.valueType,
  options: d.options,
  consentPurpose: d.consentPurpose,
  sensitive: d.sensitive,
  priority: d.priority,
}));

const BY_KEY = new Map(QUESTION_BANK.map((q) => [q.dimensionKey, q]));
export const getQuestion = (dimensionKey: string): OnboardingQuestion | undefined => BY_KEY.get(dimensionKey);

/** Every declared dimension must have a question, and every prompt must be non-empty + non-medical. */
export function checkQuestionBankConsistency(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  for (const d of DECLARED_DIMENSIONS) {
    const q = BY_KEY.get(d.key);
    if (!q) issues.push(`missing question for ${d.key}`);
    else if (!q.prompt.trim()) issues.push(`empty prompt for ${d.key}`);
    else if (/\bmedical\b|\bdiagnos|\bdisease\b|\bdisorder\b/i.test(q.prompt)) issues.push(`unsafe prompt wording on ${d.key}`);
  }
  return { ok: issues.length === 0, issues };
}
