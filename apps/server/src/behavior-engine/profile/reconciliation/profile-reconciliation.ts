/**
 * Cross-layer Profile Reconciliation (GARNISH-PROFILE-UNIFY-06) — pure, deterministic, ADDITIVE.
 *
 * The actual point of unification: where DECLARED (what the user says) and OBSERVED (what the user does,
 * the existing UserFoodIdentityGraph) overlap, compute a reconciled view that
 *   - surfaces AGREEMENT (both lean the same way → higher confidence),
 *   - surfaces CONFLICT WITHOUT ERASING either side (e.g. declares vegetarian but observed opens
 *     chicken → `declared_observed_conflict`, both evidences preserved, safe explanation, NO auto-overwrite),
 *   - applies a conservative precedence policy: SAFETY-CRITICAL declared facts (allergies, hard dietary
 *     restrictions) are ALWAYS respected regardless of observed behavior; soft preferences blend by
 *     confidence. Reuses the existing conflict-resolution philosophy (never erase evidence; safe limitations).
 *
 * It reads the observed graph BY REFERENCE and never mutates it (composition, not mutation). It never
 * emits sensitive demographic values (age/income/gender/etc.) — it only reconciles dietary/allergy/
 * effort/skill overlaps.
 */
import { DeclaredProfile } from '../declared/declared-profile.types';
import { UserFoodIdentityGraph } from '../user-food-identity-graph.types';

export type ReconciledStatus = 'agreement' | 'declared_observed_conflict' | 'declared_only' | 'observed_only' | 'unknown';
export type ReconciledPrecedence = 'declared_safety' | 'blend' | 'observed';

export interface ReconciledDimension {
  key: string;
  status: ReconciledStatus;
  precedence: ReconciledPrecedence;
  safetyCritical: boolean;
  /** the value downstream features should use (safety-critical ⇒ always the declared value). */
  reconciledValue: unknown;
  declared: { value: unknown; confidence: number } | null;
  observed: { value: unknown; confidence: number; evidence: string[] } | null;
  confidence: number;
  safeExplanation: string;
  /** true whenever both sides existed and BOTH are preserved (never erased). */
  preservesBothEvidences: boolean;
}

export interface ReconciliationResult {
  version: 1;
  dimensions: Record<string, ReconciledDimension>;
  summary: { agreements: number; conflicts: number; declaredOnly: number; observedOnly: number };
  /** ALWAYS true: a declared allergy / hard restriction is never overridden by observed behavior. */
  safetyAlwaysRespected: true;
  limitations: string[];
}

const MEAT_TOKENS = ['chicken', 'beef', 'lamb', 'pork', 'meat', 'poultry', 'fish', 'seafood', 'shrimp', 'مرغ', 'گوشت', 'ماهی', 'میگو', 'گوسفند'];
const DIETARY_RESTRICTIONS = new Set(['vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher']);
const QUICK_BANDS = new Set(['under_15', '15_30']);
const SLOW_BANDS = new Set(['30_60', '60_plus']);

function declaredDim(p: DeclaredProfile, key: string) {
  const d = p.dimensions[key];
  if (!d || (d.status !== 'declared' && d.status !== 'stale')) return null;
  return { value: d.value, confidence: d.confidence };
}
function tokenHit(tokens: unknown, set: string[]): string[] {
  const arr = Array.isArray(tokens) ? tokens.map((t) => String(t).toLowerCase()) : [];
  return arr.filter((t) => set.some((m) => t.includes(m.toLowerCase())));
}

