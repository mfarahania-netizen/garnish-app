/**
 * Whole-dish nutrition compute (the capability the founder asked for: «دقیق حساب کنه»).
 *
 * Pure + deterministic. Sums a dish's macros from each ingredient's grams × source-locked per-100g, where
 * grams come from (in trust order) the authored GRIS weightG, then the amount→gram resolver (ingredient-grams).
 *
 * HONESTY GATE (wrong number is worse than blank — mirrors the Persian-nutrition backfill + the meal-plan
 * accuracy line): a per-serving number is returned ONLY when coverage is 'full' — i.e. EVERY calorie-bearing
 * ingredient resolved to trustworthy grams, and the per-serving total is plausible. A to-taste aromatic that
 * can't be grounded is dropped (immaterial); a real-calorie ingredient that can't be grounded BLOCKS the dish
 * (perServing stays null) so the caller refuses precisely instead of inventing a total.
 */
import { resolveGrams, normalizeUnit, parseAmount, GramConversions } from './ingredient-grams';
import { parseGrisName } from './recipe-personalize';

export const MACROS = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
type Macro = (typeof MACROS)[number];

const MIN_RESOLVED = 3; // a real ingredient base, not 1–2 odds and ends
const MIN_KCAL = 20; // below this per serving is almost always an artifact (only aromatics resolved)
const MAX_KCAL = 2000; // above this per serving is almost always an artifact (e.g. a full frying bath counted)
const GLOBAL_TRUST_KCAL = 50; // a generic (global) piece/cup weight is only trusted for ≤ this kcal/100g

// A small SPOON/ml unit is a tiny absolute mass (≤ ~15 g), so a generic factor carries negligible absolute
// error even for a calorie-dense ingredient (1 tbsp of soy sauce / sugar / oil). We therefore trust the global
// factor for these regardless of kcal — the calorie gate only guards LARGE count/cup units («عدد»/«پیمانه»),
// where guessing a piece/cup weight for a dense ingredient really can be wrong.
const SMALL_VOLUME_UNIT = /قاشق|نوک\s*قاشق|میلی\s*لیتر|^ml$|سی\s*سی|^cc$/;

// DEEP-FRY OIL: a frying bath is mostly DISCARDED, not eaten — only ~10% of the fried food's weight is absorbed
// (literature 8–12%). Counting the full authored bath inflates a fried dish 4–5× (a bath is ~1000+ kcal/serving
// of pure oil). So when a dish is fried — flagged by the title OR by a bath-sized total oil amount — we count
// only the absorbed uptake (uptake × the fried solids' weight), exactly as the Persian nutrition backfill does.
const FRY_OIL_UPTAKE = 0.10;
const FRY_OIL_BATH_G = 150; // total oil ≥ this (≈⅔ cup) is a frying bath → uptake model, not the whole amount
const FRY_TITLE = /سوخاری|سرخ[\s‌]?کرده|سرخ[\s‌]?شده|فلافل|سمبوسه|چیپس|پیراشکی|ناگت|تمپورا|کروکت|دونات|بامیه|زولبیا|گوش[\s‌]?فیل/;
const OIL_RE = /روغن|\boil\b/i;
const isOilItem = (ing: DishIngredientInput): boolean => ing.category === 'oil' || OIL_RE.test(ing.name || '');

export interface DishIngredientInput {
  name: string;
  /** parsed numeric amount (use parseAmount upstream); null when unquantified. */
  amount: number | null;
  unit: string | null;
  /** dictionary per-100g (source-locked USDA where present); null when the ingredient carries no nutrition. */
  per100g: Record<string, unknown> | null;
  category: string | null;
  gramConversions: GramConversions | null;
  /** authored GRIS weightG — the strongest grams source; preferred over any conversion. */
  weightG: number | null;
}

export interface DishNutritionResult {
  perServing: Record<Macro, number> | null;
  coverage: 'full' | 'partial' | 'none';
  resolvedCount: number;
  consideredCount: number;
  /** real-calorie ingredients we could not ground (why the dish isn't 'full'). */
  blockers: string[];
  servings: number;
}

// to-taste aromatic / seasoning that can be dropped from the sum without making the number wrong.
const TOTASTE = /به\s*مزه|به\s*مقدار\s*لازم|به\s*دلخواه|به\s*اندازه|اختیار|optional|نوک\s*قاشق/;
const NEG_CAT = new Set(['spice', 'salt', 'herb', 'seasoning', 'leavening']);
const NEG_NAME = /نمک|فلفل|زردچوبه|زعفران|دارچین|هل\b|نعناع|پاپریکا|زنجبیل|آویشن|سماق|زیره|وانیل|جوش\s*شیرین|بکینگ|ادویه/;

