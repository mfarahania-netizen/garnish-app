/**
 * Recommendation shadow scoring-input provider (E18/E43-A7).
 *
 * Assembles a SAFE input object for the A5 scorer from a live recommendation request. Pure given its
 * optional ShadowDataPort (the only IO surface). Never includes raw recipe body/steps, raw user text,
 * AI prompt/output, PII, or medical/protected labels. Never fabricates a real behavioral profile — when
 * the user graph is not available it builds a documented COLD-START fallback graph (low confidence) and
 * the readiness reflects that. Never throws.
 */

import { buildUserFoodIdentityGraph } from '../../behavior-engine/profile/user-food-identity-graph.builder';
import {
  RecommendationCandidate,
  DecisionHistory,
} from '../intelligence/recommendation-decision.types';
import { ShadowScoringInputs } from './recommendation-shadow-runtime.types';
import {
  ShadowRequestContext,
  LiveCandidateLite,
  BuildInputsOptions,
  ShadowInputBundle,
  ShadowInputReadiness,
  GraphSource,
} from './recommendation-shadow-input-provider.types';

const clamp01 = (x: number): number => (Number.isFinite(x) ? (x < 0 ? 0 : x > 1 ? 1 : x) : 0);

/** Whitelist of safe enrichment fields a data port may contribute (never raw body/steps/description). */
function pickSafeEnrichment(e?: LiveCandidateLite): Partial<LiveCandidateLite> {
  if (!e || typeof e !== 'object') return {};
  return {
    title: e.title, cuisineTags: e.cuisineTags, ingredientTags: e.ingredientTags,
    estimatedEffort: e.estimatedEffort, estimatedTimeMinutes: e.estimatedTimeMinutes,
    skillLevel: e.skillLevel, mealSlot: e.mealSlot, safetyFlags: e.safetyFlags,
  };
}

/** Map a live candidate to a safe RecommendationCandidate (safe fields only — never raw body/steps). */
function toSafeCandidate(c: LiveCandidateLite, i: number): RecommendationCandidate {
  return {
    candidateId: `live_${i}_${c.recipeId}`,
    recipeId: c.recipeId,
    title: typeof c.title === 'string' && c.title.length <= 120 ? c.title : undefined,
    cuisineTags: Array.isArray(c.cuisineTags) ? c.cuisineTags.slice(0, 8).filter((t) => typeof t === 'string') : undefined,
    ingredientTags: Array.isArray(c.ingredientTags) ? c.ingredientTags.slice(0, 12).filter((t) => typeof t === 'string') : undefined,
    estimatedEffort: c.estimatedEffort,
    estimatedTimeMinutes: Number.isFinite(Number(c.estimatedTimeMinutes)) ? Number(c.estimatedTimeMinutes) : undefined,
    skillLevel: c.skillLevel,
    mealSlot: c.mealSlot,
    safetyFlags: Array.isArray(c.safetyFlags) ? c.safetyFlags.filter((t) => typeof t === 'string') : undefined,
    source: 'recipe_catalog',
  };
}

function metadataCompleteness(cands: RecommendationCandidate[]): number {
  if (!cands.length) return 0;
  let score = 0;
  for (const c of cands) {
    const fields = [c.estimatedEffort, c.skillLevel, c.mealSlot, c.cuisineTags?.length];
    score += fields.filter((f) => f !== undefined && f !== null).length / fields.length;
  }
  return clamp01(score / cands.length);
}

/**
 * Build safe shadow scoring inputs + readiness for a request. Async (awaits the optional data port).
 * Never throws — on any fault returns a not_ready bundle so the live request is unaffected.
 */
