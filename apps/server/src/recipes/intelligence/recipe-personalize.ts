/**
 * Recipe personalization cascade (Phase 4) — the deterministic, grounded core of the
 * «POST /recipes/:id/personalize» read. Pure functions only; all DB I/O lives in the service.
 *
 * Honesty contract (PERSONALIZATION_ENGINE_SPEC §5/§6, constraint ب):
 *  - nutrition is recomputed ONLY from source-locked per-100g values × real gram weights; an ingredient
 *    with no resolved nutrition simply doesn't contribute, and the result carries an explicit coverage
 *    flag instead of a fabricated number.
 *  - per-serving values are invariant to the serving count (scaling multiplies weights and servings
 *    together), so we compute from base weights ÷ base servings — no fake precision from scaling.
 */

export const MACROS = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;

// GRIS ingredient names embed their real dictionary id, e.g. «… — ing_lamb_meat_raw». Split them.
const GRIS_ID = /\s*[—–-]\s*(ing_[a-z0-9_]+)\s*$/i;
export function parseGrisName(rawName: unknown): { display: string; ingredientId: string | null } {
  const s = String(rawName ?? '');
  const m = s.match(GRIS_ID);
  return { display: (m ? s.slice(0, m.index) : s).trim(), ingredientId: m ? m[1] : null };
}

export interface NutritionItem {
  weightG: number | null;
  per100g: Record<string, unknown> | null;
}

export interface NutritionResult {
  perServing: Record<string, number> | null;
  coverage: 'full' | 'partial' | 'none';
  resolvedCount: number;
  totalCount: number;
}

/**
 * sumNutrition — Σ(weightG × per100g / 100) over the (already swap/remove-resolved) ingredient list,
 * divided by the base serving count. Returns a per-serving macro map only when coverage is good enough
 * (≥60% of considered ingredients resolved); otherwise perServing is null with an honest coverage flag.
 */
export function sumNutrition(items: NutritionItem[], baseServings: number): NutritionResult {
  const total: Record<string, number> = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let resolved = 0;
  const considered = items.length;
  for (const it of items) {
    if (typeof it.weightG === 'number' && Number.isFinite(it.weightG) && it.per100g && typeof it.per100g === 'object') {
      resolved += 1;
      for (const k of MACROS) {
        const v = Number((it.per100g as Record<string, unknown>)[k]);
        if (Number.isFinite(v)) total[k] += (v * it.weightG) / 100;
      }
    }
  }
  const ratio = considered ? resolved / considered : 0;
  const coverage: NutritionResult['coverage'] = considered === 0 ? 'none' : resolved === considered ? 'full' : ratio >= 0.6 ? 'partial' : 'none';
  if (coverage === 'none' || !baseServings || baseServings <= 0) {
    return { perServing: null, coverage, resolvedCount: resolved, totalCount: considered };
  }
  const perServing: Record<string, number> = {};
  for (const k of MACROS) perServing[k] = Math.round((total[k] / baseServings) * 10) / 10;
  return { perServing, coverage, resolvedCount: resolved, totalCount: considered };
}