function kcalOf(per100g: Record<string, unknown> | null): number | null {
  if (!per100g) return null;
  const v = Number(per100g.calories);
  return Number.isFinite(v) ? v : null;
}

/** A non-contributing ingredient that may be omitted without changing the total meaningfully. */
function isNegligible(ing: DishIngredientInput): boolean {
  const kcal = kcalOf(ing.per100g);
  if (ing.per100g == null) {
    // no nutrition data → only droppable if it's clearly a tiny aromatic/garnish.
    return (ing.category != null && NEG_CAT.has(ing.category)) || NEG_NAME.test(ing.name || '') || TOTASTE.test(`${ing.unit ?? ''} ${ing.name ?? ''}`);
  }
  if (kcal != null && kcal <= 5) return true; // salt, water
  if (ing.category != null && NEG_CAT.has(ing.category)) return true;
  if (NEG_NAME.test(ing.name || '')) return true;
  // an unquantified to-taste aromatic (low-cal) is droppable; a dense unquantified main is NOT (it blocks).
  if ((ing.amount == null || TOTASTE.test(ing.unit ?? '')) && kcal != null && kcal <= 60) return true;
  return false;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/**
 * Compute per-serving macros for a dish. `baseServings` is the recipe's serving count; `opts.friedHint`
 * (derived from the recipe title) forces the deep-fry-oil model. Returns perServing ONLY when coverage ===
 * 'full' and the total is plausible.
 */
export function computeDishNutrition(ingredients: DishIngredientInput[], baseServings: number, opts: { friedHint?: boolean } = {}): DishNutritionResult {
  const servings = baseServings && baseServings > 0 ? baseServings : 0;
  const total: Record<Macro, number> = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  let resolved = 0;
  let considered = 0;
  let solidGrams = 0; // grounded NON-oil weight — the basis for the deep-fry oil-uptake model
  const blockers: string[] = [];
  const oils: { ing: DishIngredientInput; grams: number | null }[] = [];

  const addContribution = (per100g: Record<string, unknown>, grams: number) => { for (const m of MACROS) { const v = Number(per100g[m]); if (Number.isFinite(v)) total[m] += (v * grams) / 100; } };

  for (const ing of ingredients) {
    // strongest grams first: authored GRIS weightG, else the amount→gram resolver.
    const r = typeof ing.weightG === 'number' && Number.isFinite(ing.weightG) && ing.weightG > 0
      ? { grams: ing.weightG, grounded: true }
      : resolveGrams({ amount: ing.amount, unit: ing.unit, gramConversions: ing.gramConversions });
    // oils are handled by the deep-fry model AFTER the solids' weight is known (a frying bath isn't eaten whole).
    if (isOilItem(ing)) { oils.push({ ing, grams: r.grams }); continue; }
    const kcal = kcalOf(ing.per100g);

    // a resolved, trustworthy, real-calorie ingredient → contribute. A generic (non-grounded) factor is trusted
    // when the ingredient is low-calorie OR the unit is a small spoon/ml measure (tiny absolute mass).
    const smallUnit = SMALL_VOLUME_UNIT.test(normalizeUnit(ing.unit));
    const grounded = r.grams != null && (r.grounded || smallUnit || (kcal != null && kcal <= GLOBAL_TRUST_KCAL));
    if (r.grams != null && grounded && ing.per100g) {
      considered += 1;
      resolved += 1;
      solidGrams += r.grams;
      addContribution(ing.per100g as Record<string, unknown>, r.grams);
      continue;
    }

    // not contributing → must be negligible, else it blocks the whole dish.
    if (isNegligible(ing)) continue;
    considered += 1;
    blockers.push(String(ing.name || '?').trim());
  }

  // OIL MODEL: a frying bath (flagged by the title, or by a bath-sized total oil amount) contributes only the
  // ABSORBED uptake (≈10% of the fried solids' weight), never the discarded bath — so a fried dish isn't inflated
  // 4–5×. A small consumed oil (sauté/dressing) counts its authored grams (and blocks if it's an unquantified
  // real-calorie amount). The representative oil per-100g is shared across oils (they're ~identical, ~884 kcal).
  if (oils.length) {
    const oilTotalG = oils.reduce((s, o) => s + (o.grams ?? 0), 0);
    const rep = oils.find((o) => o.ing.per100g)?.ing.per100g ?? null;
    const isBath = Boolean(opts.friedHint) || oilTotalG >= FRY_OIL_BATH_G;
    if (isBath) {
      const countedOilG = FRY_OIL_UPTAKE * solidGrams; // a bath needs no authored amount → never blocks on unquantified oil
      if (rep && countedOilG > 0) { considered += 1; resolved += 1; addContribution(rep as Record<string, unknown>, countedOilG); }
    } else {
      for (const o of oils) {
        if (o.grams != null && o.ing.per100g) { considered += 1; resolved += 1; addContribution(o.ing.per100g as Record<string, unknown>, o.grams); }
        else if (isNegligible(o.ing)) { /* a drizzle «به مزه» → ignore */ }
        else { considered += 1; blockers.push(String(o.ing.name || 'روغن').trim()); } // unquantified real-calorie oil → block
      }
    }
  }

  const ratio = considered ? resolved / considered : 0;
  const coverage: DishNutritionResult['coverage'] = considered === 0 ? 'none' : resolved === considered ? 'full' : ratio >= 0.6 ? 'partial' : 'none';

  // surface a number ONLY when fully grounded, enough ingredients resolved, and the total is plausible.
  let perServing: Record<Macro, number> | null = null;
  if (coverage === 'full' && resolved >= MIN_RESOLVED && servings > 0) {
    const cal = total.calories / servings;
    if (cal >= MIN_KCAL && cal <= MAX_KCAL) {
      perServing = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
      for (const m of MACROS) perServing[m] = round1(total[m] / servings);
    }
  }
  return { perServing, coverage, resolvedCount: resolved, consideredCount: considered, blockers, servings };
}

/** Minimal dictionary row the loader needs per ingredient. */
export interface DishDictRow {
  nutritionPer100g: unknown;
  category: string | null;
  gramConversions: unknown;
}

/**
 * Map an already-fetched recipe (ingredients with ingredientId/amount/unit + gris) and a dictionary map
 * (id → {nutritionPer100g, category, gramConversions}) into the DishIngredientInput[] computeDishNutrition
 * wants, plus the base serving count. Pure — both the chat path and the agentic tool fetch then call this.
 * GRIS weightG (the strongest grams) is preferred per ingredient; the resolver fills the rest from amounts.
 */
export function buildDishInputs(
  recipe: { title?: string | null; servings?: number | null; gris?: unknown; ingredients?: { name?: string | null; ingredientId?: string | null; amount?: string | null; unit?: string | null }[] | null },
  dictById: Map<string, DishDictRow>,
): { inputs: DishIngredientInput[]; servings: number; friedHint: boolean } {
  const gris = (recipe?.gris ?? null) as { ingredients?: unknown[]; glance?: { servings?: number } } | null;
  const grisW = new Map<string, number>();
  const grisArr = Array.isArray(gris?.ingredients) ? (gris!.ingredients as Record<string, unknown>[]) : [];
  for (const gi of grisArr) {
    const id = (typeof gi?.ingredientId === 'string' && gi.ingredientId) || parseGrisName(gi?.name).ingredientId;
    const w = gi?.weightG;
    if (id && typeof w === 'number' && Number.isFinite(w) && w > 0 && !grisW.has(id)) grisW.set(id, w);
  }
  const inputs: DishIngredientInput[] = (recipe?.ingredients ?? []).map((ri) => {
    const d = ri.ingredientId ? dictById.get(ri.ingredientId) ?? null : null;
    return {
      name: String(ri.name ?? ''),
      amount: parseAmount(ri.amount),
      unit: ri.unit ?? null,
      per100g: d && d.nutritionPer100g && typeof d.nutritionPer100g === 'object' ? (d.nutritionPer100g as Record<string, unknown>) : null,
      category: d?.category ?? null,
      gramConversions: (d?.gramConversions ?? null) as GramConversions | null,
      weightG: ri.ingredientId ? grisW.get(ri.ingredientId) ?? null : null,
    };
  });
  const grisServings = typeof gris?.glance?.servings === 'number' && gris.glance.servings > 0 ? gris.glance.servings : null;
  const servings = grisServings ?? (Number(recipe?.servings) > 0 ? Number(recipe.servings) : 4);
  const friedHint = FRY_TITLE.test(String(recipe?.title ?? ''));
  return { inputs, servings, friedHint };
}
