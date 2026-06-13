import { Injectable } from '@nestjs/common';
import { AiTool, ToolContext } from '../ai-core.types';

/**
 * get_user_food_context (E47-A4) — read-only, PII-free, NON-sensitive only.
 * Reads from the orchestrator-built BehavioralContextSnapshot (already safe). Defensively strips any
 * sensitive-looking preference keys; never infers health/allergy/disease/diagnosis/weight intent;
 * returns empty arrays when nothing is stored. No PII beyond the opaque userId.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /allerg/i,
  /health/i,
  /medical|medicine|medication/i,
  /diagnos|disease|condition|symptom/i,
  /diabet|cholesterol|insulin/i,
  /blood[_-]?(pressure|sugar)/i,
  /weight|calorie|bmi/i,
  /pregnan|fertility/i,
];

@Injectable()
export class GetUserFoodContextTool implements AiTool {
  readonly name = 'get_user_food_context';
  readonly description = "Return a PII-free, non-sensitive view of the user's food context. Read-only.";
  readonly inputSchema = {};

  async handler(_input: Record<string, unknown>, ctx: ToolContext) {
    const snap = ctx?.snapshot;
    const rawPrefs =
      snap?.preferences && typeof snap.preferences === 'object' && !Array.isArray(snap.preferences)
        ? (snap.preferences as Record<string, unknown>)
        : {};
    const preferences: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawPrefs)) {
      if (value == null) continue;
      if (SENSITIVE_KEY_PATTERNS.some((re) => re.test(key))) continue; // exclude sensitive
      preferences[key] = value;
    }
    return {
      tool: this.name,
      userId: ctx?.userId ?? null,
      locale: snap?.locale ?? 'fa',
      preferences,
      recentSignals: [] as unknown[], // no stored safe signals yet (behavior engine: later phase)
      contextStatus: Object.keys(preferences).length ? 'partial' : 'limited',
    };
  }
}
