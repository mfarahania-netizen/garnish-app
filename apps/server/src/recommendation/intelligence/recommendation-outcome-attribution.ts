/**
 * Recommendation outcome attribution (E18/E43-A5) — pure, no DB writes, no network.
 *
 * Turns outcome history (click/save/dismiss/cook/share/feedback) into a per-recipe feedback summary
 * for the shadow scorer. Deterministic; never throws; no raw payloads.
 */

import { OutcomeEvent, OutcomeAttribution } from './recommendation-decision.types';

const round4 = (x: number): number => Math.round(x * 10000) / 10000;
const clamp = (x: number, lo: number, hi: number): number => (Number.isFinite(x) ? (x < lo ? lo : x > hi ? hi : x) : 0);
const DAY = 86_400_000;

export interface OutcomeAttributionInput {
  outcomes: OutcomeEvent[];
  recipeId: string;
  now?: Date;
  outcomeWindowDays?: number;
  recencyHalfLifeDays?: number;
  dismissSaturation?: number;
}

export function buildOutcomeAttribution(input: OutcomeAttributionInput): OutcomeAttribution {
  const now = input.now ?? new Date();
  const windowMs = (input.outcomeWindowDays ?? 30) * DAY;
  const halfLife = input.recencyHalfLifeDays ?? 30;
  const dismissSat = Math.max(1, input.dismissSaturation ?? 3);
  const rows = (Array.isArray(input.outcomes) ? input.outcomes : []).filter((o) => {
    if (!o || o.recipeId !== input.recipeId) return false;
    const t = Date.parse(o.occurredAt);
    return Number.isFinite(t) && now.getTime() - t <= windowMs;
  });

  const c = { click: 0, save: 0, dismiss: 0, cook_complete: 0, share_private: 0, feedback_positive: 0, feedback_negative: 0 };
  let latestMs = NaN;
  const ids: string[] = [];
  for (const o of rows) {
    if (o.type in c) (c as any)[o.type]++;
    const t = Date.parse(o.occurredAt);
    if (!Number.isFinite(latestMs) || t > latestMs) latestMs = t;
    ids.push(o.outcomeId);
  }

  const positive = c.feedback_positive + c.save + c.share_private + 1.5 * c.cook_complete;
  const negative = c.feedback_negative + c.dismiss;
  const totalSignal = positive + negative;
  const feedbackScore = totalSignal > 0 ? round4(clamp((positive - negative) / totalSignal, -1, 1)) : 0;

  const engagement = c.click + c.save + c.cook_complete;
  const cookConversionScore = engagement > 0 ? round4(clamp(c.cook_complete / engagement, 0, 1)) : 0;
  const dismissPenalty = round4(clamp(c.dismiss / (dismissSat * 2), 0, 1));

  const ageDays = Number.isFinite(latestMs) ? Math.max(0, (now.getTime() - latestMs) / DAY) : Infinity;
  const recencyScore = Number.isFinite(ageDays) ? round4(clamp(Math.pow(0.5, ageDays / halfLife), 0, 1)) : 0;

  return {
    recipeId: input.recipeId,
    saves: c.save,
    dismisses: c.dismiss,
    cooks: c.cook_complete,
    clicks: c.click,
    positiveFeedback: c.feedback_positive,
    negativeFeedback: c.feedback_negative,
    feedbackScore,
    cookConversionScore,
    dismissPenalty,
    recencyScore,
    outcomeIdsUsed: ids.sort(),
  };
}

export function buildOutcomeAttributionMap(
  outcomes: OutcomeEvent[],
  recipeIds: string[],
  now?: Date,
  outcomeWindowDays?: number,
): Record<string, OutcomeAttribution> {
  const out: Record<string, OutcomeAttribution> = {};
  for (const recipeId of recipeIds) out[recipeId] = buildOutcomeAttribution({ outcomes, recipeId, now, outcomeWindowDays });
  return out;
}