export async function buildRecommendationShadowInputs(
  requestContext: ShadowRequestContext,
  liveCandidates: LiveCandidateLite[],
  options: BuildInputsOptions = {},
): Promise<ShadowInputBundle> {
  const now = options.now ?? new Date();
  const port = options.dataPort;
  const available: string[] = [];
  const missing: string[] = [];

  try {
    const userId = requestContext?.userId || '';
    const live = (Array.isArray(liveCandidates) ? liveCandidates : []).filter((c) => c && typeof c.recipeId === 'string');

    // ── consent (never fabricated) ──
    let consent = requestContext?.consent;
    if (!consent && port?.getConsent) consent = (await port.getConsent(userId)) ?? undefined;
    const consentOk = consent?.behavioralAnalytics === true;
    if (consentOk) available.push('consent'); else missing.push('consent');

    // ── candidate metadata ──
    let metaList: LiveCandidateLite[] = live;
    if (port?.getCandidateMetadata) {
      try {
        const enriched = await port.getCandidateMetadata(live.map((c) => c.recipeId));
        if (Array.isArray(enriched) && enriched.length) {
          const byId = new Map(enriched.map((e) => [e.recipeId, e]));
          // defense-in-depth: whitelist enrichment fields so a buggy/future data port that returns
          // unexpected keys (e.g. raw description/body) can NEVER reach the candidate object.
          metaList = live.map((c) => ({ ...c, ...pickSafeEnrichment(byId.get(c.recipeId)) }));
        }
      } catch { /* fall back to live-only metadata */ }
    }
    const candidates = metaList.map(toSafeCandidate);
    if (candidates.length) available.push('candidates'); else missing.push('candidates');
    const metaComplete = metadataCompleteness(candidates);
    if (metaComplete >= 0.5) available.push('candidateMetadata'); else missing.push('candidateMetadata');

    // ── graph (provided or cold-start fallback; never fabricated) ──
    let graph = port?.getUserGraph ? await safeGetGraph(port, userId) : null;
    let graphSource: GraphSource = 'provided';
    if (!graph) {
      graph = buildUserFoodIdentityGraph([], { userId: userId || 'shadow', now, mode: 'offline_eval' }).graph!;
      graphSource = 'cold_start_fallback';
      missing.push('userFoodIdentityGraph');
    } else {
      available.push('userFoodIdentityGraph');
    }

    // ── history (bounded records or empty) ──
    let history: DecisionHistory = { exposures: [], outcomes: [] };
    if (port?.getHistory) {
      try {
        const h = await port.getHistory(userId);
        if (h && Array.isArray(h.exposures) && Array.isArray(h.outcomes)) history = h;
      } catch { /* empty history */ }
    }
    if (history.exposures.length) available.push('exposureHistory'); else missing.push('exposureHistory');
    if (history.outcomes.length) available.push('outcomeHistory'); else missing.push('outcomeHistory');

    // ── confidence + readiness ──
    const graphConf = graphSource === 'provided' ? (graph.confidence?.overall ?? 0) : 0;
    const confidence = clamp01(
      0.4 * graphConf +
      0.25 * metaComplete +
      0.15 * (history.exposures.length ? 1 : 0) +
      0.15 * (history.outcomes.length ? 1 : 0) +
      0.05 * (candidates.length ? 1 : 0),
    );

    const inputs: ShadowScoringInputs = { graph, candidates, history };
    const readiness = computeReadiness({ consentOk, candidateCount: candidates.length, graphSource, confidence, available, missing });

    return {
      inputs: readiness.canScore ? inputs : null,
      readiness,
      consent,
      context: requestContext?.context,
      graphSource,
    };
  } catch {
    return {
      inputs: null,
      readiness: { status: 'not_ready', missingInputs: ['internal_error'], availableInputs: available, confidence: 0, canScore: false, canPersistTrace: false, reason: 'input provider internal error (handled; no throw)' },
      graphSource: 'cold_start_fallback',
    };
  }
}

async function safeGetGraph(port: NonNullable<BuildInputsOptions['dataPort']>, userId: string) {
  try { return (await port.getUserGraph!(userId)) ?? null; } catch { return null; }
}

function computeReadiness(args: {
  consentOk: boolean;
  candidateCount: number;
  graphSource: GraphSource;
  confidence: number;
  available: string[];
  missing: string[];
}): ShadowInputReadiness {
  const { consentOk, candidateCount, graphSource, confidence, available, missing } = args;
  // consent is a hard gate: no consent → cannot score (no silent fabrication).
  if (!consentOk) {
    return { status: 'not_ready', missingInputs: missing, availableInputs: available, confidence, canScore: false, canPersistTrace: false, reason: 'behavioral-analytics consent missing — shadow scoring not permitted.' };
  }
  if (candidateCount === 0) {
    return { status: 'not_ready', missingInputs: missing, availableInputs: available, confidence, canScore: false, canPersistTrace: false, reason: 'no candidates available to score.' };
  }
  // consent + candidates present → can run shadow scoring (partial inputs are OK and safe).
  const fullGraph = graphSource === 'provided';
  const status = fullGraph && confidence >= 0.5 ? 'ready_shadow' : 'partial';
  return {
    status,
    missingInputs: missing,
    availableInputs: available,
    confidence,
    canScore: true,
    canPersistTrace: true,
    reason: status === 'ready_shadow'
      ? 'Full inputs available; shadow scoring + redacted trace permitted (still product-disabled).'
      : 'Partial inputs (cold-start/low-history); shadow scoring runs at lowered confidence (product-disabled).',
  };
}