/** Reconcile declared ⊕ observed. observed may be null (cold-start) — handled gracefully. */
export function reconcileProfile(declared: DeclaredProfile, observed: UserFoodIdentityGraph | null): ReconciliationResult {
  const dims: Record<string, ReconciledDimension> = {};
  const taste: any = observed?.dimensions?.taste ?? null;
  const effort: any = observed?.dimensions?.effort ?? null;
  const skill: any = observed?.dimensions?.skill ?? null;

  // ── 1) dietary_pattern (declared dietary.pattern ⊕ observed taste lean) ──
  {
    const dec = declaredDim(declared, 'dietary.pattern');
    const meatHits = taste ? tokenHit(taste.ingredientAffinities, MEAT_TOKENS) : [];
    const observedMeatInclusive = taste && taste.status !== 'empty' && meatHits.length > 0;
    const obs = taste && taste.status !== 'empty'
      ? { value: observedMeatInclusive ? 'meat_inclusive' : 'plant_forward', confidence: taste.confidence ?? 0, evidence: meatHits }
      : null;
    const isRestriction = dec ? DIETARY_RESTRICTIONS.has(String(dec.value)) : false;
    let status: ReconciledStatus = 'unknown';
    let explanation = '';
    if (dec && obs) {
      if (isRestriction && observedMeatInclusive) {
        status = 'declared_observed_conflict';
        explanation = `You declared a "${dec.value}" pattern; we also noticed some opens of meat-containing recipes. Your declared restriction is always respected for filtering — this is surfaced, not overridden.`;
      } else {
        status = 'agreement';
        explanation = `Your declared pattern and your browsing behavior are consistent.`;
      }
    } else if (dec) {
      status = 'declared_only';
      explanation = `Based on your declared dietary pattern.`;
    } else if (obs) {
      status = 'observed_only';
      explanation = `Inferred from browsing behavior only; you have not declared a dietary pattern.`;
    }
    dims['dietary_pattern'] = {
      key: 'dietary_pattern',
      status,
      precedence: isRestriction ? 'declared_safety' : dec ? 'blend' : 'observed',
      safetyCritical: isRestriction,
      reconciledValue: dec ? dec.value : obs ? obs.value : null, // declared restriction always wins
      declared: dec,
      observed: obs,
      confidence: Number(Math.max(dec?.confidence ?? 0, status === 'agreement' ? obs?.confidence ?? 0 : 0).toFixed(3)),
      safeExplanation: explanation,
      preservesBothEvidences: Boolean(dec && obs),
    };
  }

  // ── 2) allergies (SAFETY-CRITICAL: declared ALWAYS respected; observed NEVER overrides) ──
  {
    const dec = declaredDim(declared, 'dietary.allergies_intolerances');
    const declaredAllergens = Array.isArray(dec?.value) ? (dec!.value as unknown[]).map((x) => String(x)) : [];
    const engagement = taste && declaredAllergens.length ? tokenHit(taste.ingredientAffinities, declaredAllergens) : [];
    const obs = engagement.length ? { value: 'observed_engagement_with_allergen', confidence: taste?.confidence ?? 0, evidence: engagement } : null;
    let status: ReconciledStatus = dec ? (obs ? 'declared_observed_conflict' : 'declared_only') : 'unknown';
    const explanation = obs
      ? `You declared allergies/intolerances; related behavior does not override them in Garnish filtering. This is informational, not a safety guarantee; check every ingredient list.`
      : dec
        ? `Declared allergies/intolerances take precedence in Garnish filtering. This is informational, not a safety guarantee; check every ingredient list.`
        : '';
    dims['allergies'] = {
      key: 'allergies',
      status,
      precedence: 'declared_safety',
      safetyCritical: true,
      reconciledValue: declaredAllergens, // ALWAYS the declared set — never removed by observed behavior
      declared: dec,
      observed: obs,
      confidence: dec ? 1 : 0, // a declared allergy is a hard constraint (full confidence as a constraint)
      safeExplanation: explanation,
      preservesBothEvidences: Boolean(dec && obs),
    };
  }

  // ── 3) effort (declared cooking_time_workday ⊕ observed effort.quickMealPreference) — soft blend ──
  {
    const dec = declaredDim(declared, 'constraints.cooking_time_workday');
    const decQuick = dec ? QUICK_BANDS.has(String(dec.value)) : null;
    const decSlow = dec ? SLOW_BANDS.has(String(dec.value)) : null;
    const obsQuickPref = effort && effort.status !== 'empty' ? Number(effort.quickMealPreference ?? 0) : null;
    const obs = obsQuickPref != null ? { value: obsQuickPref >= 0.4 ? 'prefers_quick' : 'tolerates_longer', confidence: effort.confidence ?? 0, evidence: ['effort.quick_meal_preference'] } : null;
    let status: ReconciledStatus = 'unknown';
    if (dec && obs) {
      const obsQuick = obs.value === 'prefers_quick';
      status = (decQuick && obsQuick) || (decSlow && !obsQuick) ? 'agreement' : 'declared_observed_conflict';
    } else if (dec) status = 'declared_only';
    else if (obs) status = 'observed_only';
    dims['effort'] = {
      key: 'effort',
      status,
      precedence: 'blend',
      safetyCritical: false,
      reconciledValue: dec ? dec.value : obs ? obs.value : null,
      declared: dec,
      observed: obs,
      confidence: Number((((dec?.confidence ?? 0) + (obs?.confidence ?? 0)) / (dec && obs ? 2 : 1) || 0).toFixed(3)),
      safeExplanation: status === 'declared_observed_conflict' ? 'Your stated cooking time and your observed pace differ; we blend them and lean on your stated time on workdays.' : status === 'agreement' ? 'Your stated cooking time matches your observed pace.' : status === 'declared_only' ? 'Based on your stated workday cooking time.' : status === 'observed_only' ? 'Inferred from your observed cooking pace.' : '',
      preservesBothEvidences: Boolean(dec && obs),
    };
  }

  // ── 4) skill (declared cooking_skill ⊕ observed skill dimension) — soft blend ──
  {
    const dec = declaredDim(declared, 'constraints.cooking_skill');
    const obs = skill && skill.status !== 'empty' ? { value: skill.status, confidence: skill.confidence ?? 0, evidence: ['skill'] } : null;
    let status: ReconciledStatus = dec && obs ? 'agreement' : dec ? 'declared_only' : obs ? 'observed_only' : 'unknown';
    // a genuine mismatch (declared beginner but observed strong technique) is a soft conflict
    if (dec && obs && ((String(dec.value) === 'beginner' && (skill.techniqueConfidence ?? 0) >= 0.6) || (String(dec.value) === 'advanced' && (skill.techniqueConfidence ?? 0) <= 0.1 && obs.confidence >= 0.4))) {
      status = 'declared_observed_conflict';
    }
    dims['skill'] = {
      key: 'skill',
      status,
      precedence: 'blend',
      safetyCritical: false,
      reconciledValue: dec ? dec.value : obs ? obs.value : null,
      declared: dec,
      observed: obs,
      confidence: Number((((dec?.confidence ?? 0) + (obs?.confidence ?? 0)) / (dec && obs ? 2 : 1) || 0).toFixed(3)),
      safeExplanation: status === 'declared_observed_conflict' ? 'Your stated skill and your observed cooking differ; we blend them as you build a track record.' : status === 'declared_only' ? 'Based on your stated cooking skill.' : status === 'observed_only' ? 'Inferred from your observed cooking.' : status === 'agreement' ? 'Stated and observed skill are consistent.' : '',
      preservesBothEvidences: Boolean(dec && obs),
    };
  }

  const vals = Object.values(dims);
  return {
    version: 1,
    dimensions: dims,
    summary: {
      agreements: vals.filter((d) => d.status === 'agreement').length,
      conflicts: vals.filter((d) => d.status === 'declared_observed_conflict').length,
      declaredOnly: vals.filter((d) => d.status === 'declared_only').length,
      observedOnly: vals.filter((d) => d.status === 'observed_only').length,
    },
    safetyAlwaysRespected: true,
    limitations: ['Reconciliation surfaces conflicts without erasing either side; declared safety constraints (allergies, hard dietary restrictions) always win.'],
  };
}
