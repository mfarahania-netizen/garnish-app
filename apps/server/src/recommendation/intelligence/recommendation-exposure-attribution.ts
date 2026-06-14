/**
 * Recommendation exposure attribution (E18/E43-A5) — pure, no DB writes, no network.
 *
 * Turns exposure history into a per-recipe fatigue/repeat-penalty summary used by the shadow scorer.
 * Deterministic; never throws on bad input; no raw payloads.
 */

import { ExposureRecord, ExposureAttribution } from './recommendation-decision.types';

const round4 = (x: number): number => Math.round(x * 10000) / 10000;
const clamp01 = (x: number): number => (Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0);
const DAY = 86_400_000;

export interface ExposureAttributionInput {
  exposures: ExposureRecord[];
  recipeId: string;
  now?: Date;
  recentWindowDays?: number;
  /** number of recent exposures at which fatigue saturates (default 5). */
  fatigueSaturation?: number;
}

/** Build the per-recipe exposure attribution. */
export function buildExposureAttribution(input: ExposureAttributionInput): ExposureAttribution {
  const now = input.now ?? new Date();
  const windowMs = (input.recentWindowDays ?? 7) * DAY;
  const sat = Math.max(1, input.fatigueSaturation ?? 5);
  const rows = (Array.isArray(input.exposures) ? input.exposures : []).filter((e) => e && e.recipeId === input.recipeId);

  const bySurface: Record<string, number> = {};
  let recent = 0;
  const ids: string[] = [];
  for (const e of rows) {
    bySurface[e.surface] = (bySurface[e.surface] || 0) + 1;
    const t = Date.parse(e.shownAt);
    if (Number.isFinite(t) && now.getTime() - t <= windowMs) recent++;
    ids.push(e.exposureId);
  }

  // repeat penalty saturates with recent exposures; fatigue adds a small surface-concentration term.
  const repeatExposurePenalty = round4(clamp01(recent / (sat * 2)));
  const surfaces = Object.keys(bySurface).length || 1;
  const concentration = rows.length > 0 ? clamp01((Math.max(0, ...Object.values(bySurface)) / rows.length) / surfaces) : 0;
  const fatigueScore = round4(clamp01(0.75 * (recent / sat) + 0.25 * concentration));

  return {
    recipeId: input.recipeId,
    totalExposures: rows.length,
    recentExposures: recent,
    bySurface,
    repeatExposurePenalty,
    fatigueScore,
    exposureIdsUsed: ids.sort(),
  };
}

/** Convenience: build attribution for many recipes at once (keyed by recipeId). */
export function buildExposureAttributionMap(
  exposures: ExposureRecord[],
  recipeIds: string[],
  now?: Date,
  recentWindowDays?: number,
): Record<string, ExposureAttribution> {
  const out: Record<string, ExposureAttribution> = {};
  for (const recipeId of recipeIds) out[recipeId] = buildExposureAttribution({ exposures, recipeId, now, recentWindowDays });
  return out;
}
