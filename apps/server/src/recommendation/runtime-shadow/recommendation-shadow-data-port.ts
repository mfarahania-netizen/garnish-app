/**
 * Prisma-backed ShadowDataPort (E18/E43-A7).
 *
 * The ONLY runtime IO surface for the shadow input provider. All reads are bounded and read-only; it
 * returns SAFE candidate metadata (no recipe body/steps) and bounded exposure/outcome history. The user
 * graph is intentionally returned as null (not persisted → the provider builds a cold-start fallback);
 * consent is returned as null (never fabricated — it must be supplied by the request). Used ONLY when
 * shadow mode is enabled; in default-off mode the service never calls it.
 */

import {
  ShadowDataPort,
  LiveCandidateLite,
} from './recommendation-shadow-input-provider.types';
import { DecisionHistory } from '../intelligence/recommendation-decision.types';

const MAX_CANDIDATES = 200;
const MAX_HISTORY = 200;

/** Minimal Prisma surface used here (keeps this adapter unit-testable). */
export interface ShadowReadPrisma {
  recipe: { findMany(args: any): Promise<any[]> };
  recommendationExposure?: { findMany(args: any): Promise<any[]> };
  recommendationAttributionEvent?: { findMany(args: any): Promise<any[]> };
}

const EFFORT_BY_DIFFICULTY: Record<string, LiveCandidateLite['estimatedEffort']> = {
  very_easy: 'very_low', easy: 'low', simple: 'low', medium: 'medium', intermediate: 'medium',
  hard: 'high', difficult: 'high', advanced: 'high', expert: 'very_high', very_hard: 'very_high',
};
const SKILL_BY_DIFFICULTY: Record<string, LiveCandidateLite['skillLevel']> = {
  very_easy: 'beginner', easy: 'beginner', simple: 'beginner', medium: 'intermediate', intermediate: 'intermediate',
  hard: 'advanced', difficult: 'advanced', advanced: 'advanced', expert: 'advanced', very_hard: 'advanced',
};

function parseJsonArray(s: unknown): string[] {
  if (Array.isArray(s)) return s.filter((x) => typeof x === 'string');
  if (typeof s === 'string') { try { const v = JSON.parse(s); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } }
  return [];
}

export function createPrismaShadowDataPort(prisma: ShadowReadPrisma): ShadowDataPort {
  return {
    async getCandidateMetadata(recipeIds: string[]): Promise<LiveCandidateLite[]> {
      const ids = (Array.isArray(recipeIds) ? recipeIds : []).slice(0, MAX_CANDIDATES);
      if (!ids.length) return [];
      const rows = await prisma.recipe.findMany({
        where: { id: { in: ids } },
        // SAFE projection only — NEVER select description/steps/body.
        select: { id: true, title: true, region: true, difficulty: true, cookingTime: true, mealType: true, allergens: true },
      });
      return rows.map((r) => {
        const diff = String(r.difficulty || '').toLowerCase();
        return {
          recipeId: r.id,
          title: typeof r.title === 'string' && r.title.length <= 120 ? r.title : undefined,
          cuisineTags: r.region ? [String(r.region)] : undefined,
          estimatedEffort: EFFORT_BY_DIFFICULTY[diff],
          estimatedTimeMinutes: Number.isFinite(Number(r.cookingTime)) ? Number(r.cookingTime) : undefined,
          skillLevel: SKILL_BY_DIFFICULTY[diff],
          mealSlot: parseJsonArray(r.mealType)[0] as LiveCandidateLite['mealSlot'],
          safetyFlags: parseJsonArray(r.allergens).length ? ['has_allergens'] : undefined,
        };
      });
    },

    // graph is not persisted → provider builds a documented cold-start fallback.
    async getUserGraph(): Promise<null> { return null; },

    async getHistory(userId: string): Promise<DecisionHistory | null> {
      if (!userId) return null;
      const history: DecisionHistory = { exposures: [], outcomes: [] };
      try {
        if (prisma.recommendationExposure) {
          const exps = await prisma.recommendationExposure.findMany({ where: { userId }, take: MAX_HISTORY, orderBy: { createdAt: 'desc' }, select: { id: true, recipeId: true, createdAt: true } });
          history.exposures = exps.map((e, i) => ({ exposureId: String(e.id ?? `exp_${i}`), userId, recipeId: String(e.recipeId), surface: 'home', shownAt: (e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt)), rank: 1, reasonCodes: [] }));
        }
      } catch { /* bounded best-effort */ }
      return history;
    },

    // consent is never fabricated here — it must come from the request context.
    async getConsent(): Promise<null> { return null; },
  };
}
